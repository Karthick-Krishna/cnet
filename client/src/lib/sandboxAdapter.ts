/**
 * Vercel Static Deployment Fallback Adapter
 * Engages ONLY when deployed as a static site (e.g. Vercel) without a live VITE_API_URL backend,
 * ensuring all HSBC Cnet client workflows remain functional in cloud previews.
 */

const STORAGE_KEY = 'hsbc_cnet_vercel_sandbox_v2';

interface SandboxState {
  organisations: any[];
  accounts: any[];
  payments: any[];
  transactions: any[];
  beneficiaries: any[];
  trade: any[];
  facilities: any[];
  receivablesDraws: any[];
  receivablesLimits: any[];
  receivablesMessages: any[];
  notifications: any[];
  tickets: any[];
  devices: any[];
  serviceRequests: any[];
  rdcDeposits: any[];
  bills: any[];
  securityCodes: Record<string, string>;
  pinMap: Record<string, string>;
  resetCodes: Record<string, string>;
}

function getInitialState(): SandboxState {
  const now = new Date().toISOString();
  return {
    organisations: [
      {
        id: 'org-meridian-gb',
        name: 'Meridian Global Manufacturing Ltd',
        registrationNumber: 'UK-RC-09482110',
        country: 'GB',
        baseCurrency: 'GBP',
        status: 'ACTIVE',
        isSandbox: true,
        role: 'ORG_ADMIN',
        permissions: [
          'VIEW_ACCOUNTS', 'VIEW_BALANCES', 'VIEW_TRANSACTIONS', 'CREATE_PAYMENTS',
          'APPROVE_PAYMENTS', 'REJECT_PAYMENTS', 'MANAGE_BENEFICIARIES',
          'ACCESS_TRADE_FINANCE', 'ACCESS_RECEIVABLES_FINANCE', 'VIEW_LIQUIDITY',
          'ACCESS_RDC', 'REQUEST_DOCUMENTS',
        ],
        modules: {
          accounts: true, authorisations: true, payments: true, track: true,
          liquidity: true, tradeFinance: true, receivablesFinance: true,
          remoteDepositCapture: true, billPayments: true, selfService: true,
        },
      },
      {
        id: 'org-meridian-in',
        name: 'Meridian Tech India Pvt Ltd',
        registrationNumber: 'CIN-U72900TN2021PTC',
        country: 'IN',
        baseCurrency: 'INR',
        status: 'ACTIVE',
        isSandbox: true,
        role: 'ORG_ADMIN',
        permissions: [
          'VIEW_ACCOUNTS', 'VIEW_BALANCES', 'VIEW_TRANSACTIONS', 'CREATE_PAYMENTS',
          'APPROVE_PAYMENTS', 'REJECT_PAYMENTS', 'MANAGE_BENEFICIARIES',
          'ACCESS_TRADE_FINANCE', 'ACCESS_RECEIVABLES_FINANCE', 'VIEW_LIQUIDITY',
          'REQUEST_DOCUMENTS',
        ],
        modules: {
          accounts: true, authorisations: true, payments: true, track: true,
          liquidity: true, tradeFinance: true, receivablesFinance: true,
          remoteDepositCapture: false, billPayments: true, selfService: true,
        },
      },
    ],
    accounts: [
      {
        id: 'acc-gb-1', organisation_id: 'org-meridian-gb', account_number: '400515-89410291',
        maskedAccountNumber: '•••• •••• 0291', account_name: 'GBP Operating Treasury',
        nickname: 'UK Primary Operating', account_type: 'SAVINGS', currency: 'GBP',
        available_balance: 48250.75, ledger_balance: 48250.75,
        availableBalance: 48250.75, ledgerBalance: 48250.75, status: 'ACTIVE', country: 'GB',
        branch_name: 'Canary Wharf Corporate Hub', institution: 'Meridian Treasury UK', ifsc_swift: 'MRDNGB2LXXX', sort_code: '40-05-15',
        isFavourite: true, favourite_order: 1,
      },
      {
        id: 'acc-gb-2', organisation_id: 'org-meridian-gb', account_number: '400515-77192044',
        maskedAccountNumber: '•••• •••• 2044', account_name: 'GBP Corporate Disbursements',
        account_type: 'CURRENT', currency: 'GBP', available_balance: 9840.20, ledger_balance: 9840.20,
        availableBalance: 9840.20, ledgerBalance: 9840.20, status: 'ACTIVE', country: 'GB',
        branch_name: 'Canary Wharf Corporate Hub', institution: 'Meridian Treasury UK', ifsc_swift: 'MRDNGB2LXXX', sort_code: '40-05-15',
        isFavourite: true, favourite_order: 2,
      },
      {
        id: 'acc-gb-td', organisation_id: 'org-meridian-gb', account_number: '400515-55910238',
        maskedAccountNumber: '•••• •••• 0238', account_name: 'Sterling Money Market Reserve',
        account_type: 'FIXED_DEPOSIT', currency: 'GBP', available_balance: 25000.00, ledger_balance: 25000.00,
        availableBalance: 25000.00, ledgerBalance: 25000.00, status: 'ACTIVE', country: 'GB',
        branch_name: 'Canary Wharf Corporate Hub', institution: 'Meridian Treasury UK', ifsc_swift: 'MRDNGB2LXXX', sort_code: '40-05-15',
        isFavourite: false, favourite_order: 5,
      },
      {
        id: 'acc-usd-1', organisation_id: 'org-meridian-gb', account_number: '400515-99201485',
        maskedAccountNumber: '•••• •••• 1485', account_name: 'USD Trade Nostro Account',
        account_type: 'FOREIGN_CURRENCY', currency: 'USD', available_balance: 12450.00, ledger_balance: 12450.00,
        availableBalance: 12450.00, ledgerBalance: 12450.00, status: 'ACTIVE', country: 'US',
        branch_name: 'New York Clearing Desk', institution: 'Meridian Americas', ifsc_swift: 'MRDNUS33XXX',
        isFavourite: true, favourite_order: 3,
      },
      {
        id: 'acc-eur-1', organisation_id: 'org-meridian-gb', account_number: 'DE89-3704-0044-0532',
        maskedAccountNumber: '•••• •••• 0532', account_name: 'Euro SEPA Treasury Pool',
        account_type: 'TREASURY', currency: 'EUR', available_balance: 142850.40, ledger_balance: 148200.40,
        availableBalance: 142850.40, ledgerBalance: 148200.40, status: 'ACTIVE', country: 'DE',
        branch_name: 'Frankfurt Corporate Hub', institution: 'Meridian Continental', ifsc_swift: 'MRDNDEFFXXX', iban: 'DE89370400440532013000',
        isFavourite: false, favourite_order: 4,
      },
      {
        id: 'acc-in-1', organisation_id: 'org-meridian-in', account_number: '0641-0088-2941-01',
        maskedAccountNumber: '•••• •••• 4101', account_name: 'India Corporate Current',
        account_type: 'OPERATING', currency: 'INR', available_balance: 14850200.00, ledger_balance: 15120000.00,
        availableBalance: 14850200.00, ledgerBalance: 15120000.00, status: 'ACTIVE', country: 'IN',
        branch_name: 'Chennai Anna Salai Corporate', institution: 'Meridian India', ifsc_swift: 'MRDN0641002',
        isFavourite: true, favourite_order: 1,
      },
    ],
    payments: [
      {
        id: 'pay-1', reference: 'PAY-2026-44102', organisation_id: 'org-meridian-gb',
        initiator_id: 'user-corp_initiator', initiator_name: 'Claire Beaumont', category: 'PRIORITY_PAYMENT',
        debit_account_id: 'acc-gb-1', debit_account_name: 'GBP Operating Treasury', debit_currency: 'GBP',
        beneficiary_name: 'Nordic Components GmbH', beneficiary_account: 'DE89370400440532013000',
        beneficiary_bank: 'Deutsche Bank AG', destination_country: 'DE', swift_bic: 'DEUTDEFFXXX',
        amount: 14500.00, currency: 'EUR', exchange_rate: 1.173, charges_bearer: 'OUR', charges_amount: 18,
        payment_purpose: 'SUPP', payment_date: '2026-11-26', reference_note: 'Q4 Turbine Actuator Invoice #NC-9021',
        status: 'AWAITING_AUTHORISATION', required_approvals: 2, current_approvals: 1,
        unusualFlags: ['Cross-border FX settlement above GBP 10,000 threshold'],
        approvalHistory: [{ approverId: 'user-corp_authoriser', approverName: 'Rajiv Malhotra', approverRole: 'AUTHORISER', decision: 'APPROVED', timestamp: now }],
        timeline: [{ id: '1', stage: 'CREATED', label: 'Payment created', description: 'Created by Claire Beaumont', timestamp: now, state: 'COMPLETED' }],
        created_at: now, updated_at: now,
      },
      {
        id: 'pay-2', reference: 'PAY-2026-44115', organisation_id: 'org-meridian-gb',
        initiator_id: 'user-corp_initiator', initiator_name: 'Claire Beaumont', category: 'SEPA_PAYMENT',
        debit_account_id: 'acc-eur-1', debit_account_name: 'Euro SEPA Treasury Pool', debit_currency: 'EUR',
        beneficiary_name: 'Nordic Components GmbH', beneficiary_account: 'DE89370400440532013000',
        beneficiary_bank: 'Deutsche Bank AG', destination_country: 'DE', swift_bic: 'DEUTDEFFXXX',
        amount: 4800.00, currency: 'EUR', exchange_rate: 1.0, charges_bearer: 'SHA', charges_amount: 0,
        payment_purpose: 'SUPP', payment_date: '2026-11-26', reference_note: 'SEPA Credit Transfer — Spare Parts',
        status: 'AWAITING_AUTHORISATION', required_approvals: 1, current_approvals: 0,
        unusualFlags: [], approvalHistory: [],
        timeline: [{ id: '1', stage: 'CREATED', label: 'Payment created', description: 'Queued for authoriser review', timestamp: now, state: 'COMPLETED' }],
        created_at: now, updated_at: now,
      },
      {
        id: 'pay-3', reference: 'PAY-2026-43980', organisation_id: 'org-meridian-gb',
        initiator_id: 'user-corp_initiator', initiator_name: 'Claire Beaumont', category: 'PRIORITY_PAYMENT',
        debit_account_id: 'acc-gb-1', debit_account_name: 'GBP Operating Treasury', debit_currency: 'GBP',
        beneficiary_name: 'Thames Logistics Partners Ltd', beneficiary_account: '200412-99014522',
        beneficiary_bank: 'Barclays Corporate UK', destination_country: 'GB', swift_bic: 'BARCGB22XXX',
        amount: 3420.00, currency: 'GBP', exchange_rate: 1.0, charges_bearer: 'SHA', charges_amount: 0,
        payment_purpose: 'SUPP', payment_date: '2026-11-24', reference_note: 'UK Haulage Settlement Nov W3',
        status: 'COMPLETED', required_approvals: 1, current_approvals: 1,
        unusualFlags: [], approvalHistory: [], timeline: [{ id: '1', stage: 'COMPLETED', label: 'Completed', description: 'Settled in sandbox ledger', timestamp: now, state: 'COMPLETED' }],
        created_at: now, updated_at: now,
      },
    ],
    transactions: [
      { id: 'txn-1', source_account_id: 'acc-gb-1', reference: 'TXN-2026-90812', counterparty_name: 'Nordic Components GmbH', description: 'Raw Material Vendor Settlement', amount: 1200, currency: 'GBP', entry_type: 'DEBIT', status: 'COMPLETED', category: 'TRANSFER', balance_after: 48250.75, created_at: now },
      { id: 'txn-2', source_account_id: 'acc-gb-1', reference: 'TXN-2026-85420', counterparty_name: 'Treasury Overnight Sweep', description: 'Interest Credit', amount: 320.45, currency: 'GBP', entry_type: 'CREDIT', status: 'COMPLETED', category: 'INVESTMENT', balance_after: 49450.75, created_at: now },
    ],
    beneficiaries: [
      { id: 'ben-1', name: 'Nordic Components GmbH', nickname: 'Munich Supplier', account_number: 'DE89370400440532013000', bank_name: 'Deutsche Bank AG', ifsc_swift: 'DEUTDEFFXXX', transfer_limit: 250000, is_favorite: 1, country: 'DE', currency: 'EUR', activation_status: 'ACTIVE' },
      { id: 'ben-2', name: 'Thames Logistics Partners Ltd', nickname: 'UK Freight', account_number: '200412-99014522', bank_name: 'Barclays Corporate UK', ifsc_swift: 'BARCGB22XXX', transfer_limit: 150000, is_favorite: 1, country: 'GB', currency: 'GBP', activation_status: 'ACTIVE' },
    ],
    trade: [
      { id: 'trd-1', reference: 'TRD-2026-11092', organisation_id: 'org-meridian-gb', trade_category: 'IMPORT_DC', direction: 'IMPORT', counterparty: 'Shenzhen Precision Electronics Co.', amount: 185000, currency: 'USD', status: 'AWAITING_AUTHORISATION', pending_action: 'Authorise Import Documentary Credit', documents: [{ id: 'd1', name: 'Commercial_Invoice_SZ8821.pdf', size: '420 KB' }], timeline: [{ id: 't1', label: 'Awaiting Corporate Sign-Off', description: 'Pending trade authoriser approval', timestamp: now, state: 'CURRENT' }] },
      { id: 'trd-2', reference: 'TRD-2026-10944', organisation_id: 'org-meridian-gb', trade_category: 'IMPORT_PRESENTATION', direction: 'IMPORT', counterparty: 'Bavaria Industrial Motors GmbH', amount: 94000, currency: 'EUR', status: 'AWAITING_AUTHORISATION', pending_action: 'Accept Import Presentation Documents', documents: [{ id: 'd2', name: 'Packing_List_BV991.pdf', size: '215 KB' }], timeline: [{ id: 't1', label: 'Documents Presented', description: 'Awaiting presentation authorisation', timestamp: now, state: 'CURRENT' }] },
      { id: 'trd-3', reference: 'TRD-2026-10810', organisation_id: 'org-meridian-gb', trade_category: 'GUARANTEE_STANDBY_DC', direction: 'EXPORT', counterparty: 'Nordic Infrastructure AB', amount: 120000, currency: 'EUR', status: 'AWAITING_AUTHORISATION', pending_action: 'Approve Standby Guarantee Extension', documents: [{ id: 'd3', name: 'Guarantee_Draft_SE44.pdf', size: '310 KB' }], timeline: [{ id: 't1', label: 'Amendment Prepared', description: 'Pending corporate approval', timestamp: now, state: 'CURRENT' }] },
    ],
    facilities: [
      { id: 'rf-1', organisation_id: 'org-meridian-gb', account_name: 'UK Invoice Discounting Facility', facility_number: 'RF-UK-9012', scenario: 'Confidential Invoice Discounting', currency: 'GBP', total_limit: 500000, utilised_amount: 185000, available_limit: 315000, advance_rate_pct: 90, status: 'ACTIVE' },
      { id: 'rf-2', organisation_id: 'org-meridian-gb', account_name: 'Euro Export Factoring Line', facility_number: 'RF-EU-4418', scenario: 'Open Account Export Factoring', currency: 'EUR', total_limit: 350000, utilised_amount: 92000, available_limit: 258000, advance_rate_pct: 85, status: 'ACTIVE' },
    ],
    receivablesDraws: [],
    receivablesLimits: [],
    receivablesMessages: [
      { id: 'rfm-1', facility_id: 'rf-1', organisation_id: 'org-meridian-gb', subject: 'Q4 Ledger Audit Reconciliation Complete', body: 'Monthly sales ledger verification completed. Eligible receivables availability has been updated to GBP 315,000.00.', sender_name: 'Receivables Operations Desk', status: 'UNREAD', created_at: now, attachments: [{ name: 'Sales_Ledger_Summary_Nov2026.pdf', size: '312 KB' }] },
    ],
    notifications: [
      { id: 'n-1', title: 'Payment Awaiting Authorisation', message: 'Priority wire PAY-2026-44102 (EUR 14,500.00) awaits sign-off.', type: 'PAYMENT', is_read: 0, created_at: now },
      { id: 'n-2', title: 'Trade Documentary Credit Pending', message: 'Import DC TRD-2026-11092 (USD 185,000.00) awaiting trade authorisation.', type: 'SYSTEM', is_read: 0, created_at: now },
    ],
    tickets: [
      { id: 't-1', ticket_number: 'TCK-2026-0041', subject: 'SEPA Instant Cut-off Inquiry', category: 'ACCOUNT_INQUIRY', status: 'OPEN', messages: [{ id: 'm1', sender_type: 'SUPPORT_AGENT', message: 'EUR SEPA instructions authorised before 15:30 GMT are queued for same-day TARGET2 settlement.' }] },
    ],
    devices: [
      { id: 'dev-1', device_name: 'iPhone 16 Pro (Mobile Auth)', platform: 'iOS / Safari', device_type: 'MOBILE_AUTH', status: 'ACTIVE', registered_at: now, last_used_at: now },
      { id: 'dev-2', device_name: 'Corporate Desk Authenticator', platform: 'macOS / Chrome', device_type: 'PASSKEY', status: 'ACTIVE', registered_at: now, last_used_at: now },
    ],
    bills: [
      { id: 'bill-1', biller_name: 'HMRC Corporate VAT Clearing', consumer_number: 'VAT-8849-019', bill_amount: 1420.50, due_date: '2026-12-18', status: 'PENDING' },
      { id: 'bill-2', biller_name: 'EDF Business Commercial Power', consumer_number: 'EDF-4401-982', bill_amount: 680.20, due_date: '2026-12-22', status: 'PENDING' },
    ],
    serviceRequests: [],
    rdcDeposits: [],
    securityCodes: {},
    pinMap: {
      premier_user: '123456',
      corp_initiator: '123456',
      corp_authoriser: '123456',
      corp_viewer: '123456',
    },
    resetCodes: {},
  };
}

function loadState(): SandboxState {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  const init = getInitialState();
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(init));
  return init;
}

function saveState(s: SandboxState) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

const USERS: Record<string, { fullName: string; role: string; password: string; orgId: string }> = {
  premier_user: { fullName: 'Alexander Vance', role: 'ORG_ADMIN', password: 'Password@123', orgId: 'org-meridian-gb' },
  corp_initiator: { fullName: 'Claire Beaumont', role: 'PAYMENT_INITIATOR', password: 'CorpPass@2026', orgId: 'org-meridian-gb' },
  corp_authoriser: { fullName: 'Rajiv Malhotra', role: 'AUTHORISER', password: 'CorpPass@2026', orgId: 'org-meridian-gb' },
  corp_viewer: { fullName: 'Hannah Lindqvist', role: 'FINANCE_VIEWER', password: 'CorpPass@2026', orgId: 'org-meridian-gb' },
};

function currentProfile() {
  const uname = sessionStorage.getItem('hsbc_cnet_sbx_user') || 'premier_user';
  const u = USERS[uname] || USERS.premier_user;
  const st = loadState();
  const org = st.organisations.find((o) => o.id === u.orgId) || st.organisations[0];
  return {
    id: `user-${uname}`,
    username: uname,
    customer_id: 'GB4490182',
    full_name: u.fullName,
    email: `${uname}@meridiannet.com`,
    phone: '+44 7700 900821',
    role: u.role,
    organisationId: org.id,
    organisationName: org.name,
    country: org.country,
    baseCurrency: org.baseCurrency,
    permissions: org.permissions,
    biometric_enabled: true,
    hasPinConfigured: true,
    mobileAuthActive: true,
    preferredCurrency: org.baseCurrency,
    lastLoginAt: new Date().toISOString(),
  };
}

export async function handleSandboxRequest(pathWithQuery: string, options: RequestInit = {}): Promise<any> {
  const [path, qs = ''] = pathWithQuery.split('?');
  const params = new URLSearchParams(qs);
  const body = options.body ? JSON.parse(String(options.body)) : {};
  const state = loadState();
  const method = (options.method || 'GET').toUpperCase();

  if (path === '/api/health') {
    return { status: 'ONLINE', mode: 'VERCEL_SANDBOX' };
  }

  if (path === '/api/auth/lookup') {
    const id = String(body.identifier || '').trim();
    const u = USERS[id];
    if (!u) throw new Error('Username not recognised. Try premier_user, corp_initiator, or corp_authoriser.');
    return {
      success: true,
      profile: {
        username: id,
        fullName: u.fullName,
        organisationName: 'Meridian Global Manufacturing Ltd',
        country: 'GB',
        methods: { password: true, securityPin: true, mobileAuth: true, securityCode: true, passkey: false, passkeyCount: 0 },
      },
    };
  }

  if (path === '/api/auth/login' || path === '/api/auth/login-pin' || path === '/api/auth/login-security-code') {
    const id = String(body.identifier || '').trim();
    const u = USERS[id];
    if (!u) throw new Error('Invalid credentials.');
    const expectedPin = state.pinMap?.[id] || '123456';
    if (path === '/api/auth/login' && body.password !== u.password) throw new Error('Incorrect password.');
    if (path === '/api/auth/login-pin' && body.pin !== expectedPin) throw new Error('Incorrect Mobile Security PIN.');
    if (path === '/api/auth/login-security-code' && state.securityCodes[id] !== body.code) throw new Error('Invalid or expired security code.');
    sessionStorage.setItem('hsbc_cnet_sbx_user', id);
    return { success: true, accessToken: `sbx-jwt-${id}`, user: currentProfile() };
  }

  if (path === '/api/auth/security-code/generate') {
    const code = String(Math.floor(10000000 + Math.random() * 89999999));
    state.securityCodes[body.identifier || 'premier_user'] = code;
    saveState(state);
    return { success: true, code, ttlSeconds: 120, expiresAt: new Date(Date.now() + 120000).toISOString() };
  }

  if (path === '/api/auth/pin/verify') {
    const prof = currentProfile();
    const expectedPin = state.pinMap?.[prof.username] || '123456';
    if (body.pin !== expectedPin) throw new Error('Incorrect 6-digit Security PIN.');
    return { success: true, reauthToken: 'sbx-stepup' };
  }

  if (path === '/api/auth/pin/set' || path === '/api/auth/pin/change') {
    const prof = currentProfile();
    if (path === '/api/auth/pin/change') {
      const expectedPin = state.pinMap?.[prof.username] || '123456';
      if (body.currentPin !== expectedPin) throw new Error('Current Mobile Security PIN is incorrect.');
    }
    state.pinMap[prof.username] = String(body.newPin);
    saveState(state);
    return { success: true, message: 'Mobile Security PIN updated.' };
  }

  if (path === '/api/auth/pin/reset-request') {
    const id = String(body.identifier || currentProfile().username).trim();
    const code = String(Math.floor(100000 + Math.random() * 899999));
    state.resetCodes[id] = code;
    saveState(state);
    return { success: true, maskedEmail: `${id.slice(0, 2)}****@meridiannet.com`, sandboxResetCode: code, expiresInMinutes: 30 };
  }

  if (path === '/api/auth/pin/reset-confirm') {
    const id = String(body.identifier || currentProfile().username).trim();
    if (state.resetCodes[id] !== String(body.resetCode).trim()) {
      throw new Error('Invalid or expired reset verification code.');
    }
    state.pinMap[id] = String(body.newPin);
    delete state.resetCodes[id];
    saveState(state);
    return { success: true, message: 'Mobile Security PIN reset successfully.' };
  }

  if (path === '/api/auth/corporate-session') {
    return { success: true, user: currentProfile() };
  }

  if (path === '/api/auth/logout') {
    return { success: true };
  }

  if (path === '/api/auth/devices' && method === 'POST') {
    const d = { id: `dev-${Date.now()}`, device_name: body.deviceName, platform: body.platform || 'Web', device_type: body.deviceType || 'MOBILE_AUTH', status: 'ACTIVE', registered_at: new Date().toISOString(), last_used_at: new Date().toISOString() };
    state.devices.unshift(d);
    saveState(state);
    return { success: true, device: d };
  }

  if (path.match(/^\/api\/auth\/devices\/.+\/deactivate$/)) {
    const id = path.split('/')[4];
    const dev = state.devices.find((d) => d.id === id);
    if (dev) dev.status = 'DEACTIVATED';
    saveState(state);
    return { success: true };
  }

  if (path.match(/^\/api\/auth\/devices\/.+\/activate$/)) {
    const id = path.split('/')[4];
    const dev = state.devices.find((d) => d.id === id);
    if (dev) dev.status = 'ACTIVE';
    saveState(state);
    return { success: true };
  }

  if (path.match(/^\/api\/auth\/devices\/.+$/) && method === 'DELETE') {
    const id = path.split('/')[4];
    state.devices = state.devices.filter((d) => d.id !== id);
    saveState(state);
    return { success: true };
  }

  if (path === '/api/auth/devices') {
    return { success: true, devices: state.devices, passkeys: [] };
  }

  if (path === '/api/auth/login-approval/pending') {
    return { success: true, requests: [] };
  }

  if (path === '/api/corporate/context') {
    const orgId = params.get('orgId') || currentProfile().organisationId;
    const active = state.organisations.find((o) => o.id === orgId) || state.organisations[0];
    return {
      success: true,
      organisations: state.organisations,
      activeOrganisation: active,
      countryCapability: {
        code: active.country,
        name: active.country === 'IN' ? 'India' : 'United Kingdom',
        supportsRDC: active.country !== 'IN',
        supportsIBAN: active.country !== 'IN',
      },
    };
  }

  if (path === '/api/corporate/accounts') {
    const orgId = params.get('orgId') || state.organisations[0].id;
    const accs = state.accounts.filter((a) => a.organisation_id === orgId);
    const total = accs.reduce((s, a) => s + a.available_balance, 0);
    return {
      success: true,
      accounts: accs,
      totalAvailableBase: Number(total.toFixed(2)),
      baseCurrency: orgId === 'org-meridian-in' ? 'INR' : 'GBP',
      lastUpdated: new Date().toISOString(),
    };
  }

  if (path.match(/^\/api\/corporate\/accounts\/.+\/favourite$/)) {
    const id = path.split('/')[4];
    const acc = state.accounts.find((a) => a.id === id);
    if (acc) {
      if (body.isFavourite !== undefined) acc.isFavourite = !!body.isFavourite;
      if (body.favouriteOrder !== undefined) acc.favourite_order = Number(body.favouriteOrder);
      saveState(state);
    }
    return { success: true };
  }

  if (path.match(/^\/api\/corporate\/accounts\/.+\/statements$/)) {
    const id = path.split('/')[4];
    const acc = state.accounts.find((a) => a.id === id) || state.accounts[0];
    return {
      success: true,
      account: acc,
      statements: [{ id: 'st-1', period_label: 'November 2026 (MTD)', start_date: '2026-11-01', end_date: '2026-11-26', opening_balance: acc.available_balance * 0.9, closing_balance: acc.available_balance, document_available: 1 }],
    };
  }

  if (path === '/api/corporate/transactions') {
    return { success: true, transactions: state.transactions };
  }

  if (path === '/api/corporate/authorisations') {
    const orgId = params.get('orgId') || state.organisations[0].id;
    const curUser = currentProfile();
    const list = state.payments
      .filter((p) => p.organisation_id === orgId)
      .map((p) => ({
        ...p,
        canCurrentUserApprove: curUser.permissions.includes('APPROVE_PAYMENTS') && p.initiator_id !== curUser.id && ['AWAITING_AUTHORISATION', 'PARTIALLY_AUTHORISED'].includes(p.status),
      }));
    return { success: true, instructions: list, tradeItems: state.trade };
  }

  if (path === '/api/corporate/authorisations/decide') {
    const results: any[] = [];
    for (const id of body.ids || []) {
      const p = state.payments.find((x) => x.id === id);
      if (p) {
        p.status = body.decision === 'APPROVED' ? 'COMPLETED' : body.decision === 'SEND_TO_REPAIR' ? 'REPAIR_REQUESTED' : body.decision === 'INFO_REQUESTED' ? p.status : 'REJECTED';
        p.current_approvals = body.decision === 'APPROVED' ? p.required_approvals : p.current_approvals;
        p.timeline = p.timeline || [];
        p.timeline.push({ id: String(Date.now()), stage: body.decision, label: body.decision.replace(/_/g, ' '), description: body.comment || 'Updated in sandbox', timestamp: new Date().toISOString(), state: body.decision === 'REJECTED' ? 'FAILED' : 'COMPLETED' });
        results.push({ id: p.id, reference: p.reference, status: p.status });
      }
    }
    saveState(state);
    return { success: true, results, errors: [] };
  }

  if (path === '/api/corporate/fx-rates') {
    const now = new Date().toISOString();
    return {
      success: true,
      timestamp: now,
      rates: [
        { base: 'GBP', quote: 'USD', rate: 1.2845, inverseRate: 0.7785, timestamp: now, source: 'SANDBOX_INDICATIVE' },
        { base: 'GBP', quote: 'EUR', rate: 1.1730, inverseRate: 0.8525, timestamp: now, source: 'SANDBOX_INDICATIVE' },
        { base: 'GBP', quote: 'INR', rate: 108.6957, inverseRate: 0.0092, timestamp: now, source: 'SANDBOX_INDICATIVE' },
        { base: 'GBP', quote: 'SGD', rate: 1.7212, inverseRate: 0.5810, timestamp: now, source: 'SANDBOX_INDICATIVE' },
        { base: 'GBP', quote: 'AED', rate: 4.7192, inverseRate: 0.2119, timestamp: now, source: 'SANDBOX_INDICATIVE' },
        { base: 'EUR', quote: 'USD', rate: 1.0951, inverseRate: 0.9132, timestamp: now, source: 'SANDBOX_INDICATIVE' },
      ],
    };
  }

  if (path === '/api/corporate/fx-quote') {
    const rate = body.fromCurrency === body.toCurrency ? 1 : 1.173;
    return {
      success: true,
      quote: { id: 'q-1', fromCurrency: body.fromCurrency, toCurrency: body.toCurrency, amount: body.amount, rate, convertedAmount: Number((body.amount * rate).toFixed(2)), fee: body.fromCurrency === body.toCurrency ? 0 : 12, expiresAt: new Date(Date.now() + 120000).toISOString(), validSeconds: 120 },
    };
  }

  if (path === '/api/corporate/payments' && method === 'POST') {
    const p = {
      id: `pay-${Date.now()}`,
      reference: `PAY-2026-${Math.floor(10000 + Math.random() * 89999)}`,
      organisation_id: body.orgId || 'org-meridian-gb',
      initiator_id: currentProfile().id,
      initiator_name: currentProfile().full_name,
      category: body.category || 'PRIORITY_PAYMENT',
      debit_account_id: body.debitAccountId,
      debit_account_name: 'Corporate Operating Account',
      debit_currency: body.currency || 'GBP',
      beneficiary_name: body.beneficiaryName,
      beneficiary_account: body.beneficiaryAccount,
      beneficiary_bank: body.beneficiaryBank,
      destination_country: body.destinationCountry || 'GB',
      amount: Number(body.amount),
      currency: body.currency || 'GBP',
      reference_note: body.referenceNote,
      payment_date: body.paymentDate || new Date().toISOString().slice(0, 10),
      status: 'AWAITING_AUTHORISATION',
      required_approvals: 1,
      current_approvals: 0,
      approvalHistory: [],
      timeline: [{ id: '1', stage: 'CREATED', label: 'Payment created', description: 'Submitted to authorisation queue', timestamp: new Date().toISOString(), state: 'COMPLETED' }],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    state.payments.unshift(p);
    saveState(state);
    return { success: true, payment: p };
  }

  if (path.match(/^\/api\/corporate\/payments\/.+\/fraud-report$/)) {
    const ref = `FRD-2026-${Math.floor(1000 + Math.random() * 8999)}`;
    return { success: true, report: { reference: ref, status: 'CASE_OPENED_SANDBOX' }, message: `Internal fraud case ${ref} logged. (Sandbox environment — no external bank desk connected.)` };
  }

  if (path === '/api/corporate/payments') {
    const orgId = params.get('orgId') || state.organisations[0].id;
    return { success: true, payments: state.payments.filter((p) => p.organisation_id === orgId) };
  }

  if (path === '/api/corporate/liquidity') {
    const orgId = params.get('orgId') || state.organisations[0].id;
    const accs = state.accounts.filter((a) => a.organisation_id === orgId);
    const total = accs.reduce((s, a) => s + a.available_balance, 0);
    return {
      success: true,
      baseCurrency: orgId === 'org-meridian-in' ? 'INR' : 'GBP',
      totalAvailableBase: total,
      totalLedgerBase: total,
      byCurrency: accs.map((a) => ({ currency: a.currency, available: a.available_balance, ledger: a.ledger_balance, baseEquivalent: a.available_balance, accountCount: 1 })),
      accounts: accs.map((a) => ({ ...a, baseEquivalent: a.available_balance })),
      history: [
        { label: 'Nov 01', available: total * 0.89, ledger: total * 0.9 },
        { label: 'Nov 08', available: total * 0.92, ledger: total * 0.93 },
        { label: 'Nov 15', available: total * 0.95, ledger: total * 0.95 },
        { label: 'Nov 22', available: total * 0.98, ledger: total * 0.99 },
        { label: 'Today', available: total, ledger: total },
      ],
    };
  }

  if (path.match(/^\/api\/corporate\/trade\/.+\/decide$/)) {
    const id = path.split('/')[4];
    const t = state.trade.find((x) => x.id === id);
    if (t) t.status = body.decision === 'APPROVED' ? 'ISSUED' : 'REJECTED';
    saveState(state);
    return { success: true, status: t?.status };
  }

  if (path === '/api/corporate/trade') {
    return { success: true, transactions: state.trade };
  }

  if (path === '/api/corporate/receivables/draw') {
    const ref = `DRW-2026-${Math.floor(1000 + Math.random() * 8999)}`;
    const fac = state.facilities.find((f) => f.id === body.facilityId);
    if (fac) {
      fac.utilised_amount += Number(body.amount);
      fac.available_limit = Math.max(0, fac.available_limit - Number(body.amount));
      state.receivablesDraws.unshift({ id: `drw-${Date.now()}`, reference: ref, amount: Number(body.amount), currency: fac.currency, invoice_reference: body.invoiceReference, created_at: new Date().toISOString() });
      saveState(state);
    }
    return { success: true, reference: ref, message: 'Draw payment processed through internal sandbox receivables ledger.' };
  }

  if (path === '/api/corporate/receivables/limit-request') {
    const ref = `LMT-2026-${Math.floor(1000 + Math.random() * 8999)}`;
    state.receivablesLimits.unshift({ id: `lmt-${Date.now()}`, reference: ref, requested_limit: Number(body.requestedLimit), status: 'UNDER_REVIEW', created_at: new Date().toISOString() });
    saveState(state);
    return { success: true, reference: ref, status: 'UNDER_REVIEW' };
  }

  if (path.match(/^\/api\/corporate\/receivables\/messages\/.+\/reply$/)) {
    const id = path.split('/')[5];
    const m = state.receivablesMessages.find((x) => x.id === id);
    if (m) m.status = 'REPLIED';
    state.receivablesMessages.unshift({ id: `rfm-${Date.now()}`, subject: `Re: ${m?.subject || 'Message'}`, body: body.body, sender_name: currentProfile().full_name, status: 'SENT', created_at: new Date().toISOString(), attachments: [] });
    saveState(state);
    return { success: true };
  }

  if (path === '/api/corporate/receivables/messages' && method === 'POST') {
    state.receivablesMessages.unshift({ id: `rfm-${Date.now()}`, subject: body.subject, body: body.body, sender_name: currentProfile().full_name, status: 'SENT', created_at: new Date().toISOString(), attachments: [] });
    saveState(state);
    return { success: true };
  }

  if (path.match(/^\/api\/corporate\/receivables\/messages\/.+\/read$/)) {
    const id = path.split('/')[5];
    const m = state.receivablesMessages.find((x) => x.id === id);
    if (m && m.status === 'UNREAD') m.status = 'READ';
    saveState(state);
    return { success: true };
  }

  if (path === '/api/corporate/receivables') {
    return { success: true, facilities: state.facilities, draws: state.receivablesDraws, limitRequests: state.receivablesLimits, messages: state.receivablesMessages };
  }

  if (path === '/api/corporate/rdc' && method === 'POST') {
    const d = { id: `rdc-${Date.now()}`, reference: `RDC-2026-${Math.floor(1000 + Math.random() * 8999)}`, amount: Number(body.amount), currency: 'GBP', quality_status: 'PASSED', status: 'PENDING_CLEARING_SANDBOX' };
    state.rdcDeposits.unshift(d);
    saveState(state);
    return { success: true, deposit: d };
  }

  if (path === '/api/corporate/rdc') {
    return { success: true, deposits: state.rdcDeposits };
  }

  if (path === '/api/corporate/self-service' && method === 'POST') {
    const r = { id: `sr-${Date.now()}`, reference: `SR-2026-${Math.floor(1000 + Math.random() * 8999)}`, request_type: body.requestType, period: body.period, status: 'COMPLETED', document_name: `${body.requestType}.pdf`, created_at: new Date().toISOString() };
    state.serviceRequests.unshift(r);
    saveState(state);
    return { success: true, request: r };
  }

  if (path === '/api/corporate/self-service') {
    return { success: true, requests: state.serviceRequests };
  }

  if (path === '/api/beneficiaries' && method === 'POST') {
    const b = { id: `ben-${Date.now()}`, name: body.name, nickname: body.nickname, account_number: body.accountNumber, bank_name: body.bankName, ifsc_swift: body.ifscSwift, transfer_limit: Number(body.transferLimit || 50000), is_favorite: 0, activation_status: 'ACTIVE' };
    state.beneficiaries.unshift(b);
    saveState(state);
    return { success: true, beneficiary: b };
  }

  if (path === '/api/beneficiaries') {
    return { success: true, beneficiaries: state.beneficiaries };
  }

  if (path === '/api/bills') {
    return { success: true, bills: state.bills };
  }

  if (path === '/api/bills/pay') {
    const b = state.bills.find((x) => x.id === body.billId);
    if (b) b.status = 'PAID';
    saveState(state);
    return { success: true };
  }

  if (path === '/api/notifications') {
    return { success: true, notifications: state.notifications, unreadCount: state.notifications.filter((n) => !n.is_read).length };
  }

  if (path === '/api/notifications/read-all') {
    state.notifications.forEach((n) => { n.is_read = 1; });
    saveState(state);
    return { success: true };
  }

  if (path.match(/^\/api\/notifications\/.+\/read$/)) {
    const id = path.split('/')[3];
    const n = state.notifications.find((x) => x.id === id);
    if (n) n.is_read = 1;
    saveState(state);
    return { success: true };
  }

  if (path === '/api/support/tickets' && method === 'POST') {
    const t = { id: `t-${Date.now()}`, ticket_number: `TCK-2026-${Math.floor(1000 + Math.random() * 8999)}`, subject: body.subject, category: body.category, status: 'OPEN', messages: [{ id: 'm1', sender_type: 'USER', message: body.description }] };
    state.tickets.unshift(t);
    saveState(state);
    return { success: true, ticket: t };
  }

  if (path.match(/^\/api\/support\/tickets\/.+\/message$/)) {
    const id = path.split('/')[4];
    const t = state.tickets.find((x) => x.id === id);
    if (t) t.messages.push({ id: `m-${Date.now()}`, sender_type: 'USER', message: body.message });
    saveState(state);
    return { success: true };
  }

  if (path.match(/^\/api\/support\/tickets\/.+$/)) {
    const id = path.split('/')[4];
    const t = state.tickets.find((x) => x.id === id);
    return { success: true, ticket: t, messages: t?.messages || [] };
  }

  if (path === '/api/support/tickets') {
    return { success: true, tickets: state.tickets };
  }

  if (path === '/api/profile/sessions') {
    return { success: true, sessions: [{ id: 'sess-current', device_name: 'Current Browser Session', ip_address: '127.0.0.1', last_active: new Date().toISOString() }] };
  }

  return { success: true };
}
