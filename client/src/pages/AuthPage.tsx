import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Fingerprint,
  ShieldCheck,
  XCircle,
  MessageSquare,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';
import { formatDateTime, formatFinancialCurrency } from '@shared/utils/formatters';
import {
  Button,
  EmptyState,
  ErrorBanner,
  FormInput,
  NativeDialog,
  SectionCard,
  SkeletonList,
  StatusBadge,
} from '../components/ui/Primitives';
import { parseRequestOptions, serializeCredential } from '../lib/webauthn';

export const AuthPage: React.FC = () => {
  const { activeOrg, hideBalances, hasPermission } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [instructions, setInstructions] = useState<any[]>([]);
  const [tradeItems, setTradeItems] = useState<any[]>([]);

  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [tab, setTab] = useState<'PENDING' | 'RECENT' | 'REJECTED' | 'TRADE'>('PENDING');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [detailItem, setDetailItem] = useState<any | null>(null);

  // Review & Step-Up Authentication Modal
  const [reviewAction, setReviewAction] = useState<{ ids: string[]; decision: 'APPROVED' | 'REJECTED' | 'INFO_REQUESTED' } | null>(null);
  const [comment, setComment] = useState('');
  const [stepUpPin, setStepUpPin] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionResult, setActionResult] = useState<{ success: boolean; message: string } | null>(null);

  const loadAuthQueue = useCallback(async () => {
    if (!activeOrg) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest<any>(`/api/corporate/authorisations?orgId=${encodeURIComponent(activeOrg.id)}`);
      setInstructions(res.instructions || []);
      setTradeItems(res.tradeItems || []);
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

  const pendingList = useMemo(
    () => instructions.filter((i) => ['AWAITING_AUTHORISATION', 'PARTIALLY_AUTHORISED'].includes(i.status)),
    [instructions]
  );
  const recentList = useMemo(
    () => instructions.filter((i) => ['AUTHORISED', 'COMPLETED', 'PROCESSING', 'SENT'].includes(i.status)),
    [instructions]
  );
  const rejectedList = useMemo(
    () => instructions.filter((i) => i.status === 'REJECTED'),
    [instructions]
  );
  const expiringCount = useMemo(
    () =>
      pendingList.filter((i) => i.expires_at && new Date(i.expires_at).getTime() - Date.now() < 12 * 3600 * 1000).length,
    [pendingList]
  );

  const activeList = useMemo(() => {
    const base = tab === 'PENDING' ? pendingList : tab === 'RECENT' ? recentList : rejectedList;
    if (categoryFilter === 'ALL') return base;
    return base.filter((i) => i.category === categoryFilter);
  }, [tab, pendingList, recentList, rejectedList, categoryFilter]);

  const categories = useMemo(() => Array.from(new Set(instructions.map((i) => i.category))), [instructions]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const executeDecision = async (usePasskey = false) => {
    if (!reviewAction || !activeOrg) return;
    setActionLoading(true);
    setActionResult(null);
    try {
      let reauthToken: string | undefined;
      if (usePasskey) {
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
      const errMsg = (res.errors || []).map((e: any) => `${e.reference || e.id}: ${e.error}`).join('; ');
      setActionResult({
        success: okCount > 0,
        message: `${okCount} instruction(s) updated.${errMsg ? ` Skipped/Rejected: ${errMsg}` : ''}`,
      });
      setStepUpPin('');
      setComment('');
      await loadAuthQueue();
    } catch (err: any) {
      setActionResult({ success: false, message: err?.message || 'Authorisation decision failed.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleTradeDecision = async (tradeId: string, decision: 'APPROVED' | 'REJECTED') => {
    if (!activeOrg) return;
    try {
      await apiRequest(`/api/corporate/trade/${tradeId}/decide`, {
        method: 'POST',
        body: JSON.stringify({ orgId: activeOrg.id, decision, comment: `${decision} from Auth Centre` }),
      });
      await loadAuthQueue();
    } catch (err: any) {
      setError(err?.message || 'Trade decision failed.');
    }
  };

  const canApprove = hasPermission('APPROVE_PAYMENTS');
  const canReject = hasPermission('REJECT_PAYMENTS');

  const reviewItems = useMemo(
    () => (reviewAction ? instructions.filter((i) => reviewAction.ids.includes(i.id)) : []),
    [reviewAction, instructions]
  );

  return (
    <div className="space-y-5">
      {/* Header & KPI Strip */}
      <div className="bg-white border border-[#D7D8D6] rounded-[2px] p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-[#252525] tracking-tight">Payment Authorisations</h1>
            <p className="text-xs text-[#767676] mt-0.5">
              Backend-enforced maker-checker policy &amp; multi-level corporate approval queue for {activeOrg?.name}
            </p>
          </div>
          {!canApprove && (
            <span className="text-xs font-medium px-2.5 py-1 rounded bg-[#FEF7EC] border border-[#FCD9A5] text-[#9A4A06]">
              View-Only Access (Approver permission required)
            </span>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-3 rounded-[2px] bg-[#F4F4F4] border border-[#D7D8D6]">
            <div className="text-[11px] text-[#767676] uppercase font-semibold">Pending Approvals</div>
            <div className="text-xl font-bold text-[#252525] tabular-nums mt-1">{pendingList.length}</div>
          </div>
          <div className="p-3 rounded-[2px] bg-[#F4F4F4] border border-[#D7D8D6]">
            <div className="text-[11px] text-[#767676] uppercase font-semibold">Expiring (&lt; 12h)</div>
            <div className="text-xl font-bold text-[#DB0011] tabular-nums mt-1">{expiringCount}</div>
          </div>
          <div className="p-3 rounded-[2px] bg-[#F4F4F4] border border-[#D7D8D6]">
            <div className="text-[11px] text-[#767676] uppercase font-semibold">Recently Authorised</div>
            <div className="text-xl font-bold text-[#008A52] tabular-nums mt-1">{recentList.length}</div>
          </div>
          <div className="p-3 rounded-[2px] bg-[#F4F4F4] border border-[#D7D8D6]">
            <div className="text-[11px] text-[#767676] uppercase font-semibold">Rejected</div>
            <div className="text-xl font-bold text-[#B0000D] tabular-nums mt-1">{rejectedList.length}</div>
          </div>
        </div>
      </div>

      {error && <ErrorBanner message={error} onRetry={loadAuthQueue} />}

      <SectionCard noPadding>
        {/* Tabs & Category Filter */}
        <div className="p-4 border-b border-[#D7D8D6] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1" role="tablist" aria-label="Authorisation categories">
            {(
              [
                { id: 'PENDING', label: `Pending (${pendingList.length})` },
                { id: 'RECENT', label: `Authorised (${recentList.length})` },
                { id: 'REJECTED', label: `Rejected (${rejectedList.length})` },
                ...(hasPermission('ACCESS_TRADE_FINANCE') ? [{ id: 'TRADE', label: `Trade (${tradeItems.filter((t) => t.status === 'AWAITING_AUTHORISATION').length})` }] : []),
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id as any)}
                className={`px-3 py-1.5 rounded-[2px] text-xs font-semibold transition-colors ${
                  tab === t.id ? 'bg-[#252525] text-white' : 'text-[#555555] hover:bg-[#EBEBEB]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab !== 'TRADE' && (
            <select
              aria-label="Filter by payment category"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="min-h-[38px] px-3 text-xs bg-white border border-[#9E9E9E] rounded-[2px]"
            >
              <option value="ALL">All Payment Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Bulk Action Bar */}
        {tab === 'PENDING' && selectedIds.length > 0 && (
          <div className="px-4 py-2.5 bg-[#F4F4F4] border-b border-[#D7D8D6] flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-[#252525]">{selectedIds.length} instruction(s) selected</span>
            <div className="flex items-center gap-2">
              {canApprove && (
                <Button
                  size="sm"
                  onClick={() => {
                    setActionResult(null);
                    setReviewAction({ ids: selectedIds, decision: 'APPROVED' });
                  }}
                >
                  Bulk Authorise
                </Button>
              )}
              {canReject && (
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => {
                    setActionResult(null);
                    setReviewAction({ ids: selectedIds, decision: 'REJECTED' });
                  }}
                >
                  Bulk Reject
                </Button>
              )}
            </div>
          </div>
        )}

        <div className="p-4">
          {loading ? (
            <SkeletonList rows={4} />
          ) : tab === 'TRADE' ? (
            tradeItems.length === 0 ? (
              <EmptyState title="No trade authorisations" description="No documentary credits or trade instructions pending." />
            ) : (
              <div className="divide-y divide-[#D7D8D6]">
                {tradeItems.map((tr) => (
                  <div key={tr.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-[#252525]">{tr.counterparty}</span>
                        <StatusBadge status={tr.status} />
                      </div>
                      <div className="text-xs text-[#767676] mt-0.5">
                        {tr.reference} • {tr.trade_category.replace(/_/g, ' ')} • {tr.pending_action}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-[#252525] tabular-nums">
                        {formatFinancialCurrency(tr.amount, tr.currency, hideBalances)}
                      </span>
                      {tr.status === 'AWAITING_AUTHORISATION' && canApprove && (
                        <>
                          <Button size="sm" onClick={() => handleTradeDecision(tr.id, 'APPROVED')}>
                            Authorise
                          </Button>
                          <Button size="sm" variant="danger" onClick={() => handleTradeDecision(tr.id, 'REJECTED')}>
                            Reject
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : activeList.length === 0 ? (
            <EmptyState
              title="No instructions in this view"
              description="There are no payment authorisations matching the current status or category."
            />
          ) : (
            <div className="divide-y divide-[#D7D8D6]">
              {activeList.map((item) => {
                const checked = selectedIds.includes(item.id);
                const isExpiring = item.expires_at && new Date(item.expires_at).getTime() - Date.now() < 12 * 3600 * 1000;
                return (
                  <div key={item.id} className="py-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      {tab === 'PENDING' && item.canCurrentUserApprove && (
                        <input
                          type="checkbox"
                          aria-label={`Select ${item.reference}`}
                          checked={checked}
                          onChange={() => toggleSelect(item.id)}
                          className="mt-1 w-4 h-4 accent-[#DB0011]"
                        />
                      )}
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-[#252525]">{item.beneficiary_name}</span>
                          <StatusBadge status={item.status} />
                          {isExpiring && tab === 'PENDING' && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#9A4A06] bg-[#FEF7EC] border border-[#FCD9A5] px-1.5 py-0.5 rounded">
                              <Clock className="w-3 h-3" /> Expiring Soon
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-[#767676] mt-1">
                          {item.reference} • {item.category.replace(/_/g, ' ')} • Initiator: {item.initiator_name} • Approvals:{' '}
                          <strong className="text-[#252525]">
                            {item.current_approvals}/{item.required_approvals}
                          </strong>
                        </div>
                        {item.unusualFlags?.length > 0 && (
                          <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-[#9A4A06] font-medium">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                            <span>{item.unusualFlags.join(' • ')}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between lg:justify-end gap-2.5 pl-7 lg:pl-0">
                      <div className="text-left lg:text-right mr-2">
                        <div className="text-sm font-bold text-[#252525] tabular-nums">
                          {formatFinancialCurrency(item.amount, item.currency, hideBalances)}
                        </div>
                        <div className="text-[11px] text-[#767676]">{item.debit_account_name}</div>
                      </div>

                      <Button size="sm" variant="outline" onClick={() => setDetailItem(item)}>
                        View Details
                      </Button>

                      {tab === 'PENDING' && canApprove && (
                        <Button
                          size="sm"
                          disabled={!item.canCurrentUserApprove}
                          onClick={() => {
                            setActionResult(null);
                            setReviewAction({ ids: [item.id], decision: 'APPROVED' });
                          }}
                        >
                          {item.canCurrentUserApprove ? 'Authorise' : 'Maker/Approved'}
                        </Button>
                      )}
                      {tab === 'PENDING' && canReject && (
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => {
                            setActionResult(null);
                            setReviewAction({ ids: [item.id], decision: 'REJECTED' });
                          }}
                        >
                          Reject
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </SectionCard>

      {/* Instruction Details Dialog */}
      <NativeDialog
        open={!!detailItem}
        onClose={() => setDetailItem(null)}
        title="Authorisation Instruction Details"
        subtitle={detailItem?.reference}
      >
        {detailItem && (
          <div className="space-y-4 text-xs">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-[#F4F4F4] rounded-[2px] border border-[#D7D8D6]">
              <div>
                <dt className="text-[#767676]">Beneficiary</dt>
                <dd className="font-semibold text-[#252525] mt-0.5">{detailItem.beneficiary_name}</dd>
                <dd className="text-[#767676] tabular-nums">{detailItem.beneficiary_account}</dd>
              </div>
              <div>
                <dt className="text-[#767676]">Amount &amp; FX</dt>
                <dd className="font-bold text-[#252525] text-sm tabular-nums mt-0.5">
                  {formatFinancialCurrency(detailItem.amount, detailItem.currency, hideBalances)}
                </dd>
                <dd className="text-[#767676]">Rate: {detailItem.exchange_rate} • Charges: {detailItem.charges_bearer}</dd>
              </div>
              <div>
                <dt className="text-[#767676]">Debit Account</dt>
                <dd className="font-medium text-[#252525] mt-0.5">{detailItem.debit_account_name} ({detailItem.debit_currency})</dd>
              </div>
              <div>
                <dt className="text-[#767676]">Destination Bank</dt>
                <dd className="font-medium text-[#252525] mt-0.5">{detailItem.beneficiary_bank} ({detailItem.destination_country})</dd>
                <dd className="text-[#767676]">SWIFT: {detailItem.swift_bic || 'N/A'}</dd>
              </div>
              <div>
                <dt className="text-[#767676]">Initiator &amp; Purpose</dt>
                <dd className="font-medium text-[#252525] mt-0.5">{detailItem.initiator_name} • {detailItem.payment_purpose}</dd>
              </div>
              <div>
                <dt className="text-[#767676]">Created</dt>
                <dd className="font-medium text-[#252525] mt-0.5">{formatDateTime(detailItem.created_at)}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-[#767676]">Reference Note</dt>
                <dd className="font-medium text-[#252525] mt-0.5">{detailItem.reference_note}</dd>
              </div>
            </dl>

            <div>
              <h3 className="font-semibold text-[#252525] mb-2">Approval History ({detailItem.current_approvals}/{detailItem.required_approvals})</h3>
              {detailItem.approvalHistory?.length === 0 ? (
                <p className="text-[#767676]">No approvals recorded yet.</p>
              ) : (
                <ul className="space-y-2">
                  {detailItem.approvalHistory.map((h: any, idx: number) => (
                    <li key={idx} className="p-2.5 rounded border border-[#D7D8D6] flex justify-between gap-2">
                      <div>
                        <span className="font-semibold text-[#252525]">{h.approverName}</span> ({h.approverRole}) — {h.decision}
                        {h.comment && <div className="text-[#767676] mt-0.5">{h.comment}</div>}
                      </div>
                      <span className="text-[#767676] shrink-0">{formatDateTime(h.timestamp)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {['AWAITING_AUTHORISATION', 'PARTIALLY_AUTHORISED'].includes(detailItem.status) && canApprove && (
              <div className="flex flex-wrap gap-2 pt-2 border-t border-[#D7D8D6]">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const id = detailItem.id;
                    setDetailItem(null);
                    setActionResult(null);
                    setReviewAction({ ids: [id], decision: 'INFO_REQUESTED' });
                  }}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  Request Information
                </Button>
              </div>
            )}
          </div>
        )}
      </NativeDialog>

      {/* Mandatory Review + Step-Up Re-Authentication Modal */}
      <NativeDialog
        open={!!reviewAction}
        onClose={() => setReviewAction(null)}
        title={
          reviewAction?.decision === 'APPROVED'
            ? 'Review & Authorise Payment(s)'
            : reviewAction?.decision === 'REJECTED'
            ? 'Confirm Payment Rejection'
            : 'Request Supporting Information'
        }
        subtitle="Verify exact beneficiaries and amounts before recording your decision."
      >
        {reviewAction && (
          <div className="space-y-4 text-xs">
            <div className="divide-y divide-[#D7D8D6] border border-[#D7D8D6] rounded-[2px]">
              {reviewItems.map((item) => (
                <div key={item.id} className="p-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-[#252525]">{item.beneficiary_name}</div>
                    <div className="text-[#767676]">{item.reference} • {item.beneficiary_bank}</div>
                    {item.unusualFlags?.length > 0 && (
                      <div className="text-[#9A4A06] font-medium mt-0.5">{item.unusualFlags[0]}</div>
                    )}
                  </div>
                  <div className="font-bold text-sm text-[#252525] tabular-nums">
                    {formatFinancialCurrency(item.amount, item.currency)}
                  </div>
                </div>
              ))}
            </div>

            <FormInput
              label="Decision Note / Audit Comment"
              placeholder={reviewAction.decision === 'REJECTED' ? 'Specify rejection reason' : 'Optional audit note'}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />

            {reviewAction.decision === 'APPROVED' && (
              <div className="p-3.5 rounded-[2px] bg-[#F4F4F4] border border-[#D7D8D6] space-y-3">
                <div className="flex items-center gap-2 font-semibold text-[#252525]">
                  <ShieldCheck className="w-4 h-4 text-[#DB0011]" aria-hidden="true" />
                  <span>Step-Up Re-Authentication Required</span>
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

            {actionResult && (
              <div
                role="status"
                className={`p-3 rounded-[2px] border flex items-center gap-2 ${
                  actionResult.success
                    ? 'bg-[#EBF7F0] border-[#B7E1CD] text-[#008A52]'
                    : 'bg-[#FDF2F2] border-[#F5C2C7] text-[#B0000D]'
                }`}
              >
                {actionResult.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
                <span>{actionResult.message}</span>
              </div>
            )}

            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setReviewAction(null)}>
                Close
              </Button>
              {reviewAction.decision === 'APPROVED' && typeof window !== 'undefined' && !!window.PublicKeyCredential && (
                <Button variant="secondary" loading={actionLoading} onClick={() => executeDecision(true)}>
                  <Fingerprint className="w-4 h-4" />
                  Verify via Passkey
                </Button>
              )}
              <Button
                variant={reviewAction.decision === 'REJECTED' ? 'danger' : 'primary'}
                loading={actionLoading}
                onClick={() => executeDecision(false)}
              >
                Confirm {reviewAction.decision === 'APPROVED' ? 'Authorisation' : reviewAction.decision === 'REJECTED' ? 'Rejection' : 'Request'}
              </Button>
            </div>
          </div>
        )}
      </NativeDialog>
    </div>
  );
};
