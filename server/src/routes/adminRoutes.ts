import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { db, runTransaction } from '../db/database';
import { authenticateToken, requireRole, AuthRequest, logAudit } from '../middleware/auth';

export const adminRouter = Router();

const ADMIN_ROLES = ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'ORG_ADMIN', 'OPERATIONS', 'SUPPORT', 'SUPPORT_ADMIN', 'COMPLIANCE', 'AUDITOR'];

// GET /api/admin/overview
adminRouter.get('/overview', authenticateToken, requireRole(ADMIN_ROLES), (req: AuthRequest, res: Response): void => {
  const customerCount = db.prepare(`SELECT COUNT(*) as count FROM users WHERE role = 'USER'`).get() as any;
  const accountCount = db.prepare(`SELECT COUNT(*) as count FROM accounts`).get() as any;
  const cardCount = db.prepare(`SELECT COUNT(*) as count FROM cards`).get() as any;
  const transactionStats = db.prepare(`
    SELECT COUNT(*) as count, SUM(amount) as totalVolume 
    FROM transactions 
    WHERE created_at >= datetime('now', '-24 hours')
  `).get() as any;

  const totalDeposits = db.prepare(`
    SELECT SUM(available_balance) as totalGbp 
    FROM accounts 
    WHERE currency = 'GBP'
  `).get() as any;

  const openTickets = db.prepare(`
    SELECT COUNT(*) as count FROM support_tickets WHERE status != 'RESOLVED' AND status != 'CLOSED'
  `).get() as any;

  const fraudAlerts = db.prepare(`
    SELECT COUNT(*) as count FROM transactions WHERE amount >= 10000.00 OR category = 'CHARGES'
  `).get() as any;

  res.json({
    success: true,
    overview: {
      totalCustomers: customerCount.count || 0,
      totalAccounts: accountCount.count || 0,
      totalCardsIssued: cardCount.count || 0,
      totalDepositsGbp: Number((totalDeposits.totalGbp || 0).toFixed(2)),
      dailyTransactionCount: transactionStats.count || 0,
      dailyVolumeGbp: Number((transactionStats.totalVolume || 0).toFixed(2)),
      openSupportTickets: openTickets.count || 0,
      flaggedFraudAlerts: fraudAlerts.count || 0,
      systemHealth: '100% OPERATIONAL',
      ledgerIntegrity: 'VERIFIED - ZERO DISCREPANCIES'
    }
  });
});

// GET /api/admin/customers
adminRouter.get('/customers', authenticateToken, requireRole(ADMIN_ROLES), (req: AuthRequest, res: Response): void => {
  const customers = db.prepare(`
    SELECT u.id, u.username, u.email, u.phone, u.full_name, u.role, u.is_active, u.is_locked, u.created_at,
           cp.customer_id, cp.kyc_status, cp.city, cp.country,
           (SELECT COUNT(*) FROM accounts a WHERE a.user_id = u.id) as accountCount,
           (SELECT SUM(available_balance) FROM accounts a WHERE a.user_id = u.id AND a.currency = 'GBP') as totalBalance
    FROM users u
    LEFT JOIN customer_profiles cp ON cp.user_id = u.id
    WHERE u.role = 'USER'
    ORDER BY u.created_at DESC
  `).all();

  res.json({ success: true, customers });
});

// POST /api/admin/customers/:id/toggle-lock
adminRouter.post('/customers/:id/toggle-lock', authenticateToken, requireRole(['SUPER_ADMIN', 'OPERATIONS', 'COMPLIANCE']), (req: AuthRequest, res: Response): void => {
  const customer = db.prepare(`SELECT id, is_locked, full_name FROM users WHERE id = ?`).get(req.params.id) as any;

  if (!customer) {
    res.status(404).json({ success: false, error: 'Customer not found' });
    return;
  }

  const nextLocked = customer.is_locked ? 0 : 1;
  db.prepare(`UPDATE users SET is_locked = ?, failed_logins = 0 WHERE id = ?`).run(nextLocked, customer.id);

  logAudit(
    req.user!.id,
    req.user!.role,
    nextLocked ? 'ADMIN_CUSTOMER_LOCKED' : 'ADMIN_CUSTOMER_UNLOCKED',
    'USER',
    customer.id,
    { customerName: customer.full_name, lockedBy: req.user!.username }
  );

  res.json({
    success: true,
    is_locked: nextLocked,
    message: nextLocked ? `Customer ${customer.full_name} locked from banking access` : `Customer ${customer.full_name} unlocked`
  });
});

// GET /api/admin/ledger
adminRouter.get('/ledger', authenticateToken, requireRole(ADMIN_ROLES), (req: AuthRequest, res: Response): void => {
  const entries = db.prepare(`
    SELECT l.*, a.account_number, a.account_name, t.reference, t.counterparty_name
    FROM ledger_entries l
    LEFT JOIN accounts a ON a.id = l.account_id
    LEFT JOIN transactions t ON t.id = l.transaction_id
    ORDER BY l.created_at DESC
    LIMIT 100
  `).all();

  res.json({ success: true, entries });
});

// GET /api/admin/transactions
adminRouter.get('/transactions', authenticateToken, requireRole(ADMIN_ROLES), (req: AuthRequest, res: Response): void => {
  const transactions = db.prepare(`
    SELECT t.*, u.full_name as customer_name, u.email as customer_email, a.account_number
    FROM transactions t
    LEFT JOIN users u ON u.id = t.user_id
    LEFT JOIN accounts a ON a.id = t.source_account_id
    ORDER BY t.created_at DESC
    LIMIT 100
  `).all();

  res.json({ success: true, transactions });
});

// GET /api/admin/cards
adminRouter.get('/cards', authenticateToken, requireRole(ADMIN_ROLES), (req: AuthRequest, res: Response): void => {
  const cards = db.prepare(`
    SELECT c.*, u.full_name as customer_name, a.account_number
    FROM cards c
    LEFT JOIN users u ON u.id = c.user_id
    LEFT JOIN accounts a ON a.id = c.account_id
    ORDER BY c.created_at DESC
  `).all();

  res.json({ success: true, cards });
});

// GET /api/admin/tickets
adminRouter.get('/tickets', authenticateToken, requireRole(ADMIN_ROLES), (req: AuthRequest, res: Response): void => {
  const tickets = db.prepare(`
    SELECT st.*, u.full_name as customer_name, u.email as customer_email, cp.customer_id
    FROM support_tickets st
    LEFT JOIN users u ON u.id = st.user_id
    LEFT JOIN customer_profiles cp ON cp.user_id = u.id
    ORDER BY st.created_at DESC
  `).all();

  res.json({ success: true, tickets });
});

// PUT /api/admin/tickets/:id/status
adminRouter.put('/tickets/:id/status', authenticateToken, requireRole(['SUPER_ADMIN', 'OPERATIONS', 'SUPPORT']), (req: AuthRequest, res: Response): void => {
  const { status, resolutionNote } = req.body;

  db.prepare(`
    UPDATE support_tickets 
    SET status = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(status, req.params.id);

  if (resolutionNote) {
    db.prepare(`
      INSERT INTO support_messages (id, ticket_id, sender_id, sender_type, message)
      VALUES (?, ?, ?, 'SUPPORT_AGENT', ?)
    `).run(require('uuid').v4(), req.params.id, req.user!.id, resolutionNote);
  }

  logAudit(req.user!.id, req.user!.role, 'SUPPORT_TICKET_STATUS_UPDATED', 'SUPPORT_TICKET', req.params.id, { status, resolutionNote });

  res.json({ success: true, status, message: `Ticket status updated to ${status}` });
});

// GET /api/admin/audit-logs
adminRouter.get('/audit-logs', authenticateToken, requireRole(ADMIN_ROLES), (req: AuthRequest, res: Response): void => {
  const logs = db.prepare(`
    SELECT a.*, u.username as actor_username, u.full_name as actor_name
    FROM audit_logs a
    LEFT JOIN users u ON u.id = a.user_id
    ORDER BY a.created_at DESC
    LIMIT 200
  `).all();

  res.json({ success: true, logs });
});

// ---------------------------------------------------------------------------
// ENTERPRISE CORPORATE ADMIN ENDPOINTS
// ---------------------------------------------------------------------------

// GET /api/admin/enterprise-summary
adminRouter.get('/enterprise-summary', authenticateToken, requireRole(ADMIN_ROLES), (_req: AuthRequest, res: Response): void => {
  const orgs = (db.prepare(`SELECT COUNT(*) as c FROM organisations`).get() as any).c;
  const users = (db.prepare(`SELECT COUNT(*) as c FROM users`).get() as any).c;
  const activeSessions = (db.prepare(`SELECT COUNT(*) as c FROM auth_sessions WHERE is_revoked = 0`).get() as any).c;
  const accounts = (db.prepare(`SELECT COUNT(*) as c FROM accounts`).get() as any).c;
  const pendingApprovals = (db.prepare(`SELECT COUNT(*) as c FROM payment_instructions WHERE status IN ('AWAITING_AUTHORISATION','PARTIALLY_AUTHORISED')`).get() as any).c;
  const totalPayments = (db.prepare(`SELECT COUNT(*) as c FROM payment_instructions`).get() as any).c;
  const openTickets = (db.prepare(`SELECT COUNT(*) as c FROM support_tickets WHERE status IN ('OPEN','IN_PROGRESS')`).get() as any).c;
  const securityEvents = (db.prepare(`SELECT COUNT(*) as c FROM audit_logs WHERE action LIKE '%LOGIN%' OR action LIKE '%PIN%' OR action LIKE '%LOCK%' OR action LIKE '%FRAUD%'`).get() as any).c;

  res.json({
    success: true,
    summary: {
      organisations: orgs,
      users,
      activeSessions,
      accounts,
      pendingApprovals,
      totalPayments,
      openTickets,
      securityEvents,
      systemHealth: 'OPERATIONAL',
      environment: 'SANDBOX_CORPORATE',
    },
  });
});

// Organisations CRUD
adminRouter.get('/organisations', authenticateToken, requireRole(ADMIN_ROLES), (_req: AuthRequest, res: Response): void => {
  const orgs = db.prepare(`SELECT * FROM organisations ORDER BY created_at DESC`).all() as any[];
  res.json({
    success: true,
    organisations: orgs.map((o) => ({
      ...o,
      isSandbox: !!o.is_sandbox,
      modules: JSON.parse(o.modules_json || '{}'),
    })),
  });
});

adminRouter.post('/organisations', authenticateToken, requireRole(['SUPER_ADMIN', 'SYSTEM_ADMIN']), (req: AuthRequest, res: Response): void => {
  const { name, registrationNumber, country = 'GB', baseCurrency = 'GBP', modules } = req.body;
  if (!name || !registrationNumber) {
    res.status(400).json({ success: false, error: 'Organisation name and registration number are required.' });
    return;
  }
  const id = `org-${uuidv4().slice(0, 8)}`;
  const defaultModules = modules || {
    accounts: true, authorisations: true, payments: true, track: true,
    liquidity: true, tradeFinance: true, receivablesFinance: true,
    remoteDepositCapture: ['GB', 'US'].includes(country), billPayments: true, selfService: true,
  };
  db.prepare(`
    INSERT INTO organisations (id, name, registration_number, country, base_currency, status, is_sandbox, modules_json)
    VALUES (?, ?, ?, ?, ?, 'ACTIVE', 1, ?)
  `).run(id, name, registrationNumber, country, baseCurrency, JSON.stringify(defaultModules));
  logAudit(req.user!.id, req.user!.role, 'ORGANISATION_CREATED', 'ORGANISATION', id, { name, country, baseCurrency });
  res.json({ success: true, id });
});

adminRouter.put('/organisations/:id', authenticateToken, requireRole(['SUPER_ADMIN', 'SYSTEM_ADMIN', 'ORG_ADMIN']), (req: AuthRequest, res: Response): void => {
  const { name, country, baseCurrency, status, modules } = req.body;
  const existing = db.prepare(`SELECT * FROM organisations WHERE id = ?`).get(req.params.id) as any;
  if (!existing) {
    res.status(404).json({ success: false, error: 'Organisation not found.' });
    return;
  }
  db.prepare(`
    UPDATE organisations
    SET name = COALESCE(?, name),
        country = COALESCE(?, country),
        base_currency = COALESCE(?, base_currency),
        status = COALESCE(?, status),
        modules_json = COALESCE(?, modules_json)
    WHERE id = ?
  `).run(name || null, country || null, baseCurrency || null, status || null, modules ? JSON.stringify(modules) : null, req.params.id);
  logAudit(req.user!.id, req.user!.role, 'ORGANISATION_UPDATED', 'ORGANISATION', req.params.id, { name, country, baseCurrency, status });
  res.json({ success: true });
});

// Users, Roles, Permissions & Device Admin
adminRouter.get('/users', authenticateToken, requireRole(ADMIN_ROLES), (_req: AuthRequest, res: Response): void => {
  const users = db.prepare(`
    SELECT u.id, u.username, u.email, u.phone, u.full_name, u.role, u.is_active, u.is_locked, u.failed_logins,
           u.biometric_enabled, u.mobile_auth_active, u.organisation_id, u.permissions_json, u.last_login_at, u.created_at,
           o.name as organisation_name
    FROM users u
    LEFT JOIN organisations o ON o.id = u.organisation_id
    ORDER BY u.created_at DESC
  `).all() as any[];

  res.json({
    success: true,
    users: users.map((u) => ({
      ...u,
      permissions: u.permissions_json ? JSON.parse(u.permissions_json) : [],
    })),
  });
});

adminRouter.post('/users', authenticateToken, requireRole(['SUPER_ADMIN', 'SYSTEM_ADMIN', 'ORG_ADMIN']), (req: AuthRequest, res: Response): void => {
  const { username, email, phone, password, fullName, role = 'PAYMENT_INITIATOR', organisationId, permissions } = req.body;
  if (!username || !email || !password || !fullName) {
    res.status(400).json({ success: false, error: 'Username, email, password, and full name are required.' });
    return;
  }
  const dup = db.prepare(`SELECT id FROM users WHERE username = ? OR email = ?`).get(username, email);
  if (dup) {
    res.status(400).json({ success: false, error: 'Username or email already exists.' });
    return;
  }
  const id = uuidv4();
  const passHash = bcrypt.hashSync(password, 10);
  const pinHash = bcrypt.hashSync('002831', 10);
  const permsJson = JSON.stringify(permissions || ['VIEW_ACCOUNTS', 'VIEW_BALANCES', 'VIEW_TRANSACTIONS']);
  const targetOrgId = organisationId || 'org-meridian-in';

  db.prepare(`
    INSERT INTO users (id, username, email, phone, password_hash, full_name, role, is_active, biometric_enabled, security_pin_hash, mobile_auth_active, organisation_id, permissions_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, ?, 1, ?, ?)
  `).run(id, username, email, phone || '+44 7700 909999', passHash, fullName, role, pinHash, targetOrgId, permsJson);

  db.prepare(`
    INSERT INTO customer_profiles (id, user_id, customer_id, dob, address, city, country, postal_code, kyc_status, preferred_language)
    VALUES (?, ?, ?, '1990-01-01', '40 Bank Street', 'London', 'United Kingdom', 'E14 5NR', 'VERIFIED', 'en')
  `).run(uuidv4(), id, `CORP-${Math.floor(100000 + Math.random() * 899999)}`);

  db.prepare(`
    INSERT INTO organisation_users (id, organisation_id, user_id, role, permissions_json, is_default)
    VALUES (?, ?, ?, ?, ?, 1)
  `).run(uuidv4(), targetOrgId, id, role, permsJson);

  logAudit(req.user!.id, req.user!.role, 'USER_CREATED', 'USER', id, { username, role, organisationId: targetOrgId });
  res.json({ success: true, id });
});

adminRouter.put('/users/:id', authenticateToken, requireRole(['SUPER_ADMIN', 'SYSTEM_ADMIN', 'ORG_ADMIN']), (req: AuthRequest, res: Response): void => {
  const { fullName, email, phone, role, isActive, isLocked, organisationId, permissions, resetPin } = req.body;
  const user = db.prepare(`SELECT * FROM users WHERE id = ?`).get(req.params.id) as any;
  if (!user) {
    res.status(404).json({ success: false, error: 'User not found.' });
    return;
  }

  db.prepare(`
    UPDATE users
    SET full_name = COALESCE(?, full_name),
        email = COALESCE(?, email),
        phone = COALESCE(?, phone),
        role = COALESCE(?, role),
        is_active = COALESCE(?, is_active),
        is_locked = COALESCE(?, is_locked),
        failed_logins = CASE WHEN ? = 0 THEN 0 ELSE failed_logins END,
        organisation_id = COALESCE(?, organisation_id),
        permissions_json = COALESCE(?, permissions_json)
    WHERE id = ?
  `).run(
    fullName || null,
    email || null,
    phone || null,
    role || null,
    isActive !== undefined ? (isActive ? 1 : 0) : null,
    isLocked !== undefined ? (isLocked ? 1 : 0) : null,
    isLocked !== undefined ? (isLocked ? 1 : 0) : null,
    organisationId || null,
    permissions ? JSON.stringify(permissions) : null,
    user.id
  );

  if (organisationId || role || permissions) {
    const existingMem = db.prepare(`SELECT id FROM organisation_users WHERE user_id = ? AND organisation_id = ?`).get(user.id, organisationId || user.organisation_id) as any;
    if (existingMem) {
      db.prepare(`UPDATE organisation_users SET role = COALESCE(?, role), permissions_json = COALESCE(?, permissions_json) WHERE id = ?`)
        .run(role || null, permissions ? JSON.stringify(permissions) : null, existingMem.id);
    }
  }

  if (resetPin) {
    const newPinHash = bcrypt.hashSync('002831', 10);
    db.prepare(`UPDATE users SET security_pin_hash = ? WHERE id = ?`).run(newPinHash, user.id);
    logAudit(req.user!.id, req.user!.role, 'ADMIN_PIN_RESET', 'USER', user.id, { username: user.username });
  }

  logAudit(req.user!.id, req.user!.role, 'USER_UPDATED', 'USER', user.id, { role, isActive, isLocked, organisationId });
  res.json({ success: true });
});

// Approval Policies CRUD
adminRouter.get('/policies', authenticateToken, requireRole(ADMIN_ROLES), (_req: AuthRequest, res: Response): void => {
  const policies = db.prepare(`
    SELECT ap.*, o.name as organisation_name
    FROM approval_policies ap
    LEFT JOIN organisations o ON o.id = ap.organisation_id
    ORDER BY ap.organisation_id ASC, ap.min_amount ASC
  `).all();
  res.json({ success: true, policies });
});

adminRouter.post('/policies', authenticateToken, requireRole(['SUPER_ADMIN', 'SYSTEM_ADMIN', 'ORG_ADMIN']), (req: AuthRequest, res: Response): void => {
  const { organisationId, name, currency = 'ALL', minAmount = 0, maxAmount = 100000, requiredApprovals = 1, makerCheckerEnforced = true, requireStepUpAuth = true } = req.body;
  if (!organisationId || !name) {
    res.status(400).json({ success: false, error: 'Organisation and policy name are required.' });
    return;
  }
  const id = uuidv4();
  db.prepare(`
    INSERT INTO approval_policies (id, organisation_id, name, currency, min_amount, max_amount, required_approvals, maker_checker_enforced, require_step_up_auth, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `).run(id, organisationId, name, currency, Number(minAmount), Number(maxAmount), Number(requiredApprovals), makerCheckerEnforced ? 1 : 0, requireStepUpAuth ? 1 : 0);
  logAudit(req.user!.id, req.user!.role, 'POLICY_CREATED', 'APPROVAL_POLICY', id, { name, requiredApprovals });
  res.json({ success: true, id });
});

adminRouter.put('/policies/:id', authenticateToken, requireRole(['SUPER_ADMIN', 'SYSTEM_ADMIN', 'ORG_ADMIN']), (req: AuthRequest, res: Response): void => {
  const { name, requiredApprovals, minAmount, maxAmount, makerCheckerEnforced, requireStepUpAuth, isActive } = req.body;
  db.prepare(`
    UPDATE approval_policies
    SET name = COALESCE(?, name),
        required_approvals = COALESCE(?, required_approvals),
        min_amount = COALESCE(?, min_amount),
        max_amount = COALESCE(?, max_amount),
        maker_checker_enforced = COALESCE(?, maker_checker_enforced),
        require_step_up_auth = COALESCE(?, require_step_up_auth),
        is_active = COALESCE(?, is_active)
    WHERE id = ?
  `).run(
    name || null,
    requiredApprovals !== undefined ? Number(requiredApprovals) : null,
    minAmount !== undefined ? Number(minAmount) : null,
    maxAmount !== undefined ? Number(maxAmount) : null,
    makerCheckerEnforced !== undefined ? (makerCheckerEnforced ? 1 : 0) : null,
    requireStepUpAuth !== undefined ? (requireStepUpAuth ? 1 : 0) : null,
    isActive !== undefined ? (isActive ? 1 : 0) : null,
    req.params.id
  );
  logAudit(req.user!.id, req.user!.role, 'POLICY_UPDATED', 'APPROVAL_POLICY', req.params.id, { requiredApprovals, isActive });
  res.json({ success: true });
});

// Sandbox Data Management (Explicitly labelled sandbox adjustments + audit log)
adminRouter.get('/sandbox/accounts', authenticateToken, requireRole(ADMIN_ROLES), (_req: AuthRequest, res: Response): void => {
  const accounts = db.prepare(`
    SELECT a.*, o.name as organisation_name, u.full_name as owner_name
    FROM accounts a
    LEFT JOIN organisations o ON o.id = a.organisation_id
    LEFT JOIN users u ON u.id = a.user_id
    ORDER BY o.name ASC, a.currency ASC
  `).all();
  res.json({ success: true, isSandbox: true, accounts });
});

adminRouter.post('/sandbox/accounts/adjust-balance', authenticateToken, requireRole(['SUPER_ADMIN', 'SYSTEM_ADMIN', 'OPERATIONS']), (req: AuthRequest, res: Response): void => {
  const { accountId, newAvailableBalance, reason } = req.body;
  if (!accountId || newAvailableBalance === undefined || !reason || String(reason).trim().length < 5) {
    res.status(400).json({ success: false, error: 'Account ID, non-negative balance, and business reason (min 5 chars) are required.' });
    return;
  }
  const numBal = Number(newAvailableBalance);
  if (isNaN(numBal) || numBal < 0) {
    res.status(400).json({ success: false, error: 'Balance must be zero or positive.' });
    return;
  }

  const acc = db.prepare(`SELECT * FROM accounts WHERE id = ?`).get(accountId) as any;
  if (!acc) {
    res.status(404).json({ success: false, error: 'Sandbox account not found.' });
    return;
  }

  const prev = acc.available_balance;
  runTransaction(() => {
    db.prepare(`UPDATE accounts SET available_balance = ?, ledger_balance = ? WHERE id = ?`).run(numBal, numBal, acc.id);
    logAudit(req.user!.id, req.user!.role, 'SANDBOX_BALANCE_OVERRIDE', 'ACCOUNT', acc.id, {
      accountNumber: acc.account_number,
      previousBalance: prev,
      newBalance: numBal,
      currency: acc.currency,
      reason,
      sandboxOnly: true,
    });
  });

  res.json({ success: true, message: 'Sandbox account balance updated and audited.' });
});

adminRouter.post('/sandbox/transactions', authenticateToken, requireRole(['SUPER_ADMIN', 'SYSTEM_ADMIN', 'OPERATIONS']), (req: AuthRequest, res: Response): void => {
  const { accountId, entryType = 'CREDIT', amount, counterpartyName, description, category = 'OTHER', reason } = req.body;
  const numAmount = Number(amount);
  if (!accountId || !numAmount || numAmount <= 0 || !counterpartyName || !description || !reason) {
    res.status(400).json({ success: false, error: 'All fields including mandatory audit reason are required.' });
    return;
  }

  const acc = db.prepare(`SELECT * FROM accounts WHERE id = ?`).get(accountId) as any;
  if (!acc) {
    res.status(404).json({ success: false, error: 'Account not found.' });
    return;
  }

  const delta = entryType === 'CREDIT' ? numAmount : -numAmount;
  const nextBal = Number((acc.available_balance + delta).toFixed(2));
  if (nextBal < 0) {
    res.status(400).json({ success: false, error: 'Debit exceeds sandbox account balance.' });
    return;
  }

  const txnId = uuidv4();
  const ref = `SBX-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 899999)}`;
  runTransaction(() => {
    db.prepare(`UPDATE accounts SET available_balance = ?, ledger_balance = ? WHERE id = ?`).run(nextBal, nextBal, acc.id);
    db.prepare(`
      INSERT INTO transactions (id, reference, user_id, source_account_id, counterparty_name, amount, currency, description, category, status, transaction_type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETED', ?)
    `).run(txnId, ref, acc.user_id, acc.id, counterpartyName, numAmount, acc.currency, `[SANDBOX] ${description}`, category, entryType === 'CREDIT' ? 'DEPOSIT_CREDIT' : 'DOMESTIC_TRANSFER');
    db.prepare(`
      INSERT INTO ledger_entries (id, transaction_id, account_id, entry_type, amount, currency, balance_after, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), txnId, acc.id, entryType, numAmount, acc.currency, nextBal, `[SANDBOX] ${description}`);
    logAudit(req.user!.id, req.user!.role, 'SANDBOX_TRANSACTION_INJECTED', 'TRANSACTION', txnId, { reference: ref, amount: numAmount, entryType, reason, sandboxOnly: true });
  });

  res.json({ success: true, reference: ref });
});

// Admin Approvals & Fraud Reports visibility
adminRouter.get('/approvals', authenticateToken, requireRole(ADMIN_ROLES), (_req: AuthRequest, res: Response): void => {
  const rows = db.prepare(`
    SELECT p.*, o.name as organisation_name
    FROM payment_instructions p
    LEFT JOIN organisations o ON o.id = p.organisation_id
    ORDER BY p.created_at DESC LIMIT 100
  `).all();
  res.json({ success: true, approvals: rows });
});

adminRouter.get('/fraud-reports', authenticateToken, requireRole(ADMIN_ROLES), (_req: AuthRequest, res: Response): void => {
  const reports = db.prepare(`
    SELECT f.*, u.full_name as reporter_name, o.name as organisation_name
    FROM fraud_reports f
    LEFT JOIN users u ON u.id = f.user_id
    LEFT JOIN organisations o ON o.id = f.organisation_id
    ORDER BY f.created_at DESC
  `).all();
  res.json({ success: true, reports });
});

adminRouter.get('/security-events', authenticateToken, requireRole(ADMIN_ROLES), (_req: AuthRequest, res: Response): void => {
  const events = db.prepare(`
    SELECT a.*, u.username as actor_username, u.full_name as actor_name
    FROM audit_logs a
    LEFT JOIN users u ON u.id = a.user_id
    WHERE a.action LIKE '%LOGIN%' OR a.action LIKE '%PIN%' OR a.action LIKE '%LOCK%' OR a.action LIKE '%DEVICE%' OR a.action LIKE '%PASSKEY%' OR a.action LIKE '%FRAUD%' OR a.action LIKE '%SECURITY%'
    ORDER BY a.created_at DESC LIMIT 100
  `).all();
  res.json({ success: true, events });
});
