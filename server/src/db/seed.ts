import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { db, runTransaction } from './database';
import { initializeSchema } from './schema';

const ALL_PERMS = [
  'VIEW_ACCOUNTS', 'VIEW_BALANCES', 'VIEW_TRANSACTIONS', 'CREATE_PAYMENTS',
  'APPROVE_PAYMENTS', 'REJECT_PAYMENTS', 'MANAGE_BENEFICIARIES',
  'ACCESS_TRADE_FINANCE', 'ACCESS_RECEIVABLES_FINANCE', 'VIEW_LIQUIDITY',
  'ACCESS_RDC', 'REQUEST_DOCUMENTS', 'MANAGE_USERS', 'MANAGE_ORGANISATIONS',
  'MANAGE_POLICIES', 'VIEW_AUDIT_LOGS'
];

const INITIATOR_PERMS = [
  'VIEW_ACCOUNTS', 'VIEW_BALANCES', 'VIEW_TRANSACTIONS', 'CREATE_PAYMENTS',
  'MANAGE_BENEFICIARIES', 'ACCESS_TRADE_FINANCE', 'ACCESS_RECEIVABLES_FINANCE',
  'ACCESS_RDC', 'REQUEST_DOCUMENTS', 'VIEW_LIQUIDITY'
];

const AUTHORISER_PERMS = [
  'VIEW_ACCOUNTS', 'VIEW_BALANCES', 'VIEW_TRANSACTIONS', 'APPROVE_PAYMENTS',
  'REJECT_PAYMENTS', 'ACCESS_TRADE_FINANCE', 'VIEW_LIQUIDITY', 'REQUEST_DOCUMENTS'
];

const VIEWER_PERMS = [
  'VIEW_ACCOUNTS', 'VIEW_BALANCES', 'VIEW_TRANSACTIONS', 'VIEW_LIQUIDITY', 'REQUEST_DOCUMENTS'
];

export function seedDatabase() {
  initializeSchema();

  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  if (userCount.count === 0) {
    seedCoreLegacyData();
  }

  const orgCount = db.prepare('SELECT COUNT(*) as count FROM organisations').get() as { count: number };
  if (orgCount.count === 0) {
    seedCorporateData();
  }

  syncCoralgenzAndNewModules();
}

function seedCoreLegacyData() {
  runTransaction(() => {
    const passwordHash = bcrypt.hashSync('Password@123', 10);
    const adminPasswordHash = bcrypt.hashSync('Admin@123', 10);
    const pinHash = bcrypt.hashSync('1234', 10);
    const secPinHash = bcrypt.hashSync('002831', 10);

    const premierUserId = uuidv4();
    db.prepare(`
      INSERT INTO users (id, username, email, phone, password_hash, full_name, role, is_active, biometric_enabled, transaction_pin_hash, security_pin_hash, mobile_auth_active, permissions_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?, 1, ?)
    `).run(
      premierUserId,
      'coralgenz global',
      'karthick.krishna@coralgenz.com',
      '+44 7700 900821',
      passwordHash,
      'Karthick Krishna M S',
      'USER',
      pinHash,
      secPinHash,
      JSON.stringify(ALL_PERMS.filter((p) => p !== 'MANAGE_ORGANISATIONS' && p !== 'MANAGE_POLICIES'))
    );

    db.prepare(`
      INSERT INTO customer_profiles (id, user_id, customer_id, dob, address, city, country, postal_code, kyc_status, preferred_language)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'VERIFIED', 'en')
    `).run(
      uuidv4(),
      premierUserId,
      'GB4490182',
      '1988-06-14',
      '40 Bank Street, Canary Wharf',
      'London',
      'United Kingdom',
      'E14 5NR'
    );

    const adminRoles = [
      { username: 'super_admin', email: 'admin@coralgenz.com', phone: '+44 20 7946 0901', name: 'Victoria Sterling', role: 'SUPER_ADMIN' },
      { username: 'ops_officer', email: 'ops@coralgenz.com', phone: '+44 20 7946 0902', name: 'Marcus Chen', role: 'OPERATIONS' },
      { username: 'support_rep', email: 'support@coralgenz.com', phone: '+44 20 7946 0903', name: 'Elena Rostova', role: 'SUPPORT' },
      { username: 'compliance_officer', email: 'compliance@coralgenz.com', phone: '+44 20 7946 0904', name: 'Arthur Pendelton', role: 'COMPLIANCE' },
      { username: 'bank_auditor', email: 'auditor@coralgenz.com', phone: '+44 20 7946 0905', name: 'Sarah Jenkins', role: 'AUDITOR' }
    ];

    for (const admin of adminRoles) {
      db.prepare(`
        INSERT INTO users (id, username, email, phone, password_hash, full_name, role, is_active, biometric_enabled, security_pin_hash, permissions_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?)
      `).run(uuidv4(), admin.username, admin.email, admin.phone, adminPasswordHash, admin.name, admin.role, secPinHash, JSON.stringify(ALL_PERMS));
    }

    const accSavingsId = uuidv4();
    const accCurrentId = uuidv4();
    const accSalaryId = uuidv4();
    const accFdId = uuidv4();
    const accRdId = uuidv4();
    const accFxId = uuidv4();

    const accounts = [
      { id: accSavingsId, number: '400515-89410291', name: 'GBP Operating Treasury', type: 'SAVINGS', currency: 'GBP', avail: 48250.75, ledger: 48250.75, sortCode: '40-05-15', fav: 1, favOrder: 1 },
      { id: accCurrentId, number: '400515-77192044', name: 'GBP Corporate Disbursements', type: 'CURRENT', currency: 'GBP', avail: 9840.20, ledger: 9840.20, sortCode: '40-05-15', fav: 1, favOrder: 2 },
      { id: accSalaryId, number: '400515-62049182', name: 'UK Payroll Clearing Account', type: 'SALARY', currency: 'GBP', avail: 15300.00, ledger: 15300.00, sortCode: '40-05-15', fav: 0, favOrder: 5 },
      { id: accFdId, number: '400515-55910238', name: 'Sterling Money Market Reserve', type: 'FIXED_DEPOSIT', currency: 'GBP', avail: 25000.00, ledger: 25000.00, sortCode: '40-05-15', fav: 0, favOrder: 6 },
      { id: accRdId, number: '400515-44829103', name: 'Escrow Settlement Reserve', type: 'RECURRING_DEPOSIT', currency: 'GBP', avail: 6000.00, ledger: 6000.00, sortCode: '40-05-15', fav: 0, favOrder: 7 },
      { id: accFxId, number: '400515-99201485', name: 'USD Trade Nostro Account', type: 'FOREIGN_CURRENCY', currency: 'USD', avail: 12450.00, ledger: 12450.00, sortCode: '40-05-15', fav: 1, favOrder: 3 }
    ];

    const insertAccount = db.prepare(`
      INSERT INTO accounts (id, user_id, account_number, account_name, account_type, currency, available_balance, ledger_balance, status, branch_name, ifsc_swift, sort_code, country, is_favourite, favourite_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', 'Canary Wharf Corporate Hub', 'CGLBGB2LXXX', ?, 'GB', ?, ?)
    `);

    for (const acc of accounts) {
      insertAccount.run(acc.id, premierUserId, acc.number, acc.name, acc.type, acc.currency, acc.avail, acc.ledger, acc.sortCode, acc.fav, acc.favOrder);
    }

    const transactionsData = [
      { ref: 'TXN-2026-90812', accountId: accSalaryId, party: 'Coralgenz Global Payroll #11', amount: 8500.00, currency: 'GBP', desc: 'Monthly Corporate Payroll Settlement', cat: 'SALARY', type: 'DOMESTIC_TRANSFER', entryType: 'CREDIT', daysAgo: 1 },
      { ref: 'TXN-2026-89211', accountId: accSavingsId, party: 'EDF Energy Commercial', amount: 142.50, currency: 'GBP', desc: 'London Hub Facilities Utility', cat: 'UTILITIES', type: 'BILL_PAYMENT', entryType: 'DEBIT', daysAgo: 2 },
      { ref: 'TXN-2026-88402', accountId: accCurrentId, party: 'Apex Logistics Freight', amount: 285.00, currency: 'GBP', desc: 'Port Customs & Freight Charge', cat: 'SUPPLIER', type: 'DOMESTIC_TRANSFER', entryType: 'DEBIT', daysAgo: 3 },
      { ref: 'TXN-2026-87915', accountId: accSavingsId, party: 'Nordic Components GmbH', amount: 1200.00, currency: 'GBP', desc: 'Raw Material Vendor Settlement', cat: 'TRANSFER', type: 'DOMESTIC_TRANSFER', entryType: 'DEBIT', daysAgo: 5 },
      { ref: 'TXN-2026-86104', accountId: accFxId, party: 'AWS EMEA Cloud Billing', amount: 1199.00, currency: 'USD', desc: 'Enterprise Cloud Infrastructure', cat: 'SUPPLIER', type: 'INTL_TRANSFER', entryType: 'DEBIT', daysAgo: 7 },
      { ref: 'TXN-2026-85420', accountId: accSavingsId, party: 'Coralgenz Treasury Yield', amount: 320.45, currency: 'GBP', desc: 'Overnight Sweep Interest Credit', cat: 'INVESTMENT', type: 'DEPOSIT_CREDIT', entryType: 'CREDIT', daysAgo: 10 },
      { ref: 'TXN-2026-84319', accountId: accCurrentId, party: 'Thames Water Commercial', amount: 68.20, currency: 'GBP', desc: 'Facility Water Direct Debit', cat: 'UTILITIES', type: 'BILL_PAYMENT', entryType: 'DEBIT', daysAgo: 12 },
      { ref: 'TXN-2026-83110', accountId: accSavingsId, party: 'CHAPS Clearing Fee', amount: 30.00, currency: 'GBP', desc: 'Priority Wire Settlement Levy', cat: 'CHARGES', type: 'DOMESTIC_TRANSFER', entryType: 'DEBIT', daysAgo: 15 }
    ];

    const insertTxn = db.prepare(`
      INSERT INTO transactions (id, reference, user_id, source_account_id, counterparty_name, amount, currency, description, category, status, transaction_type, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETED', ?, datetime('now', ? || ' days'))
    `);

    const insertLedger = db.prepare(`
      INSERT INTO ledger_entries (id, transaction_id, account_id, entry_type, amount, currency, balance_after, description, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', ? || ' days'))
    `);

    for (const t of transactionsData) {
      const txnId = uuidv4();
      insertTxn.run(txnId, t.ref, premierUserId, t.accountId, t.party, t.amount, t.currency, t.desc, t.cat, t.type, `-${t.daysAgo}`);
      insertLedger.run(uuidv4(), txnId, t.accountId, t.entryType, t.amount, t.currency, t.entryType === 'CREDIT' ? 48250.75 : 48250.75 - t.amount, t.desc, `-${t.daysAgo}`);
    }

    const beneficiaries = [
      { name: 'Nordic Components GmbH', nickname: 'Munich Supplier', number: 'DE89370400440532013000', bank: 'Deutsche Bank AG', code: 'DEUTDEFFXXX', limit: 250000, fav: 1, country: 'DE', currency: 'EUR' },
      { name: 'Thames Logistics Partners Ltd', nickname: 'UK Freight', number: '200412-99014522', bank: 'Barclays Corporate UK', code: 'BARCGB22XXX', limit: 150000, fav: 1, country: 'GB', currency: 'GBP' },
      { name: 'Pacific Trade Holdings Inc', nickname: 'US Vendor', number: '021000021-88910422', bank: 'JPMorgan Chase NA', code: 'CHASUS33XXX', limit: 500000, fav: 0, country: 'US', currency: 'USD' },
      { name: 'Precision Castings India Pvt Ltd', nickname: 'Chennai Plant', number: '50200044128910', bank: 'HDFC Corporate Bank', code: 'HDFCINBBXXX', limit: 10000000, fav: 1, country: 'IN', currency: 'INR' },
      { name: 'Coralgenz Global Singapore Pte Ltd', nickname: 'APAC Treasury', number: '7375-051-9910421', bank: 'DBS Bank Singapore', code: 'DBSSSGSGXXX', limit: 300000, fav: 0, country: 'SG', currency: 'SGD' }
    ];

    const insertBen = db.prepare(`
      INSERT INTO beneficiaries (id, user_id, name, nickname, account_number, bank_name, ifsc_swift, transfer_limit, is_favorite, is_active, activation_status, country, currency)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'ACTIVE', ?, ?)
    `);

    for (const b of beneficiaries) {
      insertBen.run(uuidv4(), premierUserId, b.name, b.nickname, b.number, b.bank, b.code, b.limit, b.fav, b.country, b.currency);
    }

    const cardCreditId = uuidv4();
    const cardDebitId = uuidv4();
    db.prepare(`
      INSERT INTO cards (
        id, user_id, account_id, card_number_masked, card_number_last4, card_type, card_network, card_tier,
        cardholder_name, expiry_month, expiry_year, cvv_encrypted, is_frozen, is_blocked, pin_hash,
        online_enabled, international_enabled, contactless_enabled, daily_spending_limit, current_month_spent,
        credit_limit, available_credit, min_due, payment_due_date, reward_points
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, 1, 1, 1, 10000.00, 2410.50, 30000.00, 27589.50, 150.00, '2026-12-15', 48920)
    `).run(cardCreditId, premierUserId, accCurrentId, '•••• •••• •••• 9821', '9821', 'CREDIT', 'MASTERCARD', 'CORPORATE_WORLD_ELITE', 'KARTHICK KRISHNA M S', '09', '29', '892', pinHash);

    db.prepare(`
      INSERT INTO cards (
        id, user_id, account_id, card_number_masked, card_number_last4, card_type, card_network, card_tier,
        cardholder_name, expiry_month, expiry_year, cvv_encrypted, is_frozen, is_blocked, pin_hash,
        online_enabled, international_enabled, contactless_enabled, daily_spending_limit, current_month_spent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, 1, 1, 1, 5000.00, 842.10)
    `).run(cardDebitId, premierUserId, accSavingsId, '•••• •••• •••• 4108', '4108', 'DEBIT', 'VISA', 'CORPORATE_PLATINUM', 'KARTHICK KRISHNA M S', '11', '28', '419', pinHash);

    db.prepare(`
      INSERT INTO deposits (id, user_id, account_id, deposit_type, deposit_number, principal_amount, interest_rate, tenure_months, expected_maturity_amount, maturity_date, status)
      VALUES (?, ?, ?, 'FIXED', 'FD-2026-88102', 25000.00, 5.25, 24, 27725.50, '2028-06-15', 'ACTIVE')
    `).run(uuidv4(), premierUserId, accFdId);

    db.prepare(`
      INSERT INTO loans (id, user_id, loan_type, loan_number, principal_amount, interest_rate, tenure_months, emi_amount, outstanding_balance, next_emi_date, status)
      VALUES (?, ?, 'CORPORATE', 'CL-2025-09144', 150000.00, 5.40, 36, 4520.55, 92800.00, '2026-12-10', 'ACTIVE')
    `).run(uuidv4(), premierUserId);

    const bills = [
      { cat: 'TAX_AUTHORITY', name: 'HMRC Corporate VAT Clearing', num: 'VAT-8849-019', amt: 1420.50, due: '2026-12-18', status: 'PENDING' },
      { cat: 'ELECTRICITY', name: 'EDF Business Commercial Power', num: 'EDF-4401-982', amt: 680.20, due: '2026-12-22', status: 'PENDING' },
      { cat: 'TELECOM', name: 'BT Corporate Fiber Trunk', num: 'BT-9912-300', amt: 254.99, due: '2026-12-08', status: 'PENDING' },
      { cat: 'CLOUD_INFRA', name: 'AWS Enterprise Settlement', num: 'AWS-7710-449', amt: 1890.00, due: '2026-11-20', status: 'PAID' }
    ];
    const insertBill = db.prepare(`
      INSERT INTO bill_payments (id, user_id, account_id, biller_category, biller_name, consumer_number, bill_amount, due_date, status, payment_reference)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const bill of bills) {
      insertBill.run(uuidv4(), premierUserId, accSavingsId, bill.cat, bill.name, bill.num, bill.amt, bill.due, bill.status, bill.status === 'PAID' ? 'REF-PAID-88129' : null);
    }

    const notifications = [
      { title: 'Payment Awaiting Authorisation', msg: 'Priority wire PAY-2026-44102 (EUR 42,500.00 to Nordic Components GmbH) requires 1 authorisation.', type: 'PAYMENT', read: 0 },
      { title: 'Trade Documentary Credit Issued', msg: 'Import DC TRD-2026-11092 (USD 185,000.00) updated to Issued status.', type: 'SYSTEM', read: 0 },
      { title: 'Security Check: Registered Passkey', msg: 'Platform WebAuthn verification active for Karthick Krishna M S.', type: 'SECURITY', read: 0 },
      { title: 'Receivables Draw Settled', msg: 'Facility RF-UK-9012 draw of GBP 35,000.00 credited to operating treasury.', type: 'TRANSACTION', read: 1 }
    ];
    const insertNotif = db.prepare(`
      INSERT INTO notifications (id, user_id, title, message, type, is_read, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now', ?))
    `);
    let nOffset = -1;
    for (const notif of notifications) {
      insertNotif.run(uuidv4(), premierUserId, notif.title, notif.msg, notif.type, notif.read, `${nOffset} hours`);
      nOffset -= 4;
    }

    const ticketId = uuidv4();
    db.prepare(`
      INSERT INTO support_tickets (id, ticket_number, user_id, category, subject, description, priority, status)
      VALUES (?, 'TCK-2026-0041', ?, 'ACCOUNT_INQUIRY', 'SEPA Instant Cut-off & Dual Approval Limit', 'Clarification on cut-off window for EUR SEPA payments exceeding EUR 50,000.', 'MEDIUM', 'OPEN')
    `).run(ticketId, premierUserId);

    db.prepare(`
      INSERT INTO support_messages (id, ticket_id, sender_id, sender_type, message)
      VALUES (?, ?, ?, 'USER', 'Could you confirm the daily cut-off time for EUR SEPA priority settlements above EUR 50,000?')
    `).run(uuidv4(), ticketId, premierUserId);

    db.prepare(`
      INSERT INTO support_messages (id, ticket_id, sender_id, sender_type, message)
      VALUES (?, ?, 'SYSTEM_BOT', 'SUPPORT_AGENT', 'Hello, EUR SEPA priority instructions authorised before 15:30 GMT are queued for same-day TARGET2 settlement in the sandbox workflow.')
    `).run(uuidv4(), ticketId);

    db.prepare(`
      INSERT INTO audit_logs (id, user_id, actor_role, action, resource, resource_id, details, ip_address)
      VALUES (?, ?, 'SUPER_ADMIN', 'SYSTEM_INITIALIZATION', 'CORE_BANKING_LEDGER', 'GENESIS_BLOCK', 'Core banking ledger initialized with verified double-entry constraints.', '127.0.0.1')
    `).run(uuidv4(), premierUserId);
  });
}

function seedCorporateData() {
  runTransaction(() => {
    const orgGbId = 'org-meridian-gb';
    const orgInId = 'org-meridian-in';
    const orgUsId = 'org-meridian-us';

    const modulesGb = {
      accounts: true, authorisations: true, payments: true, track: true,
      liquidity: true, tradeFinance: true, receivablesFinance: true,
      remoteDepositCapture: true, billPayments: true, selfService: true
    };
    const modulesIn = {
      accounts: true, authorisations: true, payments: true, track: true,
      liquidity: true, tradeFinance: true, receivablesFinance: true,
      remoteDepositCapture: false, // Country restriction: RDC unavailable in India
      billPayments: true, selfService: true
    };
    const modulesUs = {
      accounts: true, authorisations: true, payments: true, track: true,
      liquidity: true, tradeFinance: true, receivablesFinance: true,
      remoteDepositCapture: true, billPayments: true, selfService: true
    };

    db.prepare(`
      INSERT INTO organisations (id, name, registration_number, country, base_currency, status, is_sandbox, modules_json)
      VALUES (?, ?, ?, ?, ?, 'ACTIVE', 1, ?)
    `).run(orgGbId, 'Coralgenz Global UK Ltd', 'UK-RC-09482110', 'GB', 'GBP', JSON.stringify(modulesGb));

    db.prepare(`
      INSERT INTO organisations (id, name, registration_number, country, base_currency, status, is_sandbox, modules_json)
      VALUES (?, ?, ?, ?, ?, 'ACTIVE', 1, ?)
    `).run(orgInId, 'Coralgenz Global India Pvt Ltd', 'CIN-U72900TN2021PTC', 'IN', 'INR', JSON.stringify(modulesIn));

    db.prepare(`
      INSERT INTO organisations (id, name, registration_number, country, base_currency, status, is_sandbox, modules_json)
      VALUES (?, ?, ?, ?, ?, 'ACTIVE', 1, ?)
    `).run(orgUsId, 'Coralgenz Global US Inc', 'US-DE-8839201', 'US', 'USD', JSON.stringify(modulesUs));

    // Fetch primary user & super_admin
    const premierUser = db.prepare(`SELECT id, full_name FROM users WHERE username IN ('coralgenz global', 'premier_user')`).get() as any;
    const superAdmin = db.prepare(`SELECT id FROM users WHERE username = 'super_admin'`).get() as any;

    const corpPassHash = bcrypt.hashSync('CorpPass@2026', 10);
    const secPinHash = bcrypt.hashSync('002831', 10);

    // Create dedicated corporate maker-checker personas
    const initiatorId = uuidv4();
    const authoriserId = uuidv4();
    const viewerId = uuidv4();

    const corpUsers = [
      { id: initiatorId, username: 'corp_initiator', email: 'initiator@coralgenz.com', phone: '+44 7700 901101', name: 'Claire Beaumont', role: 'PAYMENT_INITIATOR', orgId: orgGbId, perms: INITIATOR_PERMS },
      { id: authoriserId, username: 'corp_authoriser', email: 'authoriser@coralgenz.com', phone: '+44 7700 901102', name: 'Rajiv Malhotra', role: 'AUTHORISER', orgId: orgGbId, perms: AUTHORISER_PERMS },
      { id: viewerId, username: 'corp_viewer', email: 'viewer@coralgenz.com', phone: '+44 7700 901103', name: 'Hannah Lindqvist', role: 'FINANCE_VIEWER', orgId: orgGbId, perms: VIEWER_PERMS },
    ];

    for (const u of corpUsers) {
      db.prepare(`
        INSERT OR IGNORE INTO users (id, username, email, phone, password_hash, full_name, role, is_active, biometric_enabled, security_pin_hash, mobile_auth_active, organisation_id, permissions_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, ?, 1, ?, ?)
      `).run(u.id, u.username, u.email, u.phone, corpPassHash, u.name, u.role, secPinHash, u.orgId, JSON.stringify(u.perms));

      db.prepare(`
        INSERT OR IGNORE INTO customer_profiles (id, user_id, customer_id, dob, address, city, country, postal_code, kyc_status, preferred_language)
        VALUES (?, ?, ?, '1985-04-12', '40 Bank Street, Canary Wharf', 'London', 'United Kingdom', 'E14 5NR', 'VERIFIED', 'en')
      `).run(uuidv4(), u.id, `CORP-${u.username.slice(5).toUpperCase()}`);
    }

    if (premierUser) {
      db.prepare(`UPDATE users SET organisation_id = ?, security_pin_hash = COALESCE(security_pin_hash, ?), permissions_json = COALESCE(permissions_json, ?) WHERE id = ?`)
        .run(orgGbId, secPinHash, JSON.stringify(ALL_PERMS.filter((p) => p !== 'MANAGE_ORGANISATIONS' && p !== 'MANAGE_POLICIES')), premierUser.id);

      // Link existing accounts of premier_user to orgGbId
      db.prepare(`UPDATE accounts SET organisation_id = ?, country = 'GB' WHERE user_id = ? AND organisation_id IS NULL`).run(orgGbId, premierUser.id);
      db.prepare(`UPDATE beneficiaries SET organisation_id = ? WHERE user_id = ? AND organisation_id IS NULL`).run(orgGbId, premierUser.id);

      // Add multi-org memberships for premier_user
      db.prepare(`INSERT INTO organisation_users (id, organisation_id, user_id, role, permissions_json, is_default) VALUES (?, ?, ?, 'ORG_ADMIN', ?, 1)`)
        .run(uuidv4(), orgGbId, premierUser.id, JSON.stringify(ALL_PERMS.filter((p) => p !== 'MANAGE_ORGANISATIONS')));
      db.prepare(`INSERT INTO organisation_users (id, organisation_id, user_id, role, permissions_json, is_default) VALUES (?, ?, ?, 'ORG_ADMIN', ?, 0)`)
        .run(uuidv4(), orgInId, premierUser.id, JSON.stringify(ALL_PERMS.filter((p) => p !== 'MANAGE_ORGANISATIONS' && p !== 'ACCESS_RDC')));
      db.prepare(`INSERT INTO organisation_users (id, organisation_id, user_id, role, permissions_json, is_default) VALUES (?, ?, ?, 'AUTHORISER', ?, 0)`)
        .run(uuidv4(), orgUsId, premierUser.id, JSON.stringify(AUTHORISER_PERMS));

      // Add EUR, INR, SGD corporate accounts for richer multi-currency liquidity & grouping
      const accEurId = uuidv4();
      const accInrId = uuidv4();
      const accUsId = uuidv4();

      db.prepare(`
        INSERT INTO accounts (id, user_id, organisation_id, account_number, account_name, nickname, account_type, currency, available_balance, ledger_balance, status, branch_name, ifsc_swift, sort_code, iban, country, is_favourite, favourite_order)
        VALUES (?, ?, ?, 'DE89-3704-0044-0532', 'Euro SEPA Treasury Pool', 'EUR Concentration', 'TREASURY', 'EUR', 142850.40, 148200.40, 'ACTIVE', 'Frankfurt Corporate Hub', 'CGLBDEFFXXX', '37040044', 'DE89370400440532013000', 'DE', 1, 4)
      `).run(accEurId, premierUser.id, orgGbId);

      db.prepare(`
        INSERT INTO accounts (id, user_id, organisation_id, account_number, account_name, nickname, account_type, currency, available_balance, ledger_balance, status, branch_name, ifsc_swift, sort_code, country, is_favourite, favourite_order)
        VALUES (?, ?, ?, '0641-0088-2941-01', 'India Corporate Current', 'Chennai Ops INR', 'OPERATING', 'INR', 122373000.00, 122373000.00, 'ACTIVE', 'Chennai Anna Salai Corporate', 'CGLB0641002', '64-10-02', 'IN', 1, 1)
      `).run(accInrId, premierUser.id, orgInId);

      db.prepare(`
        INSERT INTO accounts (id, user_id, organisation_id, account_number, account_name, nickname, account_type, currency, available_balance, ledger_balance, status, branch_name, ifsc_swift, sort_code, country, is_favourite, favourite_order)
        VALUES (?, ?, ?, '0210-0002-1988-44', 'US Dollar Clearing Account', 'NY Fedwire Ops', 'OPERATING', 'USD', 265400.00, 265400.00, 'ACTIVE', 'New York Midtown Hub', 'CGLBUS33XXX', '021000021', 'US', 1, 1)
      `).run(accUsId, premierUser.id, orgUsId);

      // Also link corp_initiator, corp_authoriser, corp_viewer to orgGbId
      for (const u of corpUsers) {
        db.prepare(`INSERT INTO organisation_users (id, organisation_id, user_id, role, permissions_json, is_default) VALUES (?, ?, ?, ?, ?, 1)`)
          .run(uuidv4(), orgGbId, u.id, u.role, JSON.stringify(u.perms));
      }

      // Registered devices
      db.prepare(`
        INSERT INTO registered_devices (id, user_id, device_name, platform, device_type, status, last_used_at)
        VALUES (?, ?, 'iPhone 16 Pro (Treasury Auth)', 'iOS 19.1 / Safari', 'MOBILE_AUTH', 'ACTIVE', datetime('now', '-2 hours'))
      `).run(uuidv4(), premierUser.id);
      db.prepare(`
        INSERT INTO registered_devices (id, user_id, device_name, platform, device_type, status, last_used_at)
        VALUES (?, ?, 'MacBook Pro M4 (Platform Passkey)', 'macOS / Chrome', 'PASSKEY', 'ACTIVE', datetime('now', '-15 minutes'))
      `).run(uuidv4(), premierUser.id);

      // Seed Approval Policies
      db.prepare(`
        INSERT INTO approval_policies (id, organisation_id, name, currency, min_amount, max_amount, required_approvals, maker_checker_enforced, require_step_up_auth, is_active)
        VALUES (?, ?, 'Standard Single Authorisation (Up to 10,000)', 'ALL', 0, 10000, 1, 1, 0, 1)
      `).run(uuidv4(), orgGbId);
      db.prepare(`
        INSERT INTO approval_policies (id, organisation_id, name, currency, min_amount, max_amount, required_approvals, maker_checker_enforced, require_step_up_auth, is_active)
        VALUES (?, ?, 'Dual Treasury Authorisation (10,000 - 100,000)', 'ALL', 10000.01, 100000, 2, 1, 1, 1)
      `).run(uuidv4(), orgGbId);
      db.prepare(`
        INSERT INTO approval_policies (id, organisation_id, name, currency, min_amount, max_amount, required_approvals, maker_checker_enforced, require_step_up_auth, is_active)
        VALUES (?, ?, 'Executive Multi-Level Policy (> 100,000)', 'ALL', 100000.01, 999999999, 3, 1, 1, 1)
      `).run(uuidv4(), orgGbId);
      db.prepare(`
        INSERT INTO approval_policies (id, organisation_id, name, currency, min_amount, max_amount, required_approvals, maker_checker_enforced, require_step_up_auth, is_active)
        VALUES (?, ?, 'India Corporate Dual Control', 'INR', 500000, 999999999, 2, 1, 1, 1)
      `).run(uuidv4(), orgInId);

      const primaryAcc = db.prepare(`SELECT id, account_name, currency FROM accounts WHERE user_id = ? AND currency = 'GBP' LIMIT 1`).get(premierUser.id) as any;

      // Seed Payment Instructions for Auth & Track
      const nowIso = new Date().toISOString();
      const seedPayments = [
        {
          ref: 'PAY-2026-44102',
          orgId: orgGbId,
          initiatorId: initiatorId,
          initiatorName: 'Claire Beaumont',
          category: 'PRIORITY_PAYMENT',
          debitAccId: primaryAcc?.id || accEurId,
          debitAccName: primaryAcc?.account_name || 'GBP Operating Treasury',
          debitCurrency: 'GBP',
          benName: 'Nordic Components GmbH',
          benAcc: 'DE89370400440532013000',
          benBank: 'Deutsche Bank AG',
          country: 'DE',
          swift: 'DEUTDEFFXXX',
          iban: 'DE89370400440532013000',
          amount: 14500.00,
          currency: 'EUR',
          rate: 1.1730,
          converted: 17008.50,
          chargesBearer: 'OUR',
          chargesAmt: 18.00,
          purpose: 'SUPP',
          date: '2026-11-26',
          note: 'Q4 Turbine Actuator Invoice #NC-9021',
          status: 'AWAITING_AUTHORISATION',
          reqApp: 2,
          curApp: 1,
          flags: ['Cross-border FX settlement above GBP 10,000 threshold'],
          expiresAt: new Date(Date.now() + 36 * 3600 * 1000).toISOString(),
          approvals: [
            { approverId: authoriserId, approverName: 'Rajiv Malhotra', approverRole: 'AUTHORISER', decision: 'APPROVED', comment: 'Verified against PO-8821', timestamp: new Date(Date.now() - 2 * 3600 * 1000).toISOString() }
          ],
          timeline: [
            { id: '1', stage: 'CREATED', label: 'Payment created', description: 'Drafted by Claire Beaumont (Payment Initiator)', actor: 'Claire Beaumont', timestamp: new Date(Date.now() - 4 * 3600 * 1000).toISOString(), state: 'COMPLETED' },
            { id: '2', stage: 'SUBMITTED', label: 'Submitted for approval', description: 'Policy matched: Dual Treasury Authorisation (2 approvals required)', timestamp: new Date(Date.now() - 3.5 * 3600 * 1000).toISOString(), state: 'COMPLETED' },
            { id: '3', stage: 'AUTH_1', label: 'First approval recorded', description: 'Approved by Rajiv Malhotra (Authoriser)', actor: 'Rajiv Malhotra', timestamp: new Date(Date.now() - 2 * 3600 * 1000).toISOString(), state: 'COMPLETED' },
            { id: '4', stage: 'AUTH_2', label: 'Final authorisation pending', description: 'Awaiting second authoriser sign-off before sandbox settlement', timestamp: nowIso, state: 'CURRENT' },
          ]
        },
        {
          ref: 'PAY-2026-44109',
          orgId: orgGbId,
          initiatorId: initiatorId,
          initiatorName: 'Claire Beaumont',
          category: 'INTERNATIONAL_PAYMENT',
          debitAccId: primaryAcc?.id || accEurId,
          debitAccName: primaryAcc?.account_name || 'GBP Operating Treasury',
          debitCurrency: 'GBP',
          benName: 'Pacific Trade Holdings Inc',
          benAcc: '021000021-88910422',
          benBank: 'JPMorgan Chase NA',
          country: 'US',
          swift: 'CHASUS33XXX',
          iban: '',
          amount: 8250.00,
          currency: 'USD',
          rate: 1.2845,
          converted: 10597.13,
          chargesBearer: 'SHA',
          chargesAmt: 12.00,
          purpose: 'SUPP',
          date: '2026-11-26',
          note: 'US Distribution Hub Retainer Nov 2026',
          status: 'AWAITING_AUTHORISATION',
          reqApp: 1,
          curApp: 0,
          flags: [],
          expiresAt: new Date(Date.now() + 8 * 3600 * 1000).toISOString(),
          approvals: [],
          timeline: [
            { id: '1', stage: 'CREATED', label: 'Payment created', description: 'Created by Claire Beaumont', actor: 'Claire Beaumont', timestamp: new Date(Date.now() - 1 * 3600 * 1000).toISOString(), state: 'COMPLETED' },
            { id: '2', stage: 'SUBMITTED', label: 'Approval requested', description: 'Expiring within 8 hours — Single authorisation required', timestamp: new Date(Date.now() - 55 * 60 * 1000).toISOString(), state: 'CURRENT' },
          ]
        },
        {
          ref: 'PAY-2026-44115',
          orgId: orgGbId,
          initiatorId: initiatorId,
          initiatorName: 'Claire Beaumont',
          category: 'SEPA_PAYMENT',
          debitAccId: accEurId,
          debitAccName: 'Euro SEPA Treasury Pool',
          debitCurrency: 'EUR',
          benName: 'Nordic Components GmbH',
          benAcc: 'DE89370400440532013000',
          benBank: 'Deutsche Bank AG',
          country: 'DE',
          swift: 'DEUTDEFFXXX',
          iban: 'DE89370400440532013000',
          amount: 4800.00,
          currency: 'EUR',
          rate: 1.0,
          converted: 4800.00,
          chargesBearer: 'SHA',
          chargesAmt: 0,
          purpose: 'SUPP',
          date: '2026-11-26',
          note: 'SEPA Credit Transfer — Spare Parts Batch',
          status: 'AWAITING_AUTHORISATION',
          reqApp: 1,
          curApp: 0,
          flags: [],
          expiresAt: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
          approvals: [],
          timeline: [
            { id: '1', stage: 'CREATED', label: 'Payment created', description: 'Created by Claire Beaumont', actor: 'Claire Beaumont', timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(), state: 'COMPLETED' },
            { id: '2', stage: 'SUBMITTED', label: 'Awaiting authorisation', description: 'Queued for authoriser review', timestamp: new Date(Date.now() - 28 * 60 * 1000).toISOString(), state: 'CURRENT' },
          ]
        },
        {
          ref: 'PAY-2026-43980',
          orgId: orgGbId,
          initiatorId: initiatorId,
          initiatorName: 'Claire Beaumont',
          category: 'PRIORITY_PAYMENT',
          debitAccId: primaryAcc?.id || accEurId,
          debitAccName: primaryAcc?.account_name || 'GBP Operating Treasury',
          debitCurrency: 'GBP',
          benName: 'Thames Logistics Partners Ltd',
          benAcc: '200412-99014522',
          benBank: 'Barclays Corporate UK',
          country: 'GB',
          swift: 'BARCGB22XXX',
          iban: '',
          amount: 3420.00,
          currency: 'GBP',
          rate: 1.0,
          converted: 3420.00,
          chargesBearer: 'SHA',
          chargesAmt: 0,
          purpose: 'SUPP',
          date: '2026-11-24',
          note: 'UK Haulage Settlement Nov W3',
          status: 'COMPLETED',
          reqApp: 1,
          curApp: 1,
          flags: [],
          expiresAt: null,
          approvals: [
            { approverId: authoriserId, approverName: 'Rajiv Malhotra', approverRole: 'AUTHORISER', decision: 'APPROVED', comment: 'Approved', timestamp: new Date(Date.now() - 48 * 3600 * 1000).toISOString() }
          ],
          timeline: [
            { id: '1', stage: 'CREATED', label: 'Payment created', description: 'Created by Claire Beaumont', timestamp: new Date(Date.now() - 50 * 3600 * 1000).toISOString(), state: 'COMPLETED' },
            { id: '2', stage: 'APPROVED', label: 'Approval completed', description: 'Authorised by Rajiv Malhotra', timestamp: new Date(Date.now() - 48 * 3600 * 1000).toISOString(), state: 'COMPLETED' },
            { id: '3', stage: 'PROCESSING', label: 'Sandbox clearing started', description: 'Internal double-entry ledger debit executed', timestamp: new Date(Date.now() - 47.9 * 3600 * 1000).toISOString(), state: 'COMPLETED' },
            { id: '4', stage: 'COMPLETED', label: 'Completed in sandbox ledger', description: 'Settled internally (Sandbox demonstration; no external bank wire sent)', timestamp: new Date(Date.now() - 47.5 * 3600 * 1000).toISOString(), state: 'COMPLETED' },
          ]
        },
        {
          ref: 'PAY-2026-43812',
          orgId: orgGbId,
          initiatorId: initiatorId,
          initiatorName: 'Claire Beaumont',
          category: 'ACH_CREDIT',
          debitAccId: primaryAcc?.id || accEurId,
          debitAccName: primaryAcc?.account_name || 'GBP Operating Treasury',
          debitCurrency: 'GBP',
          benName: 'Unverified External Vendor Ltd',
          benAcc: '9910-442109',
          benBank: 'Metro Commercial Bank',
          country: 'GB',
          swift: 'MYMBGB2LXXX',
          iban: '',
          amount: 19500.00,
          currency: 'GBP',
          rate: 1.0,
          converted: 19500.00,
          chargesBearer: 'SHA',
          chargesAmt: 0,
          purpose: 'OTHR',
          date: '2026-11-22',
          note: 'Ad-hoc consultancy invoice',
          status: 'REJECTED',
          reqApp: 2,
          curApp: 0,
          flags: ['New unverified counterparty'],
          expiresAt: null,
          approvals: [
            { approverId: authoriserId, approverName: 'Rajiv Malhotra', approverRole: 'AUTHORISER', decision: 'REJECTED', comment: 'Missing signed vendor onboarding documentation', timestamp: new Date(Date.now() - 72 * 3600 * 1000).toISOString() }
          ],
          timeline: [
            { id: '1', stage: 'CREATED', label: 'Payment created', description: 'Created by Claire Beaumont', timestamp: new Date(Date.now() - 75 * 3600 * 1000).toISOString(), state: 'COMPLETED' },
            { id: '2', stage: 'REJECTED', label: 'Rejected by Authoriser', description: 'Missing signed vendor onboarding documentation', actor: 'Rajiv Malhotra', timestamp: new Date(Date.now() - 72 * 3600 * 1000).toISOString(), state: 'FAILED' },
          ]
        }
      ];

      const insertPay = db.prepare(`
        INSERT INTO payment_instructions (
          id, reference, organisation_id, initiator_id, initiator_name, category, debit_account_id,
          debit_account_name, debit_currency, beneficiary_name, beneficiary_account, beneficiary_bank,
          destination_country, swift_bic, iban, amount, currency, exchange_rate, converted_amount,
          charges_bearer, charges_amount, payment_purpose, payment_date, reference_note, status,
          required_approvals, current_approvals, approval_history_json, timeline_json, unusual_flags_json, expires_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const p of seedPayments) {
        insertPay.run(
          uuidv4(), p.ref, p.orgId, p.initiatorId, p.initiatorName, p.category, p.debitAccId,
          p.debitAccName, p.debitCurrency, p.benName, p.benAcc, p.benBank,
          p.country, p.swift, p.iban, p.amount, p.currency, p.rate, p.converted,
          p.chargesBearer, p.chargesAmt, p.purpose, p.date, p.note, p.status,
          p.reqApp, p.curApp, JSON.stringify(p.approvals), JSON.stringify(p.timeline), JSON.stringify(p.flags), p.expiresAt
        );
      }

      // Trade Finance Seed
      const tradeItems = [
        {
          ref: 'TRD-2026-11092',
          orgId: orgGbId,
          cat: 'IMPORT_DC',
          dir: 'IMPORT',
          party: 'Shenzhen Precision Electronics Co.',
          amount: 185000,
          cur: 'USD',
          status: 'AWAITING_AUTHORISATION',
          action: 'Authorise Import Documentary Credit Issuance',
          docs: [
            { id: 'doc-1', name: 'Commercial_Invoice_SZ8821.pdf', type: 'PDF', size: '420 KB' },
            { id: 'doc-2', name: 'Proforma_LC_Draft_v2.pdf', type: 'PDF', size: '615 KB' }
          ],
          timeline: [
            { id: 't1', stage: 'DRAFTED', label: 'LC Application Created', description: 'Prepared by Trade Desk', timestamp: new Date(Date.now() - 24 * 3600 * 1000).toISOString(), state: 'COMPLETED' },
            { id: 't2', stage: 'AUTH', label: 'Awaiting Corporate Sign-Off', description: 'Requires authorised trade signatory approval', timestamp: new Date().toISOString(), state: 'CURRENT' }
          ]
        },
        {
          ref: 'TRD-2026-10944',
          orgId: orgGbId,
          cat: 'DC_AMENDMENT',
          dir: 'IMPORT',
          party: 'Bavaria Industrial Motors GmbH',
          amount: 94000,
          cur: 'EUR',
          status: 'AWAITING_AUTHORISATION',
          action: 'Approve Shipment Date Extension (+14 Days)',
          docs: [{ id: 'doc-3', name: 'Amendment_Schedule_03.pdf', type: 'PDF', size: '210 KB' }],
          timeline: [
            { id: 't1', stage: 'AMEND_REQ', label: 'Amendment Requested', description: 'Latest shipment date extended to 18 Dec 2026', timestamp: new Date(Date.now() - 12 * 3600 * 1000).toISOString(), state: 'COMPLETED' },
            { id: 't2', stage: 'AUTH', label: 'Awaiting Trade Approval', description: 'Pending corporate authorisation', timestamp: new Date().toISOString(), state: 'CURRENT' }
          ]
        },
        {
          ref: 'TRD-2026-10512',
          orgId: orgGbId,
          cat: 'IMPORT_BILL',
          dir: 'IMPORT',
          party: 'Osaka Steel Trading Corp',
          amount: 128400,
          cur: 'USD',
          status: 'ISSUED',
          action: 'Documents Dispatched',
          docs: [{ id: 'doc-4', name: 'Bill_of_Lading_OSK991.pdf', type: 'PDF', size: '890 KB' }],
          timeline: [
            { id: 't1', stage: 'LODGED', label: 'Import Bill Lodged', description: 'Sight documents received', timestamp: new Date(Date.now() - 96 * 3600 * 1000).toISOString(), state: 'COMPLETED' },
            { id: 't2', stage: 'ISSUED', label: 'Accepted & Scheduled', description: 'Maturity scheduled for 12 Dec 2026', timestamp: new Date(Date.now() - 48 * 3600 * 1000).toISOString(), state: 'COMPLETED' }
          ]
        }
      ];

      const insertTrade = db.prepare(`
        INSERT INTO trade_transactions (id, reference, organisation_id, trade_category, direction, counterparty, amount, currency, status, pending_action, documents_json, timeline_json, approval_history_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]')
      `);
      for (const tr of tradeItems) {
        insertTrade.run(uuidv4(), tr.ref, tr.orgId, tr.cat, tr.dir, tr.party, tr.amount, tr.cur, tr.status, tr.action, JSON.stringify(tr.docs), JSON.stringify(tr.timeline));
      }

      // Receivables Finance Facilities
      const rfId1 = uuidv4();
      const rfId2 = uuidv4();
      db.prepare(`
        INSERT INTO receivables_facilities (id, organisation_id, account_name, facility_number, scenario, currency, total_limit, utilised_amount, available_limit, advance_rate_pct, status)
        VALUES (?, ?, 'UK Invoice Discounting Facility', 'RF-UK-9012', 'Confidential Invoice Discounting', 'GBP', 500000, 185000, 315000, 90, 'ACTIVE')
      `).run(rfId1, orgGbId);
      db.prepare(`
        INSERT INTO receivables_facilities (id, organisation_id, account_name, facility_number, scenario, currency, total_limit, utilised_amount, available_limit, advance_rate_pct, status)
        VALUES (?, ?, 'Euro Export Factoring Line', 'RF-EU-4418', 'Open Account Export Factoring', 'EUR', 350000, 92000, 258000, 85, 'ACTIVE')
      `).run(rfId2, orgGbId);

      db.prepare(`
        INSERT INTO receivables_messages (id, facility_id, organisation_id, subject, body, sender_name, sender_role, status, attachments_json)
        VALUES (?, ?, ?, 'Q4 Ledger Audit Reconciliation Complete', 'Monthly sales ledger verification completed. Eligible receivables availability has been updated to GBP 315,000.00.', 'Receivables Operations Desk', 'OPERATIONS', 'UNREAD', ?)
      `).run(uuidv4(), rfId1, orgGbId, JSON.stringify([{ name: 'Sales_Ledger_Summary_Nov2026.pdf', size: '312 KB' }]));

      // Historical Statements
      const allAccs = db.prepare(`SELECT id, organisation_id, available_balance FROM accounts WHERE user_id = ?`).all(premierUser.id) as any[];
      for (const acc of allAccs) {
        db.prepare(`
          INSERT INTO statements (id, account_id, organisation_id, period_label, start_date, end_date, opening_balance, closing_balance, document_available)
          VALUES (?, ?, ?, 'November 2026 (MTD)', '2026-11-01', '2026-11-26', ?, ?, 1)
        `).run(uuidv4(), acc.id, acc.organisation_id || orgGbId, Number((acc.available_balance * 0.92).toFixed(2)), acc.available_balance);
        db.prepare(`
          INSERT INTO statements (id, account_id, organisation_id, period_label, start_date, end_date, opening_balance, closing_balance, document_available)
          VALUES (?, ?, ?, 'October 2026', '2026-10-01', '2026-10-31', ?, ?, 1)
        `).run(uuidv4(), acc.id, acc.organisation_id || orgGbId, Number((acc.available_balance * 0.85).toFixed(2)), Number((acc.available_balance * 0.92).toFixed(2)));
      }

      // Self-service sample request
      db.prepare(`
        INSERT INTO service_requests (id, reference, organisation_id, user_id, request_type, account_id, period, details_json, status, document_name)
        VALUES (?, 'SR-2026-7712', ?, ?, 'BALANCE_CERTIFICATE', ?, 'As of 2026-11-26', ?, 'COMPLETED', 'Balance_Certificate_2026-11-26.pdf')
      `).run(uuidv4(), orgGbId, premierUser.id, primaryAcc?.id || accEurId, JSON.stringify({ purpose: 'External Audit Verification' }));
    }

    if (superAdmin) {
      db.prepare(`UPDATE users SET organisation_id = ?, permissions_json = ? WHERE id = ?`)
        .run(orgGbId, JSON.stringify(ALL_PERMS), superAdmin.id);
    }
  });
}

function syncCoralgenzAndNewModules() {
  runTransaction(() => {
    const targetOrgId = 'org-meridian-in';
    // 1. Migrate all records cleanly to coralgenz global / Karthick Krishna M S / PIN 002831 & Coralgenz Global India Pvt Ltd (ONLY company)
    const updatedSecPinHash = bcrypt.hashSync('002831', 10);
    db.prepare(`UPDATE users SET username = 'coralgenz global', full_name = 'Karthick Krishna M S', email = 'karthick.krishna@coralgenz.com' WHERE username IN ('premier_user', 'coralgenz global')`).run();
    db.prepare(`UPDATE users SET security_pin_hash = ? WHERE username IN ('coralgenz global', 'corp_initiator', 'corp_authoriser', 'corp_viewer')`).run(updatedSecPinHash);
    db.prepare(`UPDATE users SET email = replace(email, '@meridiannet.com', '@coralgenz.com') WHERE email LIKE '%@meridiannet.com'`).run();
    db.prepare(`UPDATE organisations SET name = 'Coralgenz Global India Pvt Ltd' WHERE id = ?`).run(targetOrgId);
    db.prepare(`UPDATE accounts SET organisation_id = ?, ifsc_swift = replace(ifsc_swift, 'MRDN', 'CGLB')`).run(targetOrgId);
    // Keep personal test fixture account 400515-89410291 outside corporate consolidation so Coralgenz India corporate balance is exactly 12.2373 Cr
    db.prepare(`UPDATE accounts SET organisation_id = NULL WHERE account_number = '400515-89410291'`).run();
    db.prepare(`UPDATE accounts SET available_balance = 122373000.00, ledger_balance = 122373000.00, is_favourite = 1, favourite_order = 1 WHERE account_number = '0641-0088-2941-01'`).run();
    db.prepare(`UPDATE accounts SET available_balance = 0.00, ledger_balance = 0.00, is_favourite = 0 WHERE organisation_id = ? AND account_number != '0641-0088-2941-01'`).run(targetOrgId);
    db.prepare(`UPDATE beneficiaries SET organisation_id = ?`).run(targetOrgId);
    db.prepare(`UPDATE payment_instructions SET organisation_id = ?`).run(targetOrgId);
    db.prepare(`UPDATE trade_transactions SET organisation_id = ?`).run(targetOrgId);
    db.prepare(`UPDATE receivables_facilities SET organisation_id = ?`).run(targetOrgId);
    db.prepare(`UPDATE receivables_messages SET organisation_id = ?`).run(targetOrgId);
    db.prepare(`UPDATE receivables_draws SET organisation_id = ?`).run(targetOrgId);
    db.prepare(`UPDATE receivables_limit_requests SET organisation_id = ?`).run(targetOrgId);
    db.prepare(`UPDATE statements SET organisation_id = ?`).run(targetOrgId);
    db.prepare(`UPDATE service_requests SET organisation_id = ?`).run(targetOrgId);
    db.prepare(`UPDATE approval_policies SET organisation_id = ?`).run(targetOrgId);
    db.prepare(`UPDATE payment_templates SET organisation_id = ?`).run(targetOrgId);
    db.prepare(`UPDATE virtual_accounts SET organisation_id = ?`).run(targetOrgId);
    db.prepare(`UPDATE batch_uploads SET organisation_id = ?`).run(targetOrgId);
    db.prepare(`UPDATE supply_chain_finance SET organisation_id = ?`).run(targetOrgId);
    db.prepare(`UPDATE securities_holdings SET organisation_id = ?`).run(targetOrgId);
    db.prepare(`UPDATE afd_schedules SET organisation_id = ?`).run(targetOrgId);
    db.prepare(`UPDATE users SET organisation_id = ? WHERE organisation_id IS NOT NULL`).run(targetOrgId);
    db.prepare(`UPDATE organisation_users SET organisation_id = ?, is_default = 1 WHERE organisation_id != ? AND user_id NOT IN (SELECT user_id FROM organisation_users WHERE organisation_id = ?)`).run(targetOrgId, targetOrgId, targetOrgId);
    db.prepare(`UPDATE organisation_users SET is_default = 1 WHERE organisation_id = ?`).run(targetOrgId);
    db.prepare(`DELETE FROM organisation_users WHERE organisation_id != ?`).run(targetOrgId);
    db.prepare(`DELETE FROM organisations WHERE id != ?`).run(targetOrgId);

    db.prepare(`UPDATE cards SET cardholder_name = 'KARTHICK KRISHNA M S' WHERE cardholder_name = 'ALEXANDER VANCE'`).run();
    db.prepare(`UPDATE notifications SET message = replace(message, 'Alexander Vance', 'Karthick Krishna M S') WHERE message LIKE '%Alexander Vance%'`).run();
    db.prepare(`UPDATE beneficiaries SET name = 'Coralgenz Global Singapore Pte Ltd' WHERE name = 'Meridian Singapore Pte Ltd'`).run();
    db.prepare(`UPDATE transactions SET counterparty_name = replace(counterparty_name, 'Meridian', 'Coralgenz Global') WHERE counterparty_name LIKE 'Meridian%'`).run();

    const orgGbId = targetOrgId;
    const primaryAcc = db.prepare(`SELECT id FROM accounts WHERE organisation_id = ? LIMIT 1`).get(orgGbId) as any;
    const parentAccId = primaryAcc?.id || 'acc-in-1';

    // 2. Seed rich Trade & Guarantees / Trade Loans if fewer than 5 records exist
    const tradeCnt = (db.prepare(`SELECT COUNT(*) as cnt FROM trade_transactions`).get() as { cnt: number }).cnt;
    if (tradeCnt < 5) {
      const extraTrade = [
        {
          ref: 'TRD-2026-10810',
          cat: 'GUARANTEE_STANDBY_DC',
          dir: 'EXPORT',
          party: 'Nordic Infrastructure AB',
          amount: 120000,
          cur: 'EUR',
          status: 'AWAITING_AUTHORISATION',
          action: 'Approve Standby Guarantee Extension (BL-CGLB-88412)',
          docs: [{ id: 'doc-5', name: 'Standby_SBLC_Amendment_SE44.pdf', type: 'PDF', size: '310 KB' }],
        },
        {
          ref: 'TRD-2026-10755',
          cat: 'TRADE_LOAN',
          dir: 'IMPORT',
          party: 'Taiwan Semiconductor Foundry Co.',
          amount: 245000,
          cur: 'USD',
          status: 'AWAITING_AUTHORISATION',
          action: 'Authorise 90-Day Import Post-Shipment Loan (DHL-77492011)',
          docs: [{ id: 'doc-6', name: 'Airway_Bill_DHL77492011.pdf', type: 'PDF', size: '540 KB' }],
        },
        {
          ref: 'TRD-2026-10640',
          cat: 'EXPORT_DC',
          dir: 'EXPORT',
          party: 'Emirates Industrial Holdings LLC',
          amount: 310000,
          cur: 'USD',
          status: 'ISSUED',
          action: 'Export Advised DC — Shipment Confirmed (BL-CGLB-91004)',
          docs: [{ id: 'doc-7', name: 'Export_LC_Advice_DXB.pdf', type: 'PDF', size: '485 KB' }],
        },
      ];
      for (const tr of extraTrade) {
        const exists = db.prepare(`SELECT id FROM trade_transactions WHERE reference = ?`).get(tr.ref);
        if (!exists) {
          db.prepare(`
            INSERT INTO trade_transactions (id, reference, organisation_id, trade_category, direction, counterparty, amount, currency, status, pending_action, documents_json, timeline_json, approval_history_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]')
          `).run(
            uuidv4(), tr.ref, orgGbId, tr.cat, tr.dir, tr.party, tr.amount, tr.cur, tr.status, tr.action,
            JSON.stringify(tr.docs),
            JSON.stringify([{ id: 't1', stage: tr.status, label: tr.action, description: 'Coralgenz Global Trade Desk tracking active', timestamp: new Date().toISOString(), state: 'CURRENT' }])
          );
        }
      }
    }

    // 3. Payment Templates
    const tmplCnt = (db.prepare(`SELECT COUNT(*) as cnt FROM payment_templates`).get() as { cnt: number }).cnt;
    if (tmplCnt === 0) {
      const templates = [
        { name: 'EU Supplier Monthly Retainer (Nordic Components)', type: 'RESTRICTED', cat: 'SEPA_PAYMENT', ben: 'Nordic Components GmbH', acc: 'DE89370400440532013000', bank: 'Deutsche Bank AG', country: 'DE', bic: 'DEUTDEFFXXX', cur: 'EUR', amt: 14500, ref: 'Coralgenz Global Monthly Actuator Supply' },
        { name: 'UK Haulage Clearing Template', type: 'GENERAL', cat: 'PRIORITY_PAYMENT', ben: 'Thames Logistics Partners Ltd', acc: '200412-99014522', bank: 'Barclays Corporate UK', country: 'GB', bic: 'BARCGB22XXX', cur: 'GBP', amt: 3420, ref: 'UK Port Logistics Invoice' },
        { name: 'US Fedwire Distribution Funding', type: 'GENERAL', cat: 'PRIORITY_PAYMENT', ben: 'Pacific Trade Holdings Inc', acc: '021000021-88910422', bank: 'JPMorgan Chase NA', country: 'US', bic: 'CHASUS33XXX', cur: 'USD', amt: 18500, ref: 'Coralgenz Global Americas Working Capital' },
      ];
      for (const t of templates) {
        db.prepare(`
          INSERT INTO payment_templates (id, organisation_id, name, category, template_type, debit_account_id, beneficiary_name, beneficiary_account, beneficiary_bank, destination_country, swift_bic, currency, default_amount, reference_note, status, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', 'Karthick Krishna M S')
        `).run(uuidv4(), orgGbId, t.name, t.cat, t.type, parentAccId, t.ben, t.acc, t.bank, t.country, t.bic, t.cur, t.amt, t.ref);
      }
    }

    // 4. Virtual Accounts
    const vaCnt = (db.prepare(`SELECT COUNT(*) as cnt FROM virtual_accounts`).get() as { cnt: number }).cnt;
    if (vaCnt === 0) {
      const vas = [
        { num: 'VA-GB-900101', name: 'Coralgenz Global EMEA Enterprise Collections', region: 'United Kingdom & Europe', line: 'B2B Enterprise Billing', cur: 'GBP', bal: 18420.50, rec: 42 },
        { num: 'VA-GB-900102', name: 'Coralgenz Global D2C Marketplace Settlement', region: 'United Kingdom', line: 'Digital Commerce', cur: 'GBP', bal: 9310.00, rec: 118 },
        { num: 'VA-EU-900204', name: 'Coralgenz Global DACH Distributor Receipts', region: 'Germany', line: 'Industrial Hardware', cur: 'EUR', bal: 44800.00, rec: 27 },
      ];
      for (const va of vas) {
        db.prepare(`
          INSERT INTO virtual_accounts (id, organisation_id, parent_account_id, virtual_number, account_name, region, business_line, currency, allocated_balance, reconciled_count, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
        `).run(uuidv4(), orgGbId, parentAccId, va.num, va.name, va.region, va.line, va.cur, va.bal, va.rec);
      }
    }

    // 5. Batch File Uploads
    const batchCnt = (db.prepare(`SELECT COUNT(*) as cnt FROM batch_uploads`).get() as { cnt: number }).cnt;
    if (batchCnt === 0) {
      db.prepare(`
        INSERT INTO batch_uploads (id, reference, organisation_id, filename, format, total_count, valid_count, error_count, total_amount, currency, status, validation_summary_json, uploaded_by)
        VALUES (?, 'BATCH-2026-8801', ?, 'coralgenz_uk_payroll_nov2026.xml', 'ISO20022_XML', 24, 24, 0, 42850.00, 'GBP', 'SETTLED', ?, 'Karthick Krishna M S')
      `).run(uuidv4(), orgGbId, JSON.stringify(['pain.001.001.03 schema validated', '24 beneficiary IBAN/Sort Code checks passed', 'Zero duplicate end-to-end IDs']));
    }

    // 6. Supply Chain Finance
    const scfCnt = (db.prepare(`SELECT COUNT(*) as cnt FROM supply_chain_finance`).get() as { cnt: number }).cnt;
    if (scfCnt === 0) {
      const scfRows = [
        { ref: 'SCF-2026-4101', sup: 'Nordic Components GmbH', inv: 'INV-NC-98241', amt: 64000, cur: 'EUR', mat: '2027-01-25', disc: 3.15, net: 63664.00, status: 'OFFER_AVAILABLE' },
        { ref: 'SCF-2026-4102', sup: 'Shenzhen Precision Electronics Co.', inv: 'INV-SZ-55410', amt: 112500, cur: 'USD', mat: '2027-02-10', disc: 3.45, net: 111724.00, status: 'OFFER_AVAILABLE' },
        { ref: 'SCF-2026-4098', sup: 'Precision Castings India Pvt Ltd', inv: 'INV-PC-33108', amt: 45000, cur: 'USD', mat: '2026-12-28', disc: 2.95, net: 44810.00, status: 'APPROVED_EARLY_PAY' },
      ];
      for (const s of scfRows) {
        db.prepare(`
          INSERT INTO supply_chain_finance (id, reference, organisation_id, supplier_name, invoice_number, invoice_amount, currency, maturity_date, discount_rate_pct, net_settlement, early_pay_status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(uuidv4(), s.ref, orgGbId, s.sup, s.inv, s.amt, s.cur, s.mat, s.disc, s.net, s.status);
      }
    }

    // 7. Securities Holdings (HSBC Securities Services)
    const secCnt = (db.prepare(`SELECT COUNT(*) as cnt FROM securities_holdings`).get() as { cnt: number }).cnt;
    if (secCnt === 0) {
      const secs = [
        { isin: 'GB00BM8Z2V59', name: 'UK Treasury Gilt 4.125% Jan 2027', cls: 'SOVEREIGN_BOND', acc: 'HSS-CGLB-CUST-01', qty: 150000, val: 149250.00, cur: 'GBP', accr: 2180.40, caStat: 'NONE', caDet: 'Coupon due 29 Jan 2027' },
        { isin: 'US912828YV68', name: 'US Treasury Note 3.875% 2027', cls: 'SOVEREIGN_BOND', acc: 'HSS-CGLB-CUST-01', qty: 200000, val: 198400.00, cur: 'USD', accr: 3120.00, caStat: 'ACTION_REQUIRED', caDet: 'Optional Tender Offer — Election Cutoff 10 Dec 2026' },
        { isin: 'IE00B44Z5B48', name: 'HSBC Global Sterling Liquidity Fund (Class A)', cls: 'MONEY_MARKET_FUND', acc: 'HSS-CGLB-CUST-02', qty: 85000, val: 85412.50, cur: 'GBP', accr: 412.50, caStat: 'NONE', caDet: 'Daily accumulating share class' },
      ];
      for (const h of secs) {
        db.prepare(`
          INSERT INTO securities_holdings (id, organisation_id, isin, security_name, asset_class, custodian_account, quantity, market_value, currency, accrued_income, corp_action_status, corp_action_detail)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(uuidv4(), orgGbId, h.isin, h.name, h.cls, h.acc, h.qty, h.val, h.cur, h.accr, h.caStat, h.caDet);
      }
    }

    // 8. Automated File Delivery (AFD)
    const afdCnt = (db.prepare(`SELECT COUNT(*) as cnt FROM afd_schedules`).get() as { cnt: number }).cnt;
    if (afdCnt === 0) {
      db.prepare(`
        INSERT INTO afd_schedules (id, organisation_id, report_type, format, frequency, delivery_channel, recipient, status)
        VALUES (?, ?, 'End-of-Day Multi-Currency Statement', 'MT940', 'DAILY', 'ERP_SFTP', 'erp-treasury@coralgenz.com', 'ACTIVE')
      `).run(uuidv4(), orgGbId);
      db.prepare(`
        INSERT INTO afd_schedules (id, organisation_id, report_type, format, frequency, delivery_channel, recipient, status)
        VALUES (?, ?, 'Global Cash Position Summary', 'BAI2', 'WEEKLY', 'SFTP_PORTAL', 'karthick.krishna@coralgenz.com', 'ACTIVE')
      `).run(uuidv4(), orgGbId);
    }
  });
}
