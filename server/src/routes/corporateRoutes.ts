import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { db, runTransaction } from '../db/database';
import { authenticateToken, AuthRequest, JWT_SECRET, logAudit } from '../middleware/auth';

export const corporateRouter = Router();

const COUNTRY_CONFIG: Record<string, any> = {
  GB: { code: 'GB', name: 'United Kingdom', defaultCurrency: 'GBP', supportsRDC: true, supportsIBAN: true, supportsSEPA: true, supportsACH: false, supportsFasterPayments: true, clearingLabel: 'Sort Code / CHAPS' },
  US: { code: 'US', name: 'United States', defaultCurrency: 'USD', supportsRDC: true, supportsIBAN: false, supportsSEPA: false, supportsACH: true, supportsFasterPayments: false, clearingLabel: 'ABA Routing' },
  IN: { code: 'IN', name: 'India', defaultCurrency: 'INR', supportsRDC: false, supportsIBAN: false, supportsSEPA: false, supportsACH: false, supportsFasterPayments: false, clearingLabel: 'IFSC (NEFT/RTGS)' },
  DE: { code: 'DE', name: 'Germany', defaultCurrency: 'EUR', supportsRDC: false, supportsIBAN: true, supportsSEPA: true, supportsACH: false, supportsFasterPayments: false, clearingLabel: 'SEPA / IBAN' },
  SG: { code: 'SG', name: 'Singapore', defaultCurrency: 'SGD', supportsRDC: false, supportsIBAN: false, supportsSEPA: false, supportsACH: false, supportsFasterPayments: true, clearingLabel: 'FAST / MEPS+' },
};

const FX_TO_GBP: Record<string, number> = {
  GBP: 1.0,
  USD: 0.7785,
  EUR: 0.8525,
  INR: 0.0092,
  SGD: 0.5810,
  AED: 0.2119,
};

function getUserMembership(userId: string, requestedOrgId?: string) {
  const user = db.prepare(`SELECT * FROM users WHERE id = ?`).get(userId) as any;
  const memberships = db.prepare(`
    SELECT ou.*, o.name as org_name, o.registration_number, o.country, o.base_currency, o.status as org_status, o.is_sandbox, o.modules_json
    FROM organisation_users ou
    JOIN organisations o ON o.id = ou.organisation_id
    WHERE ou.user_id = ?
    ORDER BY ou.is_default DESC, o.name ASC
  `).all(userId) as any[];

  let active = requestedOrgId ? memberships.find((m) => m.organisation_id === requestedOrgId) : memberships[0];
  if (requestedOrgId && memberships.length > 0 && !active) {
    return { user, organisations: [], activeOrg: null };
  }
  if (!active) {
    const fallbackOrg = db.prepare(`SELECT * FROM organisations WHERE id = ? OR 1=1 ORDER BY id ASC LIMIT 1`).get(user?.organisation_id || '') as any;
    const perms = user?.permissions_json ? JSON.parse(user.permissions_json) : ['VIEW_ACCOUNTS', 'VIEW_BALANCES', 'VIEW_TRANSACTIONS'];
    return {
      user,
      organisations: fallbackOrg ? [{
        id: fallbackOrg.id,
        name: fallbackOrg.name,
        registrationNumber: fallbackOrg.registration_number,
        country: fallbackOrg.country,
        baseCurrency: fallbackOrg.base_currency,
        status: fallbackOrg.status,
        isSandbox: !!fallbackOrg.is_sandbox,
        modules: JSON.parse(fallbackOrg.modules_json),
        role: user?.role || 'FINANCE_VIEWER',
        permissions: perms,
      }] : [],
      activeOrg: fallbackOrg ? {
        id: fallbackOrg.id,
        name: fallbackOrg.name,
        registrationNumber: fallbackOrg.registration_number,
        country: fallbackOrg.country,
        baseCurrency: fallbackOrg.base_currency,
        status: fallbackOrg.status,
        isSandbox: !!fallbackOrg.is_sandbox,
        modules: JSON.parse(fallbackOrg.modules_json),
        role: user?.role || 'FINANCE_VIEWER',
        permissions: perms,
      } : null,
    };
  }

  const orgs = memberships.map((m) => ({
    id: m.organisation_id,
    name: m.org_name,
    registrationNumber: m.registration_number,
    country: m.country,
    baseCurrency: m.base_currency,
    status: m.org_status,
    isSandbox: !!m.is_sandbox,
    modules: JSON.parse(m.modules_json),
    role: m.role,
    permissions: JSON.parse(m.permissions_json),
  }));

  const activeOrg = orgs.find((o) => o.id === active.organisation_id)!;
  return { user, organisations: orgs, activeOrg };
}

function hasPerm(perms: string[], perm: string): boolean {
  return perms.includes(perm);
}

// GET /api/corporate/context
corporateRouter.get('/context', authenticateToken, (req: AuthRequest, res: Response): void => {
  const requestedOrgId = req.query.orgId as string | undefined;
  const ctx = getUserMembership(req.user!.id, requestedOrgId);
  const countryCap = ctx.activeOrg ? (COUNTRY_CONFIG[ctx.activeOrg.country] || COUNTRY_CONFIG.GB) : COUNTRY_CONFIG.GB;

  res.json({
    success: true,
    organisations: ctx.organisations,
    activeOrganisation: ctx.activeOrg,
    countryCapability: countryCap,
    environment: 'SANDBOX',
  });
});

// GET /api/corporate/accounts
corporateRouter.get('/accounts', authenticateToken, (req: AuthRequest, res: Response): void => {
  const orgId = req.query.orgId as string | undefined;
  const ctx = getUserMembership(req.user!.id, orgId);
  if (!ctx.activeOrg || !hasPerm(ctx.activeOrg.permissions, 'VIEW_ACCOUNTS')) {
    res.status(403).json({ success: false, error: 'Permission VIEW_ACCOUNTS required.' });
    return;
  }

  const accounts = db.prepare(`
    SELECT * FROM accounts
    WHERE organisation_id = ?
    ORDER BY is_favourite DESC, favourite_order ASC, currency ASC, account_name ASC
  `).all(ctx.activeOrg.id) as any[];

  const showBalances = hasPerm(ctx.activeOrg.permissions, 'VIEW_BALANCES');
  let totalAvailableBase = 0;
  const baseCur = ctx.activeOrg.baseCurrency || 'GBP';
  const baseFactor = FX_TO_GBP[baseCur] || 1;

  const formatted = accounts.map((a) => {
    const gbpVal = (a.available_balance || 0) * (FX_TO_GBP[a.currency] || 1);
    totalAvailableBase += gbpVal / baseFactor;
    return {
      ...a,
      maskedAccountNumber: `•••• •••• ${String(a.account_number).slice(-4)}`,
      availableBalance: showBalances ? a.available_balance : null,
      ledgerBalance: showBalances ? a.ledger_balance : null,
      isFavourite: !!a.is_favourite,
    };
  });

  res.json({
    success: true,
    organisationId: ctx.activeOrg.id,
    baseCurrency: baseCur,
    totalAvailableBase: showBalances ? Number(totalAvailableBase.toFixed(2)) : null,
    accountCount: formatted.length,
    lastUpdated: new Date().toISOString(),
    accounts: formatted,
  });
});

// POST /api/corporate/accounts/:id/favourite
corporateRouter.post('/accounts/:id/favourite', authenticateToken, (req: AuthRequest, res: Response): void => {
  const { isFavourite, favouriteOrder } = req.body;
  const acc = db.prepare(`SELECT * FROM accounts WHERE id = ?`).get(req.params.id) as any;
  if (!acc) {
    res.status(404).json({ success: false, error: 'Account not found.' });
    return;
  }
  const nextFav = isFavourite !== undefined ? (isFavourite ? 1 : 0) : (acc.is_favourite ? 0 : 1);
  const nextOrder = favouriteOrder !== undefined ? Number(favouriteOrder) : (nextFav ? 1 : 99);
  db.prepare(`UPDATE accounts SET is_favourite = ?, favourite_order = ? WHERE id = ?`).run(nextFav, nextOrder, acc.id);
  res.json({ success: true, isFavourite: !!nextFav, favouriteOrder: nextOrder });
});

// GET /api/corporate/accounts/:id/statements
corporateRouter.get('/accounts/:id/statements', authenticateToken, (req: AuthRequest, res: Response): void => {
  const acc = db.prepare(`SELECT * FROM accounts WHERE id = ?`).get(req.params.id) as any;
  if (!acc) {
    res.status(404).json({ success: false, error: 'Account not found.' });
    return;
  }
  const statements = db.prepare(`SELECT * FROM statements WHERE account_id = ? ORDER BY end_date DESC`).all(acc.id);
  const txns = db.prepare(`SELECT * FROM transactions WHERE source_account_id = ? OR destination_account_id = ? ORDER BY created_at DESC LIMIT 50`).all(acc.id, acc.id);
  res.json({ success: true, account: acc, statements, transactions: txns });
});

// GET /api/corporate/transactions
corporateRouter.get('/transactions', authenticateToken, (req: AuthRequest, res: Response): void => {
  const { orgId, accountId, currency, entryType, category, search, dateFrom, dateTo, minAmount, maxAmount } = req.query as Record<string, string>;
  const ctx = getUserMembership(req.user!.id, orgId);
  if (!ctx.activeOrg || !hasPerm(ctx.activeOrg.permissions, 'VIEW_TRANSACTIONS')) {
    res.status(403).json({ success: false, error: 'Permission VIEW_TRANSACTIONS required.' });
    return;
  }

  let sql = `
    SELECT t.*, a.account_name, a.account_number, le.entry_type, le.balance_after
    FROM transactions t
    JOIN accounts a ON a.id = t.source_account_id
    LEFT JOIN ledger_entries le ON le.transaction_id = t.id AND le.account_id = a.id
    WHERE a.organisation_id = ?
  `;
  const params: any[] = [ctx.activeOrg.id];

  if (accountId) {
    sql += ` AND t.source_account_id = ?`;
    params.push(accountId);
  }
  if (currency && currency !== 'ALL') {
    sql += ` AND t.currency = ?`;
    params.push(currency);
  }
  if (category && category !== 'ALL') {
    sql += ` AND t.category = ?`;
    params.push(category);
  }
  if (entryType && entryType !== 'ALL') {
    sql += ` AND le.entry_type = ?`;
    params.push(entryType);
  }
  if (dateFrom) {
    sql += ` AND date(t.created_at) >= date(?)`;
    params.push(dateFrom);
  }
  if (dateTo) {
    sql += ` AND date(t.created_at) <= date(?)`;
    params.push(dateTo);
  }
  if (minAmount) {
    sql += ` AND t.amount >= ?`;
    params.push(Number(minAmount));
  }
  if (maxAmount) {
    sql += ` AND t.amount <= ?`;
    params.push(Number(maxAmount));
  }
  if (search) {
    sql += ` AND (t.reference LIKE ? OR t.description LIKE ? OR t.counterparty_name LIKE ?)`;
    const q = `%${search}%`;
    params.push(q, q, q);
  }

  sql += ` ORDER BY t.created_at DESC LIMIT 150`;
  const transactions = db.prepare(sql).all(...params);
  res.json({ success: true, transactions });
});

// GET /api/corporate/authorisations
corporateRouter.get('/authorisations', authenticateToken, (req: AuthRequest, res: Response): void => {
  const orgId = req.query.orgId as string | undefined;
  const ctx = getUserMembership(req.user!.id, orgId);
  if (!ctx.activeOrg) {
    res.status(404).json({ success: false, error: 'Organisation not found.' });
    return;
  }

  const instructions = db.prepare(`
    SELECT * FROM payment_instructions
    WHERE organisation_id = ?
    ORDER BY created_at DESC
  `).all(ctx.activeOrg.id) as any[];

  const tradePending = hasPerm(ctx.activeOrg.permissions, 'ACCESS_TRADE_FINANCE')
    ? (db.prepare(`SELECT * FROM trade_transactions WHERE organisation_id = ? ORDER BY created_at DESC`).all(ctx.activeOrg.id) as any[])
    : [];

  const parsedInstructions = instructions.map((p) => ({
    ...p,
    approvalHistory: JSON.parse(p.approval_history_json || '[]'),
    timeline: JSON.parse(p.timeline_json || '[]'),
    unusualFlags: JSON.parse(p.unusual_flags_json || '[]'),
    canCurrentUserApprove:
      hasPerm(ctx.activeOrg!.permissions, 'APPROVE_PAYMENTS') &&
      p.initiator_id !== req.user!.id &&
      ['AWAITING_AUTHORISATION', 'PARTIALLY_AUTHORISED'].includes(p.status) &&
      !JSON.parse(p.approval_history_json || '[]').some((h: any) => h.approverId === req.user!.id && h.decision === 'APPROVED'),
  }));

  res.json({
    success: true,
    permissions: ctx.activeOrg.permissions,
    instructions: parsedInstructions,
    tradeItems: tradePending.map((t) => ({
      ...t,
      documents: JSON.parse(t.documents_json || '[]'),
      timeline: JSON.parse(t.timeline_json || '[]'),
      approvalHistory: JSON.parse(t.approval_history_json || '[]'),
    })),
  });
});

// POST /api/corporate/authorisations/decide - Backend-enforced single/bulk approve/reject/info-request
corporateRouter.post('/authorisations/decide', authenticateToken, (req: AuthRequest, res: Response): void => {
  const { ids, decision, comment = '', stepUpPin, reauthToken, orgId } = req.body;
  const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

  if (!Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({ success: false, error: 'Select at least one instruction.' });
    return;
  }
  if (!['APPROVED', 'REJECTED', 'INFO_REQUESTED'].includes(decision)) {
    res.status(400).json({ success: false, error: 'Invalid decision.' });
    return;
  }

  const ctx = getUserMembership(req.user!.id, orgId);
  if (!ctx.activeOrg) {
    res.status(403).json({ success: false, error: 'Organisation access denied.' });
    return;
  }

  if (decision === 'APPROVED' && !hasPerm(ctx.activeOrg.permissions, 'APPROVE_PAYMENTS')) {
    res.status(403).json({ success: false, error: 'Your role does not hold APPROVE_PAYMENTS permission.' });
    return;
  }
  if (decision === 'REJECTED' && !hasPerm(ctx.activeOrg.permissions, 'REJECT_PAYMENTS')) {
    res.status(403).json({ success: false, error: 'Your role does not hold REJECT_PAYMENTS permission.' });
    return;
  }

  // Step-up authentication check when approving
  if (decision === 'APPROVED') {
    let stepUpVerified = false;
    if (reauthToken) {
      try {
        const decoded = jwt.verify(reauthToken, JWT_SECRET) as any;
        if (decoded.uid === req.user!.id && decoded.stepUp) stepUpVerified = true;
      } catch {
        stepUpVerified = false;
      }
    }
    if (!stepUpVerified && stepUpPin) {
      const u = db.prepare(`SELECT security_pin_hash FROM users WHERE id = ?`).get(req.user!.id) as any;
      if (u?.security_pin_hash && bcrypt.compareSync(String(stepUpPin), u.security_pin_hash)) {
        stepUpVerified = true;
      }
    }
    if (!stepUpVerified) {
      res.status(401).json({ success: false, code: 'STEP_UP_REQUIRED', error: 'Re-authentication (6-digit Security PIN or Passkey) is required to authorise payments.' });
      return;
    }
  }

  const results: any[] = [];
  const errors: any[] = [];

  runTransaction(() => {
    for (const id of ids) {
      const p = db.prepare(`SELECT * FROM payment_instructions WHERE id = ? AND organisation_id = ?`).get(id, ctx.activeOrg!.id) as any;
      if (!p) {
        errors.push({ id, error: 'Instruction not found' });
        continue;
      }
      if (!['AWAITING_AUTHORISATION', 'PARTIALLY_AUTHORISED'].includes(p.status)) {
        errors.push({ id, reference: p.reference, error: `Instruction is already ${p.status}` });
        continue;
      }
      if (p.initiator_id === req.user!.id && decision === 'APPROVED') {
        errors.push({ id, reference: p.reference, error: 'Maker-checker policy prevents an initiator from approving their own payment.' });
        continue;
      }

      const history = JSON.parse(p.approval_history_json || '[]');
      const timeline = JSON.parse(p.timeline_json || '[]');
      const nowIso = new Date().toISOString();

      if (decision === 'APPROVED' && history.some((h: any) => h.approverId === req.user!.id && h.decision === 'APPROVED')) {
        errors.push({ id, reference: p.reference, error: 'You have already recorded an approval on this instruction.' });
        continue;
      }

      history.push({
        approverId: req.user!.id,
        approverName: req.user!.full_name,
        approverRole: ctx.activeOrg!.role,
        decision,
        comment,
        timestamp: nowIso,
      });

      if (decision === 'REJECTED') {
        timeline.push({
          id: uuidv4(),
          stage: 'REJECTED',
          label: 'Payment Rejected',
          description: comment || `Rejected by ${req.user!.full_name}`,
          actor: req.user!.full_name,
          timestamp: nowIso,
          state: 'FAILED',
        });
        db.prepare(`
          UPDATE payment_instructions
          SET status = 'REJECTED', approval_history_json = ?, timeline_json = ?, updated_at = datetime('now')
          WHERE id = ?
        `).run(JSON.stringify(history), JSON.stringify(timeline), p.id);
        logAudit(req.user!.id, ctx.activeOrg!.role, 'PAYMENT_REJECTED', 'PAYMENT_INSTRUCTION', p.id, { reference: p.reference, comment }, ip);
        results.push({ id: p.id, reference: p.reference, status: 'REJECTED' });
        continue;
      }

      if (decision === 'INFO_REQUESTED') {
        timeline.push({
          id: uuidv4(),
          stage: 'INFO_REQUESTED',
          label: 'Clarification Requested',
          description: comment || `Additional supporting info requested by ${req.user!.full_name}`,
          actor: req.user!.full_name,
          timestamp: nowIso,
          state: 'CURRENT',
        });
        db.prepare(`
          UPDATE payment_instructions
          SET approval_history_json = ?, timeline_json = ?, updated_at = datetime('now')
          WHERE id = ?
        `).run(JSON.stringify(history), JSON.stringify(timeline), p.id);
        logAudit(req.user!.id, ctx.activeOrg!.role, 'PAYMENT_INFO_REQUESTED', 'PAYMENT_INSTRUCTION', p.id, { reference: p.reference, comment }, ip);
        results.push({ id: p.id, reference: p.reference, status: p.status });
        continue;
      }

      // APPROVED
      const nextApprovals = (p.current_approvals || 0) + 1;
      const isFinal = nextApprovals >= (p.required_approvals || 1);

      if (!isFinal) {
        timeline.push({
          id: uuidv4(),
          stage: `AUTH_${nextApprovals}`,
          label: `Approval ${nextApprovals} of ${p.required_approvals} recorded`,
          description: `Approved by ${req.user!.full_name}. Awaiting remaining authoriser sign-off.`,
          actor: req.user!.full_name,
          timestamp: nowIso,
          state: 'COMPLETED',
        });
        db.prepare(`
          UPDATE payment_instructions
          SET status = 'PARTIALLY_AUTHORISED', current_approvals = ?, approval_history_json = ?, timeline_json = ?, updated_at = datetime('now')
          WHERE id = ?
        `).run(nextApprovals, JSON.stringify(history), JSON.stringify(timeline), p.id);
        logAudit(req.user!.id, ctx.activeOrg!.role, 'PAYMENT_PARTIAL_APPROVAL', 'PAYMENT_INSTRUCTION', p.id, { reference: p.reference, nextApprovals }, ip);
        results.push({ id: p.id, reference: p.reference, status: 'PARTIALLY_AUTHORISED' });
      } else {
        // Final approval -> Debit account atomically in sandbox ledger
        const acc = db.prepare(`SELECT * FROM accounts WHERE id = ?`).get(p.debit_account_id) as any;
        const debitTotal = Number((p.amount / (p.exchange_rate || 1) + (p.charges_amount || 0)).toFixed(2));
        if (!acc || acc.available_balance < debitTotal) {
          errors.push({ id: p.id, reference: p.reference, error: 'Insufficient available balance in debit account at execution time.' });
          continue;
        }

        const newAvail = Number((acc.available_balance - debitTotal).toFixed(2));
        const newLedger = Number((acc.ledger_balance - debitTotal).toFixed(2));
        db.prepare(`UPDATE accounts SET available_balance = ?, ledger_balance = ? WHERE id = ?`).run(newAvail, newLedger, acc.id);

        const txnId = uuidv4();
        db.prepare(`
          INSERT INTO transactions (id, reference, user_id, source_account_id, counterparty_name, counterparty_account, bank_name, ifsc_swift, amount, currency, fee, exchange_rate, description, category, status, transaction_type)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'TRANSFER', 'COMPLETED', ?)
        `).run(txnId, p.reference, p.initiator_id, acc.id, p.beneficiary_name, p.beneficiary_account, p.beneficiary_bank, p.swift_bic || '', debitTotal, acc.currency, p.charges_amount || 0, p.exchange_rate || 1, p.reference_note, p.category);

        db.prepare(`
          INSERT INTO ledger_entries (id, transaction_id, account_id, entry_type, amount, currency, balance_after, description)
          VALUES (?, ?, ?, 'DEBIT', ?, ?, ?, ?)
        `).run(uuidv4(), txnId, acc.id, debitTotal, acc.currency, newAvail, `Authorised Payment: ${p.beneficiary_name} (${p.reference})`);

        timeline.push(
          { id: uuidv4(), stage: 'AUTHORISED', label: 'Final authorisation completed', description: `Authorised by ${req.user!.full_name}`, actor: req.user!.full_name, timestamp: nowIso, state: 'COMPLETED' },
          { id: uuidv4(), stage: 'COMPLETED', label: 'Settled in sandbox ledger', description: 'Internal ledger debit executed (Sandbox environment — no external bank rail connected)', timestamp: nowIso, state: 'COMPLETED' }
        );

        db.prepare(`
          UPDATE payment_instructions
          SET status = 'COMPLETED', current_approvals = ?, approval_history_json = ?, timeline_json = ?, updated_at = datetime('now')
          WHERE id = ?
        `).run(nextApprovals, JSON.stringify(history), JSON.stringify(timeline), p.id);

        db.prepare(`
          INSERT INTO notifications (id, user_id, title, message, type)
          VALUES (?, ?, 'Payment Authorised & Settled', ?, 'PAYMENT')
        `).run(uuidv4(), p.initiator_id, `${p.reference} (${p.currency} ${p.amount.toLocaleString()}) to ${p.beneficiary_name} was authorised by ${req.user!.full_name}.`);

        logAudit(req.user!.id, ctx.activeOrg!.role, 'PAYMENT_AUTHORISED_FINAL', 'PAYMENT_INSTRUCTION', p.id, { reference: p.reference, debitTotal }, ip);
        results.push({ id: p.id, reference: p.reference, status: 'COMPLETED' });
      }
    }
  });

  if (results.length === 0 && errors.length > 0) {
    res.status(400).json({ success: false, error: errors[0].error, errors });
    return;
  }

  res.json({ success: true, results, errors });
});

// POST /api/corporate/fx-quote - Real backend FX quote with 120s validity
corporateRouter.post('/fx-quote', authenticateToken, (req: AuthRequest, res: Response): void => {
  const { fromCurrency = 'GBP', toCurrency = 'EUR', amount = 0 } = req.body;
  const numAmt = Number(amount);
  if (!numAmt || numAmt <= 0) {
    res.status(400).json({ success: false, error: 'Positive amount required for FX quote.' });
    return;
  }
  const fromGbp = FX_TO_GBP[fromCurrency] || 1;
  const toGbp = FX_TO_GBP[toCurrency] || 1;
  const rate = Number((fromGbp / toGbp).toFixed(4));
  const convertedAmount = Number((numAmt * rate).toFixed(2));
  const fee = fromCurrency === toCurrency ? 0 : 12.0;
  const quoteId = uuidv4();
  const expiresAt = new Date(Date.now() + 120 * 1000).toISOString();

  db.prepare(`
    INSERT INTO fx_quotes (id, user_id, from_currency, to_currency, amount, rate, converted_amount, fee, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(quoteId, req.user!.id, fromCurrency, toCurrency, numAmt, rate, convertedAmount, fee, expiresAt);

  res.json({
    success: true,
    quote: { id: quoteId, fromCurrency, toCurrency, amount: numAmt, rate, convertedAmount, fee, expiresAt, validSeconds: 120 },
  });
});

// POST /api/corporate/payments - Create payment instruction (enforcing policy & permissions)
corporateRouter.post('/payments', authenticateToken, (req: AuthRequest, res: Response): void => {
  const {
    orgId, category = 'PRIORITY_PAYMENT', debitAccountId, beneficiaryId,
    beneficiaryName, beneficiaryAccount, beneficiaryBank, destinationCountry = 'GB',
    swiftBic = '', iban = '', amount, currency, exchangeRate = 1.0,
    chargesBearer = 'SHA', paymentPurpose = 'SUPP', paymentDate, referenceNote,
    additionalInfo = '', idempotencyKey
  } = req.body;

  const ctx = getUserMembership(req.user!.id, orgId);
  if (!ctx.activeOrg || !hasPerm(ctx.activeOrg.permissions, 'CREATE_PAYMENTS')) {
    res.status(403).json({ success: false, error: 'Permission CREATE_PAYMENTS required.' });
    return;
  }

  if (idempotencyKey) {
    const existing = db.prepare(`SELECT * FROM payment_instructions WHERE idempotency_key = ?`).get(idempotencyKey) as any;
    if (existing) {
      res.json({ success: true, idempotentReplay: true, payment: existing });
      return;
    }
  }

  const acc = db.prepare(`SELECT * FROM accounts WHERE id = ? AND organisation_id = ?`).get(debitAccountId, ctx.activeOrg.id) as any;
  if (!acc) {
    res.status(404).json({ success: false, error: 'Selected debit account not found for this organisation.' });
    return;
  }
  if (acc.status !== 'ACTIVE') {
    res.status(400).json({ success: false, error: `Debit account is ${acc.status} and cannot initiate payments.` });
    return;
  }

  const numAmount = Number(amount);
  if (!numAmount || numAmount <= 0) {
    res.status(400).json({ success: false, error: 'Payment amount must be greater than zero.' });
    return;
  }
  if (acc.available_balance < numAmount / (Number(exchangeRate) || 1)) {
    res.status(400).json({ success: false, error: 'Insufficient available funds in selected debit account.' });
    return;
  }

  // Determine approval policy on backend
  const policy = db.prepare(`
    SELECT * FROM approval_policies
    WHERE organisation_id = ? AND is_active = 1
      AND (currency = ? OR currency = 'ALL')
      AND min_amount <= ? AND max_amount >= ?
    ORDER BY required_approvals DESC LIMIT 1
  `).get(ctx.activeOrg.id, currency || acc.currency, numAmount, numAmount) as any;

  const requiredApprovals = policy?.required_approvals || (numAmount > 10000 ? 2 : 1);
  const chargesAmount = category === 'INTER_ACCOUNT_TRANSFER' ? 0 : (chargesBearer === 'OUR' ? 18 : chargesBearer === 'SHA' ? 8 : 0);
  const ref = `PAY-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 89999)}`;
  const id = uuidv4();
  const nowIso = new Date().toISOString();
  const payCur = currency || acc.currency;
  const convertedAmount = Number((numAmount * (Number(exchangeRate) || 1)).toFixed(2));
  const timeline = [
    { id: uuidv4(), stage: 'CREATED', label: 'Payment created', description: `Initiated by ${req.user!.full_name}`, actor: req.user!.full_name, timestamp: nowIso, state: 'COMPLETED' },
    { id: uuidv4(), stage: 'SUBMITTED', label: 'Approval requested', description: `Policy matched (${requiredApprovals} authorisation${requiredApprovals > 1 ? 's' : ''} required). Maker-checker active.`, timestamp: nowIso, state: 'CURRENT' },
  ];

  const flags: string[] = [];
  if (numAmount >= 50000) flags.push('High-value payment threshold');
  if (payCur !== acc.currency) flags.push(`Cross-currency conversion (${acc.currency} -> ${payCur})`);

  db.prepare(`
    INSERT INTO payment_instructions (
      id, reference, organisation_id, initiator_id, initiator_name, category, debit_account_id,
      debit_account_name, debit_currency, beneficiary_id, beneficiary_name, beneficiary_account, beneficiary_bank,
      destination_country, swift_bic, iban, amount, currency, exchange_rate, converted_amount,
      charges_bearer, charges_amount, payment_purpose, payment_date, reference_note, additional_info,
      status, required_approvals, current_approvals, approval_history_json, timeline_json, unusual_flags_json,
      idempotency_key, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'AWAITING_AUTHORISATION', ?, 0, '[]', ?, ?, ?, ?)
  `).run(
    id, ref, ctx.activeOrg.id, req.user!.id, req.user!.full_name, category, acc.id,
    acc.account_name, acc.currency, beneficiaryId || null, beneficiaryName, beneficiaryAccount, beneficiaryBank,
    destinationCountry, swiftBic, iban, numAmount, payCur, Number(exchangeRate) || 1, convertedAmount,
    chargesBearer, chargesAmount, paymentPurpose, paymentDate || nowIso.slice(0, 10), referenceNote || 'Corporate Payment', additionalInfo,
    requiredApprovals, JSON.stringify(timeline), JSON.stringify(flags), idempotencyKey || null,
    new Date(Date.now() + 72 * 3600 * 1000).toISOString()
  );

  logAudit(req.user!.id, ctx.activeOrg.role, 'PAYMENT_SUBMITTED', 'PAYMENT_INSTRUCTION', id, { reference: ref, amount: numAmount, currency: payCur });
  const created = db.prepare(`SELECT * FROM payment_instructions WHERE id = ?`).get(id) as any;

  res.json({
    success: true,
    payment: {
      ...created,
      timeline: JSON.parse(created.timeline_json),
      approvalHistory: [],
      unusualFlags: flags,
    },
  });
});

// GET /api/corporate/payments - Track & Search payments
corporateRouter.get('/payments', authenticateToken, (req: AuthRequest, res: Response): void => {
  const { orgId, status, currency, search, dateFrom, dateTo } = req.query as Record<string, string>;
  const ctx = getUserMembership(req.user!.id, orgId);
  if (!ctx.activeOrg) {
    res.status(404).json({ success: false, error: 'Organisation not found.' });
    return;
  }

  let sql = `SELECT * FROM payment_instructions WHERE organisation_id = ?`;
  const params: any[] = [ctx.activeOrg.id];

  if (status && status !== 'ALL') {
    sql += ` AND status = ?`;
    params.push(status);
  }
  if (currency && currency !== 'ALL') {
    sql += ` AND currency = ?`;
    params.push(currency);
  }
  if (dateFrom) {
    sql += ` AND date(created_at) >= date(?)`;
    params.push(dateFrom);
  }
  if (dateTo) {
    sql += ` AND date(created_at) <= date(?)`;
    params.push(dateTo);
  }
  if (search) {
    sql += ` AND (reference LIKE ? OR beneficiary_name LIKE ? OR reference_note LIKE ?)`;
    const q = `%${search}%`;
    params.push(q, q, q);
  }

  sql += ` ORDER BY created_at DESC`;
  const rows = db.prepare(sql).all(...params) as any[];
  res.json({
    success: true,
    payments: rows.map((p) => ({
      ...p,
      timeline: JSON.parse(p.timeline_json || '[]'),
      approvalHistory: JSON.parse(p.approval_history_json || '[]'),
      unusualFlags: JSON.parse(p.unusual_flags_json || '[]'),
    })),
  });
});

// POST /api/corporate/payments/:id/fraud-report
corporateRouter.post('/payments/:id/fraud-report', authenticateToken, (req: AuthRequest, res: Response): void => {
  const { reason, details = '', orgId } = req.body;
  const ctx = getUserMembership(req.user!.id, orgId);
  if (!ctx.activeOrg) {
    res.status(403).json({ success: false, error: 'Organisation access denied.' });
    return;
  }
  if (!reason || reason.trim().length < 5) {
    res.status(400).json({ success: false, error: 'Please provide a clear reason (at least 5 characters).' });
    return;
  }

  const payment = db.prepare(`SELECT * FROM payment_instructions WHERE id = ? AND organisation_id = ?`).get(req.params.id, ctx.activeOrg.id) as any;
  if (!payment) {
    res.status(404).json({ success: false, error: 'Payment instruction not found.' });
    return;
  }

  const ref = `FRD-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 8999)}`;
  const id = uuidv4();
  db.prepare(`
    INSERT INTO fraud_reports (id, reference, user_id, organisation_id, payment_reference, reason, details, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'CASE_OPENED_SANDBOX')
  `).run(id, ref, req.user!.id, ctx.activeOrg.id, payment.reference, reason.trim(), details.trim());

  logAudit(req.user!.id, ctx.activeOrg.role, 'FRAUD_REPORT_CREATED', 'FRAUD_REPORT', id, { paymentReference: payment.reference, caseRef: ref });

  res.json({
    success: true,
    report: { id, reference: ref, paymentReference: payment.reference, status: 'CASE_OPENED_SANDBOX' },
    message: `Internal fraud case ${ref} logged for ${payment.reference}. (Sandbox workflow: no external bank fraud desk connected.)`,
  });
});

// GET /api/corporate/liquidity
corporateRouter.get('/liquidity', authenticateToken, (req: AuthRequest, res: Response): void => {
  const orgId = req.query.orgId as string | undefined;
  const ctx = getUserMembership(req.user!.id, orgId);
  if (!ctx.activeOrg || !hasPerm(ctx.activeOrg.permissions, 'VIEW_LIQUIDITY')) {
    res.status(403).json({ success: false, error: 'Permission VIEW_LIQUIDITY required.' });
    return;
  }

  const accounts = db.prepare(`SELECT * FROM accounts WHERE organisation_id = ?`).all(ctx.activeOrg.id) as any[];
  const baseCurrency = ctx.activeOrg.baseCurrency || 'GBP';
  const baseFactor = FX_TO_GBP[baseCurrency] || 1;

  const byCurrencyMap: Record<string, { currency: string; available: number; ledger: number; baseEquivalent: number; accountCount: number }> = {};
  let totalAvailableBase = 0;
  let totalLedgerBase = 0;

  for (const acc of accounts) {
    const fx = FX_TO_GBP[acc.currency] || 1;
    const availBase = (acc.available_balance * fx) / baseFactor;
    const ledgerBase = (acc.ledger_balance * fx) / baseFactor;
    totalAvailableBase += availBase;
    totalLedgerBase += ledgerBase;

    if (!byCurrencyMap[acc.currency]) {
      byCurrencyMap[acc.currency] = { currency: acc.currency, available: 0, ledger: 0, baseEquivalent: 0, accountCount: 0 };
    }
    byCurrencyMap[acc.currency].available += acc.available_balance;
    byCurrencyMap[acc.currency].ledger += acc.ledger_balance;
    byCurrencyMap[acc.currency].baseEquivalent += availBase;
    byCurrencyMap[acc.currency].accountCount += 1;
  }

  // Deterministic 7-point historical balance trajectory anchored on real totalAvailableBase
  const history = [
    { label: 'Nov 01', available: Number((totalAvailableBase * 0.89).toFixed(2)), ledger: Number((totalLedgerBase * 0.90).toFixed(2)) },
    { label: 'Nov 05', available: Number((totalAvailableBase * 0.91).toFixed(2)), ledger: Number((totalLedgerBase * 0.92).toFixed(2)) },
    { label: 'Nov 10', available: Number((totalAvailableBase * 0.94).toFixed(2)), ledger: Number((totalLedgerBase * 0.95).toFixed(2)) },
    { label: 'Nov 15', available: Number((totalAvailableBase * 0.93).toFixed(2)), ledger: Number((totalLedgerBase * 0.94).toFixed(2)) },
    { label: 'Nov 20', available: Number((totalAvailableBase * 0.97).toFixed(2)), ledger: Number((totalLedgerBase * 0.98).toFixed(2)) },
    { label: 'Nov 24', available: Number((totalAvailableBase * 0.99).toFixed(2)), ledger: Number((totalLedgerBase * 0.995).toFixed(2)) },
    { label: 'Today', available: Number(totalAvailableBase.toFixed(2)), ledger: Number(totalLedgerBase.toFixed(2)) },
  ];

  res.json({
    success: true,
    baseCurrency,
    totalAvailableBase: Number(totalAvailableBase.toFixed(2)),
    totalLedgerBase: Number(totalLedgerBase.toFixed(2)),
    byCurrency: Object.values(byCurrencyMap),
    accounts: accounts.map((a) => ({
      ...a,
      baseEquivalent: Number((((a.available_balance || 0) * (FX_TO_GBP[a.currency] || 1)) / baseFactor).toFixed(2)),
    })),
    history,
  });
});

// Trade Finance endpoints
corporateRouter.get('/trade', authenticateToken, (req: AuthRequest, res: Response): void => {
  const orgId = req.query.orgId as string | undefined;
  const ctx = getUserMembership(req.user!.id, orgId);
  if (!ctx.activeOrg || !hasPerm(ctx.activeOrg.permissions, 'ACCESS_TRADE_FINANCE')) {
    res.status(403).json({ success: false, error: 'Permission ACCESS_TRADE_FINANCE required.' });
    return;
  }
  const items = db.prepare(`SELECT * FROM trade_transactions WHERE organisation_id = ? ORDER BY created_at DESC`).all(ctx.activeOrg.id) as any[];
  res.json({
    success: true,
    transactions: items.map((t) => ({
      ...t,
      documents: JSON.parse(t.documents_json || '[]'),
      timeline: JSON.parse(t.timeline_json || '[]'),
      approvalHistory: JSON.parse(t.approval_history_json || '[]'),
    })),
  });
});

corporateRouter.post('/trade/:id/decide', authenticateToken, (req: AuthRequest, res: Response): void => {
  const { decision, comment = '', orgId } = req.body;
  const ctx = getUserMembership(req.user!.id, orgId);
  if (!ctx.activeOrg || !hasPerm(ctx.activeOrg.permissions, 'APPROVE_PAYMENTS')) {
    res.status(403).json({ success: false, error: 'Authoriser permission required for trade decisions.' });
    return;
  }
  const item = db.prepare(`SELECT * FROM trade_transactions WHERE id = ? AND organisation_id = ?`).get(req.params.id, ctx.activeOrg.id) as any;
  if (!item) {
    res.status(404).json({ success: false, error: 'Trade transaction not found.' });
    return;
  }
  const nextStatus = decision === 'APPROVED' ? 'ISSUED' : 'REJECTED';
  const history = JSON.parse(item.approval_history_json || '[]');
  const timeline = JSON.parse(item.timeline_json || '[]');
  const nowIso = new Date().toISOString();

  history.push({ actorName: req.user!.full_name, decision, timestamp: nowIso, comment });
  timeline.push({
    id: uuidv4(),
    stage: nextStatus,
    label: decision === 'APPROVED' ? 'Authorised & Issued (Sandbox)' : 'Trade Instruction Rejected',
    description: comment || `Decision recorded by ${req.user!.full_name}`,
    actor: req.user!.full_name,
    timestamp: nowIso,
    state: decision === 'APPROVED' ? 'COMPLETED' : 'FAILED',
  });

  db.prepare(`UPDATE trade_transactions SET status = ?, pending_action = ?, approval_history_json = ?, timeline_json = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(nextStatus, decision === 'APPROVED' ? 'Active Facility' : 'Rejected', JSON.stringify(history), JSON.stringify(timeline), item.id);
  logAudit(req.user!.id, ctx.activeOrg.role, `TRADE_${decision}`, 'TRADE_TRANSACTION', item.id, { reference: item.reference, comment });

  res.json({ success: true, status: nextStatus });
});

// Receivables Finance endpoints
corporateRouter.get('/receivables', authenticateToken, (req: AuthRequest, res: Response): void => {
  const orgId = req.query.orgId as string | undefined;
  const ctx = getUserMembership(req.user!.id, orgId);
  if (!ctx.activeOrg || !hasPerm(ctx.activeOrg.permissions, 'ACCESS_RECEIVABLES_FINANCE')) {
    res.status(403).json({ success: false, error: 'Permission ACCESS_RECEIVABLES_FINANCE required.' });
    return;
  }
  const facilities = db.prepare(`SELECT * FROM receivables_facilities WHERE organisation_id = ?`).all(ctx.activeOrg.id);
  const draws = db.prepare(`SELECT * FROM receivables_draws WHERE organisation_id = ? ORDER BY created_at DESC`).all(ctx.activeOrg.id);
  const limitRequests = db.prepare(`SELECT * FROM receivables_limit_requests WHERE organisation_id = ? ORDER BY created_at DESC`).all(ctx.activeOrg.id);
  const messages = db.prepare(`SELECT * FROM receivables_messages WHERE organisation_id = ? ORDER BY created_at DESC`).all(ctx.activeOrg.id) as any[];
  res.json({
    success: true,
    facilities,
    draws,
    limitRequests,
    messages: messages.map((m) => ({ ...m, attachments: JSON.parse(m.attachments_json || '[]') })),
  });
});

corporateRouter.post('/receivables/draw', authenticateToken, (req: AuthRequest, res: Response): void => {
  const { facilityId, amount, destinationAccountId, invoiceReference = '', orgId } = req.body;
  const ctx = getUserMembership(req.user!.id, orgId);
  if (!ctx.activeOrg || !hasPerm(ctx.activeOrg.permissions, 'ACCESS_RECEIVABLES_FINANCE')) {
    res.status(403).json({ success: false, error: 'Access denied.' });
    return;
  }
  const fac = db.prepare(`SELECT * FROM receivables_facilities WHERE id = ? AND organisation_id = ?`).get(facilityId, ctx.activeOrg.id) as any;
  if (!fac) {
    res.status(404).json({ success: false, error: 'Receivables facility not found.' });
    return;
  }
  const numAmount = Number(amount);
  if (!numAmount || numAmount <= 0 || numAmount > fac.available_limit) {
    res.status(400).json({ success: false, error: 'Draw amount exceeds available receivables facility limit.' });
    return;
  }

  const ref = `DRW-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 8999)}`;
  const drawId = uuidv4();
  runTransaction(() => {
    db.prepare(`UPDATE receivables_facilities SET utilised_amount = utilised_amount + ?, available_limit = available_limit - ? WHERE id = ?`)
      .run(numAmount, numAmount, fac.id);
    db.prepare(`
      INSERT INTO receivables_draws (id, reference, facility_id, organisation_id, user_id, amount, currency, destination_account_id, invoice_reference, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETED_SANDBOX')
    `).run(drawId, ref, fac.id, ctx.activeOrg!.id, req.user!.id, numAmount, fac.currency, destinationAccountId, invoiceReference);
    if (destinationAccountId) {
      db.prepare(`UPDATE accounts SET available_balance = available_balance + ?, ledger_balance = ledger_balance + ? WHERE id = ?`)
        .run(numAmount, numAmount, destinationAccountId);
    }
    logAudit(req.user!.id, ctx.activeOrg!.role, 'RECEIVABLES_DRAW', 'RECEIVABLES', drawId, { reference: ref, amount: numAmount });
  });

  res.json({ success: true, reference: ref, message: 'Draw payment processed through internal sandbox receivables ledger.' });
});

corporateRouter.post('/receivables/limit-request', authenticateToken, (req: AuthRequest, res: Response): void => {
  const { facilityId, requestedLimit, reason, supportingDocName = '', orgId } = req.body;
  const ctx = getUserMembership(req.user!.id, orgId);
  if (!ctx.activeOrg) {
    res.status(403).json({ success: false, error: 'Access denied.' });
    return;
  }
  const fac = db.prepare(`SELECT * FROM receivables_facilities WHERE id = ? AND organisation_id = ?`).get(facilityId, ctx.activeOrg.id) as any;
  if (!fac) {
    res.status(404).json({ success: false, error: 'Facility not found.' });
    return;
  }
  const reqLimit = Number(requestedLimit);
  if (!reqLimit || reqLimit <= fac.total_limit) {
    res.status(400).json({ success: false, error: 'Requested limit must exceed current facility limit.' });
    return;
  }
  const ref = `LMT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 8999)}`;
  const id = uuidv4();
  db.prepare(`
    INSERT INTO receivables_limit_requests (id, reference, facility_id, organisation_id, user_id, current_limit, requested_limit, reason, supporting_doc_name, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'UNDER_REVIEW')
  `).run(id, ref, fac.id, ctx.activeOrg.id, req.user!.id, fac.total_limit, reqLimit, reason || 'Seasonal working capital expansion', supportingDocName);
  logAudit(req.user!.id, ctx.activeOrg.role, 'RECEIVABLES_LIMIT_REQUESTED', 'RECEIVABLES', id, { reference: ref, requestedLimit: reqLimit });

  res.json({ success: true, reference: ref, status: 'UNDER_REVIEW' });
});

corporateRouter.post('/receivables/messages/:id/reply', authenticateToken, (req: AuthRequest, res: Response): void => {
  const { body, orgId } = req.body;
  const ctx = getUserMembership(req.user!.id, orgId);
  if (!ctx.activeOrg || !body) {
    res.status(400).json({ success: false, error: 'Message body is required.' });
    return;
  }
  const orig = db.prepare(`SELECT * FROM receivables_messages WHERE id = ? AND organisation_id = ?`).get(req.params.id, ctx.activeOrg.id) as any;
  if (!orig) {
    res.status(404).json({ success: false, error: 'Message not found.' });
    return;
  }
  db.prepare(`UPDATE receivables_messages SET status = 'REPLIED' WHERE id = ?`).run(orig.id);
  db.prepare(`
    INSERT INTO receivables_messages (id, facility_id, organisation_id, subject, body, sender_name, sender_role, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'SENT')
  `).run(uuidv4(), orig.facility_id, ctx.activeOrg.id, `Re: ${orig.subject}`, body, req.user!.full_name, ctx.activeOrg.role);
  res.json({ success: true });
});

// Remote Deposit Capture (Country-gated!)
corporateRouter.get('/rdc', authenticateToken, (req: AuthRequest, res: Response): void => {
  const orgId = req.query.orgId as string | undefined;
  const ctx = getUserMembership(req.user!.id, orgId);
  if (!ctx.activeOrg) {
    res.status(403).json({ success: false, error: 'Organisation access denied.' });
    return;
  }
  const countryCap = COUNTRY_CONFIG[ctx.activeOrg.country] || COUNTRY_CONFIG.GB;
  if (!ctx.activeOrg.modules.remoteDepositCapture || !countryCap.supportsRDC) {
    res.status(403).json({ success: false, code: 'UNAVAILABLE_IN_COUNTRY', error: `Remote Deposit Capture is not enabled for ${countryCap.name}.` });
    return;
  }
  const deposits = db.prepare(`SELECT * FROM remote_deposit_captures WHERE organisation_id = ? ORDER BY created_at DESC`).all(ctx.activeOrg.id);
  res.json({ success: true, deposits });
});

corporateRouter.post('/rdc', authenticateToken, (req: AuthRequest, res: Response): void => {
  const { orgId, accountId, amount, chequeDate, frontImageName, backImageName } = req.body;
  const ctx = getUserMembership(req.user!.id, orgId);
  if (!ctx.activeOrg) {
    res.status(403).json({ success: false, error: 'Access denied.' });
    return;
  }
  const countryCap = COUNTRY_CONFIG[ctx.activeOrg.country] || COUNTRY_CONFIG.GB;
  if (!ctx.activeOrg.modules.remoteDepositCapture || !countryCap.supportsRDC) {
    res.status(403).json({ success: false, error: `Remote Deposit Capture is disabled in ${countryCap.name}.` });
    return;
  }
  if (!accountId || !amount || Number(amount) <= 0 || !frontImageName || !backImageName) {
    res.status(400).json({ success: false, error: 'Account, positive cheque amount, and both front & back cheque images are required.' });
    return;
  }

  const acc = db.prepare(`SELECT * FROM accounts WHERE id = ? AND organisation_id = ?`).get(accountId, ctx.activeOrg.id) as any;
  if (!acc) {
    res.status(404).json({ success: false, error: 'Deposit account not found.' });
    return;
  }

  const ref = `RDC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 8999)}`;
  const id = uuidv4();
  db.prepare(`
    INSERT INTO remote_deposit_captures (id, reference, organisation_id, user_id, account_id, amount, currency, cheque_date, front_image_name, back_image_name, quality_status, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PASSED', 'PENDING_CLEARING_SANDBOX')
  `).run(id, ref, ctx.activeOrg.id, req.user!.id, acc.id, Number(amount), acc.currency, chequeDate || new Date().toISOString().slice(0, 10), frontImageName, backImageName);

  logAudit(req.user!.id, ctx.activeOrg.role, 'RDC_SUBMITTED', 'RDC', id, { reference: ref, amount: Number(amount), currency: acc.currency });
  const created = db.prepare(`SELECT * FROM remote_deposit_captures WHERE id = ?`).get(id);
  res.json({ success: true, deposit: created });
});

// Self-Service & Document Requests
corporateRouter.get('/self-service', authenticateToken, (req: AuthRequest, res: Response): void => {
  const orgId = req.query.orgId as string | undefined;
  const ctx = getUserMembership(req.user!.id, orgId);
  if (!ctx.activeOrg || !hasPerm(ctx.activeOrg.permissions, 'REQUEST_DOCUMENTS')) {
    res.status(403).json({ success: false, error: 'Permission REQUEST_DOCUMENTS required.' });
    return;
  }
  const requests = db.prepare(`SELECT * FROM service_requests WHERE organisation_id = ? ORDER BY created_at DESC`).all(ctx.activeOrg.id);
  res.json({ success: true, requests });
});

corporateRouter.post('/self-service', authenticateToken, (req: AuthRequest, res: Response): void => {
  const { orgId, requestType, accountId, period = 'Current Period', details = {} } = req.body;
  const ctx = getUserMembership(req.user!.id, orgId);
  if (!ctx.activeOrg || !hasPerm(ctx.activeOrg.permissions, 'REQUEST_DOCUMENTS')) {
    res.status(403).json({ success: false, error: 'Permission REQUEST_DOCUMENTS required.' });
    return;
  }

  const ref = `SR-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 8999)}`;
  const id = uuidv4();
  const docName = `${requestType}_${ref}.pdf`;
  db.prepare(`
    INSERT INTO service_requests (id, reference, organisation_id, user_id, request_type, account_id, period, details_json, status, document_name)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETED', ?)
  `).run(id, ref, ctx.activeOrg.id, req.user!.id, requestType, accountId || null, period, JSON.stringify(details), docName);

  logAudit(req.user!.id, ctx.activeOrg.role, 'DOCUMENT_REQUESTED', 'SERVICE_REQUEST', id, { reference: ref, requestType });
  const created = db.prepare(`SELECT * FROM service_requests WHERE id = ?`).get(id);
  res.json({ success: true, request: created });
});
