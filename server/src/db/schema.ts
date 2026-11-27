import { db } from './database';

function ensureColumn(table: string, column: string, definition: string) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

export function initializeSchema() {
  db.exec(`
    -- Organisations (Corporate Entities)
    CREATE TABLE IF NOT EXISTS organisations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      registration_number TEXT NOT NULL,
      country TEXT NOT NULL DEFAULT 'GB',
      base_currency TEXT NOT NULL DEFAULT 'GBP',
      status TEXT NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, SUSPENDED
      is_sandbox INTEGER NOT NULL DEFAULT 1,
      modules_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Users table
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'USER',
      is_active INTEGER NOT NULL DEFAULT 1,
      is_locked INTEGER NOT NULL DEFAULT 0,
      failed_logins INTEGER NOT NULL DEFAULT 0,
      locked_until TEXT,
      biometric_enabled INTEGER NOT NULL DEFAULT 1,
      transaction_pin_hash TEXT,
      avatar_url TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Organisation-User Memberships (Multi-org & granular permissions)
    CREATE TABLE IF NOT EXISTS organisation_users (
      id TEXT PRIMARY KEY,
      organisation_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL,
      permissions_json TEXT NOT NULL,
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (organisation_id) REFERENCES organisations(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Customer Profile table
    CREATE TABLE IF NOT EXISTS customer_profiles (
      id TEXT PRIMARY KEY,
      user_id TEXT UNIQUE NOT NULL,
      customer_id TEXT UNIQUE NOT NULL,
      dob TEXT NOT NULL,
      address TEXT NOT NULL,
      city TEXT NOT NULL,
      country TEXT NOT NULL,
      postal_code TEXT,
      kyc_status TEXT NOT NULL DEFAULT 'VERIFIED',
      preferred_language TEXT NOT NULL DEFAULT 'en',
      notification_email INTEGER NOT NULL DEFAULT 1,
      notification_sms INTEGER NOT NULL DEFAULT 1,
      notification_push INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Bank Accounts table
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      account_number TEXT UNIQUE NOT NULL,
      account_name TEXT NOT NULL,
      account_type TEXT NOT NULL,
      currency TEXT NOT NULL DEFAULT 'GBP',
      available_balance REAL NOT NULL DEFAULT 0.00,
      ledger_balance REAL NOT NULL DEFAULT 0.00,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      branch_name TEXT NOT NULL DEFAULT 'Canary Wharf Corporate Hub',
      ifsc_swift TEXT NOT NULL DEFAULT 'MRDNGB2LXXX',
      sort_code TEXT NOT NULL DEFAULT '40-05-15',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Core Banking Double-Entry Ledger
    CREATE TABLE IF NOT EXISTS ledger_entries (
      id TEXT PRIMARY KEY,
      transaction_id TEXT NOT NULL,
      account_id TEXT NOT NULL,
      entry_type TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL,
      balance_after REAL NOT NULL,
      description TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (account_id) REFERENCES accounts(id)
    );

    -- Transactions table
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      reference TEXT UNIQUE NOT NULL,
      user_id TEXT NOT NULL,
      source_account_id TEXT,
      destination_account_id TEXT,
      counterparty_name TEXT NOT NULL,
      counterparty_account TEXT,
      bank_name TEXT,
      ifsc_swift TEXT,
      amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'GBP',
      fee REAL NOT NULL DEFAULT 0.00,
      tax REAL NOT NULL DEFAULT 0.00,
      exchange_rate REAL DEFAULT 1.00,
      description TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'GENERAL',
      status TEXT NOT NULL DEFAULT 'COMPLETED',
      transaction_type TEXT NOT NULL,
      idempotency_key TEXT UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (source_account_id) REFERENCES accounts(id)
    );

    -- Beneficiaries table
    CREATE TABLE IF NOT EXISTS beneficiaries (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      nickname TEXT,
      account_number TEXT NOT NULL,
      bank_name TEXT NOT NULL,
      ifsc_swift TEXT NOT NULL,
      transfer_limit REAL NOT NULL DEFAULT 50000.00,
      is_favorite INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      activation_status TEXT NOT NULL DEFAULT 'ACTIVE',
      verified_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Billers and Bill Payments
    CREATE TABLE IF NOT EXISTS bill_payments (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      account_id TEXT NOT NULL,
      biller_category TEXT NOT NULL,
      biller_name TEXT NOT NULL,
      consumer_number TEXT NOT NULL,
      bill_amount REAL NOT NULL,
      due_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PAID',
      payment_reference TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (account_id) REFERENCES accounts(id)
    );

    -- Cards (Debit and Credit)
    CREATE TABLE IF NOT EXISTS cards (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      account_id TEXT NOT NULL,
      card_number_masked TEXT NOT NULL,
      card_number_last4 TEXT NOT NULL,
      card_type TEXT NOT NULL,
      card_network TEXT NOT NULL DEFAULT 'MASTERCARD',
      card_tier TEXT NOT NULL DEFAULT 'PREMIER_WORLD_ELITE',
      cardholder_name TEXT NOT NULL,
      expiry_month TEXT NOT NULL,
      expiry_year TEXT NOT NULL,
      cvv_encrypted TEXT NOT NULL DEFAULT '892',
      is_frozen INTEGER NOT NULL DEFAULT 0,
      is_blocked INTEGER NOT NULL DEFAULT 0,
      pin_hash TEXT,
      online_enabled INTEGER NOT NULL DEFAULT 1,
      international_enabled INTEGER NOT NULL DEFAULT 1,
      contactless_enabled INTEGER NOT NULL DEFAULT 1,
      daily_spending_limit REAL NOT NULL DEFAULT 5000.00,
      current_month_spent REAL NOT NULL DEFAULT 0.00,
      credit_limit REAL DEFAULT 0.00,
      available_credit REAL DEFAULT 0.00,
      min_due REAL DEFAULT 0.00,
      payment_due_date TEXT,
      reward_points INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (account_id) REFERENCES accounts(id)
    );

    -- Deposits (Fixed & Recurring Deposits)
    CREATE TABLE IF NOT EXISTS deposits (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      account_id TEXT NOT NULL,
      deposit_type TEXT NOT NULL,
      deposit_number TEXT UNIQUE NOT NULL,
      principal_amount REAL NOT NULL,
      monthly_installment REAL DEFAULT 0.00,
      interest_rate REAL NOT NULL,
      tenure_months INTEGER NOT NULL,
      expected_maturity_amount REAL NOT NULL,
      maturity_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (account_id) REFERENCES accounts(id)
    );

    -- Loans & Financial Products
    CREATE TABLE IF NOT EXISTS loans (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      loan_type TEXT NOT NULL,
      loan_number TEXT UNIQUE NOT NULL,
      principal_amount REAL NOT NULL,
      interest_rate REAL NOT NULL,
      tenure_months INTEGER NOT NULL,
      emi_amount REAL NOT NULL,
      outstanding_balance REAL NOT NULL,
      next_emi_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    -- Notifications Centre
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      metadata TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Support Tickets & Chat
    CREATE TABLE IF NOT EXISTS support_tickets (
      id TEXT PRIMARY KEY,
      ticket_number TEXT UNIQUE NOT NULL,
      user_id TEXT NOT NULL,
      category TEXT NOT NULL,
      subject TEXT NOT NULL,
      description TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'MEDIUM',
      status TEXT NOT NULL DEFAULT 'OPEN',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS support_messages (
      id TEXT PRIMARY KEY,
      ticket_id TEXT NOT NULL,
      sender_id TEXT NOT NULL,
      sender_type TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE
    );

    -- Security & Audit Logs
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      actor_role TEXT NOT NULL DEFAULT 'USER',
      action TEXT NOT NULL,
      resource TEXT NOT NULL,
      resource_id TEXT,
      details TEXT,
      ip_address TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Active Auth Sessions
    CREATE TABLE IF NOT EXISTS auth_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      refresh_token_hash TEXT NOT NULL,
      device_name TEXT NOT NULL,
      ip_address TEXT NOT NULL,
      is_revoked INTEGER NOT NULL DEFAULT 0,
      last_active TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Branches and ATMs
    CREATE TABLE IF NOT EXISTS branches_atms (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      address TEXT NOT NULL,
      city TEXT NOT NULL,
      postal_code TEXT NOT NULL,
      phone TEXT,
      timing TEXT NOT NULL,
      distance_km REAL NOT NULL,
      is_24x7 INTEGER NOT NULL DEFAULT 0,
      services TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL
    );

    -- Corporate Registered Devices (Mobile Auth, Passkeys, Hardware Tokens)
    CREATE TABLE IF NOT EXISTS registered_devices (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      device_name TEXT NOT NULL,
      platform TEXT NOT NULL,
      device_type TEXT NOT NULL DEFAULT 'MOBILE_AUTH',
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      last_used_at TEXT,
      registered_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- WebAuthn / Passkey Credentials
    CREATE TABLE IF NOT EXISTS webauthn_credentials (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      credential_id TEXT UNIQUE NOT NULL,
      public_key TEXT NOT NULL,
      device_type TEXT NOT NULL DEFAULT 'multiDevice',
      transports TEXT NOT NULL DEFAULT '["internal"]',
      counter INTEGER NOT NULL DEFAULT 0,
      name TEXT NOT NULL DEFAULT 'Platform Passkey',
      last_used_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS webauthn_challenges (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      challenge TEXT NOT NULL,
      type TEXT NOT NULL, -- REGISTRATION, AUTHENTICATION, REAUTH
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Backend-Generated Security Codes (Soft Token / OTP)
    CREATE TABLE IF NOT EXISTS security_codes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      purpose TEXT NOT NULL DEFAULT 'LOGIN', -- LOGIN, AUTHORISATION, BENEFICIARY
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Push Login Approval Requests
    CREATE TABLE IF NOT EXISTS login_approval_requests (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      device_info TEXT NOT NULL,
      ip_address TEXT NOT NULL,
      challenge_code TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING, APPROVED, REJECTED, EXPIRED
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Approval Policies (Maker-Checker & Amount Thresholds)
    CREATE TABLE IF NOT EXISTS approval_policies (
      id TEXT PRIMARY KEY,
      organisation_id TEXT NOT NULL,
      name TEXT NOT NULL,
      currency TEXT NOT NULL DEFAULT 'ALL',
      min_amount REAL NOT NULL DEFAULT 0,
      max_amount REAL NOT NULL DEFAULT 999999999,
      required_approvals INTEGER NOT NULL DEFAULT 1,
      maker_checker_enforced INTEGER NOT NULL DEFAULT 1,
      require_step_up_auth INTEGER NOT NULL DEFAULT 1,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (organisation_id) REFERENCES organisations(id) ON DELETE CASCADE
    );

    -- Corporate Payment Instructions (Maker-Checker & Tracking)
    CREATE TABLE IF NOT EXISTS payment_instructions (
      id TEXT PRIMARY KEY,
      reference TEXT UNIQUE NOT NULL,
      organisation_id TEXT NOT NULL,
      initiator_id TEXT NOT NULL,
      initiator_name TEXT NOT NULL,
      category TEXT NOT NULL,
      debit_account_id TEXT NOT NULL,
      debit_account_name TEXT NOT NULL,
      debit_currency TEXT NOT NULL,
      beneficiary_id TEXT,
      beneficiary_name TEXT NOT NULL,
      beneficiary_account TEXT NOT NULL,
      beneficiary_bank TEXT NOT NULL,
      destination_country TEXT NOT NULL DEFAULT 'GB',
      swift_bic TEXT,
      iban TEXT,
      amount REAL NOT NULL,
      currency TEXT NOT NULL,
      exchange_rate REAL DEFAULT 1.0,
      converted_amount REAL,
      charges_bearer TEXT NOT NULL DEFAULT 'SHA',
      charges_amount REAL NOT NULL DEFAULT 0,
      payment_purpose TEXT NOT NULL DEFAULT 'SUPP',
      payment_date TEXT NOT NULL,
      reference_note TEXT NOT NULL,
      additional_info TEXT,
      status TEXT NOT NULL DEFAULT 'AWAITING_AUTHORISATION',
      required_approvals INTEGER NOT NULL DEFAULT 1,
      current_approvals INTEGER NOT NULL DEFAULT 0,
      approval_history_json TEXT NOT NULL DEFAULT '[]',
      timeline_json TEXT NOT NULL DEFAULT '[]',
      unusual_flags_json TEXT NOT NULL DEFAULT '[]',
      idempotency_key TEXT UNIQUE,
      expires_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (organisation_id) REFERENCES organisations(id),
      FOREIGN KEY (initiator_id) REFERENCES users(id)
    );

    -- FX Quotes
    CREATE TABLE IF NOT EXISTS fx_quotes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      from_currency TEXT NOT NULL,
      to_currency TEXT NOT NULL,
      amount REAL NOT NULL,
      rate REAL NOT NULL,
      converted_amount REAL NOT NULL,
      fee REAL NOT NULL DEFAULT 0,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Fraud Case Reports
    CREATE TABLE IF NOT EXISTS fraud_reports (
      id TEXT PRIMARY KEY,
      reference TEXT UNIQUE NOT NULL,
      user_id TEXT NOT NULL,
      organisation_id TEXT NOT NULL,
      payment_reference TEXT NOT NULL,
      reason TEXT NOT NULL,
      details TEXT,
      status TEXT NOT NULL DEFAULT 'CASE_OPENED_SANDBOX',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Trade Finance Transactions
    CREATE TABLE IF NOT EXISTS trade_transactions (
      id TEXT PRIMARY KEY,
      reference TEXT UNIQUE NOT NULL,
      organisation_id TEXT NOT NULL,
      trade_category TEXT NOT NULL,
      direction TEXT NOT NULL,
      counterparty TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'AWAITING_AUTHORISATION',
      pending_action TEXT,
      documents_json TEXT NOT NULL DEFAULT '[]',
      timeline_json TEXT NOT NULL DEFAULT '[]',
      approval_history_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (organisation_id) REFERENCES organisations(id)
    );

    -- Receivables Finance
    CREATE TABLE IF NOT EXISTS receivables_facilities (
      id TEXT PRIMARY KEY,
      organisation_id TEXT NOT NULL,
      account_name TEXT NOT NULL,
      facility_number TEXT UNIQUE NOT NULL,
      scenario TEXT NOT NULL,
      currency TEXT NOT NULL,
      total_limit REAL NOT NULL,
      utilised_amount REAL NOT NULL,
      available_limit REAL NOT NULL,
      advance_rate_pct REAL NOT NULL DEFAULT 90,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (organisation_id) REFERENCES organisations(id)
    );

    CREATE TABLE IF NOT EXISTS receivables_draws (
      id TEXT PRIMARY KEY,
      reference TEXT UNIQUE NOT NULL,
      facility_id TEXT NOT NULL,
      organisation_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL,
      destination_account_id TEXT NOT NULL,
      invoice_reference TEXT,
      status TEXT NOT NULL DEFAULT 'SUBMITTED',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS receivables_limit_requests (
      id TEXT PRIMARY KEY,
      reference TEXT UNIQUE NOT NULL,
      facility_id TEXT NOT NULL,
      organisation_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      current_limit REAL NOT NULL,
      requested_limit REAL NOT NULL,
      reason TEXT NOT NULL,
      supporting_doc_name TEXT,
      status TEXT NOT NULL DEFAULT 'UNDER_REVIEW',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS receivables_messages (
      id TEXT PRIMARY KEY,
      facility_id TEXT NOT NULL,
      organisation_id TEXT NOT NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      sender_name TEXT NOT NULL,
      sender_role TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'UNREAD',
      attachments_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Remote Deposit Capture
    CREATE TABLE IF NOT EXISTS remote_deposit_captures (
      id TEXT PRIMARY KEY,
      reference TEXT UNIQUE NOT NULL,
      organisation_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      account_id TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL,
      cheque_date TEXT NOT NULL,
      front_image_name TEXT NOT NULL,
      back_image_name TEXT NOT NULL,
      quality_status TEXT NOT NULL DEFAULT 'PASSED',
      status TEXT NOT NULL DEFAULT 'PENDING_CLEARING_SANDBOX',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Self-Service & Document Requests
    CREATE TABLE IF NOT EXISTS service_requests (
      id TEXT PRIMARY KEY,
      reference TEXT UNIQUE NOT NULL,
      organisation_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      request_type TEXT NOT NULL,
      account_id TEXT,
      period TEXT,
      details_json TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'COMPLETED',
      document_name TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Account Statements Registry
    CREATE TABLE IF NOT EXISTS statements (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      organisation_id TEXT NOT NULL,
      period_label TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      opening_balance REAL NOT NULL,
      closing_balance REAL NOT NULL,
      document_available INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- HSBCnet Payment Templates (General & Restricted)
    CREATE TABLE IF NOT EXISTS payment_templates (
      id TEXT PRIMARY KEY,
      organisation_id TEXT NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'PRIORITY_PAYMENT',
      template_type TEXT NOT NULL DEFAULT 'GENERAL', -- GENERAL, RESTRICTED
      debit_account_id TEXT NOT NULL,
      beneficiary_name TEXT NOT NULL,
      beneficiary_account TEXT NOT NULL,
      beneficiary_bank TEXT NOT NULL,
      destination_country TEXT NOT NULL DEFAULT 'GB',
      swift_bic TEXT,
      currency TEXT NOT NULL DEFAULT 'GBP',
      default_amount REAL NOT NULL DEFAULT 0,
      reference_note TEXT,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Virtual Accounts (AR Reconciliation & Sub-Ledgers)
    CREATE TABLE IF NOT EXISTS virtual_accounts (
      id TEXT PRIMARY KEY,
      organisation_id TEXT NOT NULL,
      parent_account_id TEXT NOT NULL,
      virtual_number TEXT UNIQUE NOT NULL,
      account_name TEXT NOT NULL,
      region TEXT NOT NULL,
      business_line TEXT NOT NULL,
      currency TEXT NOT NULL DEFAULT 'GBP',
      allocated_balance REAL NOT NULL DEFAULT 0,
      reconciled_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Batch Payment File Uploads (ISO 20022 XML, CSV, BACS, ACH)
    CREATE TABLE IF NOT EXISTS batch_uploads (
      id TEXT PRIMARY KEY,
      reference TEXT UNIQUE NOT NULL,
      organisation_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      format TEXT NOT NULL DEFAULT 'ISO20022_XML',
      total_count INTEGER NOT NULL DEFAULT 0,
      valid_count INTEGER NOT NULL DEFAULT 0,
      error_count INTEGER NOT NULL DEFAULT 0,
      total_amount REAL NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'GBP',
      status TEXT NOT NULL DEFAULT 'AWAITING_AUTHORISATION',
      validation_summary_json TEXT NOT NULL DEFAULT '[]',
      uploaded_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Supply Chain Finance (Payables / Supplier Early Discounting)
    CREATE TABLE IF NOT EXISTS supply_chain_finance (
      id TEXT PRIMARY KEY,
      reference TEXT UNIQUE NOT NULL,
      organisation_id TEXT NOT NULL,
      supplier_name TEXT NOT NULL,
      invoice_number TEXT NOT NULL,
      invoice_amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'USD',
      maturity_date TEXT NOT NULL,
      discount_rate_pct REAL NOT NULL DEFAULT 3.25,
      net_settlement REAL NOT NULL,
      early_pay_status TEXT NOT NULL DEFAULT 'OFFER_AVAILABLE', -- OFFER_AVAILABLE, APPROVED_EARLY_PAY, SETTLED
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- HSBC Securities Services (Custody, Portfolio & Corporate Actions)
    CREATE TABLE IF NOT EXISTS securities_holdings (
      id TEXT PRIMARY KEY,
      organisation_id TEXT NOT NULL,
      isin TEXT NOT NULL,
      security_name TEXT NOT NULL,
      asset_class TEXT NOT NULL,
      custodian_account TEXT NOT NULL,
      quantity REAL NOT NULL,
      market_value REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'USD',
      accrued_income REAL NOT NULL DEFAULT 0,
      corp_action_status TEXT DEFAULT 'NONE', -- NONE, ACTION_REQUIRED, ELECTED
      corp_action_detail TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Automated File Delivery (AFD) & Reports Schedules
    CREATE TABLE IF NOT EXISTS afd_schedules (
      id TEXT PRIMARY KEY,
      organisation_id TEXT NOT NULL,
      report_type TEXT NOT NULL,
      format TEXT NOT NULL DEFAULT 'MT940',
      frequency TEXT NOT NULL DEFAULT 'DAILY',
      delivery_channel TEXT NOT NULL DEFAULT 'SFTP_PORTAL',
      recipient TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      last_run_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Indexes for performance
    CREATE INDEX IF NOT EXISTS idx_accounts_user ON accounts(user_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_created ON transactions(created_at);
    CREATE INDEX IF NOT EXISTS idx_ledger_account ON ledger_entries(account_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
    CREATE INDEX IF NOT EXISTS idx_cards_user ON cards(user_id);
    CREATE INDEX IF NOT EXISTS idx_payments_org ON payment_instructions(organisation_id);
    CREATE INDEX IF NOT EXISTS idx_payments_status ON payment_instructions(status);
    CREATE INDEX IF NOT EXISTS idx_trade_org ON trade_transactions(organisation_id);
  `);

  // Safe migrations for existing tables
  ensureColumn('users', 'organisation_id', 'TEXT');
  ensureColumn('users', 'permissions_json', 'TEXT');
  ensureColumn('users', 'security_pin_hash', 'TEXT');
  ensureColumn('users', 'mobile_auth_active', 'INTEGER NOT NULL DEFAULT 1');
  ensureColumn('users', 'preferred_currency', "TEXT NOT NULL DEFAULT 'GBP'");
  ensureColumn('users', 'last_login_at', 'TEXT');

  ensureColumn('accounts', 'organisation_id', 'TEXT');
  ensureColumn('accounts', 'nickname', 'TEXT');
  ensureColumn('accounts', 'country', "TEXT NOT NULL DEFAULT 'GB'");
  ensureColumn('accounts', 'iban', 'TEXT');
  ensureColumn('accounts', 'is_favourite', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn('accounts', 'favourite_order', 'INTEGER NOT NULL DEFAULT 99');

  ensureColumn('beneficiaries', 'organisation_id', 'TEXT');
  ensureColumn('beneficiaries', 'country', "TEXT NOT NULL DEFAULT 'GB'");
  ensureColumn('beneficiaries', 'currency', "TEXT NOT NULL DEFAULT 'GBP'");
  ensureColumn('beneficiaries', 'iban', 'TEXT');

  ensureColumn('audit_logs', 'organisation_id', 'TEXT');
  ensureColumn('audit_logs', 'actor_name', 'TEXT');
}
