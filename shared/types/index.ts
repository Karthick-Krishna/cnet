export type CorporateRole =
  | 'SYSTEM_ADMIN'
  | 'ORG_ADMIN'
  | 'PAYMENT_INITIATOR'
  | 'PAYMENT_APPROVER'
  | 'AUTHORISER'
  | 'FINANCE_VIEWER'
  | 'AUDITOR'
  | 'SUPPORT_ADMIN'
  | 'USER'
  | 'SUPER_ADMIN'
  | 'OPERATIONS'
  | 'SUPPORT'
  | 'COMPLIANCE';

export interface OrganisationModuleConfig {
  accounts: boolean;
  authorisations: boolean;
  payments: boolean;
  track: boolean;
  liquidity: boolean;
  tradeFinance: boolean;
  receivablesFinance: boolean;
  remoteDepositCapture: boolean;
  billPayments: boolean;
  selfService: boolean;
}

export interface OrganisationRecord {
  id: string;
  name: string;
  registrationNumber: string;
  country: string;
  baseCurrency: string;
  status: 'ACTIVE' | 'SUSPENDED';
  isSandbox: boolean;
  modules: OrganisationModuleConfig;
  createdAt: string;
}

export interface UserSessionProfile {
  id: string;
  username: string;
  customerId?: string;
  fullName: string;
  email: string;
  phone: string;
  role: string;
  organisationId: string;
  organisationName: string;
  country: string;
  baseCurrency: string;
  permissions: string[];
  biometricEnabled: boolean;
  hasPinConfigured: boolean;
  mobileAuthActive: boolean;
  lastLoginAt?: string;
  preferredLanguage: string;
  preferredCurrency: string;
}

export interface CorporateAccount {
  id: string;
  organisationId: string;
  organisationName?: string;
  accountNumber: string;
  maskedAccountNumber: string;
  accountName: string;
  nickname?: string;
  accountType: 'SAVINGS' | 'CURRENT' | 'OPERATING' | 'TREASURY' | 'ESCROW' | 'FOREIGN_CURRENCY' | 'SALARY' | 'FIXED_DEPOSIT' | 'RECURRING_DEPOSIT';
  currency: string;
  availableBalance: number;
  ledgerBalance: number;
  status: 'ACTIVE' | 'DORMANT' | 'FROZEN' | 'CLOSED';
  country: string;
  branchName: string;
  swiftBic: string;
  iban?: string;
  sortCode?: string;
  isFavourite: boolean;
  favouriteOrder: number;
  updatedAt: string;
}

export interface CorporateTransaction {
  id: string;
  reference: string;
  accountId: string;
  accountName?: string;
  transactionDate: string;
  postingDate: string;
  description: string;
  counterpartyName: string;
  counterpartyAccount?: string;
  entryType: 'DEBIT' | 'CREDIT';
  amount: number;
  currency: string;
  status: 'COMPLETED' | 'PENDING' | 'FAILED' | 'REVERSED';
  transactionType: string;
  category: string;
  runningBalance?: number;
  fee?: number;
  tax?: number;
  exchangeRate?: number;
}

export type PaymentCategory =
  | 'PRIORITY_PAYMENT'
  | 'INTERNATIONAL_PAYMENT'
  | 'INTER_ACCOUNT_TRANSFER'
  | 'SEPA_PAYMENT'
  | 'ACH_CREDIT'
  | 'ACH_DEBIT'
  | 'BILL_PAYMENT'
  | 'PAYMENT_FILE'
  | 'FILE_LEVEL_INSTRUCTION'
  | 'TRADE_AUTHORISATION'
  | 'IMPORT_DOCUMENTARY_CREDIT'
  | 'DC_AMENDMENT'
  | 'IMPORT_BILL'
  | 'IMPORT_LOAN';

export type PaymentStatus =
  | 'DRAFT'
  | 'PENDING_SUBMISSION'
  | 'AWAITING_AUTHORISATION'
  | 'PARTIALLY_AUTHORISED'
  | 'AUTHORISED'
  | 'PROCESSING'
  | 'SENT'
  | 'COMPLETED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'FAILED'
  | 'RETURNED';

export interface PaymentTimelineEvent {
  id: string;
  stage: string;
  label: string;
  description: string;
  actor?: string;
  timestamp: string;
  state: 'COMPLETED' | 'CURRENT' | 'UPCOMING' | 'FAILED';
}

export interface PaymentInstruction {
  id: string;
  reference: string;
  organisationId: string;
  initiatorId: string;
  initiatorName: string;
  category: PaymentCategory;
  debitAccountId: string;
  debitAccountName: string;
  debitCurrency: string;
  beneficiaryId?: string;
  beneficiaryName: string;
  beneficiaryAccount: string;
  beneficiaryBank: string;
  destinationCountry: string;
  swiftBic?: string;
  iban?: string;
  amount: number;
  currency: string;
  exchangeRate?: number;
  convertedAmount?: number;
  chargesBearer: 'OUR' | 'SHA' | 'BEN';
  chargesAmount: number;
  paymentPurpose: string;
  paymentDate: string;
  referenceNote: string;
  additionalInfo?: string;
  status: PaymentStatus;
  requiredApprovals: number;
  currentApprovals: number;
  approvalHistory: {
    approverId: string;
    approverName: string;
    approverRole: string;
    decision: 'APPROVED' | 'REJECTED' | 'INFO_REQUESTED';
    comment?: string;
    timestamp: string;
  }[];
  timeline: PaymentTimelineEvent[];
  unusualFlags?: string[];
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RegisteredDevice {
  id: string;
  userId: string;
  deviceName: string;
  platform: string;
  deviceType: 'MOBILE_AUTH' | 'PASSKEY' | 'HARDWARE_TOKEN';
  status: 'ACTIVE' | 'DEACTIVATED';
  lastUsedAt?: string;
  registeredAt: string;
}

export interface TradeTransaction {
  id: string;
  reference: string;
  organisationId: string;
  tradeCategory: 'IMPORT_DC' | 'DC_AMENDMENT' | 'IMPORT_BILL' | 'IMPORT_LOAN' | 'EXPORT_COLLECTION';
  direction: 'IMPORT' | 'EXPORT';
  counterparty: string;
  amount: number;
  currency: string;
  status: 'AWAITING_AUTHORISATION' | 'IN_PROGRESS' | 'ISSUED' | 'SETTLED' | 'REJECTED';
  pendingAction?: string;
  documents: { id: string; name: string; type: string; size: string }[];
  timeline: PaymentTimelineEvent[];
  approvalHistory: { actorName: string; decision: string; timestamp: string; comment?: string }[];
  createdAt: string;
  updatedAt: string;
}

export interface ReceivablesFacility {
  id: string;
  organisationId: string;
  accountName: string;
  facilityNumber: string;
  scenario: string;
  currency: string;
  totalLimit: number;
  utilisedAmount: number;
  availableLimit: number;
  advanceRatePct: number;
  status: 'ACTIVE' | 'REVIEW';
}

export interface ApprovalPolicy {
  id: string;
  organisationId: string;
  name: string;
  currency: string;
  minAmount: number;
  maxAmount: number;
  requiredApprovals: number;
  makerCheckerEnforced: boolean;
  requireStepUpAuth: boolean;
  isActive: boolean;
}

export interface AuditLogEntry {
  id: string;
  userId?: string;
  actorName?: string;
  actorRole: string;
  organisationId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  details: any;
  ipAddress?: string;
  createdAt: string;
}

// Legacy compatibility types for shared/realtimeStore.ts & shared/seedData.ts
export type UserRole = 'customer' | 'admin' | 'superadmin';
export interface UserRecord {
  uid: string;
  displayName: string;
  email: string;
  phone: string;
  role: UserRole;
  customerId: string;
  accountStatus: 'active' | 'suspended' | 'pending';
  kycStatus: 'VERIFIED' | 'PENDING' | 'REJECTED';
  address?: string;
  city?: string;
  country?: string;
  createdAt: any;
  updatedAt: any;
}
export interface BankAccountRecord {
  accountId: string;
  ownerUid: string;
  customerName?: string;
  accountType: 'SAVINGS' | 'CURRENT' | 'SALARY' | 'FIXED_DEPOSIT' | 'RECURRING_DEPOSIT' | 'FOREIGN_CURRENCY';
  maskedAccountNumber: string;
  accountNumber: string;
  currency: 'INR' | 'GBP' | 'USD' | 'EUR';
  managedBalance: number;
  ledgerBalance: number;
  accountStatus: 'ACTIVE' | 'DORMANT' | 'INOPERATIVE' | 'FROZEN' | 'CLOSED';
  branchName: string;
  ifscCode: string;
  sortCode?: string;
  createdAt: any;
  updatedAt: any;
}
export interface TransactionRecord {
  transactionId: string;
  ownerUid: string;
  accountId: string;
  category: 'TRANSFER' | 'SALARY' | 'UTILITIES' | 'DINING' | 'SHOPPING' | 'INVESTMENT' | 'CHARGES' | 'CASH_WITHDRAWAL' | 'OTHER';
  description: string;
  amount: number;
  currency: string;
  transactionType: 'CREDIT' | 'DEBIT';
  status: 'COMPLETED' | 'PENDING' | 'FAILED' | 'REVERSED';
  reference: string;
  counterpartyName: string;
  counterpartyAccount?: string;
  counterpartyBank?: string;
  transactionDate: string;
  internalNote?: string;
  isCorrection?: boolean;
  originalTransactionId?: string;
  createdAt: any;
  updatedAt: any;
}
export interface BeneficiaryRecord {
  beneficiaryId: string;
  ownerUid: string;
  displayName: string;
  nickname?: string;
  maskedAccountNumber: string;
  accountNumber: string;
  bankName: string;
  ifscCode: string;
  transferLimit: number;
  status: 'ACTIVE' | 'BLOCKED';
  isFavorite?: boolean;
  createdAt: any;
}
export type CardTier = 'PREMIER_PLATINUM' | 'PREMIER_WORLD_ELITE' | 'GLOBAL_TRAVEL' | 'TRAVEL_ONE' | 'LIVE_PLUS' | 'VISA_PLATINUM';
export interface CardRecord {
  cardId: string;
  ownerUid: string;
  accountId: string;
  cardType: 'DEBIT' | 'CREDIT';
  cardTier: CardTier;
  cardName?: string;
  cardholderName?: string;
  network?: 'VISA' | 'MASTERCARD';
  maskedCardNumber: string;
  expiryMonth: string;
  expiryYear: string;
  cardStatus: 'ACTIVE' | 'FROZEN' | 'BLOCKED';
  spendingLimit: number;
  currentMonthSpent: number;
  creditLimit?: number;
  availableCredit?: number;
  minDue?: number;
  dueDate?: string;
  rewardPoints?: number;
  onlineEnabled?: boolean;
  internationalEnabled?: boolean;
  contactlessEnabled?: boolean;
  atmEnabled?: boolean;
  posEnabled?: boolean;
  gamblingRestricted?: boolean;
  isActivated?: boolean;
  cardPin?: string;
  createdAt: any;
  updatedAt: any;
}
export interface DepositRecord {
  depositId: string;
  ownerUid: string;
  accountId: string;
  depositType: 'FIXED' | 'RECURRING';
  depositNumber: string;
  principalAmount: number;
  interestRate: number;
  tenureMonths: number;
  maturityDate: string;
  expectedMaturityAmount: number;
  status: 'ACTIVE' | 'MATURED' | 'CLOSED';
  createdAt: any;
}
export interface RewardRecord {
  rewardId: string;
  ownerUid: string;
  points: number;
  availablePoints: number;
  redemptionHistory: { id: string; rewardTitle: string; pointsRedeemed: number; status: 'COMPLETED' | 'PENDING'; date: string }[];
}
export interface InsuranceRecord {
  policyId: string;
  ownerUid: string;
  policyNumber: string;
  policyType: 'HEALTH' | 'TERM_LIFE' | 'TRAVEL' | 'HOME';
  providerName: string;
  coverageAmount: number;
  annualPremium: number;
  policyStatus: 'ACTIVE' | 'PENDING_RENEWAL' | 'LAPSED';
  dueDate: string;
}
export interface NotificationRecord {
  notificationId: string;
  ownerUid: string;
  title: string;
  message: string;
  type: 'ACCOUNT' | 'TRANSACTION' | 'PAYMENT' | 'CARD' | 'DEPOSIT' | 'ANNOUNCEMENT' | 'SECURITY';
  read: boolean;
  createdAt: any;
}
export interface SupportTicketRecord {
  ticketId: string;
  ownerUid: string;
  customerName?: string;
  subject: string;
  description: string;
  category: 'TRANSACTION_DISPUTE' | 'CARD_LOST' | 'FRAUD' | 'ACCOUNT_INQUIRY' | 'GENERAL';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  assignedAdmin?: string;
  createdAt: any;
  updatedAt: any;
  messages?: { id: string; senderUid: string; senderRole: 'customer' | 'admin'; message: string; timestamp: any }[];
}
export interface AppLockSecurityRecord {
  ownerUid: string;
  appLockEnabled: boolean;
  pinHash?: string;
  failedAttempts: number;
  lockedUntil?: string | null;
  resetRequestedByAdmin?: boolean;
  updatedAt: any;
}
export interface AuditLogRecord {
  logId: string;
  adminUid: string;
  adminEmail: string;
  action: 'BALANCE_ADJUSTMENT' | 'TRANSACTION_CREATED' | 'TRANSACTION_CORRECTION' | 'CUSTOMER_CREATED' | 'CUSTOMER_STATUS_CHANGED' | 'APP_LOCK_RESET' | 'CARD_STATUS_CHANGED' | 'NOTIFICATION_BROADCAST';
  targetUid: string;
  targetCustomerName?: string;
  targetRecord: string;
  previousValue?: any;
  newValue?: any;
  reason: string;
  createdAt: any;
}
export interface WealthPortfolio {
  ownerUid: string;
  totalPortfolioValue: number;
  equityAllocation: number;
  debtAllocation: number;
  goldAllocation: number;
  mutualFunds: { fundName: string; category: string; investedAmount: number; currentValue: number; returnPercentage: number }[];
}
