import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertOctagon,
  CheckCircle2,
  Clock,
  FileText,
  Search,
  Ship,
  XCircle,
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

export const TrackPage: React.FC = () => {
  const { activeOrg, hideBalances, hasPermission } = useAuth();
  const [tab, setTab] = useState<'PAYMENTS' | 'TRADE'>('PAYMENTS');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [tradeItems, setTradeItems] = useState<any[]>([]);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedPayment, setSelectedPayment] = useState<any | null>(null);
  const [selectedTrade, setSelectedTrade] = useState<any | null>(null);

  // Fraud Report Modal
  const [fraudTarget, setFraudTarget] = useState<any | null>(null);
  const [fraudReason, setFraudReason] = useState('');
  const [fraudDetails, setFraudDetails] = useState('');
  const [fraudResult, setFraudResult] = useState<string | null>(null);
  const [fraudLoading, setFraudLoading] = useState(false);

  const loadTrackData = useCallback(async () => {
    if (!activeOrg) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        orgId: activeOrg.id,
        ...(statusFilter !== 'ALL' ? { status: statusFilter } : {}),
        ...(search ? { search } : {}),
      });
      const payRes = await apiRequest<any>(`/api/corporate/payments?${params.toString()}`);
      setPayments(payRes.payments || []);

      if (hasPermission('ACCESS_TRADE_FINANCE')) {
        const trRes = await apiRequest<any>(`/api/corporate/trade?orgId=${encodeURIComponent(activeOrg.id)}`);
        setTradeItems(trRes.transactions || []);
      } else {
        setTradeItems([]);
      }
    } catch (err: any) {
      setError(err?.message || 'Unable to load tracking records.');
    } finally {
      setLoading(false);
    }
  }, [activeOrg, statusFilter, search, hasPermission]);

  useEffect(() => {
    loadTrackData();
  }, [loadTrackData]);

  const submitFraudReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fraudTarget || !activeOrg) return;
    setFraudLoading(true);
    try {
      const res = await apiRequest<any>(`/api/corporate/payments/${fraudTarget.id}/fraud-report`, {
        method: 'POST',
        body: JSON.stringify({ orgId: activeOrg.id, reason: fraudReason, details: fraudDetails }),
      });
      setFraudResult(res.message);
      setFraudReason('');
      setFraudDetails('');
    } catch (err: any) {
      setError(err?.message || 'Failed to submit fraud report.');
    } finally {
      setFraudLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="bg-white border border-[#D7D8D6] rounded-[2px] p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[#252525] tracking-tight">Track</h1>
          <p className="text-xs text-[#767676] mt-0.5">
            Real-time payment lifecycle timelines, fraud case reporting &amp; trade transaction tracker
          </p>
        </div>
        <div className="flex gap-1.5" role="tablist" aria-label="Tracking sections">
          <button
            role="tab"
            aria-selected={tab === 'PAYMENTS'}
            onClick={() => setTab('PAYMENTS')}
            className={`px-3.5 py-2 rounded-[2px] text-xs font-semibold ${
              tab === 'PAYMENTS' ? 'bg-[#252525] text-white' : 'bg-[#F4F4F4] text-[#555555]'
            }`}
          >
            Payment Tracking ({payments.length})
          </button>
          <button
            role="tab"
            aria-selected={tab === 'TRADE'}
            onClick={() => setTab('TRADE')}
            className={`px-3.5 py-2 rounded-[2px] text-xs font-semibold ${
              tab === 'TRADE' ? 'bg-[#252525] text-white' : 'bg-[#F4F4F4] text-[#555555]'
            }`}
          >
            Trade Tracker ({tradeItems.length})
          </button>
        </div>
      </div>

      {error && <ErrorBanner message={error} onRetry={loadTrackData} />}

      {tab === 'PAYMENTS' && (
        <SectionCard title="Payment Status &amp; Lifecycle" subtitle="Select any payment to view step-by-step clearing timeline">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <div className="relative sm:col-span-2">
              <Search className="w-4 h-4 text-[#767676] absolute left-3 top-3" />
              <input
                type="search"
                placeholder="Search reference, beneficiary, note..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full min-h-[42px] pl-9 pr-3 text-sm bg-white border border-[#9E9E9E] rounded-[2px]"
              />
            </div>
            <select
              aria-label="Filter payment status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="min-h-[42px] px-3 text-sm bg-white border border-[#9E9E9E] rounded-[2px]"
            >
              <option value="ALL">All Lifecycle Statuses</option>
              <option value="AWAITING_AUTHORISATION">Awaiting Authorisation</option>
              <option value="PARTIALLY_AUTHORISED">Partially Authorised</option>
              <option value="COMPLETED">Completed</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>

          {loading ? (
            <SkeletonList rows={4} />
          ) : payments.length === 0 ? (
            <EmptyState title="No matching payments" description="No tracked payments match your filters in the supported tracking period." />
          ) : (
            <div className="divide-y divide-[#D7D8D6]">
              {payments.map((p) => (
                <div
                  key={p.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedPayment(p)}
                  onKeyDown={(e) => e.key === 'Enter' && setSelectedPayment(p)}
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#FAFAFA] px-2 -mx-2 rounded cursor-pointer"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-[#252525]">{p.beneficiary_name}</span>
                      <StatusBadge status={p.status} />
                    </div>
                    <div className="text-xs text-[#767676] mt-1">
                      {p.reference} • {p.debit_account_name} &rarr; {p.destination_country} • Updated {formatDateTime(p.updated_at || p.created_at)}
                    </div>
                  </div>
                  <div className="text-left sm:text-right">
                    <div className="text-sm font-bold text-[#252525] tabular-nums">
                      {formatFinancialCurrency(p.amount, p.currency, hideBalances)}
                    </div>
                    <div className="text-[11px] text-[#DB0011] font-medium">View timeline &rarr;</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      )}

      {tab === 'TRADE' && (
        <SectionCard title="Trade Transaction Tracker" subtitle="Documentary credits, amendments, and import bills">
          {!hasPermission('ACCESS_TRADE_FINANCE') ? (
            <EmptyState title="Trade Tracking Restricted" description="Your role does not include ACCESS_TRADE_FINANCE permission." />
          ) : tradeItems.length === 0 ? (
            <EmptyState title="No trade transactions" description="No active documentary trade items for this entity." />
          ) : (
            <div className="divide-y divide-[#D7D8D6]">
              {tradeItems.map((t) => (
                <div
                  key={t.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedTrade(t)}
                  onKeyDown={(e) => e.key === 'Enter' && setSelectedTrade(t)}
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#FAFAFA] px-2 -mx-2 rounded cursor-pointer"
                >
                  <div className="flex items-start gap-3">
                    <Ship className="w-4 h-4 text-[#252525] mt-1 shrink-0" />
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-[#252525]">{t.counterparty}</span>
                        <StatusBadge status={t.status} />
                      </div>
                      <div className="text-xs text-[#767676] mt-0.5">
                        {t.reference} • {t.direction} • {t.trade_category.replace(/_/g, ' ')} • {t.pending_action}
                      </div>
                    </div>
                  </div>
                  <div className="text-left sm:text-right">
                    <div className="text-sm font-bold text-[#252525] tabular-nums">
                      {formatFinancialCurrency(t.amount, t.currency, hideBalances)}
                    </div>
                    <div className="text-[11px] text-[#767676]">{t.documents?.length || 0} Document(s)</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      )}

      {/* Payment Timeline & Fraud Report Trigger Modal */}
      <NativeDialog
        open={!!selectedPayment}
        onClose={() => setSelectedPayment(null)}
        title="Payment Lifecycle Timeline"
        subtitle={selectedPayment?.reference}
      >
        {selectedPayment && (
          <div className="space-y-4 text-xs">
            <div className="p-3.5 rounded-[2px] bg-[#F4F4F4] border border-[#D7D8D6] flex justify-between items-center">
              <div>
                <div className="font-semibold text-[#252525]">{selectedPayment.beneficiary_name}</div>
                <div className="text-[#767676]">{selectedPayment.beneficiary_bank} ({selectedPayment.destination_country})</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-[#252525] tabular-nums">
                  {formatFinancialCurrency(selectedPayment.amount, selectedPayment.currency, hideBalances)}
                </div>
                <StatusBadge status={selectedPayment.status} />
              </div>
            </div>

            <ol className="space-y-3 border-l-2 border-[#D7D8D6] ml-2.5 pl-4">
              {(selectedPayment.timeline || []).map((ev: any) => (
                <li key={ev.id} className="relative">
                  <span className="absolute -left-[23px] top-0.5 bg-white">
                    {ev.state === 'COMPLETED' ? (
                      <CheckCircle2 className="w-4 h-4 text-[#008A52]" />
                    ) : ev.state === 'FAILED' ? (
                      <XCircle className="w-4 h-4 text-[#B0000D]" />
                    ) : (
                      <Clock className="w-4 h-4 text-[#252525]" />
                    )}
                  </span>
                  <div className="font-semibold text-[#252525]">{ev.label}</div>
                  <div className="text-[#555555] mt-0.5">{ev.description}</div>
                  <div className="text-[11px] text-[#767676] mt-0.5">{formatDateTime(ev.timestamp)}</div>
                </li>
              ))}
            </ol>

            <div className="pt-3 border-t border-[#D7D8D6] flex justify-between items-center">
              <Button
                size="sm"
                variant="danger"
                onClick={() => {
                  const target = selectedPayment;
                  setSelectedPayment(null);
                  setFraudResult(null);
                  setFraudTarget(target);
                }}
              >
                <AlertOctagon className="w-3.5 h-3.5" />
                Report Payment as Fraud
              </Button>
              <Button size="sm" variant="outline" onClick={() => setSelectedPayment(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </NativeDialog>

      {/* Trade Timeline Modal */}
      <NativeDialog
        open={!!selectedTrade}
        onClose={() => setSelectedTrade(null)}
        title="Trade Transaction Details"
        subtitle={selectedTrade?.reference}
      >
        {selectedTrade && (
          <div className="space-y-4 text-xs">
            <div className="p-3.5 rounded-[2px] bg-[#F4F4F4] border border-[#D7D8D6]">
              <div className="font-semibold text-[#252525]">{selectedTrade.counterparty}</div>
              <div className="text-[#767676] mt-0.5">
                {selectedTrade.direction} • {selectedTrade.trade_category.replace(/_/g, ' ')} •{' '}
                <strong className="text-[#252525]">{formatFinancialCurrency(selectedTrade.amount, selectedTrade.currency, hideBalances)}</strong>
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-[#252525] mb-2">Timeline</h3>
              <ul className="space-y-2 border-l-2 border-[#D7D8D6] ml-2 pl-4">
                {(selectedTrade.timeline || []).map((ev: any) => (
                  <li key={ev.id}>
                    <div className="font-semibold text-[#252525]">{ev.label}</div>
                    <div className="text-[#555555]">{ev.description}</div>
                    <div className="text-[11px] text-[#767676]">{formatDateTime(ev.timestamp)}</div>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-[#252525] mb-2">Supporting Documents</h3>
              <ul className="space-y-1.5">
                {(selectedTrade.documents || []).map((doc: any) => (
                  <li key={doc.id} className="p-2 rounded border border-[#D7D8D6] flex items-center justify-between">
                    <span className="flex items-center gap-2 font-medium text-[#252525]">
                      <FileText className="w-3.5 h-3.5 text-[#252525]" />
                      {doc.name}
                    </span>
                    <span className="text-[#767676]">{doc.size}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </NativeDialog>

      {/* Fraud Reporting Modal */}
      <NativeDialog
        open={!!fraudTarget}
        onClose={() => setFraudTarget(null)}
        title="Report Payment as Fraud"
        subtitle={`Reference: ${fraudTarget?.reference}`}
      >
        {fraudTarget && (
          <form onSubmit={submitFraudReport} className="space-y-4 text-xs">
            <p className="text-[#555555] leading-relaxed">
              Logs a formal fraud investigation case in the HSBC Cnet backend case-management workflow. (Sandbox environment: does not transmit to an external bank fraud desk.)
            </p>
            <FormInput
              label="Primary Reason"
              required
              requiredMark
              placeholder="e.g. Unauthorised beneficiary modification / BEC suspicion"
              value={fraudReason}
              onChange={(e) => setFraudReason(e.target.value)}
            />
            <FormInput
              label="Additional Evidence / Context"
              placeholder="Optional supporting details"
              value={fraudDetails}
              onChange={(e) => setFraudDetails(e.target.value)}
            />
            {fraudResult && (
              <div className="p-3 rounded bg-[#EBF7F0] border border-[#B7E1CD] text-[#008A52] font-medium">{fraudResult}</div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setFraudTarget(null)}>Cancel</Button>
              <Button type="submit" variant="danger" loading={fraudLoading}>Submit Fraud Case</Button>
            </div>
          </form>
        )}
      </NativeDialog>
    </div>
  );
};
