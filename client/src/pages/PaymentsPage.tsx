import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeftRight,
  CheckCircle2,
  FileCheck,
  Plus,
  Receipt,
  Search,
  Send,
  Share2,
  Star,
  Trash2,
  Users,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiRequest, generateIdempotencyKey } from '../lib/api';
import { formatDateTime, formatFinancialCurrency } from '@shared/utils/formatters';
import { COUNTRY_CAPABILITIES, PAYMENT_PURPOSE_CODES } from '@shared/constants';
import {
  Button,
  EmptyState,
  ErrorBanner,
  FormInput,
  FormSelect,
  NativeDialog,
  SectionCard,
  SkeletonList,
  StatusBadge,
} from '../components/ui/Primitives';

type PayMode = 'HOME' | 'PRIORITY_WIRE' | 'INTER_ACCOUNT' | 'BILL_PAY' | 'BENEFICIARIES' | 'SEARCH';

export const PaymentsPage: React.FC = () => {
  const { activeOrg, hideBalances, hasPermission } = useAuth();
  const [mode, setMode] = useState<PayMode>('HOME');
  const [accounts, setAccounts] = useState<any[]>([]);
  const [beneficiaries, setBeneficiaries] = useState<any[]>([]);
  const [recentPayments, setRecentPayments] = useState<any[]>([]);
  const [bills, setBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 7-Step Priority / Wire Payment State
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
  const [stepUpPin, setStepUpPin] = useState('');
  const [wireResult, setWireResult] = useState<any>(null);
  const [wireLoading, setWireLoading] = useState(false);
  const [wireError, setWireError] = useState('');

  // Inter-account transfer
  const [iatFrom, setIatFrom] = useState('');
  const [iatTo, setIatTo] = useState('');
  const [iatAmt, setIatAmt] = useState('');
  const [iatRef, setIatRef] = useState('Treasury Liquidity Sweep');
  const [iatResult, setIatResult] = useState<string | null>(null);

  // New Beneficiary modal
  const [addBenOpen, setAddBenOpen] = useState(false);
  const [newBen, setNewBen] = useState({ name: '', nickname: '', accountNumber: '', bankName: '', ifscSwift: '', transferLimit: '50000' });

  // Search filters
  const [searchRef, setSearchRef] = useState('');
  const [searchStatus, setSearchStatus] = useState('ALL');
  const [shareDoc, setShareDoc] = useState<any | null>(null);

  const loadData = useCallback(async () => {
    if (!activeOrg) return;
    setLoading(true);
    setError(null);
    try {
      const [accRes, benRes, payRes, billRes] = await Promise.all([
        apiRequest<any>(`/api/corporate/accounts?orgId=${encodeURIComponent(activeOrg.id)}`),
        apiRequest<any>('/api/beneficiaries'),
        apiRequest<any>(`/api/corporate/payments?orgId=${encodeURIComponent(activeOrg.id)}`),
        apiRequest<any>('/api/bills').catch(() => ({ bills: [] })),
      ]);
      const accList = accRes.accounts || [];
      setAccounts(accList);
      if (accList.length > 0 && !debitAccountId) {
        setDebitAccountId(accList[0].id);
        setIatFrom(accList[0].id);
        setIatTo(accList[1]?.id || accList[0].id);
      }
      setBeneficiaries(benRes.beneficiaries || []);
      setRecentPayments(payRes.payments || []);
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
  const canCreate = hasPermission('CREATE_PAYMENTS');

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
      setFxQuote(res.quote);
    } catch (err: any) {
      setWireError(err?.message || 'Unable to retrieve FX rate.');
    } finally {
      setWireLoading(false);
    }
  };

  const submitPriorityPayment = async () => {
    setWireError('');
    if (!/^\d{6}$/.test(stepUpPin)) {
      setWireError('Enter your 6-digit Security PIN to authenticate this payment submission.');
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
      setWireError('Select two different corporate accounts.');
      return;
    }
    try {
      const src = accounts.find((a) => a.id === iatFrom);
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
          currency: src?.currency || 'GBP',
          referenceNote: iatRef,
          idempotencyKey: generateIdempotencyKey('iat'),
        }),
      });
      setIatResult(`Inter-account transfer ${res.payment.reference} submitted (${res.payment.status.replace(/_/g, ' ')}).`);
      setIatAmt('');
      await loadData();
    } catch (err: any) {
      setWireError(err?.message || 'Inter-account transfer failed.');
    }
  };

  const handlePayBill = async (bill: any) => {
    if (!debitAccountId) return;
    try {
      await apiRequest('/api/bills/pay', {
        method: 'POST',
        body: JSON.stringify({ billId: bill.id, accountId: debitAccountId }),
      });
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Bill payment failed.');
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

  const handleDeactivateBeneficiary = async (id: string) => {
    await apiRequest(`/api/beneficiaries/${id}`, { method: 'DELETE' });
    await loadData();
  };

  const filteredPayments = recentPayments.filter((p) => {
    if (searchStatus !== 'ALL' && p.status !== searchStatus) return false;
    if (searchRef) {
      const q = searchRef.toLowerCase();
      return p.reference.toLowerCase().includes(q) || p.beneficiary_name.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white border border-[#D7D8D6] rounded-[2px] p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[#252525] tracking-tight">Payments</h1>
          <p className="text-xs text-[#767676] mt-0.5">
            Corporate priority wires, inter-account transfers, bill settlements &amp; beneficiary directory
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              { id: 'HOME', label: 'Overview' },
              ...(canCreate ? [{ id: 'PRIORITY_WIRE', label: 'Priority / Wire' }, { id: 'INTER_ACCOUNT', label: 'Inter-Account' }, { id: 'BILL_PAY', label: 'Bill Pay' }] : []),
              { id: 'BENEFICIARIES', label: 'Beneficiaries' },
              { id: 'SEARCH', label: 'Search' },
            ] as const
          ).map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                setWireError('');
                setMode(m.id as PayMode);
              }}
              className={`px-3 py-1.5 rounded-[2px] text-xs font-semibold transition-colors ${
                mode === m.id ? 'bg-[#252525] text-white' : 'bg-[#F4F4F4] text-[#555555] hover:bg-[#EBEBEB]'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {error && <ErrorBanner message={error} onRetry={loadData} />}

      {/* PAYMENTS HOME */}
      {mode === 'HOME' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <button
              type="button"
              disabled={!canCreate}
              onClick={() => {
                setWireStep(1);
                setWireResult(null);
                setMode('PRIORITY_WIRE');
              }}
              className="p-4 bg-white border border-[#D7D8D6] hover:border-[#DB0011] rounded-[2px] text-left transition-colors disabled:opacity-50"
            >
              <Send className="w-5 h-5 text-[#DB0011] mb-2" />
              <div className="text-sm font-semibold text-[#252525]">Priority / Wire Payment</div>
              <div className="text-xs text-[#767676] mt-0.5">7-step domestic &amp; international wire with FX</div>
            </button>
            <button
              type="button"
              disabled={!canCreate}
              onClick={() => setMode('INTER_ACCOUNT')}
              className="p-4 bg-white border border-[#D7D8D6] hover:border-[#252525] rounded-[2px] text-left transition-colors disabled:opacity-50"
            >
              <ArrowLeftRight className="w-5 h-5 text-[#252525] mb-2" />
              <div className="text-sm font-semibold text-[#252525]">Inter-Account Transfer</div>
              <div className="text-xs text-[#767676] mt-0.5">Move funds between entity accounts</div>
            </button>
            <button
              type="button"
              disabled={!canCreate}
              onClick={() => setMode('BILL_PAY')}
              className="p-4 bg-white border border-[#D7D8D6] hover:border-[#252525] rounded-[2px] text-left transition-colors disabled:opacity-50"
            >
              <Receipt className="w-5 h-5 text-[#252525] mb-2" />
              <div className="text-sm font-semibold text-[#252525]">Corporate Bill Payment</div>
              <div className="text-xs text-[#767676] mt-0.5">Utilities, tax &amp; cloud settlements</div>
            </button>
            <button
              type="button"
              onClick={() => setMode('BENEFICIARIES')}
              className="p-4 bg-white border border-[#D7D8D6] hover:border-[#252525] rounded-[2px] text-left transition-colors"
            >
              <Users className="w-5 h-5 text-[#252525] mb-2" />
              <div className="text-sm font-semibold text-[#252525]">Beneficiaries ({beneficiaries.length})</div>
              <div className="text-xs text-[#767676] mt-0.5">Saved corporate payees &amp; limits</div>
            </button>
          </div>

          <SectionCard title="Recent Payment Instructions" subtitle="Click an authorised payment to share confirmation">
            {loading ? (
              <SkeletonList rows={3} />
            ) : recentPayments.length === 0 ? (
              <EmptyState title="No recent payments" description="Initiate a priority wire or inter-account transfer to begin." />
            ) : (
              <div className="divide-y divide-[#D7D8D6]">
                {recentPayments.slice(0, 6).map((p) => (
                  <div key={p.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-[#252525]">{p.beneficiary_name}</span>
                        <StatusBadge status={p.status} />
                      </div>
                      <div className="text-xs text-[#767676] mt-0.5">
                        {p.reference} • {formatDateTime(p.created_at)}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-[#252525] tabular-nums">
                        {formatFinancialCurrency(p.amount, p.currency, hideBalances)}
                      </span>
                      {['COMPLETED', 'AUTHORISED', 'SENT'].includes(p.status) && (
                        <Button size="sm" variant="outline" onClick={() => setShareDoc(p)}>
                          <Share2 className="w-3.5 h-3.5" />
                          Confirmation
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      )}

      {/* 7-STEP PRIORITY / WIRE PAYMENT WORKFLOW */}
      {mode === 'PRIORITY_WIRE' && (
        <SectionCard
          title={`Priority / Wire Payment — Step ${wireStep} of 7`}
          subtitle="Structured corporate payment workflow with country-specific clearing & backend FX quotes"
        >
          {/* Progress Tracker */}
          <nav aria-label="Payment steps" className="mb-6">
            <ol className="grid grid-cols-7 gap-1 text-[11px] font-medium">
              {['Account', 'Payee', 'Details', 'FX Rate', 'Review', 'Auth', 'Result'].map((label, idx) => {
                const sNum = idx + 1;
                const active = wireStep === sNum;
                const done = wireStep > sNum;
                return (
                  <li
                    key={label}
                    aria-current={active ? 'step' : undefined}
                    className={`py-1.5 px-1 text-center rounded border truncate ${
                      active
                        ? 'bg-[#252525] text-white border-[#252525]'
                        : done
                        ? 'bg-[#EBF7F0] text-[#008A52] border-[#B7E1CD]'
                        : 'bg-[#F4F4F4] text-[#767676] border-[#D7D8D6]'
                    }`}
                  >
                    {sNum}. {label}
                  </li>
                );
              })}
            </ol>
          </nav>

          {wireError && <div className="mb-4"><ErrorBanner message={wireError} /></div>}

          {wireStep === 1 && (
            <div className="space-y-4">
              <FormSelect label="Select Debit Account" requiredMark value={debitAccountId} onChange={(e) => setDebitAccountId(e.target.value)}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.account_name} ({a.maskedAccountNumber}) — {formatFinancialCurrency(a.available_balance, a.currency, hideBalances)}
                  </option>
                ))}
              </FormSelect>
              {selectedDebitAccount && (
                <div className="p-3.5 rounded-[2px] bg-[#F4F4F4] border border-[#D7D8D6] text-xs flex justify-between">
                  <span>Currency: <strong>{selectedDebitAccount.currency}</strong></span>
                  <span className="tabular-nums">
                    Available: <strong>{formatFinancialCurrency(selectedDebitAccount.available_balance, selectedDebitAccount.currency, hideBalances)}</strong>
                  </span>
                </div>
              )}
              <div className="flex justify-end">
                <Button onClick={() => setWireStep(2)} disabled={!debitAccountId}>
                  Next: Select Beneficiary
                </Button>
              </div>
            </div>
          )}

          {wireStep === 2 && (
            <div className="space-y-4">
              <FormInput
                label="Search Saved Beneficiaries"
                placeholder="Search by beneficiary name or bank..."
                value={benSearch}
                onChange={(e) => setBenSearch(e.target.value)}
              />
              <div className="divide-y divide-[#D7D8D6] border border-[#D7D8D6] rounded-[2px] max-h-64 overflow-y-auto">
                {beneficiaries
                  .filter((b) => !benSearch || b.name.toLowerCase().includes(benSearch.toLowerCase()))
                  .map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => applyBeneficiary(b)}
                      className="w-full p-3 text-left hover:bg-[#F4F4F4] flex items-center justify-between gap-3"
                    >
                      <div>
                        <div className="text-sm font-semibold text-[#252525]">{b.name}</div>
                        <div className="text-xs text-[#767676]">{b.bank_name} • {b.account_number}</div>
                      </div>
                      <span className="text-xs font-medium text-[#DB0011]">Select</span>
                    </button>
                  ))}
              </div>
              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setWireStep(1)}>Back</Button>
                <Button variant="secondary" onClick={() => { setSelectedBeneficiaryId(''); setWireStep(3); }}>
                  Enter New Payee Details Manually
                </Button>
              </div>
            </div>
          )}

          {wireStep === 3 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormInput label="Beneficiary Name" requiredMark value={benName} onChange={(e) => setBenName(e.target.value)} />
                <FormInput label="Beneficiary Account / Number" requiredMark value={benAccount} onChange={(e) => setBenAccount(e.target.value)} />
                <FormInput label="Bank Name" requiredMark value={bankName} onChange={(e) => setBankName(e.target.value)} />
                <FormSelect label="Bank Country" requiredMark value={bankCountry} onChange={(e) => setBankCountry(e.target.value)}>
                  {Object.values(COUNTRY_CAPABILITIES).map((c) => (
                    <option key={c.code} value={c.code}>{c.name} ({c.code})</option>
                  ))}
                </FormSelect>
                <FormInput label="SWIFT / BIC" requiredMark value={swiftBic} onChange={(e) => setSwiftBic(e.target.value)} />
                {destCountryCap.supportsIBAN && (
                  <FormInput label="IBAN (Required for IBAN jurisdiction)" value={iban} onChange={(e) => setIban(e.target.value)} />
                )}
                <FormSelect label="Payment Currency" requiredMark value={payCurrency} onChange={(e) => setPayCurrency(e.target.value)}>
                  {['GBP', 'USD', 'EUR', 'INR', 'SGD', 'AED'].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </FormSelect>
                <FormInput label="Payment Amount" type="number" step="0.01" requiredMark value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
                <FormInput label="Payment Value Date" type="date" requiredMark value={payDate} onChange={(e) => setPayDate(e.target.value)} />
                <FormSelect label="Purpose of Payment" requiredMark value={payPurpose} onChange={(e) => setPayPurpose(e.target.value)}>
                  {PAYMENT_PURPOSE_CODES.map((p) => (
                    <option key={p.code} value={p.code}>{p.code} — {p.label}</option>
                  ))}
                </FormSelect>
                <FormSelect label="Charges Arrangement" value={chargesBearer} onChange={(e) => setChargesBearer(e.target.value as any)}>
                  <option value="SHA">SHA — Shared Charges</option>
                  <option value="OUR">OUR — Remitter Pays All Fees</option>
                  <option value="BEN">BEN — Beneficiary Pays Fees</option>
                </FormSelect>
                <FormInput label="Payment Reference" requiredMark value={payReference} onChange={(e) => setPayReference(e.target.value)} />
              </div>
              <FormInput label="Additional Remittance Information" value={additionalInfo} onChange={(e) => setAdditionalInfo(e.target.value)} />

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setWireStep(2)}>Back</Button>
                <Button
                  onClick={() => {
                    if (!benName || !benAccount || !bankName || !payAmount || Number(payAmount) <= 0 || !payReference) {
                      setWireError('Please complete all required beneficiary, amount, and reference fields.');
                      return;
                    }
                    setWireError('');
                    setFxQuote(null);
                    setWireStep(4);
                  }}
                >
                  Next: Exchange Rate
                </Button>
              </div>
            </div>
          )}

          {wireStep === 4 && (
            <div className="space-y-4">
              {selectedDebitAccount?.currency === payCurrency ? (
                <div className="p-4 rounded-[2px] bg-[#F4F4F4] border border-[#D7D8D6] text-xs">
                  Same-currency settlement ({payCurrency}). No foreign exchange conversion required.
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-[#555555]">
                    Cross-currency payment ({selectedDebitAccount?.currency} &rarr; {payCurrency}). Request a live sandbox FX quote before confirming.
                  </p>
                  <Button variant="secondary" loading={wireLoading} onClick={requestFxQuote}>
                    Request Exchange Rate Quote
                  </Button>
                  {fxQuote && (
                    <div className="p-4 rounded-[2px] bg-[#F4F4F4] border border-[#D7D8D6] text-xs space-y-1">
                      <div className="font-semibold text-[#252525]">Quoted Rate: 1 {fxQuote.fromCurrency} = {fxQuote.rate} {fxQuote.toCurrency}</div>
                      <div className="tabular-nums">Converted Credit: <strong>{formatFinancialCurrency(fxQuote.convertedAmount, fxQuote.toCurrency)}</strong></div>
                      <div>Quote Fee: {formatFinancialCurrency(fxQuote.fee, fxQuote.fromCurrency)} • Valid for {fxQuote.validSeconds}s</div>
                    </div>
                  )}
                </div>
              )}
              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setWireStep(3)}>Back</Button>
                <Button
                  disabled={selectedDebitAccount?.currency !== payCurrency && !fxQuote}
                  onClick={() => setWireStep(5)}
                >
                  Next: Review Payment
                </Button>
              </div>
            </div>
          )}

          {wireStep === 5 && (
            <div className="space-y-4">
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-[#F4F4F4] border border-[#D7D8D6] rounded-[2px] text-xs">
                <div><dt className="text-[#767676]">Debit Account</dt><dd className="font-semibold">{selectedDebitAccount?.account_name}</dd></div>
                <div><dt className="text-[#767676]">Beneficiary</dt><dd className="font-semibold">{benName} ({benAccount})</dd></div>
                <div><dt className="text-[#767676]">Bank &amp; Country</dt><dd className="font-semibold">{bankName} ({bankCountry})</dd></div>
                <div><dt className="text-[#767676]">Payment Amount</dt><dd className="font-bold text-[#252525] text-sm tabular-nums">{formatFinancialCurrency(Number(payAmount), payCurrency)}</dd></div>
                <div><dt className="text-[#767676]">Purpose &amp; Charges</dt><dd className="font-medium">{payPurpose} • {chargesBearer}</dd></div>
                <div><dt className="text-[#767676]">Value Date &amp; Reference</dt><dd className="font-medium">{payDate} • {payReference}</dd></div>
              </dl>
              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setWireStep(4)}>Back</Button>
                <Button onClick={() => setWireStep(6)}>Proceed to Authentication</Button>
              </div>
            </div>
          )}

          {wireStep === 6 && (
            <div className="space-y-4">
              <p className="text-xs text-[#555555]">
                Enter your 6-digit Mobile Security PIN to submit this instruction into the corporate authorisation workflow.
              </p>
              <FormInput
                label="6-Digit Mobile Security PIN"
                type="password"
                inputMode="numeric"
                maxLength={6}
                placeholder="Enter 6-digit Mobile Security PIN"
                value={stepUpPin}
                onChange={(e) => setStepUpPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              />
              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setWireStep(5)}>Back</Button>
                <Button loading={wireLoading} onClick={submitPriorityPayment}>
                  Authenticate &amp; Submit Payment
                </Button>
              </div>
            </div>
          )}

          {wireStep === 7 && wireResult && (
            <div className="space-y-4">
              <div className="p-4 rounded-[2px] bg-[#EBF7F0] border border-[#B7E1CD] flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-[#008A52] shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <div className="text-sm font-semibold text-[#008A52]">Payment Instruction Recorded (Sandbox)</div>
                  <div>Reference: <strong className="tabular-nums">{wireResult.reference}</strong></div>
                  <div>Amount: <strong className="tabular-nums">{formatFinancialCurrency(wireResult.amount, wireResult.currency)}</strong> to {wireResult.beneficiary_name}</div>
                  <div>Status: <StatusBadge status={wireResult.status} /></div>
                  <p className="text-[#555555] pt-1">
                    Next step: Requires {wireResult.required_approvals} independent authoriser approval(s) in the Auth tab before internal sandbox settlement. No external bank wire has been transmitted.
                  </p>
                </div>
              </div>
              <Button onClick={() => { setMode('HOME'); setWireStep(1); }}>Done</Button>
            </div>
          )}
        </SectionCard>
      )}

      {/* INTER-ACCOUNT TRANSFER */}
      {mode === 'INTER_ACCOUNT' && (
        <SectionCard title="Inter-Account Transfer" subtitle="Transfer funds between your organisation's corporate accounts">
          {wireError && <div className="mb-4"><ErrorBanner message={wireError} /></div>}
          {iatResult && <div className="mb-4 p-3 rounded bg-[#EBF7F0] border border-[#B7E1CD] text-xs text-[#008A52] font-medium">{iatResult}</div>}
          <form onSubmit={handleInterAccountSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormSelect label="Source Account" requiredMark value={iatFrom} onChange={(e) => setIatFrom(e.target.value)}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.account_name} ({formatFinancialCurrency(a.available_balance, a.currency, hideBalances)})</option>
              ))}
            </FormSelect>
            <FormSelect label="Destination Account" requiredMark value={iatTo} onChange={(e) => setIatTo(e.target.value)}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.account_name} ({a.currency})</option>
              ))}
            </FormSelect>
            <FormInput label="Transfer Amount" type="number" step="0.01" requiredMark value={iatAmt} onChange={(e) => setIatAmt(e.target.value)} />
            <FormInput label="Reference" requiredMark value={iatRef} onChange={(e) => setIatRef(e.target.value)} />
            <div className="sm:col-span-2">
              <Button type="submit">Submit Inter-Account Transfer</Button>
            </div>
          </form>
        </SectionCard>
      )}

      {/* BILL PAYMENTS */}
      {mode === 'BILL_PAY' && (
        <SectionCard title="Corporate Bill Payments" subtitle="Pending utility, tax, and enterprise infrastructure invoices">
          {bills.length === 0 ? (
            <EmptyState title="No bills found" description="All scheduled corporate bills have been settled." />
          ) : (
            <div className="divide-y divide-[#D7D8D6]">
              {bills.map((b) => (
                <div key={b.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-[#252525]">{b.biller_name}</span>
                      <StatusBadge status={b.status} />
                    </div>
                    <div className="text-xs text-[#767676] mt-0.5">Consumer: {b.consumer_number} • Due: {b.due_date}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-[#252525] tabular-nums">{formatFinancialCurrency(b.bill_amount, 'GBP', hideBalances)}</span>
                    {b.status === 'PENDING' && (
                      <Button size="sm" onClick={() => handlePayBill(b)}>Pay Now</Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      )}

      {/* BENEFICIARIES */}
      {mode === 'BENEFICIARIES' && (
        <SectionCard
          title="Corporate Beneficiary Directory"
          action={
            hasPermission('MANAGE_BENEFICIARIES') && (
              <Button size="sm" onClick={() => setAddBenOpen(true)}>
                <Plus className="w-4 h-4" />
                Add Beneficiary
              </Button>
            )
          }
        >
          <div className="divide-y divide-[#D7D8D6]">
            {beneficiaries.map((b) => (
              <div key={b.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-[#252525]">{b.name}</span>
                    {b.is_favorite === 1 && <Star className="w-3.5 h-3.5 text-[#DB0011] fill-current" />}
                    <StatusBadge status={b.activation_status || 'ACTIVE'} />
                  </div>
                  <div className="text-xs text-[#767676] mt-0.5">
                    {b.bank_name} • {b.account_number} • SWIFT: {b.ifsc_swift} • Limit: {formatFinancialCurrency(b.transfer_limit, b.currency || 'GBP')}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {canCreate && (
                    <Button size="sm" variant="outline" onClick={() => { applyBeneficiary(b); setMode('PRIORITY_WIRE'); }}>
                      Pay
                    </Button>
                  )}
                  {hasPermission('MANAGE_BENEFICIARIES') && (
                    <Button size="sm" variant="ghost" aria-label={`Deactivate ${b.name}`} onClick={() => handleDeactivateBeneficiary(b.id)}>
                      <Trash2 className="w-4 h-4 text-[#B0000D]" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* PAYMENT SEARCH */}
      {mode === 'SEARCH' && (
        <SectionCard title="Payment Search">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <div className="relative sm:col-span-2">
              <Search className="w-4 h-4 text-[#767676] absolute left-3 top-3" />
              <input
                type="search"
                placeholder="Search payment reference or beneficiary..."
                value={searchRef}
                onChange={(e) => setSearchRef(e.target.value)}
                className="w-full min-h-[42px] pl-9 pr-3 text-sm bg-white border border-[#9E9E9E] rounded-[2px]"
              />
            </div>
            <select
              value={searchStatus}
              onChange={(e) => setSearchStatus(e.target.value)}
              className="min-h-[42px] px-3 text-sm bg-white border border-[#9E9E9E] rounded-[2px]"
            >
              <option value="ALL">All Statuses</option>
              <option value="AWAITING_AUTHORISATION">Awaiting Authorisation</option>
              <option value="PARTIALLY_AUTHORISED">Partially Authorised</option>
              <option value="COMPLETED">Completed</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>
          <div className="divide-y divide-[#D7D8D6]">
            {filteredPayments.map((p) => (
              <div key={p.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                <div>
                  <div className="font-semibold text-[#252525]">{p.beneficiary_name} — {p.reference}</div>
                  <div className="text-[#767676]">{p.reference_note}</div>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={p.status} />
                  <span className="font-bold text-[#252525] tabular-nums">{formatFinancialCurrency(p.amount, p.currency, hideBalances)}</span>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Add Beneficiary Dialog */}
      <NativeDialog open={addBenOpen} onClose={() => setAddBenOpen(false)} title="Add Corporate Beneficiary">
        <form onSubmit={handleAddBeneficiary} className="space-y-3">
          <FormInput label="Beneficiary Legal Name" required value={newBen.name} onChange={(e) => setNewBen({ ...newBen, name: e.target.value })} />
          <FormInput label="Nickname" value={newBen.nickname} onChange={(e) => setNewBen({ ...newBen, nickname: e.target.value })} />
          <FormInput label="Account Number / IBAN" required value={newBen.accountNumber} onChange={(e) => setNewBen({ ...newBen, accountNumber: e.target.value })} />
          <FormInput label="Bank Name" required value={newBen.bankName} onChange={(e) => setNewBen({ ...newBen, bankName: e.target.value })} />
          <FormInput label="SWIFT / BIC / IFSC" required value={newBen.ifscSwift} onChange={(e) => setNewBen({ ...newBen, ifscSwift: e.target.value })} />
          <FormInput label="Daily Transfer Limit" type="number" value={newBen.transferLimit} onChange={(e) => setNewBen({ ...newBen, transferLimit: e.target.value })} />
          <Button type="submit" fullWidth>Save Beneficiary</Button>
        </form>
      </NativeDialog>

      {/* Authorised Payment Confirmation Sharing Modal */}
      <NativeDialog
        open={!!shareDoc}
        onClose={() => setShareDoc(null)}
        title="Authorised Payment Confirmation"
        subtitle={shareDoc?.reference}
      >
        {shareDoc && (
          <div className="space-y-4 text-xs">
            <div className="p-4 rounded-[2px] bg-[#F4F4F4] border border-[#D7D8D6] space-y-2">
              <div className="flex items-center gap-2 font-semibold text-[#008A52]">
                <FileCheck className="w-4 h-4" />
                <span>Backend Status Verified: {shareDoc.status}</span>
              </div>
              <div>Reference: <strong>{shareDoc.reference}</strong></div>
              <div>Beneficiary: <strong>{shareDoc.beneficiary_name}</strong> ({shareDoc.beneficiary_bank})</div>
              <div>Amount: <strong className="tabular-nums">{formatFinancialCurrency(shareDoc.amount, shareDoc.currency)}</strong></div>
              <div>Processed: {formatDateTime(shareDoc.updated_at || shareDoc.created_at)}</div>
              <p className="text-[11px] text-[#767676] pt-1">Sandbox ledger confirmation. Not an external SWIFT gpi bank receipt.</p>
            </div>
            <Button
              fullWidth
              onClick={() => {
                navigator.clipboard?.writeText(`HSBC Cnet Confirmation | Ref: ${shareDoc.reference} | Payee: ${shareDoc.beneficiary_name} | Amount: ${shareDoc.currency} ${shareDoc.amount}`);
                setShareDoc(null);
              }}
            >
              Copy Confirmation Reference
            </Button>
          </div>
        )}
      </NativeDialog>
    </div>
  );
};
