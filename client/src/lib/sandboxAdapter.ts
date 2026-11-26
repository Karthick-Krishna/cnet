/**
 * Vercel Static Deployment Fallback Adapter
 * Engages ONLY when deployed as a static site (e.g. Vercel) without a live VITE_API_URL backend,
 * ensuring all HSBC Cnet client workflows remain functional in cloud previews.
 */

const STORAGE_KEY = 'hsbc_cnet_vercel_sandbox_v1';

interface SandboxState {
  organisations: any[];
  accounts: any[];
  payments: any[];
  transactions: any[];
  beneficiaries: any[];
  trade: any[];
  facilities: any[];
  notifications: any[];
  tickets: any[];
  devices: any[];
  serviceRequests: any[];
  rdcDeposits: any[];
  securityCodes: Record<string, string>;
}

function getInitialState(): SandboxState {
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
        account_type: 'SAVINGS', currency: 'GBP', available_balance: 48250.75, ledger_balance: 48250.75,
        availableBalance: 48250.75, ledgerBalance: 48250.75, status: 'ACTIVE', country: 'GB',
        branch_name: 'Canary Wharf Corporate Hub', ifsc_swift: 'MRDNGB2LXXX', sort_code: '40-05-15',
        isFavourite: true, favourite_order: 1,
      },
      {
        id: 'acc-gb-2', organisation_id: 'org-meridian-gb', account_number: '400515-77192044',
        maskedAccountNumber: '•••• •••• 2044', account_name: 'GBP Corporate Disbursements',
        account_type: 'CURRENT', currency: 'GBP', available_balance: 9840.20, ledger_balance: 9840.20,
        availableBalance: 9840.20, ledgerBalance: 9840.20, status: 'ACTIVE', country: 'GB',
        branch_name: 'Canary Wharf Corporate Hub', ifsc_swift: 'MRDNGB2LXXX', sort_code: '40-05-15',
        isFavourite: true, favourite_order: 2,
      },
      {
        id: 'acc-usd-1', organisation_id: 'org-meridian-gb', account_number: '400515-99201485',
        maskedAccountNumber: '•••• •••• 1485', account_name: 'USD Trade Nostro Account',
        account_type: 'FOREIGN_CURRENCY', currency: 'USD', available_balance: 12450.00, ledger_balance: 12450.00,
        availableBalance: 12450.00, ledgerBalance: 12450.00, status: 'ACTIVE', country: 'GB',
        branch_name: 'Canary Wharf Corporate Hub', ifsc_swift: 'MRDNGB2LXXX',
        isFavourite: true, favourite_order: 3,
      },
      {
        id: 'acc-eur-1', organisation_id: 'org-meridian-gb', account_number: 'DE89-3704-0044-0532',
        maskedAccountNumber: '•••• •••• 0532', account_name: 'Euro SEPA Treasury Pool',
        account_type: 'TREASURY', currency: 'EUR', available_balance: 142850.40, ledger_balance: 148200.40,
        availableBalance: 142850.40, ledgerBalance: 148200.40, status: 'ACTIVE', country: 'DE',
        branch_name: 'Frankfurt Corporate Hub', ifsc_swift: 'MRDNDEFFXXX', iban: 'DE89370400440532013000',
        isFavourite: false, favourite_order: 4,
      },
      {
        id: 'acc-in-1', organisation_id: 'org-meridian-in', account_number: '0641-0088-2941-01',
        maskedAccountNumber: '•••• •••• 4101', account_name: 'India Corporate Current',
        account_type: 'OPERATING', currency: 'INR', available_balance: 14850200.00, ledger_balance: 15120000.00,
        availableBalance: 14850200.00, ledgerBalance: 15120000.00, status: 'ACTIVE', country: 'IN',
        branch_name: 'Chennai Anna Salai Corporate', ifsc_swift: 'MRDN0641002',
        isFavourite: true, favourite_order: 1,
      },
    ],
    payments: [
      {
        id: 'pay-1', reference: 'PAY-2026-44102', organisation_id: 'org-meridian-gb',
        initiator_id: 'user-initiator', initiator_name: 'Claire Beaumont', category: 'PRIORITY_PAYMENT',
        debit_account_id: 'acc-gb-1', debit_account_name: 'GBP Operating Treasury', debit_currency: 'GBP',
        beneficiary_name: 'Nordic Components GmbH', beneficiary_account: 'DE89370400440532013000',
        beneficiary_bank: 'Deutsche Bank AG', destination_country: 'DE', swift_bic: 'DEUTDEFFXXX',
        amount: 14500.00, currency: 'EUR', exchange_rate: 1.173, charges_bearer: 'OUR', charges_amount: 18,
        payment_purpose: 'SUPP', reference_note: 'Q4 Turbine Actuator Invoice #NC-9021',
        status: 'AWAITING_AUTHORISATION', required_approvals: 2, current_approvals: 1,
        unusualFlags: ['Cross-border FX settlement above GBP 10,000 threshold'],
        approvalHistory: [{ approverId: 'user-auth', approverName: 'Rajiv Malhotra', approverRole: 'AUTHORISER', decision: 'APPROVED', timestamp: new Date().toISOString() }],
        timeline: [{ id: '1', stage: 'CREATED', label: 'Payment created', description: 'Created by Claire Beaumont', timestamp: new Date().toISOString(), state: 'COMPLETED' }],
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      },
      {
        id: 'pay-2', reference: 'PAY-2026-43980', organisation_id: 'org-meridian-gb',
        initiator_id: 'user-initiator', initiator_name: 'Claire Beaumont', category: 'PRIORITY_PAYMENT',
        debit_account_id: 'acc-gb-1', debit_account_name: 'GBP Operating Treasury', debit_currency: 'GBP',
        beneficiary_name: 'Thames Logistics Partners Ltd', beneficiary_account: '200412-99014522',
        beneficiary_bank: 'Barclays Corporate UK', destination_country: 'GB', swift_bic: 'BARCGB22XXX',
        amount: 3420.00, currency: 'GBP', exchange_rate: 1.0, charges_bearer: 'SHA', charges_amount: 0,
        payment_purpose: 'SUPP', reference_note: 'UK Haulage Settlement Nov W3',
        status: 'COMPLETED', required_approvals: 1, current_approvals: 1,
        unusualFlags: [], approvalHistory: [], timeline: [{ id: '1', stage: 'COMPLETED', label: 'Completed', description: 'Settled in sandbox ledger', timestamp: new Date().toISOString(), state: 'COMPLETED' }],
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      },
    ],
    transactions: [
      { id: 'txn-1', source_account_id: 'acc-gb-1', reference: 'TXN-2026-90812', counterparty_name: 'Nordic Components GmbH', description: 'Raw Material Vendor Settlement', amount: 1200, currency: 'GBP', entry_type: 'DEBIT', status: 'COMPLETED', category: 'TRANSFER', balance_after: 48250.75, created_at: new Date().toISOString() },
      { id: 'txn-2', source_account_id: 'acc-gb-1', reference: 'TXN-2026-85420', counterparty_name: 'Treasury Overnight Sweep', description: 'Interest Credit', amount: 320.45, currency: 'GBP', entry_type: 'CREDIT', status: 'COMPLETED', category: 'INVESTMENT', balance_after: 49450.75, created_at: new Date().toISOString() },
    ],
    beneficiaries: [
      { id: 'ben-1', name: 'Nordic Components GmbH', nickname: 'Munich Supplier', account_number: 'DE89370400440532013000', bank_name: 'Deutsche Bank AG', ifsc_swift: 'DEUTDEFFXXX', transfer_limit: 250000, is_favorite: 1, country: 'DE', currency: 'EUR', activation_status: 'ACTIVE' },
      { id: 'ben-2', name: 'Thames Logistics Partners Ltd', nickname: 'UK Freight', account_number: '200412-99014522', bank_name: 'Barclays Corporate UK', ifsc_swift: 'BARCGB22XXX', transfer_limit: 150000, is_favorite: 1, country: 'GB', currency: 'GBP', activation_status: 'ACTIVE' },
    ],
    trade: [
      { id: 'trd-1', reference: 'TRD-2026-11092', organisation_id: 'org-meridian-gb', trade_category: 'IMPORT_DC', direction: 'IMPORT', counterparty: 'Shenzhen Precision Electronics Co.', amount: 185000, currency: 'USD', status: 'AWAITING_AUTHORISATION', pending_action: 'Authorise Import Documentary Credit', documents: [{ id: 'd1', name: 'Commercial_Invoice_SZ8821.pdf', size: '420 KB' }], timeline: [{ id: 't1', label: 'Awaiting Corporate Sign-Off', description: 'Pending trade authoriser approval', timestamp: new Date().toISOString() }] },
    ],
    facilities: [
      { id: 'rf-1', organisation_id: 'org-meridian-gb', account_name: 'UK Invoice Discounting Facility', facility_number: 'RF-UK-9012', scenario: 'Confidential Invoice Discounting', currency: 'GBP', total_limit: 500000, utilised_amount: 185000, available_limit: 315000, advance_rate_pct: 90, status: 'ACTIVE' },
    ],
    notifications: [
      { id: 'n-1', title: 'Payment Awaiting Authorisation', message: 'Priority wire PAY-2026-44102 (EUR 14,500.00) awaits sign-off.', type: 'PAYMENT', is_read: 0, created_at: new Date().toISOString() },
    ],
    tickets: [
      { id: 't-1', ticket_number: 'TCK-2026-0041', subject: 'SEPA Instant Cut-off Inquiry', category: 'ACCOUNT_INQUIRY', status: 'OPEN', messages: [{ id: 'm1', sender_type: 'SUPPORT_AGENT', message: 'EUR SEPA instructions authorised before 15:30 GMT are queued for same-day TARGET2 settlement.' }] },
    ],
    devices: [
      { id: 'dev-1', device_name: 'iPhone 16 Pro (Mobile Auth)', platform: 'iOS / Safari', status: 'ACTIVE', last_used_at: new Date().toISOString() },
    ],
    serviceRequests: [],
    rdcDeposits: [],
    securityCodes: {},
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
    if (path === '/api/auth/login' && body.password !== u.password) throw new Error('Incorrect password.');
    if (path === '/api/auth/login-pin' && body.pin !== '123456') throw new Error('Incorrect Mobile Security PIN.');
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
    if (body.pin !== '123456') throw new Error('Incorrect 6-digit Security PIN.');
    return { success: true, reauthToken: 'sbx-stepup' };
  }

  if (path === '/api/auth/corporate-session') {
    return { success: true, user: currentProfile() };
  }

  if (path === '/api/auth/logout') {
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
        canCurrentUserApprove: curUser.permissions.includes('APPROVE_PAYMENTS') && p.initiator_id !== curUser.id && p.status === 'AWAITING_AUTHORISATION',
      }));
    return { success: true, instructions: list, tradeItems: state.trade };
  }

  if (path === '/api/corporate/authorisations/decide') {
    const results: any[] = [];
    for (const id of body.ids || []) {
      const p = state.payments.find((x) => x.id === id);
      if (p) {
        p.status = body.decision === 'APPROVED' ? 'COMPLETED' : 'REJECTED';
        p.current_approvals = p.required_approvals;
        results.push({ id: p.id, reference: p.reference, status: p.status });
      }
    }
    saveState(state);
    return { success: true, results, errors: [] };
  }

  if (path === '/api/corporate/fx-quote') {
    const rate = body.fromCurrency === body.toCurrency ? 1 : 1.173;
    return {
      success: true,
      quote: { id: 'q-1', fromCurrency: body.fromCurrency, toCurrency: body.toCurrency, amount: body.amount, rate, convertedAmount: Number((body.amount * rate).toFixed(2)), fee: 12, validSeconds: 120 },
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
        { label: 'Nov 01', available: total * 0.9, ledger: total * 0.9 },
        { label: 'Nov 15', available: total * 0.95, ledger: total * 0.95 },
        { label: 'Today', available: total, ledger: total },
      ],
    };
  }

  if (path === '/api/corporate/trade') {
    return { success: true, transactions: state.trade };
  }

  if (path === '/api/corporate/receivables') {
    return { success: true, facilities: state.facilities, draws: [], limitRequests: [], messages: [] };
  }

  if (path === '/api/corporate/rdc') {
    return { success: true, deposits: state.rdcDeposits };
  }

  if (path === '/api/corporate/self-service') {
    return { success: true, requests: state.serviceRequests };
  }

  if (path === '/api/beneficiaries') {
    return { success: true, beneficiaries: state.beneficiaries };
  }

  if (path === '/api/bills') {
    return { success: true, bills: [] };
  }

  if (path === '/api/notifications') {
    return { success: true, notifications: state.notifications, unreadCount: state.notifications.filter((n) => !n.is_read).length };
  }

  if (path === '/api/support/tickets') {
    return { success: true, tickets: state.tickets };
  }

  if (path === '/api/profile/sessions') {
    return { success: true, sessions: [] };
  }

  return { success: true };
}
