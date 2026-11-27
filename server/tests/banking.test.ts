import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/index';

describe('Premier Mobile Banking - Core Banking Test Suite', () => {
  let customerToken: string;
  let adminToken: string;
  let sourceAccountId: string;
  let savingsBalance: number;

  beforeAll(async () => {
    // Authenticate as Customer
    const res = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'premier_user', password: 'Password@123' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    customerToken = res.body.accessToken;

    // Authenticate as Super Admin
    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'super_admin', password: 'Admin@123' });
    expect(adminRes.status).toBe(200);
    adminToken = adminRes.body.accessToken;

    // Fetch accounts
    const accRes = await request(app)
      .get('/api/accounts')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(accRes.status).toBe(200);
    expect(accRes.body.accounts.length).toBeGreaterThan(0);
    sourceAccountId = accRes.body.accounts[0].id;
    savingsBalance = accRes.body.accounts[0].available_balance;
  });

  // 1. Health & Core Gateway Check
  it('should return system online and verified ledger integrity', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ONLINE');
    expect(res.body.ledgerIntegrity).toBe('VERIFIED');
  });

  // 2. Auth & Security Verification
  it('should reject invalid passwords and enforce secure error handling', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'premier_user', password: 'WrongPassword99' });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('should permit biometric login when customer has biometric enabled', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'premier_user', isBiometric: true });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user.biometric_enabled).toBe(true);
  });

  // 3. Double-Entry Ledger & ACID Transfer Test
  it('should process a domestic faster payment using atomic double-entry ledger', async () => {
    const transferAmount = 150.00;
    const idempotencyKey = `test-idemp-${Date.now()}`;

    const res = await request(app)
      .post('/api/transfers')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        sourceAccountId,
        counterpartyName: 'British Telecom Services',
        counterpartyAccount: '400515-88339102',
        bankName: 'Barclays Bank UK',
        ifscSwift: 'BARCGB22XXX',
        amount: transferAmount,
        currency: 'GBP',
        fee: 0,
        description: 'Office Telecom Invoice #892',
        transactionType: 'DOMESTIC_TRANSFER',
        idempotencyKey
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.transaction).toBeDefined();
    expect(res.body.transaction.amount).toBe(transferAmount);
    expect(res.body.receipt.reference).toMatch(/^TXN-\d{6}-\d{6}$/);

    // Verify balance deduction in source account
    const accRes = await request(app)
      .get(`/api/accounts/${sourceAccountId}`)
      .set('Authorization', `Bearer ${customerToken}`);
    expect(accRes.body.account.available_balance).toBe(savingsBalance - transferAmount);
    savingsBalance = accRes.body.account.available_balance;
  });

  // 4. Idempotency Key Prevention of Duplicate Payments
  it('should prevent duplicate payments when re-submitting with identical idempotency key', async () => {
    const duplicateKey = `test-dup-${Date.now()}`;
    const payload = {
      sourceAccountId,
      counterpartyName: 'Duplicate Test Merchant',
      counterpartyAccount: '400515-11223344',
      bankName: 'NatWest Bank',
      ifscSwift: 'NWBKGB2LXXX',
      amount: 50.00,
      currency: 'GBP',
      description: 'Single Charge Only',
      transactionType: 'DOMESTIC_TRANSFER',
      idempotencyKey: duplicateKey
    };

    // First Call
    const firstRes = await request(app)
      .post('/api/transfers')
      .set('Authorization', `Bearer ${customerToken}`)
      .send(payload);
    expect(firstRes.status).toBe(200);

    // Second Call with identical key
    const secondRes = await request(app)
      .post('/api/transfers')
      .set('Authorization', `Bearer ${customerToken}`)
      .send(payload);
    expect(secondRes.status).toBe(200);
    expect(secondRes.body.status).toBe('IDEMPOTENT_REPLAY');
    expect(secondRes.body.transaction.id).toBe(firstRes.body.transaction.id);
  });

  // 5. Insufficient Balance Protection
  it('should halt transfers when balance is insufficient', async () => {
    const res = await request(app)
      .post('/api/transfers')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        sourceAccountId,
        counterpartyName: 'Luxury Yacht Broker',
        counterpartyAccount: '400515-99999999',
        bankName: 'Coutts & Co',
        ifscSwift: 'COUTGB22XXX',
        amount: 5000000.00, // Exceeds available balance
        currency: 'GBP',
        description: 'Mega Purchase',
        transactionType: 'DOMESTIC_TRANSFER'
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('Insufficient funds');
  });

  // 6. Card Management & Freeze Controls
  it('should allow customer to toggle card freeze and update spending limits', async () => {
    const cardsRes = await request(app)
      .get('/api/cards')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(cardsRes.status).toBe(200);
    expect(cardsRes.body.cards.length).toBeGreaterThan(0);
    const cardId = cardsRes.body.cards[0].id;

    // Toggle Freeze
    const freezeRes = await request(app)
      .post(`/api/cards/${cardId}/freeze`)
      .set('Authorization', `Bearer ${customerToken}`);
    expect(freezeRes.status).toBe(200);
    expect(freezeRes.body.is_frozen).toBe(1);

    // Unfreeze
    const unfreezeRes = await request(app)
      .post(`/api/cards/${cardId}/freeze`)
      .set('Authorization', `Bearer ${customerToken}`);
    expect(unfreezeRes.status).toBe(200);
    expect(unfreezeRes.body.is_frozen).toBe(0);

    // Update spending limit
    const limitRes = await request(app)
      .post(`/api/cards/${cardId}/controls`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ dailySpendingLimit: 7500 });
    expect(limitRes.status).toBe(200);
    expect(limitRes.body.card.daily_spending_limit).toBe(7500);
  });

  // 7. Role-Based Access Control on Administrative APIs
  it('should deny administrative ledger endpoints to non-admin customers', async () => {
    const res = await request(app)
      .get('/api/admin/overview')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('should grant access to administrative endpoints for Super Admin', async () => {
    const res = await request(app)
      .get('/api/admin/overview')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.overview.systemHealth).toBe('100% OPERATIONAL');
  });
});

describe('MeridianNet Corporate Banking - Enterprise Transformation Suite', () => {
  let initiatorToken: string;
  let authoriserToken: string;
  let adminToken: string;
  let orgGbAccId: string;
  let createdPaymentId: string;

  beforeAll(async () => {
    const initRes = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'corp_initiator', password: 'CorpPass@2026' });
    expect(initRes.status).toBe(200);
    initiatorToken = initRes.body.accessToken;

    const authRes = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'corp_authoriser', password: 'CorpPass@2026' });
    expect(authRes.status).toBe(200);
    authoriserToken = authRes.body.accessToken;

    const admRes = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'super_admin', password: 'Admin@123' });
    expect(admRes.status).toBe(200);
    adminToken = admRes.body.accessToken;

    const accRes = await request(app)
      .get('/api/corporate/accounts?orgId=org-meridian-in')
      .set('Authorization', `Bearer ${initiatorToken}`);
    expect(accRes.status).toBe(200);
    expect(accRes.body.accounts.length).toBeGreaterThan(0);
    orgGbAccId = accRes.body.accounts[0].id;
  });

  it('should support multi-stage username lookup and backend security code login', async () => {
    const lookupRes = await request(app)
      .post('/api/auth/lookup')
      .send({ identifier: 'corp_initiator' });
    expect(lookupRes.status).toBe(200);
    expect(lookupRes.body.profile.methods.securityCode).toBe(true);

    const codeGen = await request(app)
      .post('/api/auth/security-code/generate')
      .send({ identifier: 'corp_initiator', purpose: 'LOGIN' });
    expect(codeGen.status).toBe(200);
    expect(codeGen.body.code).toMatch(/^\d{8}$/);

    const codeLogin = await request(app)
      .post('/api/auth/login-security-code')
      .send({ identifier: 'corp_initiator', code: codeGen.body.code });
    expect(codeLogin.status).toBe(200);
    expect(codeLogin.body.accessToken).toBeDefined();
  });

  it('should enforce maker-checker separation and step-up PIN on payment authorisation', async () => {
    const payRes = await request(app)
      .post('/api/corporate/payments')
      .set('Authorization', `Bearer ${initiatorToken}`)
      .send({
        orgId: 'org-meridian-in',
        category: 'PRIORITY_PAYMENT',
        debitAccountId: orgGbAccId,
        beneficiaryName: 'Thames Logistics Partners Ltd',
        beneficiaryAccount: '200412-99014522',
        beneficiaryBank: 'Barclays Corporate UK',
        destinationCountry: 'GB',
        swiftBic: 'BARCGB22XXX',
        amount: 450.00,
        currency: 'GBP',
        referenceNote: 'Automated Corporate Test Settlement',
      });
    expect(payRes.status).toBe(200);
    createdPaymentId = payRes.body.payment.id;

    // Maker (initiator) cannot approve even with step-up PIN
    const selfApprove = await request(app)
      .post('/api/corporate/authorisations/decide')
      .set('Authorization', `Bearer ${initiatorToken}`)
      .send({ orgId: 'org-meridian-in', ids: [createdPaymentId], decision: 'APPROVED', stepUpPin: '123456' });
    expect(selfApprove.status).toBe(403);

    // Authoriser without step-up PIN gets STEP_UP_REQUIRED
    const missingPin = await request(app)
      .post('/api/corporate/authorisations/decide')
      .set('Authorization', `Bearer ${authoriserToken}`)
      .send({ orgId: 'org-meridian-in', ids: [createdPaymentId], decision: 'APPROVED' });
    expect(missingPin.status).toBe(401);
    expect(missingPin.body.code).toBe('STEP_UP_REQUIRED');

    // Authoriser with valid step-up PIN succeeds
    const approved = await request(app)
      .post('/api/corporate/authorisations/decide')
      .set('Authorization', `Bearer ${authoriserToken}`)
      .send({ orgId: 'org-meridian-in', ids: [createdPaymentId], decision: 'APPROVED', stepUpPin: '123456' });
    expect(approved.status).toBe(200);
    expect(approved.body.results[0].status).toBe('COMPLETED');
  });

  it('should enforce country-gated Remote Deposit Capture rules and single-company isolation', async () => {
    const premierRes = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'premier_user', password: 'Password@123' });
    const premierToken = premierRes.body.accessToken;

    const inRes = await request(app)
      .get('/api/corporate/rdc?orgId=org-meridian-in')
      .set('Authorization', `Bearer ${premierToken}`);
    expect(inRes.status).toBe(403);

    // Non-member org request denied
    const crossOrgRes = await request(app)
      .get('/api/corporate/accounts?orgId=org-nonexistent-co')
      .set('Authorization', `Bearer ${initiatorToken}`);
    expect(crossOrgRes.status).toBe(403);
  });

  it('should support admin enterprise summary, policy management, and audit logs', async () => {
    const sumRes = await request(app)
      .get('/api/admin/enterprise-summary')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(sumRes.status).toBe(200);
    expect(sumRes.body.summary.organisations).toBe(1);

    const audRes = await request(app)
      .get('/api/admin/audit-logs')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(audRes.status).toBe(200);
    expect(audRes.body.logs.length).toBeGreaterThan(0);
  });
});
