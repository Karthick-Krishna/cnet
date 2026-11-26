import { DESIGN_TOKENS } from '../designTokens';

export const BANK_CONFIG = {
  appName: 'HSBC Cnet',
  fullTitle: 'HSBC Cnet Corporate Banking',
  adminAppName: 'HSBC Cnet Operations Admin',
  tagline: 'Global Corporate Cash Management, Payments & Trade',
  version: '4.2.0-enterprise',
  disclaimer:
    'Sandbox Demonstration Environment for HSBC Cnet. Balances, FX quotes, and settlements operate in an internal sandbox ledger unless connected to an authorised banking API.',
  defaultCurrency: 'GBP',
  currencySymbols: {
    GBP: '£',
    USD: '$',
    EUR: '€',
    INR: '₹',
    SGD: 'S$',
    AED: 'AED ',
    JPY: '¥',
    CHF: 'CHF ',
  } as Record<string, string>,
  colors: {
    primaryRed: DESIGN_TOKENS.colors.accentPrimary,
    deepRed: DESIGN_TOKENS.colors.accentPrimaryHover,
    navy: DESIGN_TOKENS.colors.accentNavy,
    white: DESIGN_TOKENS.colors.surfacePrimary,
    mainBg: DESIGN_TOKENS.colors.surfaceSecondary,
    cardBg: DESIGN_TOKENS.colors.surfacePrimary,
    primaryText: DESIGN_TOKENS.colors.textPrimary,
    secondaryText: DESIGN_TOKENS.colors.textSecondary,
    border: DESIGN_TOKENS.colors.borderSubtle,
    success: DESIGN_TOKENS.colors.statusSuccessText,
    warning: DESIGN_TOKENS.colors.statusWarningText,
    error: DESIGN_TOKENS.colors.statusDangerText,
  },
  defaultBranch: {
    name: 'Canary Wharf Corporate Hub',
    ifsc: 'MRDNGB2LXXX',
    swift: 'MRDNGB2LXXX',
    city: 'London',
    country: 'GB',
  },
};

export interface CountryCapability {
  code: string;
  name: string;
  defaultCurrency: string;
  clearingLabel: string;
  clearingExample: string;
  supportsIBAN: boolean;
  supportsSEPA: boolean;
  supportsACH: boolean;
  supportsFasterPayments: boolean;
  supportsRDC: boolean;
  supportsTradeFinance: boolean;
  supportsReceivablesFinance: boolean;
}

export const COUNTRY_CAPABILITIES: Record<string, CountryCapability> = {
  GB: {
    code: 'GB',
    name: 'United Kingdom',
    defaultCurrency: 'GBP',
    clearingLabel: 'Sort Code / CHAPS',
    clearingExample: '40-05-15',
    supportsIBAN: true,
    supportsSEPA: true,
    supportsACH: false,
    supportsFasterPayments: true,
    supportsRDC: true,
    supportsTradeFinance: true,
    supportsReceivablesFinance: true,
  },
  US: {
    code: 'US',
    name: 'United States',
    defaultCurrency: 'USD',
    clearingLabel: 'ABA Routing Number',
    clearingExample: '021000021',
    supportsIBAN: false,
    supportsSEPA: false,
    supportsACH: true,
    supportsFasterPayments: false,
    supportsRDC: true,
    supportsTradeFinance: true,
    supportsReceivablesFinance: true,
  },
  IN: {
    code: 'IN',
    name: 'India',
    defaultCurrency: 'INR',
    clearingLabel: 'IFSC Code (NEFT/RTGS)',
    clearingExample: 'MRDN0641002',
    supportsIBAN: false,
    supportsSEPA: false,
    supportsACH: false,
    supportsFasterPayments: false,
    supportsRDC: false,
    supportsTradeFinance: true,
    supportsReceivablesFinance: true,
  },
  DE: {
    code: 'DE',
    name: 'Germany',
    defaultCurrency: 'EUR',
    clearingLabel: 'SEPA / IBAN',
    clearingExample: 'DE89 3704 0044 0532 0130 00',
    supportsIBAN: true,
    supportsSEPA: true,
    supportsACH: false,
    supportsFasterPayments: false,
    supportsRDC: false,
    supportsTradeFinance: true,
    supportsReceivablesFinance: true,
  },
  SG: {
    code: 'SG',
    name: 'Singapore',
    defaultCurrency: 'SGD',
    clearingLabel: 'FAST / MEPS+ Bank Code',
    clearingExample: '7375-051',
    supportsIBAN: false,
    supportsSEPA: false,
    supportsACH: false,
    supportsFasterPayments: true,
    supportsRDC: false,
    supportsTradeFinance: true,
    supportsReceivablesFinance: true,
  },
  AE: {
    code: 'AE',
    name: 'United Arab Emirates',
    defaultCurrency: 'AED',
    clearingLabel: 'IBAN / UAEFTS',
    clearingExample: 'AE07 0331 2345 6789 0123 456',
    supportsIBAN: true,
    supportsSEPA: false,
    supportsACH: false,
    supportsFasterPayments: false,
    supportsRDC: false,
    supportsTradeFinance: true,
    supportsReceivablesFinance: false,
  },
};

export const CORPORATE_PERMISSIONS = [
  'VIEW_ACCOUNTS',
  'VIEW_BALANCES',
  'VIEW_TRANSACTIONS',
  'CREATE_PAYMENTS',
  'APPROVE_PAYMENTS',
  'REJECT_PAYMENTS',
  'MANAGE_BENEFICIARIES',
  'ACCESS_TRADE_FINANCE',
  'ACCESS_RECEIVABLES_FINANCE',
  'VIEW_LIQUIDITY',
  'ACCESS_RDC',
  'REQUEST_DOCUMENTS',
  'MANAGE_USERS',
  'MANAGE_ORGANISATIONS',
  'MANAGE_POLICIES',
  'VIEW_AUDIT_LOGS',
] as const;

export type CorporatePermission = (typeof CORPORATE_PERMISSIONS)[number];

export const ROLE_PERMISSION_DEFAULTS: Record<string, CorporatePermission[]> = {
  SYSTEM_ADMIN: [...CORPORATE_PERMISSIONS],
  ORG_ADMIN: [
    'VIEW_ACCOUNTS',
    'VIEW_BALANCES',
    'VIEW_TRANSACTIONS',
    'CREATE_PAYMENTS',
    'APPROVE_PAYMENTS',
    'REJECT_PAYMENTS',
    'MANAGE_BENEFICIARIES',
    'ACCESS_TRADE_FINANCE',
    'ACCESS_RECEIVABLES_FINANCE',
    'VIEW_LIQUIDITY',
    'ACCESS_RDC',
    'REQUEST_DOCUMENTS',
    'MANAGE_USERS',
    'VIEW_AUDIT_LOGS',
  ],
  AUTHORISER: [
    'VIEW_ACCOUNTS',
    'VIEW_BALANCES',
    'VIEW_TRANSACTIONS',
    'APPROVE_PAYMENTS',
    'REJECT_PAYMENTS',
    'ACCESS_TRADE_FINANCE',
    'VIEW_LIQUIDITY',
    'REQUEST_DOCUMENTS',
  ],
  PAYMENT_APPROVER: [
    'VIEW_ACCOUNTS',
    'VIEW_BALANCES',
    'VIEW_TRANSACTIONS',
    'APPROVE_PAYMENTS',
    'REJECT_PAYMENTS',
    'VIEW_LIQUIDITY',
  ],
  PAYMENT_INITIATOR: [
    'VIEW_ACCOUNTS',
    'VIEW_BALANCES',
    'VIEW_TRANSACTIONS',
    'CREATE_PAYMENTS',
    'MANAGE_BENEFICIARIES',
    'ACCESS_TRADE_FINANCE',
    'ACCESS_RECEIVABLES_FINANCE',
    'ACCESS_RDC',
    'REQUEST_DOCUMENTS',
  ],
  FINANCE_VIEWER: [
    'VIEW_ACCOUNTS',
    'VIEW_BALANCES',
    'VIEW_TRANSACTIONS',
    'VIEW_LIQUIDITY',
    'REQUEST_DOCUMENTS',
  ],
  AUDITOR: ['VIEW_ACCOUNTS', 'VIEW_BALANCES', 'VIEW_TRANSACTIONS', 'VIEW_AUDIT_LOGS', 'VIEW_LIQUIDITY'],
  SUPPORT_ADMIN: ['VIEW_ACCOUNTS', 'VIEW_TRANSACTIONS', 'VIEW_AUDIT_LOGS'],
};

export const PAYMENT_PURPOSE_CODES = [
  { code: 'SUPP', label: 'Supplier Invoice Settlement' },
  { code: 'SALA', label: 'Corporate Payroll & Compensation' },
  { code: 'TREA', label: 'Treasury & Liquidity Sweep' },
  { code: 'TAXS', label: 'Tax & Regulatory Payment' },
  { code: 'TRAD', label: 'Trade & Documentary Settlement' },
  { code: 'DIVI', label: 'Dividend / Intercompany Distribution' },
  { code: 'OTHR', label: 'General Corporate Expenditure' },
] as const;

export const TRANSACTION_CATEGORIES = [
  { id: 'TRANSFER', label: 'Wire & Treasury Transfers' },
  { id: 'SALARY', label: 'Payroll & Compensation' },
  { id: 'UTILITIES', label: 'Facilities & Utilities' },
  { id: 'SUPPLIER', label: 'Vendor & Supply Chain' },
  { id: 'TRADE', label: 'Trade Finance & FX' },
  { id: 'INVESTMENT', label: 'Liquidity & Money Market' },
  { id: 'CHARGES', label: 'Bank Charges & Levies' },
  { id: 'OTHER', label: 'Other Corporate Entries' },
] as const;

export const BILL_CATEGORIES = [
  { id: 'ELECTRICITY', name: 'Commercial Power', icon: 'Zap', billerExample: 'EDF Business / Tata Power' },
  { id: 'TAX_AUTHORITY', name: 'Tax & Customs', icon: 'Landmark', billerExample: 'HMRC / IRS / GST Portal' },
  { id: 'TELECOM', name: 'Enterprise Telecom', icon: 'Wifi', billerExample: 'BT Corporate / AT&T Business' },
  { id: 'INSURANCE', name: 'Commercial Insurance', icon: 'Shield', billerExample: 'Chubb / Allianz Corporate' },
  { id: 'CLOUD_INFRA', name: 'Cloud & Data Services', icon: 'Server', billerExample: 'AWS / Google Cloud Billing' },
  { id: 'OTHER', name: 'Other Corporate Bills', icon: 'FileText', billerExample: 'Municipal & Regulatory Fees' },
] as const;
