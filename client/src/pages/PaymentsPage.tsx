import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Plus,
  RefreshCw,
  Trash2,
  Users,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiRequest, generateIdempotencyKey } from '../lib/api';
import { formatDateTime, formatFinancialCurrency } from '@shared/utils/formatters';
import { COUNTRY_CAPABILITIES, PAYMENT_PURPOSE_CODES } from '@shared/constants';
import { GeometricHeader } from '../components/ui/GeometricHeader';
import { BankingHeader } from '../components/ui/BankingHeader';
import {
  Button,
  EmptyState,
  ErrorBanner,
  FormInput,
  FormSelect,
  NativeDialog,
  SkeletonList,
  StatusBadge,
} from '../components/ui/Primitives';

type PaymentTypeChoice = 'PRIORITY_PAYMENT' | 'INTER_ACCOUNT' | 'BILL_PAY';
type PayScreen = 'LANDING' | 'PRIORITY_FORM' | 'INTER_ACCOUNT_FORM' | 'BILL_PAY_FORM' | 'BENEFICIARIES';

export const PaymentsPage: React.FC<{ onNavigate?: (tab: string, sub?: string) => void }> = ({ onNavigate }) => {
  const { activeOrg, hideBalances, hasPermission, hasModule } = useAuth();

  const [screen, setScreen] = useState<PayScreen>('LANDING');
  const [selectedType, setSelectedType] = useState<PaymentTypeChoice>('PRIORITY_PAYMENT');

  const [accounts, setAccounts] = useState<any[]>([]);
  const [beneficiaries, setBeneficiaries] = useState<any[]>([]);
  const [bills, setBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Priority Payment step state
  const [wireStep, setWireStep] = useState<1 | 2 | 3 | 4 | 5 | 6 | 7>(1);
  const [debitAccountId, setDebitAccountId] = useState('');
  const [selectedBeneficiaryId, setSelectedBeneficiaryId] = useState('');
  const [benSearch, setBenSearch] = useState('');
  const [benName, setBenName] = useState('');
  const [benAccount, setBenAccount] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankCountry, setBankCountry] = useState('GB');
  const [swiftBic, setSwiftBic] = useState('');
  const [iban, setIban] = useState('');
  const [payCurrency, setPayCurrency] = useState('GBP');
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [payReference, setPayReference] = useState('');
  const [payPurpose, setPayPurpose] = useState('SUPP');
  const [chargesBearer, setChargesBearer] = useState<'OUR' | 'SHA' | 'BEN'>('SHA');
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [fxQuote, setFxQuote] = useState<any>(null);
  const [fxConfirmed, setFxConfirmed] = useState(false);
  const [stepUpPin, setStepUpPin] = useState('');
  const [wireResult, setWireResult] = useState<any>(null);
  const [wireLoading, setWireLoading] = useState(false);
  const [wireError, setWireError] = useState('');

  // Inter-account Transfer state
  const [iatFrom, setIatFrom] = useState('');
  const [iatTo, setIatTo] = useState('');
  const [iatCurrency, setIatCurrency] = useState('GBP');
  const [iatAmt, setIatAmt] = useState('');
  const [iatDate, setIatDate] = useState(new Date().toISOString().slice(0, 10));
  const [iatRef, setIatRef] = useState('Treasury Liquidity Sweep');
  const [iatResult, setIatResult] = useState<string | null>(null);

  // Bill Payment form state
  const [billDebitId, setBillDebitId] = useState('');
  const [billBeneficiary, setBillBeneficiary] = useState('');
  const [billAmt, setBillAmt] = useState('');
  const [billRef, setBillRef] = useState('');
  const [billDate, setBillDate] = useState(new Date().toISOString().slice(0, 10));
  const [billResult, setBillResult] = useState<string | null>(null);

  // Add Beneficiary Modal
  const [addBenOpen, setAddBenOpen] = useState(false);
  const [newBen, setNewBen] = useState({ name: '', nickname: '', accountNumber: '', bankName: '', ifscSwift: '', transferLimit: '50000' });

  const canCreate = hasPermission('CREATE_PAYMENTS');

  const loadData = useCallback(async () => {
    if (!activeOrg) return;
    setLoading(true);
    setError(null);
    try {
      const [accRes, benRes, billRes] = await Promise.all([
        apiRequest<any>(`/api/corporate/accounts?orgId=${encodeURIComponent(activeOrg.id)}`),
        apiRequest<any>('/api/beneficiaries'),
        apiRequest<any>('/api/bills').catch(() => ({ bills: [] })),
      ]);
      const accList = accRes.accounts || [];
      setAccounts(accList);
      if (accList.length > 0 && !debitAccountId) {
        setDebitAccountId(accList[0].id);
        setBillDebitId(accList[0].id);
        setIatFrom(accList[0].id);
        setIatTo(accList[1]?.id || accList[0].id);
        setIatCurrency(accList[0].currency);
      }
      setBeneficiaries(benRes.beneficiaries || []);
      setBills(billRes.bills || []);
    } catch (err: any) {
      setError(err?.message || 'Unable to load payment services.');
    } finally {
      setLoading(false);
    }
  }, [activeOrg, debitAccountId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const selectedDebitAccount = accounts.find((a) => a.id === debitAccountId);
  const destCountryCap = COUNTRY_CAPABILITIES[bankCountry] || COUNTRY_CAPABILITIES.GB;

  const startPaymentCreation = () => {
    setWireError('');
    setIatResult(null);
    setBillResult(null);
    if (selectedType === 'PRIORITY_PAYMENT') {
      setWireStep(1);
      setWireResult(null);
      setFxQuote(null);
      setFxConfirmed(false);
      setScreen('PRIORITY_FORM');
    } else if (selectedType === 'INTER_ACCOUNT') {
      setScreen('INTER_ACCOUNT_FORM');
    } else {
      setScreen('BILL_PAY_FORM');
    }
  };

  const applyBeneficiary = (b: any) => {
    setSelectedBeneficiaryId(b.id);
    setBenName(b.name);
    setBenAccount(b.account_number);
    setBankName(b.bank_name);
    setBankCountry(b.country || 'GB');
    setSwiftBic(b.ifsc_swift || '');
    setIban(b.iban || (b.country === 'DE' ? b.account_number : ''));
    setPayCurrency(b.currency || selectedDebitAccount?.currency || 'GBP');
    setWireStep(3);
  };

  const requestFxQuote = async () => {
    setWireError('');
    setFxConfirmed(false);
    setWireLoading(true);
    try {
      const res = await apiRequest<any>('/api/corporate/fx-quote', {
        method: 'POST',
        body: JSON.stringify({
          fromCurrency: selectedDebitAccount?.currency || 'GBP',
          toCurrency: payCurrency,
          amount: Number(payAmount),
        }),
      });
      setFxQuote({ ...res.quote, fetchedAt: new Date().toISOString() });
    } catch (err: any) {
      setWireError(err?.message || 'Unable to retrieve FX rate.');
    } finally {
      setWireLoading(false);
    }
  };

  const submitPriorityPayment = async () => {
    setWireError('');
    if (!/^\d{6}$/.test(stepUpPin)) {
      setWireError('Enter your 6-digit Mobile Security PIN to authenticate.');
      return;
    }
    setWireLoading(true);
    try {
      await apiRequest('/api/auth/pin/verify', {
        method: 'POST',
        body: JSON.stringify({ pin: stepUpPin }),
      });

      const res = await apiRequest<any>('/api/corporate/payments', {
        method: 'POST',
        body: JSON.stringify({
          orgId: activeOrg?.id,
          category: payCurrency === selectedDebitAccount?.currency ? 'PRIORITY_PAYMENT' : 'INTERNATIONAL_PAYMENT',
          debitAccountId,
          beneficiaryId: selectedBeneficiaryId || undefined,
          beneficiaryName: benName,
          beneficiaryAccount: benAccount,
          beneficiaryBank: bankName,
          destinationCountry: bankCountry,
          swiftBic,
          iban,
          amount: Number(payAmount),
          currency: payCurrency,
          exchangeRate: fxQuote?.rate || 1.0,
          chargesBearer,
          paymentPurpose: payPurpose,
          paymentDate: payDate,
          referenceNote: payReference,
          additionalInfo,
          idempotencyKey: generateIdempotencyKey('wire'),
        }),
      });
      setWireResult(res.payment);
      setStepUpPin('');
      setWireStep(7);
      await loadData();
    } catch (err: any) {
      setWireError(err?.message || 'Payment submission failed.');
    } finally {
      setWireLoading(false);
    }
  };

  const handleInterAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setWireError('');
    setIatResult(null);
    if (!iatFrom || !iatTo || iatFrom === iatTo) {
      setWireError('Select two different accounts.');
      return;
    }
    if (!Number(iatAmt) || Number(iatAmt) <= 0) {
      setWireError('Enter a positive transfer amount.');
      return;
    }
    try {
      const dst = accounts.find((a) => a.id === iatTo);
      const res = await apiRequest<any>('/api/corporate/payments', {
        method: 'POST',
        body: JSON.stringify({
          orgId: activeOrg?.id,
          category: 'INTER_ACCOUNT_TRANSFER',
          debitAccountId: iatFrom,
          beneficiaryName: dst?.account_name || 'Internal Account',
          beneficiaryAccount: dst?.account_number || '',
          beneficiaryBank: 'HSBC Cnet Internal Treasury',
          destinationCountry: dst?.country || 'GB',
          amount: Number(iatAmt),
          currency: iatCurrency,
          paymentDate: iatDate,
          referenceNote: iatRef,
          idempotencyKey: generateIdempotencyKey('iat'),
        }),
      });
      setIatResult(`Inter-account transfer ${res.payment.reference} recorded (${res.payment.status.replace(/_/g, ' ')}).`);
      setIatAmt('');
      await loadData();
    } catch (err: any) {
      setWireError(err?.message || 'Inter-account transfer failed.');
    }
  };

  const handleBillSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setWireError('');
    setBillResult(null);
    if (!billBeneficiary || !Number(billAmt) || Number(billAmt) <= 0 || !billRef) {
      setWireError('Complete all bill payment fields.');
      return;
    }
    try {
      const src = accounts.find((a) => a.id === billDebitId);
      const res = await apiRequest<any>('/api/corporate/payments', {
        method: 'POST',
        body: JSON.stringify({
          orgId: activeOrg?.id,
          category: 'BILL_PAYMENT',
          debitAccountId: billDebitId,
          beneficiaryName: billBeneficiary,
          beneficiaryAccount: billRef,
          beneficiaryBank: 'Registered Corporate Biller',
          destinationCountry: src?.country || 'GB',
          amount: Number(billAmt),
          currency: src?.currency || 'GBP',
          paymentDate: billDate,
          referenceNote: billRef,
          idempotencyKey: generateIdempotencyKey('bill'),
        }),
      });
      setBillResult(`Bill payment ${res.payment.reference} recorded (${res.payment.status.replace(/_/g, ' ')}).`);
      setBillAmt('');
      setBillRef('');
      await loadData();
    } catch (err: any) {
      setWireError(err?.message || 'Bill payment failed.');
    }
  };

  const handlePayScheduledBill = async (bill: any) => {
    if (!billDebitId) return;
    try {
      await apiRequest('/api/bills/pay', {
        method: 'POST',
        body: JSON.stringify({ billId: bill.id, accountId: billDebitId }),
      });
      setBillResult(`Scheduled bill ${bill.biller_name} settled.`);
      await loadData();
    } catch (err: any) {
      setWireError(err?.message || 'Bill payment failed.');
    }
  };

  const handleAddBeneficiary = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/beneficiaries', {
        method: 'POST',
        body: JSON.stringify({ ...newBen, otp: '123456' }),
      });
      setAddBenOpen(false);
      setNewBen({ name: '', nickname: '', accountNumber: '', bankName: '', ifscSwift: '', transferLimit: '50000' });
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Failed to add beneficiary.');
    }
  };

  // =========================================================================
  // PRIORITY PAYMENT WORKFLOW (7 CLEAN BANKING STEPS + FX PREVIEW / GET RATE)
  // =========================================================================
  if (screen === 'PRIORITY_FORM') {
    const stepLabels = ['Account', 'Payee', 'Details', 'FX / Rate', 'Review', 'Authenticate', 'Result'];
    return (
      <div className="bg-white md:border md:border-[#D9DEE1]">
        <BankingHeader
          title="Priority Payment"
          onBack={() => (wireStep > 1 && wireStep < 7 ? setWireStep((wireStep - 1) as any) : setScreen('LANDING'))}
          subHeader={`Step ${wireStep} of 7: ${stepLabels[wireStep - 1]}`}
        />

        {wireError && (
          <div className="p-4 pb-0">
            <ErrorBanner message={wireError} />
          </div>
        )}

        <div className="p-4 sm:p-5">
          {wireStep === 1 && (
            <div className="space-y-4">
              <FormSelect label="Debit account" requiredMark value={debitAccountId} onChange={(e) => setDebitAccountId(e.target.value)}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.account_name} ({a.maskedAccountNumber}) — {formatFinancialCurrency(a.available_balance, a.currency, hideBalances)}
                  </option>
                ))}
              </FormSelect>
              {selectedDebitAccount && (
                <div className="divide-y divide-[#D9DEE1] border border-[#D9DEE1] text-xs">
                  <div className="p-3 flex justify-between"><span className="text-[#68727A]">Account currency</span><strong>{selectedDebitAccount.currency}</strong></div>
                  <div className="p-3 flex justify-between"><span className="text-[#68727A]">Available balance</span><strong className="tabular-nums">{formatFinancialCurrency(selectedDebitAccount.available_balance, selectedDebitAccount.currency, hideBalances)}</strong></div>
                </div>
              )}
              <Button fullWidth size="lg" onClick={() => setWireStep(2)} disabled={!debitAccountId}>
                Continue
              </Button>
            </div>
          )}

          {wireStep === 2 && (
            <div className="space-y-4">
              <FormInput
                label="Search existing beneficiary"
                placeholder="Name or bank"
                value={benSearch}
                onChange={(e) => setBenSearch(e.target.value)}
              />
              <div className="divide-y divide-[#D9DEE1] border border-[#D9DEE1]">
                {beneficiaries
                  .filter((b) => !benSearch || b.name.toLowerCase().includes(benSearch.toLowerCase()))
                  .map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => applyBeneficiary(b)}
                      className="w-full px-3.5 py-3 flex items-center justify-between text-left hover:bg-[#F4F5F6]"
                    >
                      <div>
                        <div className="text-sm font-medium text-[#252B30]">{b.name}</div>
                        <div className="text-xs text-[#68727A]">{b.bank_name} • {b.account_number}</div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-[#68727A]" />
                    </button>
                  ))}
              </div>
              <Button variant="outline" fullWidth onClick={() => { setSelectedBeneficiaryId(''); setWireStep(3); }}>
                Pay to new beneficiary
              </Button>
            </div>
          )}

          {wireStep === 3 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <FormInput label="Beneficiary name" requiredMark value={benName} onChange={(e) => setBenName(e.target.value)} />
                <FormInput label="Beneficiary account" requiredMark value={benAccount} onChange={(e) => setBenAccount(e.target.value)} />
                <FormInput label="Beneficiary bank" requiredMark value={bankName} onChange={(e) => setBankName(e.target.value)} />
                <FormSelect label="Bank country" requiredMark value={bankCountry} onChange={(e) => setBankCountry(e.target.value)}>
                  {Object.values(COUNTRY_CAPABILITIES).map((c) => (
                    <option key={c.code} value={c.code}>{c.name} ({c.code})</option>
                  ))}
                </FormSelect>
                <FormInput label="SWIFT / BIC" requiredMark value={swiftBic} onChange={(e) => setSwiftBic(e.target.value)} />
                {destCountryCap.supportsIBAN && (
                  <FormInput label="IBAN" value={iban} onChange={(e) => setIban(e.target.value)} />
                )}
                <FormSelect label="Payment currency" requiredMark value={payCurrency} onChange={(e) => setPayCurrency(e.target.value)}>
                  {['GBP', 'USD', 'EUR', 'INR', 'SGD', 'AED'].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </FormSelect>
                <FormInput label="Amount" type="number" step="0.01" requiredMark value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
                <FormInput label="Payment date" type="date" requiredMark value={payDate} onChange={(e) => setPayDate(e.target.value)} />
                <FormSelect label="Payment purpose" requiredMark value={payPurpose} onChange={(e) => setPayPurpose(e.target.value)}>
                  {PAYMENT_PURPOSE_CODES.map((p) => (
                    <option key={p.code} value={p.code}>{p.code} — {p.label}</option>
                  ))}
                </FormSelect>
                <FormSelect label="Charges" value={chargesBearer} onChange={(e) => setChargesBearer(e.target.value as any)}>
                  <option value="SHA">SHA — Shared</option>
                  <option value="OUR">OUR — Remitter pays</option>
                  <option value="BEN">BEN — Beneficiary pays</option>
                </FormSelect>
                <FormInput label="Payment reference" requiredMark value={payReference} onChange={(e) => setPayReference(e.target.value)} />
              </div>
              <FormInput label="Additional information (optional)" value={additionalInfo} onChange={(e) => setAdditionalInfo(e.target.value)} />

              <Button
                fullWidth
                size="lg"
                onClick={() => {
                  if (!benName || !benAccount || !bankName || !payAmount || Number(payAmount) <= 0 || !payReference) {
                    setWireError('Complete all required beneficiary, amount, and reference fields.');
                    return;
                  }
                  setWireError('');
                  setFxQuote(null);
                  if (selectedDebitAccount?.currency !== payCurrency) {
                    requestFxQuote();
                  }
                  setWireStep(4);
                }}
              >
                Continue
              </Button>
            </div>
          )}

          {/* STEP 4: FX PREVIEW & GET RATE (mobile.pdf p.8) */}
          {wireStep === 4 && (
            <div className="space-y-4">
              {selectedDebitAccount?.currency === payCurrency ? (
                <div className="p-4 bg-[#F4F5F6] border border-[#D9DEE1] text-xs text-[#252B30]">
                  Same-currency settlement ({payCurrency}). No foreign exchange conversion applies.
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-3 bg-[#FBF5EA] border border-[#EBD3A7] text-xs text-[#B77A1D] flex gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                    <span>
                      Sandbox indicative / Get Rate quote supplied by backend. The exchange rate and value date displayed may update if refreshed.
                    </span>
                  </div>

                  {fxQuote ? (
                    <dl className="divide-y divide-[#D9DEE1] border border-[#D9DEE1] text-xs">
                      <div className="px-4 py-3 flex justify-between"><dt className="text-[#68727A]">Debit account</dt><dd className="font-medium">{selectedDebitAccount?.account_name}</dd></div>
                      <div className="px-4 py-3 flex justify-between"><dt className="text-[#68727A]">Amount</dt><dd className="font-semibold tabular-nums">{formatFinancialCurrency(Number(payAmount), payCurrency)}</dd></div>
                      <div className="px-4 py-3 flex justify-between"><dt className="text-[#68727A]">Currency equivalent ({selectedDebitAccount?.currency})</dt><dd className="font-semibold tabular-nums">{formatFinancialCurrency(fxQuote.convertedAmount, fxQuote.toCurrency)}</dd></div>
                      <div className="px-4 py-3 flex justify-between"><dt className="text-[#68727A]">Exchange rate</dt><dd className="font-medium tabular-nums">1 {fxQuote.fromCurrency} = {fxQuote.rate} {fxQuote.toCurrency}</dd></div>
                      <div className="px-4 py-3 flex justify-between"><dt className="text-[#68727A]">Inverse rate</dt><dd className="font-medium tabular-nums">1 {fxQuote.toCurrency} = {(1 / fxQuote.rate).toFixed(6)} {fxQuote.fromCurrency}</dd></div>
                      <div className="px-4 py-3 flex justify-between"><dt className="text-[#68727A]">Value date</dt><dd className="font-medium">{payDate}</dd></div>
                      <div className="px-4 py-3 flex justify-between"><dt className="text-[#68727A]">Rates at</dt><dd className="font-medium">{formatDateTime(fxQuote.fetchedAt || new Date().toISOString())}</dd></div>
                      <div className="px-4 py-3 flex justify-between"><dt className="text-[#68727A]">Quote validity</dt><dd className="font-medium">{fxQuote.validSeconds}s</dd></div>
                    </dl>
                  ) : null}

                  <Button fullWidth variant="outline" loading={wireLoading} onClick={requestFxQuote}>
                    <RefreshCw className="w-4 h-4" /> Refresh rate
                  </Button>

                  {fxQuote && (
                    <label className="flex items-center gap-2.5 p-3 bg-[#F4F5F6] border border-[#D9DEE1] text-xs">
                      <input
                        type="checkbox"
                        checked={fxConfirmed}
                        onChange={(e) => setFxConfirmed(e.target.checked)}
                        className="accent-[#DB001B]"
                      />
                      <span>Confirm Get Rate quote and continue to review</span>
                    </label>
                  )}
                </div>
              )}

              <Button
                fullWidth
                size="lg"
                disabled={selectedDebitAccount?.currency !== payCurrency && (!fxQuote || !fxConfirmed)}
                onClick={() => setWireStep(5)}
              >
                Continue to Review
              </Button>
            </div>
          )}

          {wireStep === 5 && (
            <div className="space-y-4">
              <dl className="divide-y divide-[#D9DEE1] border border-[#D9DEE1] text-xs">
                <div className="px-4 py-3 flex justify-between"><dt className="text-[#68727A]">Debit account</dt><dd className="font-medium">{selectedDebitAccount?.account_name}</dd></div>
                <div className="px-4 py-3 flex justify-between"><dt className="text-[#68727A]">Beneficiary</dt><dd className="font-medium">{benName}</dd></div>
                <div className="px-4 py-3 flex justify-between"><dt className="text-[#68727A]">Account / Bank</dt><dd className="font-medium">{benAccount} • {bankName}</dd></div>
                <div className="px-4 py-3 flex justify-between"><dt className="text-[#68727A]">Amount</dt><dd className="font-semibold text-sm tabular-nums">{formatFinancialCurrency(Number(payAmount), payCurrency)}</dd></div>
                <div className="px-4 py-3 flex justify-between"><dt className="text-[#68727A]">Value date</dt><dd className="font-medium">{payDate}</dd></div>
                <div className="px-4 py-3 flex justify-between"><dt className="text-[#68727A]">Reference</dt><dd className="font-medium">{payReference}</dd></div>
              </dl>
              <Button fullWidth size="lg" onClick={() => setWireStep(6)}>
                Continue to Authenticate
              </Button>
            </div>
          )}

          {wireStep === 6 && (
            <div className="space-y-4">
              <p className="text-xs text-[#68727A]">
                Enter your 6-digit Mobile Security PIN to submit this instruction for authorisation.
              </p>
              <FormInput
                label="Mobile Security PIN"
                type="password"
                inputMode="numeric"
                maxLength={6}
                autoFocus
                value={stepUpPin}
                onChange={(e) => setStepUpPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              />
              <Button fullWidth size="lg" loading={wireLoading} onClick={submitPriorityPayment}>
                Submit payment instruction
              </Button>
            </div>
          )}

          {wireStep === 7 && wireResult && (
            <div className="space-y-5 text-center py-4">
              <CheckCircle2 className="w-12 h-12 text-[#27835B] mx-auto" strokeWidth={1.75} aria-hidden="true" />
              <div>
                <h1 className="text-lg font-medium text-[#252B30]">Payment instruction submitted</h1>
                <p className="text-xs text-[#68727A] mt-1">
                  Reference <strong className="text-[#252B30]">{wireResult.reference}</strong> recorded in sandbox workflow.
                </p>
              </div>
              <dl className="divide-y divide-[#D9DEE1] border border-[#D9DEE1] text-left text-xs">
                <div className="px-4 py-3 flex justify-between"><dt className="text-[#68727A]">Beneficiary</dt><dd className="font-medium">{wireResult.beneficiary_name}</dd></div>
                <div className="px-4 py-3 flex justify-between"><dt className="text-[#68727A]">Amount</dt><dd className="font-semibold tabular-nums">{formatFinancialCurrency(wireResult.amount, wireResult.currency)}</dd></div>
                <div className="px-4 py-3 flex justify-between"><dt className="text-[#68727A]">Status</dt><dd><StatusBadge status={wireResult.status} /></dd></div>
              </dl>
              <Button fullWidth size="lg" onClick={() => { setScreen('LANDING'); setWireStep(1); }}>
                Done
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // =========================================================================
  // INTER-ACCOUNT TRANSFER FORM
  // =========================================================================
  if (screen === 'INTER_ACCOUNT_FORM') {
    return (
      <div className="bg-white md:border md:border-[#D9DEE1]">
        <BankingHeader title="Inter-account Transfer" onBack={() => setScreen('LANDING')} />
        <form onSubmit={handleInterAccountSubmit} className="p-4 sm:p-5 space-y-4">
          {wireError && <ErrorBanner message={wireError} />}
          {iatResult && <div className="p-3 bg-[#ECF6F1] border border-[#B7DFCC] text-xs text-[#27835B] font-medium">{iatResult}</div>}

          <FormSelect
            label="Source account"
            requiredMark
            value={iatFrom}
            onChange={(e) => {
              setIatFrom(e.target.value);
              const found = accounts.find((a) => a.id === e.target.value);
              if (found) setIatCurrency(found.currency);
            }}
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.account_name} ({formatFinancialCurrency(a.available_balance, a.currency, hideBalances)})</option>
            ))}
          </FormSelect>
          <FormSelect label="Destination account" requiredMark value={iatTo} onChange={(e) => setIatTo(e.target.value)}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.account_name} ({a.currency})</option>
            ))}
          </FormSelect>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <FormSelect label="Currency" value={iatCurrency} onChange={(e) => setIatCurrency(e.target.value)}>
              {['GBP', 'USD', 'EUR', 'INR'].map((c) => <option key={c} value={c}>{c}</option>)}
            </FormSelect>
            <FormInput label="Amount" type="number" step="0.01" requiredMark value={iatAmt} onChange={(e) => setIatAmt(e.target.value)} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <FormInput label="Payment date" type="date" requiredMark value={iatDate} onChange={(e) => setIatDate(e.target.value)} />
            <FormInput label="Reference" requiredMark value={iatRef} onChange={(e) => setIatRef(e.target.value)} />
          </div>
          <Button type="submit" fullWidth size="lg">
            Submit transfer instruction
          </Button>
        </form>
      </div>
    );
  }

  // =========================================================================
  // BILL PAYMENT FORM
  // =========================================================================
  if (screen === 'BILL_PAY_FORM') {
    return (
      <div className="bg-white md:border md:border-[#D9DEE1]">
        <BankingHeader title="Bill Payment" onBack={() => setScreen('LANDING')} />
        <div className="p-4 sm:p-5 space-y-5">
          {wireError && <ErrorBanner message={wireError} />}
          {billResult && <div className="p-3 bg-[#ECF6F1] border border-[#B7DFCC] text-xs text-[#27835B] font-medium">{billResult}</div>}

          <form onSubmit={handleBillSubmit} className="space-y-4">
            <FormSelect label="Debit account" requiredMark value={billDebitId} onChange={(e) => setBillDebitId(e.target.value)}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.account_name} ({a.currency})</option>
              ))}
            </FormSelect>
            <FormSelect label="Existing beneficiary / Biller" requiredMark value={billBeneficiary} onChange={(e) => setBillBeneficiary(e.target.value)}>
              <option value="">Select registered biller or payee</option>
              {beneficiaries.map((b) => <option key={b.id} value={b.name}>{b.name} ({b.bank_name})</option>)}
              {bills.map((b) => <option key={b.id} value={b.biller_name}>{b.biller_name}</option>)}
            </FormSelect>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <FormInput label="Payment amount" type="number" step="0.01" requiredMark value={billAmt} onChange={(e) => setBillAmt(e.target.value)} />
              <FormInput label="Payment date" type="date" requiredMark value={billDate} onChange={(e) => setBillDate(e.target.value)} />
            </div>
            <FormInput label="Customer / Invoice reference" requiredMark value={billRef} onChange={(e) => setBillRef(e.target.value)} />
            <Button type="submit" fullWidth size="lg">
              Submit bill payment
            </Button>
          </form>

          {bills.length > 0 && (
            <div className="pt-4 border-t border-[#D9DEE1]">
              <div className="text-xs font-semibold uppercase tracking-wide text-[#68727A] mb-2">Pending Invoices</div>
              <div className="divide-y divide-[#D9DEE1] border border-[#D9DEE1]">
                {bills.map((b) => (
                  <div key={b.id} className="p-3 flex items-center justify-between gap-2 text-xs">
                    <div>
                      <div className="font-medium text-[#252B30]">{b.biller_name}</div>
                      <div className="text-[#68727A]">{b.consumer_number} • Due {b.due_date}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold tabular-nums">{formatFinancialCurrency(b.bill_amount, 'GBP', hideBalances)}</span>
                      {b.status === 'PENDING' ? (
                        <Button size="sm" onClick={() => handlePayScheduledBill(b)}>Pay</Button>
                      ) : (
                        <StatusBadge status={b.status} />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // =========================================================================
  // BENEFICIARIES DIRECTORY SUB-SCREEN
  // =========================================================================
  if (screen === 'BENEFICIARIES') {
    return (
      <div className="bg-white md:border md:border-[#D9DEE1]">
        <BankingHeader
          title="Trusted Beneficiaries"
          onBack={() => setScreen('LANDING')}
          rightSlot={
            hasPermission('MANAGE_BENEFICIARIES') ? (
              <button type="button" onClick={() => setAddBenOpen(true)} className="px-2 py-1 text-xs font-medium text-[#DB001B] flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            ) : null
          }
        />
        <div className="divide-y divide-[#D9DEE1]">
          {beneficiaries.map((b) => (
            <div key={b.id} className="px-4 py-3.5 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-[#252B30]">{b.name}</div>
                <div className="text-xs text-[#68727A]">{b.bank_name} • {b.account_number}</div>
              </div>
              <div className="flex items-center gap-2">
                {canCreate && (
                  <Button size="sm" variant="outline" onClick={() => { applyBeneficiary(b); setScreen('PRIORITY_FORM'); }}>
                    Pay
                  </Button>
                )}
                {hasPermission('MANAGE_BENEFICIARIES') && (
                  <button
                    type="button"
                    aria-label={`Remove ${b.name}`}
                    onClick={async () => {
                      await apiRequest(`/api/beneficiaries/${b.id}`, { method: 'DELETE' });
                      await loadData();
                    }}
                    className="p-2 text-[#C83A42]"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <NativeDialog open={addBenOpen} onClose={() => setAddBenOpen(false)} title="Add Corporate Beneficiary">
          <form onSubmit={handleAddBeneficiary} className="space-y-3">
            <FormInput label="Legal name" required value={newBen.name} onChange={(e) => setNewBen({ ...newBen, name: e.target.value })} />
            <FormInput label="Account number / IBAN" required value={newBen.accountNumber} onChange={(e) => setNewBen({ ...newBen, accountNumber: e.target.value })} />
            <FormInput label="Bank name" required value={newBen.bankName} onChange={(e) => setNewBen({ ...newBen, bankName: e.target.value })} />
            <FormInput label="SWIFT / BIC / IFSC" required value={newBen.ifscSwift} onChange={(e) => setNewBen({ ...newBen, ifscSwift: e.target.value })} />
            <Button type="submit" fullWidth>Save Beneficiary</Button>
          </form>
        </NativeDialog>
      </div>
    );
  }

  // =========================================================================
  // PAYMENTS LANDING SCREEN — Exact mobile.pdf p.6 Radio Selection Layout
  // =========================================================================
  const paymentTypes: { id: PaymentTypeChoice; label: string; enabled: boolean }[] = [
    { id: 'PRIORITY_PAYMENT', label: 'Priority Payment', enabled: canCreate },
    { id: 'INTER_ACCOUNT', label: 'Inter-account Transfer', enabled: canCreate },
    { id: 'BILL_PAY', label: 'Bill payment', enabled: canCreate && hasModule('billPayments') },
  ];

  return (
    <div className="bg-white md:border md:border-[#D9DEE1] min-h-[520px] flex flex-col justify-between">
      <div>
        <GeometricHeader
          title="Payments"
          subtitle={activeOrg?.name}
          actions={
            <button
              type="button"
              onClick={() => setScreen('BENEFICIARIES')}
              aria-label="Beneficiaries"
              className="min-w-[40px] min-h-[40px] flex items-center justify-center text-white/90 hover:bg-white/10 rounded-[2px]"
            >
              <Users className="w-4 h-4" />
            </button>
          }
        />

        {error && (
          <div className="p-4">
            <ErrorBanner message={error} onRetry={loadData} />
          </div>
        )}

        {loading ? (
          <SkeletonList rows={3} />
        ) : !canCreate ? (
          <EmptyState
            title="Payment Creation Restricted"
            description="Your assigned role does not hold CREATE_PAYMENTS entitlement. You may still view beneficiary directory."
            action={
              <Button variant="outline" size="sm" onClick={() => setScreen('BENEFICIARIES')}>
                View Beneficiaries
              </Button>
            }
          />
        ) : (
          <div>
            <div className="px-4 py-2.5 bg-[#F4F5F6] border-b border-[#D9DEE1] text-xs font-medium text-[#68727A]">
              Select a payment type
            </div>
            <fieldset className="divide-y divide-[#D9DEE1] border-b border-[#D9DEE1]">
              <legend className="visually-hidden">Payment type</legend>
              {paymentTypes
                .filter((p) => p.enabled)
                .map((opt) => {
                  const checked = selectedType === opt.id;
                  return (
                    <label
                      key={opt.id}
                      className="px-4 py-4 flex items-center gap-3.5 bg-white hover:bg-[#F4F5F6] cursor-pointer"
                    >
                      <input
                        type="radio"
                        name="payment-type"
                        checked={checked}
                        onChange={() => setSelectedType(opt.id)}
                        className="w-4 h-4 accent-[#DB001B]"
                      />
                      <span className="text-sm text-[#252B30]">{opt.label}</span>
                    </label>
                  );
                })}
            </fieldset>

            {/* Clean secondary utility rows */}
            <div className="divide-y divide-[#D9DEE1] border-b border-[#D9DEE1] mt-4">
              <button
                type="button"
                onClick={() => setScreen('BENEFICIARIES')}
                className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-[#F4F5F6]"
              >
                <span className="text-xs font-medium text-[#252B30]">Saved Beneficiaries ({beneficiaries.length})</span>
                <ChevronRight className="w-4 h-4 text-[#68727A]" />
              </button>
              {onNavigate && (
                <button
                  type="button"
                  onClick={() => onNavigate('more', 'FX_RATES')}
                  className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-[#F4F5F6]"
                >
                  <span className="text-xs font-medium text-[#252B30]">Preview Exchange Rates</span>
                  <ChevronRight className="w-4 h-4 text-[#68727A]" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {canCreate && !loading && (
        <div className="p-4 border-t border-[#D9DEE1] bg-white">
          <Button fullWidth size="lg" onClick={startPaymentCreation}>
            Create payment instruction
          </Button>
        </div>
      )}
    </div>
  );
};
