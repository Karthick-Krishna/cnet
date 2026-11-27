import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Download,
  Fingerprint,
  HelpCircle,
  ListChecks,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';
import { formatDateTime, formatFinancialCurrency } from '@shared/utils/formatters';
import { GeometricHeader } from '../components/ui/GeometricHeader';
import { BankingHeader } from '../components/ui/BankingHeader';
import {
  Button,
  EmptyState,
  ErrorBanner,
  FormInput,
  NativeDialog,
  SkeletonList,
  StatusBadge,
} from '../components/ui/Primitives';
import { parseRequestOptions, serializeCredential } from '../lib/webauthn';

interface AuthCategoryDef {
  id: string;
  label: string;
  matchCategories: string[];
  countryRequired?: string;
}

const DOCUMENTED_CATEGORIES: AuthCategoryDef[] = [
  { id: 'ACH', label: 'ACH', matchCategories: ['ACH_CREDIT', 'ACH_DEBIT', 'ACH'] },
  { id: 'BILL_PAYMENT', label: 'Bill Payment', matchCategories: ['BILL_PAYMENT', 'BILL'] },
  { id: 'SEPA', label: 'Eurozone-SEPA', matchCategories: ['SEPA_PAYMENT', 'EUROZONE_SEPA'] },
  { id: 'FLA', label: 'Payment File - FLA', matchCategories: ['PAYMENT_FILE_FLA', 'FLA'] },
  { id: 'ILA', label: 'Payment File - ILA', matchCategories: ['PAYMENT_FILE_ILA', 'ILA'] },
  { id: 'PRIORITY', label: 'Priority', matchCategories: ['PRIORITY_PAYMENT', 'INTERNATIONAL_PAYMENT'] },
  { id: 'ZENGIN', label: 'Priority Payment Zengin', matchCategories: ['PRIORITY_ZENGIN'], countryRequired: 'JP' },
  { id: 'TRANSFER', label: 'Transfer', matchCategories: ['INTER_ACCOUNT_TRANSFER', 'TRANSFER'] },
];

type AuthLevel = 'OVERVIEW' | 'CATEGORY_LIST' | 'DETAIL' | 'ACK';

export const AuthPage: React.FC = () => {
  const { activeOrg, hideBalances, hasPermission } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [instructions, setInstructions] = useState<any[]>([]);

  const [level, setLevel] = useState<AuthLevel>('OVERVIEW');
  const [statusTab, setStatusTab] = useState<'PENDING' | 'RECENT' | 'REJECTED'>('PENDING');
  const [activeCategory, setActiveCategory] = useState<AuthCategoryDef | null>(null);
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [detailItem, setDetailItem] = useState<any | null>(null);

  // Step-Up Auth / Decision Modal
  const [reviewAction, setReviewAction] = useState<{
    ids: string[];
    decision: 'APPROVED' | 'REJECTED' | 'SEND_TO_REPAIR';
  } | null>(null);
  const [comment, setComment] = useState('');
  const [stepUpPin, setStepUpPin] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');

  // Acknowledgement Screen state (pay_auth.pdf p.4)
  const [ackResult, setAckResult] = useState<{
    decision: string;
    items: any[];
    timestamp: string;
  } | null>(null);

  const loadAuthQueue = useCallback(async () => {
    if (!activeOrg) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest<any>(`/api/corporate/authorisations?orgId=${encodeURIComponent(activeOrg.id)}`);
      setInstructions(res.instructions || []);
      setSelectedIds([]);
    } catch (err: any) {
      setError(err?.message || 'Unable to load authorisations.');
    } finally {
      setLoading(false);
    }
  }, [activeOrg]);

  useEffect(() => {
    loadAuthQueue();
  }, [loadAuthQueue]);

  const canApprove = hasPermission('APPROVE_PAYMENTS');
  const canReject = hasPermission('REJECT_PAYMENTS');

  const scopedList = useMemo(() => {
    if (statusTab === 'PENDING') {
      return instructions.filter((i) => ['AWAITING_AUTHORISATION', 'PARTIALLY_AUTHORISED'].includes(i.status));
    }
    if (statusTab === 'RECENT') {
      return instructions.filter((i) => ['AUTHORISED', 'COMPLETED', 'PROCESSING', 'SENT'].includes(i.status));
    }
    return instructions.filter((i) => ['REJECTED', 'REPAIR_REQUESTED'].includes(i.status));
  }, [instructions, statusTab]);

  const visibleCategories = useMemo(() => {
    return DOCUMENTED_CATEGORIES.filter((cat) => {
      if (cat.countryRequired && activeOrg?.country !== cat.countryRequired) return false;
      return true;
    }).map((cat) => {
      const items = scopedList.filter((i) => cat.matchCategories.includes(i.category));
      return { ...cat, items };
    });
  }, [scopedList, activeOrg?.country]);

  const categoryItems = useMemo(() => {
    if (!activeCategory) return [];
    return scopedList.filter((i) => activeCategory.matchCategories.includes(i.category));
  }, [scopedList, activeCategory]);

  const reviewItems = useMemo(
    () => (reviewAction ? instructions.filter((i) => reviewAction.ids.includes(i.id)) : []),
    [reviewAction, instructions]
  );

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const executeDecision = async (usePasskey = false) => {
    if (!reviewAction || !activeOrg) return;
    setActionLoading(true);
    setActionError('');
    try {
      let reauthToken: string | undefined;
      if (reviewAction.decision === 'APPROVED' && usePasskey) {
        const opts = await apiRequest('/api/auth/webauthn/reauth/options', { method: 'POST' });
        const pk = parseRequestOptions(opts);
        const cred = (await navigator.credentials.get({ publicKey: pk })) as PublicKeyCredential | null;
        if (!cred) throw new Error('Passkey verification cancelled.');
        const ver = await apiRequest<any>('/api/auth/webauthn/reauth/verify', {
          method: 'POST',
          body: JSON.stringify(serializeCredential(cred)),
        });
        reauthToken = ver.reauthToken;
      }

      const itemsSnapshot = reviewItems;
      const res = await apiRequest<any>('/api/corporate/authorisations/decide', {
        method: 'POST',
        body: JSON.stringify({
          orgId: activeOrg.id,
          ids: reviewAction.ids,
          decision: reviewAction.decision,
          comment,
          stepUpPin: usePasskey ? undefined : stepUpPin,
          reauthToken,
        }),
      });

      const okCount = (res.results || []).length;
      if (okCount === 0) {
        const msg = (res.errors || []).map((e: any) => e.error).join('; ') || 'Authorisation update could not be applied.';
        setActionError(msg);
        return;
      }

      setAckResult({
        decision: reviewAction.decision,
        items: itemsSnapshot,
        timestamp: new Date().toISOString(),
      });
      setReviewAction(null);
      setStepUpPin('');
      setComment('');
      setMultiSelectMode(false);
      setLevel('ACK');
      await loadAuthQueue();
    } catch (err: any) {
      setActionError(err?.message || 'Authorisation decision failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const saveConfirmationRecord = () => {
    if (!ackResult) return;
    const html = `<!doctype html><html><head><title>HSBC Cnet Authorisation Confirmation</title>
      <style>body{font-family:Inter,sans-serif;padding:32px;color:#252B30}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border-bottom:1px solid #D9DEE1;padding:8px;text-align:left;font-size:12px}</style></head>
      <body><h2>Authorisation Confirmation — HSBC Cnet (Sandbox)</h2>
      <p><strong>Decision:</strong> ${ackResult.decision}<br/><strong>Date:</strong> ${formatDateTime(ackResult.timestamp)}</p>
      <table><thead><tr><th>Reference</th><th>Beneficiary</th><th>Amount</th></tr></thead><tbody>
      ${ackResult.items.map((i) => `<tr><td>${i.reference}</td><td>${i.beneficiary_name}</td><td>${formatFinancialCurrency(i.amount, i.currency)}</td></tr>`).join('')}
      </tbody></table></body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `HSBC_Cnet_Authorisation_${Date.now()}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // =========================================================================
  // LEVEL 4: ACKNOWLEDGEMENT SCREEN (pay_auth.pdf p.4)
  // =========================================================================
  if (level === 'ACK' && ackResult) {
    const isApproved = ackResult.decision === 'APPROVED';
    return (
      <div className="bg-white md:border md:border-[#D9DEE1] min-h-[540px] flex flex-col justify-between">
        <BankingHeader
          title="Confirmation"
          rightSlot={
            <button type="button" onClick={saveConfirmationRecord} aria-label="Save confirmation PDF/HTML" className="p-2 text-[#263640]">
              <Download className="w-4 h-4" aria-hidden="true" />
            </button>
          }
        />

        <div className="p-6 flex-1 flex flex-col justify-center items-center text-center max-w-md mx-auto">
          <div className="w-12 h-12 rounded-full bg-[#ECF6F1] flex items-center justify-center mb-4">
            <CheckCircle2 className="w-7 h-7 text-[#27835B]" strokeWidth={1.75} aria-hidden="true" />
          </div>
          <h1 className="text-lg font-medium text-[#252B30]">
            {ackResult.items.length === 1
              ? `Your payment instruction was ${isApproved ? 'successfully authorised' : ackResult.decision === 'REJECTED' ? 'rejected' : 'sent to repair'}`
              : `Your ${ackResult.items.length} instructions were ${isApproved ? 'successfully authorised' : ackResult.decision.toLowerCase().replace(/_/g, ' ')}`}
          </h1>

          <div className="w-full mt-6 divide-y divide-[#D9DEE1] border-y border-[#D9DEE1] text-left text-xs">
            {ackResult.items.map((item) => (
              <div key={item.id} className="py-3 flex justify-between items-center gap-3">
                <div>
                  <div className="font-medium text-[#252B30]">{item.beneficiary_name}</div>
                  <div className="text-[#68727A] tabular-nums">{item.reference}</div>
                </div>
                <div className="font-semibold text-[#252B30] tabular-nums">
                  {formatFinancialCurrency(item.amount, item.currency)}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 border-t border-[#D9DEE1] space-y-2.5">
          <Button
            fullWidth
            onClick={() => {
              setAckResult(null);
              setDetailItem(null);
              setLevel(activeCategory ? 'CATEGORY_LIST' : 'OVERVIEW');
            }}
          >
            Back to {activeCategory?.label || 'Authorisations'}
          </Button>
          <Button fullWidth variant="outline" onClick={saveConfirmationRecord}>
            Save instruction details
          </Button>
        </div>
      </div>
    );
  }

  // =========================================================================
  // LEVEL 3: AUTHORISATION DETAIL SCREEN (pay_auth.pdf p.3 — clean populated fields)
  // =========================================================================
  if (level === 'DETAIL' && detailItem) {
    const fields: { label: string; value: React.ReactNode }[] = [
      { label: 'Status', value: <StatusBadge status={detailItem.status} /> },
      { label: 'Instruction reference number', value: <span className="tabular-nums">{detailItem.reference}</span> },
      { label: 'Payment system', value: detailItem.category.replace(/_/g, ' ') },
      ...(detailItem.reference_note ? [{ label: 'Your reference', value: detailItem.reference_note }] : []),
      { label: 'Debit account', value: `${detailItem.debit_account_name} (${detailItem.debit_currency})` },
      { label: 'Beneficiary', value: detailItem.beneficiary_name },
      ...(detailItem.beneficiary_account ? [{ label: 'Beneficiary account', value: <span className="tabular-nums">{detailItem.beneficiary_account}</span> }] : []),
      ...(detailItem.beneficiary_bank ? [{ label: 'Beneficiary bank', value: `${detailItem.beneficiary_bank} (${detailItem.destination_country})` }] : []),
      ...(detailItem.swift_bic ? [{ label: 'SWIFT / BIC', value: detailItem.swift_bic }] : []),
      ...(detailItem.exchange_rate && detailItem.exchange_rate !== 1 ? [{ label: 'Exchange rate', value: `1 ${detailItem.debit_currency} = ${detailItem.exchange_rate} ${detailItem.currency}` }] : []),
      ...(detailItem.payment_purpose ? [{ label: 'Payment purpose', value: detailItem.payment_purpose }] : []),
      ...(detailItem.charges_bearer ? [{ label: 'Charges', value: detailItem.charges_bearer }] : []),
      { label: 'Initiated by', value: `${detailItem.initiator_name} • ${formatDateTime(detailItem.created_at)}` },
      { label: 'Approvals recorded', value: `${detailItem.current_approvals} of ${detailItem.required_approvals}` },
    ];

    const isPending = ['AWAITING_AUTHORISATION', 'PARTIALLY_AUTHORISED'].includes(detailItem.status);

    return (
      <div className="bg-white md:border md:border-[#D9DEE1]">
        <BankingHeader
          title={activeCategory?.label || 'Payment Details'}
          onBack={() => {
            setDetailItem(null);
            setLevel('CATEGORY_LIST');
          }}
          rightSlot={
            <button type="button" aria-label="Authorisation guidance" className="p-2 text-[#68727A]">
              <HelpCircle className="w-4 h-4" />
            </button>
          }
        />

        {/* Hero Payee & Amount Summary Row */}
        <div className="px-4 py-4 border-b border-[#D9DEE1] flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-[#252B30]">{detailItem.beneficiary_name}</div>
            <div className="text-xs text-[#68727A] mt-0.5">{detailItem.destination_country}</div>
          </div>
          <div className="text-right">
            <div className="text-lg font-semibold text-[#252B30] tabular-nums">
              {formatFinancialCurrency(detailItem.amount, detailItem.currency, hideBalances)}
            </div>
          </div>
        </div>

        {detailItem.unusualFlags?.length > 0 && (
          <div className="px-4 py-2.5 bg-[#FBF5EA] border-b border-[#EBD3A7] text-xs text-[#B77A1D] flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{detailItem.unusualFlags.join(' • ')}</span>
          </div>
        )}

        {/* Populated-Only Fields */}
        <dl className="divide-y divide-[#D9DEE1] text-xs">
          {fields.map((f) => (
            <div key={f.label} className="px-4 py-3 flex items-center justify-between gap-4">
              <dt className="text-[#68727A] shrink-0">{f.label}</dt>
              <dd className="text-right font-medium text-[#252B30]">{f.value}</dd>
            </div>
          ))}
        </dl>

        {detailItem.approvalHistory?.length > 0 && (
          <div className="p-4 bg-[#F4F5F6] border-t border-[#D9DEE1] text-xs">
            <div className="font-semibold text-[#68727A] uppercase tracking-wider text-[11px] mb-2">Approval History</div>
            <div className="space-y-2">
              {detailItem.approvalHistory.map((h: any, idx: number) => (
                <div key={idx} className="p-2.5 bg-white border border-[#D9DEE1] flex justify-between gap-2">
                  <div>
                    <span className="font-medium text-[#252B30]">{h.approverName}</span> ({h.decision})
                    {h.comment && <div className="text-[#68727A] mt-0.5">{h.comment}</div>}
                  </div>
                  <span className="text-[#68727A]">{formatDateTime(h.timestamp)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bottom Fixed-Style Action Buttons matching pay_auth.pdf p.3 */}
        {isPending && (
          <div className="p-4 border-t border-[#D9DEE1] space-y-2.5 bg-white">
            <Button
              fullWidth
              size="lg"
              disabled={!detailItem.canCurrentUserApprove}
              onClick={() => {
                setActionError('');
                setReviewAction({ ids: [detailItem.id], decision: 'APPROVED' });
              }}
            >
              {detailItem.canCurrentUserApprove ? 'Authorise' : 'Maker-Checker Restricted / Already Signed'}
            </Button>
            {(canReject || canApprove) && (
              <div className="grid grid-cols-2 gap-2.5">
                <Button
                  variant="outline"
                  disabled={!canReject}
                  onClick={() => {
                    setActionError('');
                    setReviewAction({ ids: [detailItem.id], decision: 'REJECTED' });
                  }}
                >
                  Reject
                </Button>
                <Button
                  variant="outline"
                  disabled={!canReject && !canApprove}
                  onClick={() => {
                    setActionError('');
                    setReviewAction({ ids: [detailItem.id], decision: 'SEND_TO_REPAIR' });
                  }}
                >
                  Send to repair
                </Button>
              </div>
            )}
          </div>
        )}

        <StepUpDecisionDialog
          reviewAction={reviewAction}
          onClose={() => setReviewAction(null)}
          reviewItems={reviewItems}
          comment={comment}
          setComment={setComment}
          stepUpPin={stepUpPin}
          setStepUpPin={setStepUpPin}
          actionLoading={actionLoading}
          actionError={actionError}
          executeDecision={executeDecision}
        />
      </div>
    );
  }

  // =========================================================================
  // LEVEL 2: CATEGORY INSTRUCTION LIST (pay_auth.pdf p.2)
  // =========================================================================
  if (level === 'CATEGORY_LIST' && activeCategory) {
    return (
      <div className="bg-white md:border md:border-[#D9DEE1]">
        <BankingHeader
          title={activeCategory.label}
          onBack={() => {
            setActiveCategory(null);
            setMultiSelectMode(false);
            setSelectedIds([]);
            setLevel('OVERVIEW');
          }}
          rightSlot={
            statusTab === 'PENDING' && canApprove && categoryItems.length > 0 ? (
              <button
                type="button"
                onClick={() => {
                  setMultiSelectMode((m) => !m);
                  setSelectedIds([]);
                }}
                className="px-2.5 py-1.5 text-xs font-medium text-[#263640] hover:bg-[#F4F5F6] flex items-center gap-1.5"
              >
                <ListChecks className="w-4 h-4" />
                <span>{multiSelectMode ? 'Done' : 'Multi-select'}</span>
              </button>
            ) : null
          }
        />

        {categoryItems.length === 0 ? (
          <EmptyState
            title={`No ${activeCategory.label} instructions`}
            description="There are no instructions in this payment category for the selected status."
          />
        ) : (
          <div className="divide-y divide-[#D9DEE1]">
            {categoryItems.map((item) => {
              const checked = selectedIds.includes(item.id);
              return (
                <div
                  key={item.id}
                  className="px-4 py-3.5 flex items-start justify-between gap-3 hover:bg-[#F4F5F6]"
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    {(multiSelectMode || statusTab === 'PENDING') && item.canCurrentUserApprove && (
                      <input
                        type="checkbox"
                        aria-label={`Select ${item.reference}`}
                        checked={checked}
                        onChange={() => toggleSelect(item.id)}
                        className="mt-1 w-4 h-4 accent-[#DB001B]"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setDetailItem(item);
                        setLevel('DETAIL');
                      }}
                      className="flex-1 text-left min-w-0"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="font-medium text-sm text-[#252B30] truncate">{item.beneficiary_name}</div>
                        <div className="text-sm font-semibold text-[#252B30] tabular-nums shrink-0">
                          {formatFinancialCurrency(item.amount, item.currency, hideBalances)}
                        </div>
                      </div>
                      <dl className="mt-2 space-y-1 text-xs">
                        <div className="flex justify-between gap-2">
                          <dt className="text-[#68727A]">Status</dt>
                          <dd className="text-[#252B30] font-medium">
                            {item.status.replace(/_/g, ' ')} ({item.current_approvals}/{item.required_approvals})
                          </dd>
                        </div>
                        <div className="flex justify-between gap-2">
                          <dt className="text-[#68727A]">Reference</dt>
                          <dd className="text-[#252B30] tabular-nums">{item.reference}</dd>
                        </div>
                        <div className="flex justify-between gap-2">
                          <dt className="text-[#68727A]">Debit account</dt>
                          <dd className="text-[#68727A] truncate">{item.debit_account_name}</dd>
                        </div>
                      </dl>
                    </button>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#68727A] mt-1 shrink-0" aria-hidden="true" />
                </div>
              );
            })}
          </div>
        )}

        {selectedIds.length > 0 && statusTab === 'PENDING' && (
          <div className="p-4 border-t border-[#D9DEE1] bg-[#F4F5F6] space-y-2">
            <div className="text-xs font-medium text-[#252B30]">{selectedIds.length} instruction(s) selected</div>
            <div className="grid grid-cols-3 gap-2">
              {canApprove && (
                <Button
                  size="sm"
                  onClick={() => {
                    setActionError('');
                    setReviewAction({ ids: selectedIds, decision: 'APPROVED' });
                  }}
                >
                  Authorise
                </Button>
              )}
              {canReject && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setActionError('');
                      setReviewAction({ ids: selectedIds, decision: 'REJECTED' });
                    }}
                  >
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setActionError('');
                      setReviewAction({ ids: selectedIds, decision: 'SEND_TO_REPAIR' });
                    }}
                  >
                    Send to repair
                  </Button>
                </>
              )}
            </div>
          </div>
        )}

        <StepUpDecisionDialog
          reviewAction={reviewAction}
          onClose={() => setReviewAction(null)}
          reviewItems={reviewItems}
          comment={comment}
          setComment={setComment}
          stepUpPin={stepUpPin}
          setStepUpPin={setStepUpPin}
          actionLoading={actionLoading}
          actionError={actionError}
          executeDecision={executeDecision}
        />
      </div>
    );
  }

  // =========================================================================
  // LEVEL 1: COMPANY OVERVIEW (pay_auth.pdf p.1 exact structure)
  // =========================================================================
  return (
    <div className="bg-white md:border md:border-[#D9DEE1]">
      <GeometricHeader title="Authorisations" subtitle={activeOrg?.name} />

      {/* Status Filter Bar */}
      <div className="grid grid-cols-3 border-b border-[#D9DEE1] bg-white text-xs font-medium" role="tablist">
        {(
          [
            { id: 'PENDING', label: 'Pending' },
            { id: 'RECENT', label: 'Authorised' },
            { id: 'REJECTED', label: 'Rejected / Repair' },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={statusTab === t.id}
            onClick={() => setStatusTab(t.id)}
            className={`py-3 text-center border-b-[2px] ${
              statusTab === t.id ? 'border-[#DB001B] text-[#252B30] font-semibold' : 'border-transparent text-[#68727A]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="p-4">
          <ErrorBanner message={error} onRetry={loadAuthQueue} />
        </div>
      )}

      <div className="px-4 py-2.5 bg-[#F4F5F6] border-b border-[#D9DEE1] flex items-center justify-between">
        <span className="text-xs font-medium text-[#252B30]">Company overview</span>
        {!canApprove && (
          <span className="text-[11px] text-[#B77A1D] font-medium">View-Only Role</span>
        )}
      </div>

      {loading ? (
        <SkeletonList rows={6} />
      ) : (
        <div className="divide-y divide-[#D9DEE1]">
          {visibleCategories.map((cat) => {
            const count = cat.items.length;
            const actionableCount = cat.items.filter((i) => i.canCurrentUserApprove).length;
            const highlightRed = statusTab === 'PENDING' && actionableCount > 0;

            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  setActiveCategory(cat);
                  setLevel('CATEGORY_LIST');
                }}
                className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-[#F4F5F6] text-left transition-colors"
              >
                <span className="text-sm text-[#252B30]">{cat.label}</span>
                <span className="flex items-center gap-2">
                  <span
                    className={`text-sm tabular-nums ${
                      highlightRed ? 'font-semibold text-[#DB001B]' : 'font-normal text-[#68727A]'
                    }`}
                  >
                    {count}
                  </span>
                  <ChevronRight className="w-4 h-4 text-[#68727A]" aria-hidden="true" />
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div className="p-4 bg-[#F4F5F6] border-t border-[#D9DEE1] text-xs text-[#68727A] leading-relaxed">
        Please note: this is a summary of all outstanding authorisations across your business. Tap on a payment type to view all authorisations that require actions from you.
      </div>
    </div>
  );
};

const StepUpDecisionDialog: React.FC<{
  reviewAction: { ids: string[]; decision: 'APPROVED' | 'REJECTED' | 'SEND_TO_REPAIR' } | null;
  onClose: () => void;
  reviewItems: any[];
  comment: string;
  setComment: (v: string) => void;
  stepUpPin: string;
  setStepUpPin: (v: string) => void;
  actionLoading: boolean;
  actionError: string;
  executeDecision: (usePasskey?: boolean) => void;
}> = ({
  reviewAction,
  onClose,
  reviewItems,
  comment,
  setComment,
  stepUpPin,
  setStepUpPin,
  actionLoading,
  actionError,
  executeDecision,
}) => (
  <NativeDialog
    open={!!reviewAction}
    onClose={onClose}
    title={
      reviewAction?.decision === 'APPROVED'
        ? 'Re-authenticate & Authorise'
        : reviewAction?.decision === 'REJECTED'
        ? 'Confirm Payment Rejection'
        : 'Send Instruction to Repair'
    }
    subtitle="Review exact beneficiaries and amounts before confirming."
  >
    {reviewAction && (
      <div className="space-y-4 text-xs">
        <div className="divide-y divide-[#D9DEE1] border border-[#D9DEE1]">
          {reviewItems.map((item) => (
            <div key={item.id} className="p-3 flex items-center justify-between gap-3">
              <div>
                <div className="font-medium text-[#252B30]">{item.beneficiary_name}</div>
                <div className="text-[#68727A]">{item.reference}</div>
              </div>
              <div className="font-semibold text-[#252B30] tabular-nums">
                {formatFinancialCurrency(item.amount, item.currency)}
              </div>
            </div>
          ))}
        </div>

        <FormInput
          label={reviewAction.decision === 'SEND_TO_REPAIR' ? 'Repair Note' : 'Comment / Reason'}
          placeholder={reviewAction.decision === 'REJECTED' ? 'Specify rejection reason' : 'Optional note for initiator'}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />

        {reviewAction.decision === 'APPROVED' && (
          <div className="p-3.5 bg-[#F4F5F6] border border-[#D9DEE1] space-y-3">
            <div className="flex items-center gap-2 font-medium text-[#252B30]">
              <ShieldCheck className="w-4 h-4 text-[#DB001B]" aria-hidden="true" />
              <span>Step-Up Authentication Required</span>
            </div>
            <FormInput
              label="6-Digit Mobile Security PIN"
              type="password"
              inputMode="numeric"
              maxLength={6}
              placeholder="Enter 6-digit PIN"
              value={stepUpPin}
              onChange={(e) => setStepUpPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
            />
          </div>
        )}

        {actionError && (
          <div role="alert" className="p-3 bg-[#FDF2F3] border-l-4 border-[#C83A42] text-[#C83A42]">
            {actionError}
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {reviewAction.decision === 'APPROVED' && typeof window !== 'undefined' && !!window.PublicKeyCredential && (
            <Button variant="secondary" loading={actionLoading} onClick={() => executeDecision(true)}>
              <Fingerprint className="w-4 h-4" />
              Verify with Biometrics
            </Button>
          )}
          <Button
            variant={reviewAction.decision === 'REJECTED' ? 'danger' : 'primary'}
            loading={actionLoading}
            onClick={() => executeDecision(false)}
          >
            {reviewAction.decision === 'APPROVED'
              ? 'Continue & Authorise'
              : reviewAction.decision === 'REJECTED'
              ? 'Confirm Rejection'
              : 'Send to repair'}
          </Button>
        </div>
      </div>
    )}
  </NativeDialog>
);
