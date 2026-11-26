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
}

function seedCoreLegacyData() {
  runTransaction(() => {
    const passwordHash = bcrypt.hashSync('Password@123', 10);
    const adminPasswordHash = bcrypt.hashSync('Admin@123', 10);
    const pinHash = bcrypt.hashSync('1234', 10);
    const secPinHash = bcrypt.hashSync('123456', 10);

    const premierUserId = uuidv4();
    db.prepare(`
      INSERT INTO users (id, username, email, phone, password_hash, full_name, role, is_active, biometric_enabled, transaction_pin_hash, security_pin_hash, mobile_auth_active, permissions_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?, 1, ?)
    `).run(
      premierUserId,
      'premier_user',
      'alexander.vance@meridiannet.com',
      '+44 7700 900821',
      passwordHash,
      'Alexander Vance',
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
      { username: 'super_admin', email: 'admin@meridiannet.com', phone: '+44 20 7946 0901', name: 'Victoria Sterling', role: 'SUPER_ADMIN' },
      { username: 'ops_officer', email: 'ops@meridiannet.com', phone: '+44 20 7946 0902', name: 'Marcus Chen', role: 'OPERATIONS' },
      { username: 'support_rep', email: 'support@meridiannet.com', phone: '+44 20 7946 0903', name: 'Elena Rostova', role: 'SUPPORT' },
      { username: 'compliance_officer', email: 'compliance@meridiannet.com', phone: '+44 20 7946 0904', name: 'Arthur Pendelton', role: 'COMPLIANCE' },
      { username: 'bank_auditor', email: 'auditor@meridiannet.com', phone: '+44 20 7946 0905', name: 'Sarah Jenkins', role: 'AUDITOR' }
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
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', 'Canary Wharf Corporate Hub', 'MRDNGB2LXXX', ?, 'GB', ?, ?)
    `);

    for (const acc of accounts) {
      insertAccount.run(acc.id, premierUserId, acc.number, acc.name, acc.type, acc.currency, acc.avail, acc.ledger, acc.sortCode, acc.fav, acc.favOrder);
    }

    const transactionsData = [
      { ref: 'TXN-2026-90812', accountId: accSalaryId, party: 'Meridian Payroll Batch #11', amount: 8500.00, currency: 'GBP', desc: 'Monthly Corporate Payroll Settlement', cat: 'SALARY', type: 'DOMESTIC_TRANSFER', entryType: 'CREDIT', daysAgo: 1 },
      { ref: 'TXN-2026-89211', accountId: accSavingsId, party: 'EDF Energy Commercial', amount: 142.50, currency: 'GBP', desc: 'London Hub Facilities Utility', cat: 'UTILITIES', type: 'BILL_PAYMENT', entryType: 'DEBIT', daysAgo: 2 },
      { ref: 'TXN-2026-88402', accountId: accCurrentId, party: 'Apex Logistics Freight', amount: 285.00, currency: 'GBP', desc: 'Port Customs & Freight Charge', cat: 'SUPPLIER', type: 'DOMESTIC_TRANSFER', entryType: 'DEBIT', daysAgo: 3 },
      { ref: 'TXN-2026-87915', accountId: accSavingsId, party: 'Nordic Components GmbH', amount: 1200.00, currency: 'GBP', desc: 'Raw Material Vendor Settlement', cat: 'TRANSFER', type: 'DOMESTIC_TRANSFER', entryType: 'DEBIT', daysAgo: 5 },
      { ref: 'TXN-2026-86104', accountId: accFxId, party: 'AWS EMEA Cloud Billing', amount: 1199.00, currency: 'USD', desc: 'Enterprise Cloud Infrastructure', cat: 'SUPPLIER', type: 'INTL_TRANSFER', entryType: 'DEBIT', daysAgo: 7 },
      { ref: 'TXN-2026-85420', accountId: accSavingsId, party: 'Meridian Treasury Yield', amount: 320.45, currency: 'GBP', desc: 'Overnight Sweep Interest Credit', cat: 'INVESTMENT', type: 'DEPOSIT_CREDIT', entryType: 'CREDIT', daysAgo: 10 },
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
      { name: 'Meridian Singapore Pte Ltd', nickname: 'APAC Treasury', number: '7375-051-9910421', bank: 'DBS Bank Singapore', code: 'DBSSSGSGXXX', limit: 300000, fav: 0, country: 'SG', currency: 'SGD' }
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
    `).run(cardCreditId, premierUserId, accCurrentId, '•••• •••• •••• 9821', '9821', 'CREDIT', 'MASTERCARD', 'CORPORATE_WORLD_ELITE', 'ALEXANDER VANCE', '09', '29', '892', pinHash);

    db.prepare(`
      INSERT INTO cards (
        id, user_id, account_id, card_number_masked, card_number_last4, card_type, card_network, card_tier,
        cardholder_name, expiry_month, expiry_year, cvv_encrypted, is_frozen, is_blocked, pin_hash,
        online_enabled, international_enabled, contactless_enabled, daily_spending_limit, current_month_spent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, 1, 1, 1, 5000.00, 842.10)
    `).run(cardDebitId, premierUserId, accSavingsId, '•••• •••• •••• 4108', '4108', 'DEBIT', 'VISA', 'CORPORATE_PLATINUM', 'ALEXANDER VANCE', '11', '28', '419', pinHash);

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
      { title: 'Security Check: Registered Passkey', msg: 'Platform WebAuthn verification active for Alexander Vance.', type: 'SECURITY', read: 0 },
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
    `).run(orgGbId, 'Meridian Global Manufacturing Ltd', 'UK-RC-09482110', 'GB', 'GBP', JSON.stringify(modulesGb));

    db.prepare(`
      INSERT INTO organisations (id, name, registration_number, country, base_currency, status, is_sandbox, modules_json)
      VALUES (?, ?, ?, ?, ?, 'ACTIVE', 1, ?)
    `).run(orgInId, 'Meridian Tech India Pvt Ltd', 'CIN-U72900TN2021PTC', 'IN', 'INR', JSON.stringify(modulesIn));

    db.prepare(`
      INSERT INTO organisations (id, name, registration_number, country, base_currency, status, is_sandbox, modules_json)
      VALUES (?, ?, ?, ?, ?, 'ACTIVE', 1, ?)
    `).run(orgUsId, 'Meridian Americas Logistics Inc', 'US-DE-8839201', 'US', 'USD', JSON.stringify(modulesUs));

    // Fetch premier_user & super_admin
    const premierUser = db.prepare(`SELECT id, full_name FROM users WHERE username = 'premier_user'`).get() as any;
    const superAdmin = db.prepare(`SELECT id FROM users WHERE username = 'super_admin'`).get() as any;

    const corpPassHash = bcrypt.hashSync('CorpPass@2026', 10);
    const secPinHash = bcrypt.hashSync('123456', 10);

    // Create dedicated corporate maker-checker personas
    const initiatorId = uuidv4();
    const authoriserId = uuidv4();
    const viewerId = uuidv4();

    const corpUsers = [
      { id: initiatorId, username: 'corp_initiator', email: 'initiator@meridiannet.com', phone: '+44 7700 901101', name: 'Claire Beaumont', role: 'PAYMENT_INITIATOR', orgId: orgGbId, perms: INITIATOR_PERMS },
      { id: authoriserId, username: 'corp_authoriser', email: 'authoriser@meridiannet.com', phone: '+44 7700 901102', name: 'Rajiv Malhotra', role: 'AUTHORISER', orgId: orgGbId, perms: AUTHORISER_PERMS },
      { id: viewerId, username: 'corp_viewer', email: 'viewer@meridiannet.com', phone: '+44 7700 901103', name: 'Hannah Lindqvist', role: 'FINANCE_VIEWER', orgId: orgGbId, perms: VIEWER_PERMS },
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
        VALUES (?, ?, ?, 'DE89-3704-0044-0532', 'Euro SEPA Treasury Pool', 'EUR Concentration', 'TREASURY', 'EUR', 142850.40, 148200.40, 'ACTIVE', 'Frankfurt Corporate Hub', 'MRDNDEFFXXX', '37040044', 'DE89370400440532013000', 'DE', 1, 4)
      `).run(accEurId, premierUser.id, orgGbId);

      db.prepare(`
        INSERT INTO accounts (id, user_id, organisation_id, account_number, account_name, nickname, account_type, currency, available_balance, ledger_balance, status, branch_name, ifsc_swift, sort_code, country, is_favourite, favourite_order)
        VALUES (?, ?, ?, '0641-0088-2941-01', 'India Corporate Current', 'Chennai Ops INR', 'OPERATING', 'INR', 14850200.00, 15120000.00, 'ACTIVE', 'Chennai Anna Salai Corporate', 'MRDN0641002', '64-10-02', 'IN', 1, 1)
      `).run(accInrId, premierUser.id, orgInId);

      db.prepare(`
        INSERT INTO accounts (id, user_id, organisation_id, account_number, account_name, nickname, account_type, currency, available_balance, ledger_balance, status, branch_name, ifsc_swift, sort_code, country, is_favourite, favourite_order)
        VALUES (?, ?, ?, '0210-0002-1988-44', 'US Dollar Clearing Account', 'NY Fedwire Ops', 'OPERATING', 'USD', 265400.00, 265400.00, 'ACTIVE', 'New York Midtown Hub', 'MRDNUS33XXX', '021000021', 'US', 1, 1)
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
