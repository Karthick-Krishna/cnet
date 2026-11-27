import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertOctagon,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  Search,
  Ship,
  XCircle,
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

export const TrackPage: React.FC = () => {
  const { activeOrg, hideBalances, hasPermission } = useAuth();
  const [tab, setTab] = useState<'PAYMENTS' | 'TRADE'>('PAYMENTS');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [tradeItems, setTradeItems] = useState<any[]>([]);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [dateFrom, setDateFrom] = useState('');

  const [selectedPayment, setSelectedPayment] = useState<any | null>(null);
  const [selectedTrade, setSelectedTrade] = useState<any | null>(null);

  // Fraud Report Modal
  const [fraudTarget, setFraudTarget] = useState<any | null>(null);
  const [fraudReason, setFraudReason] = useState('');
  const [fraudDetails, setFraudDetails] = useState('');
  const [fraudConfirmChecked, setFraudConfirmChecked] = useState(false);
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
        ...(dateFrom ? { dateFrom } : {}),
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
  }, [activeOrg, statusFilter, search, dateFrom, hasPermission]);

  useEffect(() => {
    loadTrackData();
  }, [loadTrackData]);

  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      if (typeFilter !== 'ALL' && p.category !== typeFilter) return false;
      return true;
    });
  }, [payments, typeFilter]);

  const submitFraudReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fraudTarget || !activeOrg || !fraudConfirmChecked) return;
    setFraudLoading(true);
    try {
      const res = await apiRequest<any>(`/api/corporate/payments/${fraudTarget.id}/fraud-report`, {
        method: 'POST',
        body: JSON.stringify({ orgId: activeOrg.id, reason: fraudReason, details: fraudDetails }),
      });
      setFraudResult(res.message);
      setFraudReason('');
      setFraudDetails('');
      setFraudConfirmChecked(false);
    } catch (err: any) {
      setError(err?.message || 'Failed to submit fraud report.');
    } finally {
      setFraudLoading(false);
    }
  };

  // Detailed Payment View
  if (selectedPayment) {
    return (
      <div className="bg-white md:border md:border-[#D9DEE1]">
        <BankingHeader
          title="Payment Status"
          onBack={() => setSelectedPayment(null)}
          subHeader={selectedPayment.reference}
        />

        <div className="px-4 py-4 border-b border-[#D9DEE1] flex items-start justify-between gap-3">
          <div>
            <div className="text-base font-medium text-[#252B30]">{selectedPayment.beneficiary_name}</div>
            <div className="text-xs text-[#68727A] mt-0.5">
              {selectedPayment.beneficiary_bank} ({selectedPayment.destination_country})
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-semibold text-[#252B30] tabular-nums">
              {formatFinancialCurrency(selectedPayment.amount, selectedPayment.currency, hideBalances)}
            </div>
            <div className="mt-1">
              <StatusBadge status={selectedPayment.status} />
            </div>
          </div>
        </div>

        <dl className="divide-y divide-[#D9DEE1] text-xs">
          <div className="px-4 py-3 flex justify-between"><dt className="text-[#68727A]">Reference</dt><dd className="font-medium tabular-nums">{selectedPayment.reference}</dd></div>
          <div className="px-4 py-3 flex justify-between"><dt className="text-[#68727A]">Debit account</dt><dd className="font-medium">{selectedPayment.debit_account_name}</dd></div>
          <div className="px-4 py-3 flex justify-between"><dt className="text-[#68727A]">Payment type</dt><dd className="font-medium">{selectedPayment.category?.replace(/_/g, ' ')}</dd></div>
          <div className="px-4 py-3 flex justify-between"><dt className="text-[#68727A]">Date</dt><dd className="font-medium">{formatDateTime(selectedPayment.created_at)}</dd></div>
        </dl>

        <div className="p-4 border-t border-[#D9DEE1] bg-[#F4F5F6]">
          <div className="text-xs font-semibold uppercase tracking-wide text-[#68727A] mb-3">Transaction Timeline</div>
          <ol className="space-y-3 border-l-2 border-[#D9DEE1] ml-2 pl-4 text-xs">
            {(selectedPayment.timeline || []).map((ev: any) => (
              <li key={ev.id} className="relative">
                <span className="absolute -left-[23px] top-0.5 bg-[#F4F5F6]">
                  {ev.state === 'COMPLETED' ? (
                    <CheckCircle2 className="w-4 h-4 text-[#27835B]" />
                  ) : ev.state === 'FAILED' ? (
                    <XCircle className="w-4 h-4 text-[#C83A42]" />
                  ) : (
                    <Clock className="w-4 h-4 text-[#263640]" />
                  )}
                </span>
                <div className="font-medium text-[#252B30]">{ev.label}</div>
                <div className="text-[#68727A] mt-0.5">{ev.description}</div>
                <div className="text-[11px] text-[#68727A] mt-0.5">{formatDateTime(ev.timestamp)}</div>
              </li>
            ))}
          </ol>
        </div>

        <div className="p-4 border-t border-[#D9DEE1]">
          <Button
            fullWidth
            variant="danger"
            onClick={() => {
              setFraudResult(null);
              setFraudConfirmChecked(false);
              setFraudTarget(selectedPayment);
            }}
          >
            <AlertOctagon className="w-4 h-4" aria-hidden="true" />
            Report payment as fraud
          </Button>
        </div>

        {/* Fraud Reporting Modal */}
        <NativeDialog
          open={!!fraudTarget}
          onClose={() => setFraudTarget(null)}
          title="Report Payment as Fraud"
          subtitle={`Reference: ${fraudTarget?.reference}`}
        >
          {fraudTarget && (
            <form onSubmit={submitFraudReport} className="space-y-4 text-xs">
              <p className="text-[#68727A] leading-relaxed">
                Submitting this report opens an internal fraud investigation case in the HSBC Cnet backend case registry. (Sandbox demonstration: no external bank fraud operations desk is connected.)
              </p>
              <FormInput
                label="Reason for fraud report"
                required
                requiredMark
                placeholder="e.g. Unauthorised instruction or suspected invoice compromise"
                value={fraudReason}
                onChange={(e) => setFraudReason(e.target.value)}
              />
              <FormInput
                label="Additional details (optional)"
                value={fraudDetails}
                onChange={(e) => setFraudDetails(e.target.value)}
              />
              <label className="flex items-start gap-2.5 p-3 bg-[#F4F5F6] border border-[#D9DEE1] text-xs">
                <input
                  type="checkbox"
                  required
                  checked={fraudConfirmChecked}
                  onChange={(e) => setFraudConfirmChecked(e.target.checked)}
                  className="mt-0.5 accent-[#DB001B]"
                />
                <span>I confirm this payment is suspected to be fraudulent and understand investigation actions will be logged.</span>
              </label>
              {fraudResult && (
                <div className="p-3 bg-[#ECF6F1] border border-[#B7DFCC] text-[#27835B] font-medium">{fraudResult}</div>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setFraudTarget(null)}>Cancel</Button>
                <Button type="submit" variant="primary" disabled={!fraudConfirmChecked} loading={fraudLoading}>
                  Submit fraud report
                </Button>
              </div>
            </form>
          )}
        </NativeDialog>
      </div>
    );
  }

  // Trade Detail Sub-View
  if (selectedTrade) {
    return (
      <div className="bg-white md:border md:border-[#D9DEE1]">
        <BankingHeader title="Trade Transaction Tracker" onBack={() => setSelectedTrade(null)} subHeader={selectedTrade.reference} />
        <div className="px-4 py-4 border-b border-[#D9DEE1] flex justify-between items-start gap-3">
          <div>
            <div className="text-base font-medium text-[#252B30]">{selectedTrade.counterparty}</div>
            <div className="text-xs text-[#68727A] mt-0.5">{selectedTrade.trade_category.replace(/_/g, ' ')} • {selectedTrade.direction}</div>
          </div>
          <div className="text-right">
            <div className="text-lg font-semibold text-[#252B30] tabular-nums">{formatFinancialCurrency(selectedTrade.amount, selectedTrade.currency, hideBalances)}</div>
            <div className="mt-1"><StatusBadge status={selectedTrade.status} /></div>
          </div>
        </div>
        <div className="p-4 border-b border-[#D9DEE1]">
          <div className="text-xs font-semibold uppercase tracking-wide text-[#68727A] mb-3">Timeline</div>
          <ul className="space-y-2.5 border-l-2 border-[#D9DEE1] ml-2 pl-4 text-xs">
            {(selectedTrade.timeline || []).map((ev: any) => (
              <li key={ev.id}>
                <div className="font-medium text-[#252B30]">{ev.label}</div>
                <div className="text-[#68727A]">{ev.description}</div>
                <div className="text-[11px] text-[#68727A]">{formatDateTime(ev.timestamp)}</div>
              </li>
            ))}
          </ul>
        </div>
        <div className="p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-[#68727A] mb-2">Documents</div>
          <div className="divide-y divide-[#D9DEE1] border border-[#D9DEE1] text-xs">
            {(selectedTrade.documents || []).map((doc: any) => (
              <div key={doc.id} className="p-3 flex items-center justify-between">
                <span className="flex items-center gap-2 text-[#252B30]"><FileText className="w-4 h-4 text-[#263640]" /> {doc.name}</span>
                <span className="text-[#68727A]">{doc.size}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white md:border md:border-[#D9DEE1]">
      <GeometricHeader title="Track" subtitle={activeOrg?.name} />

      <div className="grid grid-cols-2 border-b border-[#D9DEE1] bg-white text-xs font-medium" role="tablist">
        <button
          role="tab"
          aria-selected={tab === 'PAYMENTS'}
          onClick={() => setTab('PAYMENTS')}
          className={`py-3 text-center border-b-[2px] ${
            tab === 'PAYMENTS' ? 'border-[#DB001B] text-[#252B30] font-semibold' : 'border-transparent text-[#68727A]'
          }`}
        >
          Payments ({filteredPayments.length})
        </button>
        <button
          role="tab"
          aria-selected={tab === 'TRADE'}
          onClick={() => setTab('TRADE')}
          className={`py-3 text-center border-b-[2px] ${
            tab === 'TRADE' ? 'border-[#DB001B] text-[#252B30] font-semibold' : 'border-transparent text-[#68727A]'
          }`}
        >
          Trade Tracker ({tradeItems.length})
        </button>
      </div>

      {error && (
        <div className="p-4">
          <ErrorBanner message={error} onRetry={loadTrackData} />
        </div>
      )}

      {tab === 'PAYMENTS' && (
        <div>
          <search className="p-4 bg-[#F4F5F6] border-b border-[#D9DEE1] grid grid-cols-1 sm:grid-cols-4 gap-2.5">
            <div className="relative sm:col-span-2">
              <Search className="w-4 h-4 text-[#68727A] absolute left-3 top-3" aria-hidden="true" />
              <input
                type="search"
                placeholder="Search reference, beneficiary..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full min-h-[40px] pl-9 pr-3 text-xs bg-white border border-[#B4BCC2] rounded-[2px]"
              />
            </div>
            <select
              aria-label="Filter payment status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="min-h-[40px] px-2.5 text-xs bg-white border border-[#B4BCC2] rounded-[2px]"
            >
              <option value="ALL">All Statuses</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="AWAITING_AUTHORISATION">Awaiting authorisation</option>
              <option value="PARTIALLY_AUTHORISED">Partially authorised</option>
              <option value="AUTHORISED">Authorised</option>
              <option value="PROCESSING">Processing</option>
              <option value="COMPLETED">Completed</option>
              <option value="REJECTED">Rejected</option>
              <option value="FAILED">Failed</option>
              <option value="RETURNED">Returned</option>
            </select>
            <div className="grid grid-cols-2 gap-2">
              <select
                aria-label="Filter payment type"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="min-h-[40px] px-2 text-xs bg-white border border-[#B4BCC2] rounded-[2px]"
              >
                <option value="ALL">All Types</option>
                <option value="PRIORITY_PAYMENT">Priority</option>
                <option value="INTERNATIONAL_PAYMENT">International</option>
                <option value="SEPA_PAYMENT">SEPA</option>
                <option value="INTER_ACCOUNT_TRANSFER">Transfer</option>
                <option value="BILL_PAYMENT">Bill Pay</option>
              </select>
              <input
                type="date"
                aria-label="From date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="min-h-[40px] px-2 text-xs bg-white border border-[#B4BCC2] rounded-[2px]"
              />
            </div>
          </search>

          {loading ? (
            <SkeletonList rows={5} />
          ) : filteredPayments.length === 0 ? (
            <EmptyState title="No tracked payments" description="No payment instructions match your search or status filter." />
          ) : (
            <div className="divide-y divide-[#D9DEE1]">
              {filteredPayments.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedPayment(p)}
                  className="w-full px-4 py-3.5 flex items-center justify-between gap-3 hover:bg-[#F4F5F6] text-left"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-[#252B30] truncate">{p.beneficiary_name}</span>
                      <StatusBadge status={p.status} />
                    </div>
                    <div className="text-xs text-[#68727A] mt-0.5 tabular-nums truncate">
                      {p.reference} • {p.debit_account_name} • {formatDateTime(p.created_at)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 text-right">
                    <span className="text-sm font-semibold text-[#252B30] tabular-nums">
                      {formatFinancialCurrency(p.amount, p.currency, hideBalances)}
                    </span>
                    <ChevronRight className="w-4 h-4 text-[#68727A]" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'TRADE' && (
        <div>
          {!hasPermission('ACCESS_TRADE_FINANCE') ? (
            <EmptyState title="Trade Tracking Restricted" description="Your role does not hold ACCESS_TRADE_FINANCE permission." />
          ) : tradeItems.length === 0 ? (
            <EmptyState title="No trade items" description="No active documentary trade items for this organisation." />
          ) : (
            <div className="divide-y divide-[#D9DEE1]">
              {tradeItems.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedTrade(t)}
                  className="w-full px-4 py-3.5 flex items-center justify-between gap-3 hover:bg-[#F4F5F6] text-left"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <Ship className="w-4 h-4 text-[#263640] mt-1 shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-[#252B30] truncate">{t.counterparty}</span>
                        <StatusBadge status={t.status} />
                      </div>
                      <div className="text-xs text-[#68727A] mt-0.5">
                        {t.reference} • {t.trade_category.replace(/_/g, ' ')}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 text-right">
                    <span className="text-sm font-semibold text-[#252B30] tabular-nums">
                      {formatFinancialCurrency(t.amount, t.currency, hideBalances)}
                    </span>
                    <ChevronRight className="w-4 h-4 text-[#68727A]" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
