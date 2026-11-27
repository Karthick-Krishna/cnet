import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Download,
  FileCheck,
  FileSpreadsheet,
  FileText,
  Globe,
  Layers,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Ship,
  Trash2,
  TrendingUp,
  Upload,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';
import { formatDateTime, formatFinancialCurrency } from '@shared/utils/formatters';
import { GeometricHeader } from '../components/ui/GeometricHeader';
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

/* ============================================================================
 * 1. FULL HSBCnet TRADE & SUPPLY CHAIN SUITE
 *    (Dashboard, Documentary Credits, Guarantees/SBLC, Loans/Collections, Tracker, SCF)
 * ========================================================================== */
type TradeTab = 'DASHBOARD' | 'DOC_CREDITS' | 'GUARANTEES' | 'LOANS_COLLECTIONS' | 'TRACKER' | 'SCF';

export const TradeSuiteView: React.FC<{ initialTab?: TradeTab }> = ({ initialTab = 'DASHBOARD' }) => {
  const { activeOrg, hideBalances, hasPermission } = useAuth();
  const [tab, setTab] = useState<TradeTab>(initialTab);
  const [items, setItems] = useState<any[]>([]);
  const [scfOffers, setScfOffers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [detailItem, setDetailItem] = useState<any | null>(null);
  const [applyOpen, setApplyOpen] = useState(false);
  const [newTrade, setNewTrade] = useState({
    tradeCategory: 'IMPORT_DC',
    direction: 'IMPORT',
    counterparty: '',
    amount: '',
    currency: 'USD',
    actionDescription: 'Issuance under Coralgenz Global Master Trade Line',
    billOfLading: '',
  });
  const [trackerQuery, setTrackerQuery] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [decisionTarget, setDecisionTarget] = useState<{ item: any; decision: 'APPROVED' | 'REJECTED' } | null>(null);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const load = useCallback(async () => {
    if (!activeOrg) return;
    setLoading(true);
    setError(null);
    try {
      const [trRes, scfRes] = await Promise.all([
        apiRequest<any>(`/api/corporate/trade?orgId=${encodeURIComponent(activeOrg.id)}`),
        apiRequest<any>(`/api/corporate/scf?orgId=${encodeURIComponent(activeOrg.id)}`).catch(() => ({ offers: [] })),
      ]);
      setItems(trRes.transactions || []);
      setScfOffers(scfRes.offers || []);
    } catch (err: any) {
      setError(err?.message || 'Unable to load Trade and Supply Chain services.');
    } finally {
      setLoading(false);
    }
  }, [activeOrg]);

  useEffect(() => {
    load();
  }, [load]);

  const exportTradeCsv = () => {
    const header = 'Reference,Category,Direction,Counterparty,Amount,Currency,Status,Action\n';
    const body = items
      .map((i) => `"${i.reference}","${i.trade_category}","${i.direction}","${i.counterparty}",${i.amount},"${i.currency}","${i.status}","${i.pending_action || ''}"`)
      .join('\n');
    const blob = new Blob([header + body], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Coralgenz_Trade_Portfolio_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const submitTradeApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    try {
      const res = await apiRequest<any>('/api/corporate/trade', {
        method: 'POST',
        body: JSON.stringify({ orgId: activeOrg?.id, ...newTrade, amount: Number(newTrade.amount) }),
      });
      setNotice(`Trade application ${res.transaction.reference} submitted for authorisation.`);
      setApplyOpen(false);
      setNewTrade({
        tradeCategory: 'IMPORT_DC',
        direction: 'IMPORT',
        counterparty: '',
        amount: '',
        currency: 'USD',
        actionDescription: 'Issuance under Coralgenz Global Master Trade Line',
        billOfLading: '',
      });
      await load();
    } catch (err: any) {
      setError(err?.message || 'Failed to submit trade instruction.');
    }
  };

  const confirmDecision = async () => {
    if (!decisionTarget) return;
    setError(null);
    try {
      if (decisionTarget.decision === 'APPROVED') {
        await apiRequest('/api/auth/pin/verify', { method: 'POST', body: JSON.stringify({ pin: pinInput }) });
      }
      await apiRequest(`/api/corporate/trade/${decisionTarget.item.id}/decide`, {
        method: 'POST',
        body: JSON.stringify({ orgId: activeOrg?.id, decision: decisionTarget.decision }),
      });
      setNotice(`${decisionTarget.item.reference} ${decisionTarget.decision === 'APPROVED' ? 'authorised & issued' : 'rejected'}.`);
      setDecisionTarget(null);
      setDetailItem(null);
      setPinInput('');
      await load();
    } catch (err: any) {
      setError(err?.message || 'Unable to process trade decision.');
    }
  };

  if (!hasPermission('ACCESS_TRADE_FINANCE')) {
    return (
      <div className="bg-white border border-[#D9DEE1]">
        <GeometricHeader title="Trade and Supply Chain" subtitle={activeOrg?.name} />
        <EmptyState title="Trade Finance Restricted" description="Requires ACCESS_TRADE_FINANCE entitlement." />
      </div>
    );
  }

  if (loading) return <SkeletonList rows={5} />;

  const dcs = items.filter((i) => ['IMPORT_DC', 'EXPORT_DC', 'TRANSFERABLE_DC', 'DC_AMENDMENT'].includes(i.trade_category));
  const guarantees = items.filter((i) => i.trade_category === 'GUARANTEE_STANDBY_DC');
  const loansAndColls = items.filter((i) => ['IMPORT_PRESENTATION', 'IMPORT_BILL', 'TRADE_LOAN'].includes(i.trade_category));
  const pendingCount = items.filter((i) => i.status === 'AWAITING_AUTHORISATION').length;
  const totalExposure = items.reduce((s, i) => s + (Number(i.amount) || 0), 0);

  const trackedItems = trackerQuery.trim()
    ? items.filter((i) =>
        `${i.reference} ${i.counterparty} ${i.pending_action || ''}`.toLowerCase().includes(trackerQuery.trim().toLowerCase())
      )
    : items;

  return (
    <div className="bg-white border border-[#D9DEE1]">
      <GeometricHeader
        title="Trade and Supply Chain"
        subtitle={`${activeOrg?.name} • Internet Trade Services (ITS)`}
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={exportTradeCsv} className="!bg-white/10 !text-white !border-white/30 hover:!bg-white/20">
              <Download className="w-3.5 h-3.5" /> Export Excel/CSV
            </Button>
            <Button size="sm" onClick={() => setApplyOpen(true)}>
              <Plus className="w-3.5 h-3.5" /> Apply LC / Guarantee
            </Button>
          </div>
        }
      />

      {/* Sub-Navigation Tabs */}
      <div className="flex flex-wrap border-b border-[#D9DEE1] bg-[#F4F5F6] text-xs font-medium" role="tablist">
        {(
          [
            { id: 'DASHBOARD', label: 'Trade Dashboard' },
            { id: 'DOC_CREDITS', label: `Documentary Credits (${dcs.length})` },
            { id: 'GUARANTEES', label: `Guarantees & SBLCs (${guarantees.length})` },
            { id: 'LOANS_COLLECTIONS', label: `Collections & Loans (${loansAndColls.length})` },
            { id: 'TRACKER', label: 'Trade Transaction Tracker' },
            { id: 'SCF', label: `Supply Chain Finance (${scfOffers.length})` },
          ] as { id: TradeTab; label: string }[]
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-3 border-b-[2px] transition-colors ${
              tab === t.id
                ? 'border-[#DB001B] bg-white text-[#252B30] font-semibold'
                : 'border-transparent text-[#68727A] hover:text-[#252B30]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {notice && (
        <div className="px-4 py-2.5 bg-[#ECF6F1] border-b border-[#B7DFCC] text-xs text-[#27835B] font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" /> {notice}
        </div>
      )}
      {error && <div className="p-4"><ErrorBanner message={error} onRetry={load} /></div>}

      <div className="p-4 sm:p-5">
        {tab === 'DASHBOARD' && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-4 border border-[#D9DEE1] bg-[#F4F5F6]">
                <div className="text-[11px] uppercase tracking-wider text-[#68727A]">Trade Portfolio Exposure</div>
                <div className="text-xl font-semibold text-[#252B30] tabular-nums mt-1">
                  {formatFinancialCurrency(totalExposure, 'USD', hideBalances)}
                </div>
                <div className="text-[11px] text-[#68727A] mt-1">Coralgenz Global Master Trade Line</div>
              </div>
              <div className="p-4 border border-[#D9DEE1] bg-[#F4F5F6]">
                <div className="text-[11px] uppercase tracking-wider text-[#68727A]">Awaiting Authorisation</div>
                <div className="text-xl font-semibold text-[#DB001B] tabular-nums mt-1">{pendingCount}</div>
                <div className="text-[11px] text-[#68727A] mt-1">Action required by trade signatory</div>
              </div>
              <div className="p-4 border border-[#D9DEE1] bg-[#F4F5F6]">
                <div className="text-[11px] uppercase tracking-wider text-[#68727A]">Master Facility Headroom</div>
                <div className="text-xl font-semibold text-[#27835B] tabular-nums mt-1">
                  {formatFinancialCurrency(Math.max(0, 10000000 - totalExposure), 'USD', hideBalances)}
                </div>
                <div className="text-[11px] text-[#68727A] mt-1">$10,000,000.00 approved cap</div>
              </div>
              <div className="p-4 border border-[#D9DEE1] bg-[#F4F5F6]">
                <div className="text-[11px] uppercase tracking-wider text-[#68727A]">SCF Early-Pay Eligible</div>
                <div className="text-xl font-semibold text-[#252B30] tabular-nums mt-1">{scfOffers.length} invoices</div>
                <div className="text-[11px] text-[#68727A] mt-1">Open supplier discounting offers</div>
              </div>
            </div>

            <div>
              <h2 className="text-sm font-semibold text-[#252B30] mb-2">Priority Trade Items Requiring Action</h2>
              <div className="overflow-x-auto border border-[#D9DEE1]">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-[#2D373E] text-white">
                    <tr>
                      <th className="py-2.5 px-3 font-medium">Reference</th>
                      <th className="py-2.5 px-3 font-medium">Product</th>
                      <th className="py-2.5 px-3 font-medium">Beneficiary / Counterparty</th>
                      <th className="py-2.5 px-3 font-medium text-right">Amount</th>
                      <th className="py-2.5 px-3 font-medium">Pending Action / Tracking</th>
                      <th className="py-2.5 px-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D9DEE1]">
                    {items.map((t) => (
                      <tr key={t.id} onClick={() => setDetailItem(t)} className="hover:bg-[#F4F5F6] cursor-pointer">
                        <td className="py-3 px-3 font-medium text-[#252B30] tabular-nums">{t.reference}</td>
                        <td className="py-3 px-3 text-[#68727A]">{t.trade_category.replace(/_/g, ' ')}</td>
                        <td className="py-3 px-3 text-[#252B30]">{t.counterparty}</td>
                        <td className="py-3 px-3 text-right font-semibold tabular-nums">
                          {formatFinancialCurrency(t.amount, t.currency, hideBalances)}
                        </td>
                        <td className="py-3 px-3 text-[#68727A]">{t.pending_action}</td>
                        <td className="py-3 px-3"><StatusBadge status={t.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {(tab === 'DOC_CREDITS' || tab === 'GUARANTEES' || tab === 'LOANS_COLLECTIONS') && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-[#252B30]">
                {tab === 'DOC_CREDITS'
                  ? 'Import, Export & Transferable Documentary Credits'
                  : tab === 'GUARANTEES'
                    ? 'Bank Guarantees & Standby Letters of Credit (SBLCs)'
                    : 'Documentary Collections & Trade Finance Loans'}
              </h2>
              <Button size="sm" onClick={() => {
                setNewTrade((p) => ({
                  ...p,
                  tradeCategory: tab === 'GUARANTEES' ? 'GUARANTEE_STANDBY_DC' : tab === 'LOANS_COLLECTIONS' ? 'TRADE_LOAN' : 'IMPORT_DC',
                }));
                setApplyOpen(true);
              }}>
                <Plus className="w-3.5 h-3.5" /> New Application
              </Button>
            </div>
            {(tab === 'DOC_CREDITS' ? dcs : tab === 'GUARANTEES' ? guarantees : loansAndColls).length === 0 ? (
              <EmptyState icon={Ship} title="No records in this module" description="Click New Application to submit an LC, Guarantee, or Trade Loan." />
            ) : (
              <div className="divide-y divide-[#D9DEE1] border border-[#D9DEE1]">
                {(tab === 'DOC_CREDITS' ? dcs : tab === 'GUARANTEES' ? guarantees : loansAndColls).map((t) => (
                  <div key={t.id} className="p-4 flex flex-wrap items-center justify-between gap-3 hover:bg-[#F4F5F6]">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-[#252B30]">{t.counterparty}</span>
                        <StatusBadge status={t.status} />
                      </div>
                      <div className="text-xs text-[#68727A] mt-0.5">
                        {t.reference} • {t.trade_category.replace(/_/g, ' ')} • {t.pending_action}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold tabular-nums text-[#252B30]">
                        {formatFinancialCurrency(t.amount, t.currency, hideBalances)}
                      </span>
                      <Button size="sm" variant="outline" onClick={() => setDetailItem(t)}>Inspect</Button>
                      {t.status === 'AWAITING_AUTHORISATION' && hasPermission('APPROVE_PAYMENTS') && (
                        <Button size="sm" onClick={() => setDecisionTarget({ item: t, decision: 'APPROVED' })}>Authorise</Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'TRACKER' && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <div className="relative flex-1 min-w-[240px]">
                <Search className="w-4 h-4 text-[#68727A] absolute left-3 top-3" />
                <input
                  type="search"
                  placeholder="Search Reference (TRD-...), Counterparty, Bill of Lading (BL-CGLB-88412) or Courier (DHL-77492011)..."
                  value={trackerQuery}
                  onChange={(e) => setTrackerQuery(e.target.value)}
                  className="w-full min-h-[40px] pl-9 pr-3 text-xs border border-[#B4BCC2] rounded-[2px]"
                />
              </div>
              <Button size="sm" variant="secondary" onClick={() => setTrackerQuery('')}>Clear</Button>
            </div>

            <div className="space-y-3">
              {trackedItems.map((t) => (
                <div key={t.id} className="p-4 border border-[#D9DEE1] bg-[#F4F5F6]/60">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#D9DEE1]">
                    <div>
                      <span className="text-sm font-semibold text-[#252B30]">{t.reference}</span>
                      <span className="text-xs text-[#68727A] ml-2">• {t.counterparty} ({t.direction})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold tabular-nums">{formatFinancialCurrency(t.amount, t.currency, hideBalances)}</span>
                      <StatusBadge status={t.status} />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-3 text-[11px]">
                    {['Application Filed', 'Instrument Advised / Vessel Booked', 'Documents Examined', 'Final Settlement'].map((stage, idx) => {
                      const done = t.status === 'ISSUED' ? idx <= 3 : idx <= 1;
                      return (
                        <div key={stage} className={`p-2 border ${done ? 'border-[#27835B] bg-[#ECF6F1] text-[#27835B]' : 'border-[#D9DEE1] bg-white text-[#68727A]'}`}>
                          <div className="font-semibold">{idx + 1}. {stage}</div>
                          <div className="mt-0.5">{done ? 'Completed / Verified' : 'Pending next milestone'}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'SCF' && (
          <div className="space-y-4">
            <div className="p-3.5 bg-[#EEF2F5] border border-[#5A656E] text-xs text-[#252B30]">
              <strong>Buyer-Led Supply Chain Finance (Coralgenz Global):</strong> Approve vetted supplier invoices below so vendors can draw discounted early settlement via HSBC.
            </div>
            <div className="divide-y divide-[#D9DEE1] border border-[#D9DEE1]">
              {scfOffers.map((o) => (
                <div key={o.id} className="p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div>
                    <div className="text-sm font-semibold text-[#252B30]">{o.supplier_name} — {o.invoice_number}</div>
                    <div className="text-[#68727A] mt-0.5">
                      Ref: {o.reference} • Maturity: {o.maturity_date} • Discount Rate: {o.discount_rate_pct}% p.a. • Early Net Settlement: <strong>{formatFinancialCurrency(o.net_settlement, o.currency, hideBalances)}</strong>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold tabular-nums">{formatFinancialCurrency(o.invoice_amount, o.currency, hideBalances)}</span>
                    {o.early_pay_status === 'OFFER_AVAILABLE' ? (
                      <Button
                        size="sm"
                        onClick={async () => {
                          await apiRequest(`/api/corporate/scf/${o.id}/approve`, { method: 'POST' });
                          setNotice(`Approved early-payment discounting for ${o.invoice_number}.`);
                          await load();
                        }}
                      >
                        Approve Early Pay
                      </Button>
                    ) : (
                      <StatusBadge status={o.early_pay_status} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Inspect Modal */}
      <NativeDialog open={!!detailItem} onClose={() => setDetailItem(null)} title={detailItem ? `${detailItem.reference} — ${detailItem.counterparty}` : 'Trade Detail'}>
        {detailItem && (
          <div className="space-y-3 text-xs">
            <div className="p-3 bg-[#F4F5F6] border border-[#D9DEE1] grid grid-cols-2 gap-2">
              <div><span className="text-[#68727A]">Product:</span><br /><strong>{detailItem.trade_category.replace(/_/g, ' ')}</strong></div>
              <div><span className="text-[#68727A]">Amount:</span><br /><strong>{formatFinancialCurrency(detailItem.amount, detailItem.currency, hideBalances)}</strong></div>
              <div className="col-span-2"><span className="text-[#68727A]">Pending Action / Tracking:</span><br /><strong>{detailItem.pending_action}</strong></div>
            </div>
            <div>
              <div className="font-semibold text-[#68727A] uppercase mb-1">Attached Trade Documents</div>
              {(detailItem.documents || []).map((d: any) => (
                <div key={d.id} className="p-2 border border-[#D9DEE1] flex justify-between">
                  <span className="flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> {d.name}</span>
                  <span className="text-[#68727A]">{d.size}</span>
                </div>
              ))}
            </div>
            {detailItem.status === 'AWAITING_AUTHORISATION' && hasPermission('APPROVE_PAYMENTS') && (
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setDecisionTarget({ item: detailItem, decision: 'REJECTED' })}>Reject</Button>
                <Button onClick={() => setDecisionTarget({ item: detailItem, decision: 'APPROVED' })}>Authorise &amp; Issue</Button>
              </div>
            )}
          </div>
        )}
      </NativeDialog>

      {/* PIN Step-Up Modal */}
      <NativeDialog open={!!decisionTarget} onClose={() => setDecisionTarget(null)} title="Trade Signatory Confirmation">
        {decisionTarget && (
          <div className="space-y-3 text-xs">
            <p>Confirm <strong>{decisionTarget.decision}</strong> for <strong>{decisionTarget.item.reference}</strong> ({decisionTarget.item.counterparty}).</p>
            {decisionTarget.decision === 'APPROVED' && (
              <FormInput label="6-Digit Security PIN" type="password" inputMode="numeric" maxLength={6} value={pinInput} onChange={(e) => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 6))} />
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDecisionTarget(null)}>Cancel</Button>
              <Button onClick={confirmDecision}>Confirm</Button>
            </div>
          </div>
        )}
      </NativeDialog>

      {/* Apply LC / Guarantee / Loan Modal */}
      <NativeDialog open={applyOpen} onClose={() => setApplyOpen(false)} title="New Trade Finance Application">
        <form onSubmit={submitTradeApplication} className="space-y-3">
          <FormSelect label="Trade Product" value={newTrade.tradeCategory} onChange={(e) => setNewTrade((p) => ({ ...p, tradeCategory: e.target.value }))}>
            <option value="IMPORT_DC">Import Documentary Credit (LC)</option>
            <option value="EXPORT_DC">Export Documentary Credit (Advised)</option>
            <option value="TRANSFERABLE_DC">Transferable Documentary Credit</option>
            <option value="GUARANTEE_STANDBY_DC">Bank Guarantee / Standby LC (SBLC)</option>
            <option value="IMPORT_PRESENTATION">Documentary Collection</option>
            <option value="TRADE_LOAN">Pre/Post-Shipment Trade Loan</option>
          </FormSelect>
          <FormSelect label="Direction" value={newTrade.direction} onChange={(e) => setNewTrade((p) => ({ ...p, direction: e.target.value }))}>
            <option value="IMPORT">Import</option>
            <option value="EXPORT">Export</option>
          </FormSelect>
          <FormInput label="Beneficiary / Counterparty Name" required value={newTrade.counterparty} onChange={(e) => setNewTrade((p) => ({ ...p, counterparty: e.target.value }))} />
          <div className="grid grid-cols-2 gap-3">
            <FormInput label="Amount" type="number" step="0.01" required value={newTrade.amount} onChange={(e) => setNewTrade((p) => ({ ...p, amount: e.target.value }))} />
            <FormSelect label="Currency" value={newTrade.currency} onChange={(e) => setNewTrade((p) => ({ ...p, currency: e.target.value }))}>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
              <option value="INR">INR</option>
            </FormSelect>
          </div>
          <FormInput label="Bill of Lading / Tracking Ref (optional)" placeholder="e.g. BL-CGLB-99410" value={newTrade.billOfLading} onChange={(e) => setNewTrade((p) => ({ ...p, billOfLading: e.target.value }))} />
          <FormInput label="Terms / Goods Description" required value={newTrade.actionDescription} onChange={(e) => setNewTrade((p) => ({ ...p, actionDescription: e.target.value }))} />
          <Button type="submit" fullWidth>Submit for Trade Authorisation</Button>
        </form>
      </NativeDialog>
    </div>
  );
};

/* ============================================================================
 * 2. PAYMENT TEMPLATES (General & Restricted)
 * ========================================================================== */
export const PaymentTemplatesView: React.FC = () => {
  const { activeOrg, hideBalances } = useAuth();
  const [templates, setTemplates] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '', templateType: 'GENERAL', category: 'PRIORITY_PAYMENT', debitAccountId: '',
    beneficiaryName: '', beneficiaryAccount: '', beneficiaryBank: '', destinationCountry: 'GB',
    swiftBic: '', currency: 'GBP', defaultAmount: '', referenceNote: '',
  });

  const load = useCallback(async () => {
    if (!activeOrg) return;
    setLoading(true);
    const [tRes, aRes] = await Promise.all([
      apiRequest<any>(`/api/corporate/templates?orgId=${encodeURIComponent(activeOrg.id)}`),
      apiRequest<any>(`/api/corporate/accounts?orgId=${encodeURIComponent(activeOrg.id)}`),
    ]);
    setTemplates(tRes.templates || []);
    const accs = aRes.accounts || [];
    setAccounts(accs);
    if (accs[0] && !form.debitAccountId) setForm((p) => ({ ...p, debitAccountId: accs[0].id }));
    setLoading(false);
  }, [activeOrg, form.debitAccountId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <SkeletonList rows={4} />;

  return (
    <div className="bg-white border border-[#D9DEE1]">
      <GeometricHeader
        title="Payment templates"
        subtitle={`${activeOrg?.name} • General & Restricted Standing Templates`}
        actions={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="w-3.5 h-3.5" /> Create payment template
          </Button>
        }
      />
      {notice && <div className="px-4 py-2.5 bg-[#ECF6F1] border-b border-[#B7DFCC] text-xs text-[#27835B] font-medium">{notice}</div>}

      <div className="divide-y divide-[#D9DEE1]">
        {templates.length === 0 ? (
          <EmptyState title="No payment templates saved" description="Create a General or Restricted template for fast recurring wires." />
        ) : (
          templates.map((t) => (
            <div key={t.id} className="p-4 flex flex-wrap items-center justify-between gap-3 hover:bg-[#F4F5F6] text-xs">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-[#252B30]">{t.name}</span>
                  <span className={`px-2 py-0.5 text-[10px] font-semibold uppercase border ${
                    t.template_type === 'RESTRICTED'
                      ? 'bg-[#FFF7E6] text-[#B77A1D] border-[#F6D38A]'
                      : 'bg-[#F4F5F6] text-[#263640] border-[#D9DEE1]'
                  }`}>
                    {t.template_type}
                  </span>
                </div>
                <div className="text-[#68727A] mt-0.5">
                  {t.beneficiary_name} ({t.beneficiary_bank} • {t.beneficiary_account}) • {t.category.replace(/_/g, ' ')}
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <strong className="text-sm tabular-nums">{formatFinancialCurrency(t.default_amount, t.currency, hideBalances)}</strong>
                <Button
                  size="sm"
                  onClick={async () => {
                    const res = await apiRequest<any>(`/api/corporate/templates/${t.id}/execute`, {
                      method: 'POST',
                      body: JSON.stringify({ orgId: activeOrg?.id, amount: t.default_amount }),
                    });
                    setNotice(`Payment instruction ${res.reference} created from template and queued for Authorisation.`);
                  }}
                >
                  Pay from Template
                </Button>
                <button
                  type="button"
                  aria-label={`Delete ${t.name}`}
                  onClick={async () => {
                    await apiRequest(`/api/corporate/templates/${t.id}`, { method: 'DELETE' });
                    await load();
                  }}
                  className="p-2 text-[#68727A] hover:text-[#C83A42]"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <NativeDialog open={createOpen} onClose={() => setCreateOpen(false)} title="Create payment template">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await apiRequest('/api/corporate/templates', {
              method: 'POST',
              body: JSON.stringify({ orgId: activeOrg?.id, ...form, defaultAmount: Number(form.defaultAmount) }),
            });
            setCreateOpen(false);
            setNotice(`Saved payment template "${form.name}".`);
            await load();
          }}
          className="space-y-3"
        >
          <FormInput label="Template Name" required value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
          <div className="grid grid-cols-2 gap-3">
            <FormSelect label="Template Type" value={form.templateType} onChange={(e) => setForm((p) => ({ ...p, templateType: e.target.value }))}>
              <option value="GENERAL">General (Editable amount)</option>
              <option value="RESTRICTED">Restricted (Locked beneficiary &amp; amount)</option>
            </FormSelect>
            <FormSelect label="Payment Rail" value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}>
              <option value="PRIORITY_PAYMENT">Priority Payment (CHAPS / Wire)</option>
              <option value="SEPA_PAYMENT">SEPA Credit Transfer</option>
              <option value="ACH_CREDIT">ACH Credit</option>
            </FormSelect>
          </div>
          <FormSelect label="Debit Account" value={form.debitAccountId} onChange={(e) => setForm((p) => ({ ...p, debitAccountId: e.target.value }))}>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.account_name} ({a.currency})</option>)}
          </FormSelect>
          <FormInput label="Beneficiary Name" required value={form.beneficiaryName} onChange={(e) => setForm((p) => ({ ...p, beneficiaryName: e.target.value }))} />
          <div className="grid grid-cols-2 gap-3">
            <FormInput label="Beneficiary Account / IBAN" required value={form.beneficiaryAccount} onChange={(e) => setForm((p) => ({ ...p, beneficiaryAccount: e.target.value }))} />
            <FormInput label="Beneficiary Bank" required value={form.beneficiaryBank} onChange={(e) => setForm((p) => ({ ...p, beneficiaryBank: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormInput label="Default Amount" type="number" step="0.01" required value={form.defaultAmount} onChange={(e) => setForm((p) => ({ ...p, defaultAmount: e.target.value }))} />
            <FormSelect label="Currency" value={form.currency} onChange={(e) => setForm((p) => ({ ...p, currency: e.target.value }))}>
              <option value="GBP">GBP</option>
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
              <option value="INR">INR</option>
            </FormSelect>
          </div>
          <FormInput label="Payment Reference Note" value={form.referenceNote} onChange={(e) => setForm((p) => ({ ...p, referenceNote: e.target.value }))} />
          <Button type="submit" fullWidth>Save Template</Button>
        </form>
      </NativeDialog>
    </div>
  );
};

/* ============================================================================
 * 3. BATCH FILE UPLOAD (ISO 20022 XML, CSV, BACS, ACH)
 * ========================================================================== */
export const FileUploadView: React.FC = () => {
  const { activeOrg, hideBalances } = useAuth();
  const [uploads, setUploads] = useState<any[]>([]);
  const [format, setFormat] = useState('ISO20022_XML');
  const [filename, setFilename] = useState('coralgenz_vendor_batch_nov2026.xml');
  const [currency, setCurrency] = useState('GBP');
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeOrg) return;
    const res = await apiRequest<any>(`/api/corporate/file-uploads?orgId=${encodeURIComponent(activeOrg.id)}`);
    setUploads(res.uploads || []);
  }, [activeOrg]);

  useEffect(() => { load(); }, [load]);

  const submitBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    const sampleRows = [
      { beneficiary: 'Nordic Components GmbH', amount: 8200 },
      { beneficiary: 'Thames Logistics Partners Ltd', amount: 3450 },
      { beneficiary: 'Coralgenz Global Singapore Pte Ltd', amount: 6150 },
    ];
    const res = await apiRequest<any>('/api/corporate/file-uploads', {
      method: 'POST',
      body: JSON.stringify({ orgId: activeOrg?.id, filename, format, currency, rows: sampleRows }),
    });
    setNotice(`Batch ${res.upload.reference} validated (${res.upload.valid_count} instructions) and queued for Authorisation.`);
    await load();
  };

  return (
    <div className="bg-white border border-[#D9DEE1]">
      <GeometricHeader title="File upload" subtitle="Bulk ISO 20022 XML, CSV, BACS & ACH ERP Batch Transmission" />
      {notice && <div className="px-4 py-2.5 bg-[#ECF6F1] border-b border-[#B7DFCC] text-xs text-[#27835B] font-medium">{notice}</div>}
      <div className="p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <form onSubmit={submitBatch} className="space-y-4 border border-[#D9DEE1] p-4 bg-[#F4F5F6]/50">
          <h2 className="text-sm font-semibold text-[#252B30]">Transmit Payment / Receivables File</h2>
          <FormSelect label="File Format Standard" value={format} onChange={(e) => setFormat(e.target.value)}>
            <option value="ISO20022_XML">ISO 20022 XML (pain.001.001.03)</option>
            <option value="CSV">Dynamic Corporate CSV</option>
            <option value="BACS">UK BACS Standard 18</option>
            <option value="ACH">US NACHA / ACH Format</option>
          </FormSelect>
          <FormSelect label="Settlement Currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            <option value="GBP">GBP</option>
            <option value="EUR">EUR</option>
            <option value="USD">USD</option>
            <option value="INR">INR</option>
          </FormSelect>
          <label className="block p-5 border border-dashed border-[#5A656E] bg-white text-center text-xs cursor-pointer hover:bg-[#F4F5F6]">
            <Upload className="w-5 h-5 mx-auto mb-1.5 text-[#263640]" />
            <div className="font-medium text-[#252B30]">{filename}</div>
            <div className="text-[#68727A] mt-0.5">Click to browse local .xml or .csv file (or submit sample ERP batch)</div>
            <input type="file" accept=".csv,.xml,.txt" className="hidden" onChange={(e) => e.target.files?.[0] && setFilename(e.target.files[0].name)} />
          </label>
          <Button type="submit" fullWidth>Validate &amp; Upload Batch File</Button>
        </form>

        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-[#252B30]">Uploaded Batch Files &amp; Validation Reports</h2>
          <div className="divide-y divide-[#D9DEE1] border border-[#D9DEE1] text-xs">
            {uploads.map((u) => (
              <div key={u.id} className="p-3.5 space-y-1.5">
                <div className="flex justify-between items-center">
                  <strong className="text-[#252B30]">{u.reference} — {u.filename}</strong>
                  <StatusBadge status={u.status} />
                </div>
                <div className="text-[#68727A]">
                  Format: {u.format} • Instructions: {u.valid_count}/{u.total_count} valid • Total: <strong>{formatFinancialCurrency(u.total_amount, u.currency, hideBalances)}</strong>
                </div>
                <div className="text-[11px] text-[#27835B]">
                  {(u.validationSummary || []).join(' • ')}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
 * 4. VIRTUAL ACCOUNTS (Coralgenz Global AR Reconciliation)
 * ========================================================================== */
export const VirtualAccountsView: React.FC = () => {
  const { activeOrg, hideBalances } = useAuth();
  const [virtuals, setVirtuals] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [openCreate, setOpenCreate] = useState(false);
  const [name, setName] = useState('');
  const [region, setRegion] = useState('United Kingdom');
  const [line, setLine] = useState('B2B SaaS & Enterprise');
  const [parentId, setParentId] = useState('');

  const load = useCallback(async () => {
    if (!activeOrg) return;
    const [vaRes, accRes] = await Promise.all([
      apiRequest<any>(`/api/corporate/virtual-accounts?orgId=${encodeURIComponent(activeOrg.id)}`),
      apiRequest<any>(`/api/corporate/accounts?orgId=${encodeURIComponent(activeOrg.id)}`),
    ]);
    setVirtuals(vaRes.virtualAccounts || []);
    const accs = accRes.accounts || [];
    setAccounts(accs);
    if (accs[0] && !parentId) setParentId(accs[0].id);
  }, [activeOrg, parentId]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="bg-white border border-[#D9DEE1]">
      <GeometricHeader
        title="Virtual accounts"
        subtitle={`${activeOrg?.name} • Automated Receivables Reconciliation & Sub-Ledgers`}
        actions={<Button size="sm" onClick={() => setOpenCreate(true)}><Plus className="w-3.5 h-3.5" /> New Virtual Account</Button>}
      />
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="bg-[#2D373E] text-white">
            <tr>
              <th className="py-2.5 px-4 font-medium">Virtual Account No.</th>
              <th className="py-2.5 px-4 font-medium">Account Title</th>
              <th className="py-2.5 px-4 font-medium">Region / Business Line</th>
              <th className="py-2.5 px-4 font-medium text-right">Allocated Balance</th>
              <th className="py-2.5 px-4 font-medium text-right">Reconciled Credits</th>
              <th className="py-2.5 px-4 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#D9DEE1]">
            {virtuals.map((v) => (
              <tr key={v.id} className="hover:bg-[#F4F5F6]">
                <td className="py-3 px-4 font-medium tabular-nums">{v.virtual_number}</td>
                <td className="py-3 px-4 font-medium text-[#252B30]">{v.account_name}</td>
                <td className="py-3 px-4 text-[#68727A]">{v.region} • {v.business_line}</td>
                <td className="py-3 px-4 text-right font-semibold tabular-nums">{formatFinancialCurrency(v.allocated_balance, v.currency, hideBalances)}</td>
                <td className="py-3 px-4 text-right tabular-nums">{v.reconciled_count} txns</td>
                <td className="py-3 px-4 text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      await apiRequest(`/api/corporate/virtual-accounts/${v.id}/reconcile`, {
                        method: 'POST',
                        body: JSON.stringify({ amount: 2500 }),
                      });
                      await load();
                    }}
                  >
                    + Reconcile 2,500
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <NativeDialog open={openCreate} onClose={() => setOpenCreate(false)} title="Create Virtual Sub-Account">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await apiRequest('/api/corporate/virtual-accounts', {
              method: 'POST',
              body: JSON.stringify({ orgId: activeOrg?.id, parentAccountId: parentId, accountName: name, region, businessLine: line, currency: activeOrg?.baseCurrency || 'GBP' }),
            });
            setOpenCreate(false);
            setName('');
            await load();
          }}
          className="space-y-3"
        >
          <FormSelect label="Physical Header Account" value={parentId} onChange={(e) => setParentId(e.target.value)}>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.account_name} ({a.currency})</option>)}
          </FormSelect>
          <FormInput label="Virtual Account Title" required placeholder="e.g. Coralgenz UK SaaS Subscriptions" value={name} onChange={(e) => setName(e.target.value)} />
          <FormInput label="Region" value={region} onChange={(e) => setRegion(e.target.value)} />
          <FormInput label="Business Line" value={line} onChange={(e) => setLine(e.target.value)} />
          <Button type="submit" fullWidth>Open Virtual Account</Button>
        </form>
      </NativeDialog>
    </div>
  );
};

/* ============================================================================
 * 5. REPORTS AND FILES (MT940 / BAI2 / CSV + Automated File Delivery)
 * ========================================================================== */
export const ReportsFilesView: React.FC = () => {
  const { activeOrg } = useAuth();
  const [schedules, setSchedules] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [reportType, setReportType] = useState('Intraday Multi-Currency Balance Report');
  const [format, setFormat] = useState('MT940');
  const [frequency, setFrequency] = useState('DAILY');
  const [recipient, setRecipient] = useState('karthick.krishna@coralgenz.com');
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeOrg) return;
    const [afdRes, accRes] = await Promise.all([
      apiRequest<any>(`/api/corporate/reports/afd?orgId=${encodeURIComponent(activeOrg.id)}`),
      apiRequest<any>(`/api/corporate/accounts?orgId=${encodeURIComponent(activeOrg.id)}`),
    ]);
    setSchedules(afdRes.schedules || []);
    setAccounts(accRes.accounts || []);
  }, [activeOrg]);

  useEffect(() => { load(); }, [load]);

  const downloadFormatFile = (fmt: 'MT940' | 'BAI2' | 'CSV') => {
    let content = '';
    const dateTag = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    if (fmt === 'MT940') {
      content = accounts
        .map((a) => `:20:CGLB${dateTag}\n:25:${a.account_number}\n:28C:00124/001\n:60F:C${dateTag.slice(2)}${a.currency}${Number(a.available_balance).toFixed(2).replace('.', ',')}\n:62F:C${dateTag.slice(2)}${a.currency}${Number(a.available_balance).toFixed(2).replace('.', ',')}\n-`)
        .join('\n');
    } else if (fmt === 'BAI2') {
      content = `01,HSBCNET,CORALGENZ,${dateTag},1915,1,80,,2/\n02,CORALGENZ,HSBCNET,1,${dateTag},,,,2/\n` +
        accounts.map((a) => `03,${a.account_number},${a.currency},010,${Math.round(a.available_balance * 100)},,,/`).join('\n') +
        '\n99,1,1,1/';
    } else {
      content = 'Account Number,Account Title,Country,Currency,Available Balance,Ledger Balance\n' +
        accounts.map((a) => `"${a.account_number}","${a.account_name}","${a.country}","${a.currency}",${a.available_balance},${a.ledger_balance}`).join('\n');
    }
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Coralgenz_HSBCnet_${fmt}_${dateTag}.${fmt === 'CSV' ? 'csv' : 'txt'}`;
    link.click();
    URL.revokeObjectURL(url);
    setNotice(`Downloaded ${fmt} statement extract for ${accounts.length} corporate accounts.`);
  };

  return (
    <div className="bg-white border border-[#D9DEE1]">
      <GeometricHeader title="Reports and files" subtitle="SWIFT MT940, BAI2, CSV Statements & Automated File Delivery (AFD)" />
      {notice && <div className="px-4 py-2.5 bg-[#ECF6F1] border-b border-[#B7DFCC] text-xs text-[#27835B] font-medium">{notice}</div>}
      <div className="p-4 sm:p-5 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(['MT940', 'BAI2', 'CSV'] as const).map((fmt) => (
            <div key={fmt} className="p-4 border border-[#D9DEE1] bg-[#F4F5F6] flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-[#252B30]">{fmt} Extract</div>
                <div className="text-xs text-[#68727A]">Instant ERP statement export</div>
              </div>
              <Button size="sm" onClick={() => downloadFormatFile(fmt)}>
                <FileSpreadsheet className="w-3.5 h-3.5" /> Download
              </Button>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await apiRequest('/api/corporate/reports/afd', {
                method: 'POST',
                body: JSON.stringify({ orgId: activeOrg?.id, reportType, format, frequency, deliveryChannel: 'ERP_SFTP', recipient }),
              });
              setNotice(`Automated File Delivery schedule created (${format} • ${frequency}).`);
              await load();
            }}
            className="p-4 border border-[#D9DEE1] space-y-3"
          >
            <h2 className="text-sm font-semibold text-[#252B30]">Schedule Automated File Delivery (AFD)</h2>
            <FormInput label="Report Name" required value={reportType} onChange={(e) => setReportType(e.target.value)} />
            <div className="grid grid-cols-2 gap-3">
              <FormSelect label="Format" value={format} onChange={(e) => setFormat(e.target.value)}>
                <option value="MT940">SWIFT MT940</option>
                <option value="BAI2">BAI2</option>
                <option value="CSV">CSV</option>
                <option value="PDF">PDF Statement</option>
              </FormSelect>
              <FormSelect label="Frequency" value={frequency} onChange={(e) => setFrequency(e.target.value)}>
                <option value="DAILY">Daily (06:00 GMT)</option>
                <option value="WEEKLY">Weekly (Monday)</option>
                <option value="MONTHLY">Monthly (Day 1)</option>
              </FormSelect>
            </div>
            <FormInput label="ERP / SFTP Recipient Endpoint" required value={recipient} onChange={(e) => setRecipient(e.target.value)} />
            <Button type="submit" fullWidth>Activate AFD Schedule</Button>
          </form>

          <div>
            <h2 className="text-sm font-semibold text-[#252B30] mb-2">Active AFD Schedules</h2>
            <div className="divide-y divide-[#D9DEE1] border border-[#D9DEE1] text-xs">
              {schedules.map((s) => (
                <div key={s.id} className="p-3.5 flex justify-between items-center gap-3">
                  <div>
                    <div className="font-semibold text-[#252B30]">{s.report_type}</div>
                    <div className="text-[#68727A] mt-0.5">{s.format} • {s.frequency} • {s.recipient}</div>
                  </div>
                  <StatusBadge status={s.status} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
 * 6. GLOBAL MARKETS & FOREIGN EXCHANGE (FX Deal Execution & Get Rate)
 * ========================================================================== */
export const FxMarketsView: React.FC = () => {
  const [rates, setRates] = useState<any[]>([]);
  const [fromCurrency, setFromCurrency] = useState('GBP');
  const [toCurrency, setToCurrency] = useState('USD');
  const [amount, setAmount] = useState('25000');
  const [dealResult, setDealResult] = useState<any>(null);

  const loadRates = useCallback(async () => {
    const res = await apiRequest<any>('/api/corporate/fx-rates');
    setRates(res.rates || []);
  }, []);

  useEffect(() => { loadRates(); }, [loadRates]);

  const executeDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await apiRequest<any>('/api/corporate/fx-deal', {
      method: 'POST',
      body: JSON.stringify({ fromCurrency, toCurrency, amount: Number(amount) }),
    });
    setDealResult(res.deal);
  };

  return (
    <div className="bg-white border border-[#D9DEE1]">
      <GeometricHeader
        title="Markets & Foreign Exchange"
        subtitle="HSBC Evolve Indicative Rates & Cross-Border FX Deal Execution"
        actions={<Button size="sm" variant="outline" onClick={loadRates} className="!bg-white/10 !text-white !border-white/30"><RefreshCw className="w-3.5 h-3.5" /> Refresh Rates</Button>}
      />
      <div className="p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h2 className="text-sm font-semibold text-[#252B30] mb-2">Live Indicative Currency Board</h2>
          <table className="w-full text-left border-collapse border border-[#D9DEE1] text-xs">
            <thead className="bg-[#2D373E] text-white">
              <tr>
                <th className="py-2.5 px-3 font-medium">Currency Pair</th>
                <th className="py-2.5 px-3 font-medium text-right">Indicative Rate</th>
                <th className="py-2.5 px-3 font-medium text-right">Inverse</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D9DEE1]">
              {rates.map((r) => (
                <tr key={`${r.base}-${r.quote}`} className="hover:bg-[#F4F5F6]">
                  <td className="py-2.5 px-3 font-semibold text-[#252B30]">{r.base} / {r.quote}</td>
                  <td className="py-2.5 px-3 text-right font-semibold tabular-nums">{r.rate}</td>
                  <td className="py-2.5 px-3 text-right text-[#68727A] tabular-nums">{r.inverseRate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <form onSubmit={executeDeal} className="p-4 border border-[#D9DEE1] bg-[#F4F5F6]/50 space-y-3">
          <h2 className="text-sm font-semibold text-[#252B30]">Book Spot / Forward FX Deal</h2>
          <div className="grid grid-cols-2 gap-3">
            <FormSelect label="Sell Currency" value={fromCurrency} onChange={(e) => setFromCurrency(e.target.value)}>
              <option value="GBP">GBP</option>
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
              <option value="INR">INR</option>
            </FormSelect>
            <FormSelect label="Buy Currency" value={toCurrency} onChange={(e) => setToCurrency(e.target.value)}>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
              <option value="INR">INR</option>
              <option value="SGD">SGD</option>
            </FormSelect>
          </div>
          <FormInput label={`Sell Amount (${fromCurrency})`} type="number" step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} />
          <Button type="submit" fullWidth>Get Rate &amp; Book FX Deal</Button>
          {dealResult && (
            <div className="p-3 bg-[#ECF6F1] border border-[#B7DFCC] text-xs text-[#27835B] space-y-1">
              <div className="font-semibold">FX Deal Confirmed: {dealResult.reference}</div>
              <div>Converted: {dealResult.sellAmount} {dealResult.fromCurrency} → <strong>{dealResult.buyAmount} {dealResult.toCurrency}</strong> @ {dealResult.rate}</div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

/* ============================================================================
 * 7. HSBC SECURITIES SERVICES (Custody, Valuation & Corporate Actions)
 * ========================================================================== */
export const SecuritiesServicesView: React.FC = () => {
  const { activeOrg, hideBalances } = useAuth();
  const [holdings, setHoldings] = useState<any[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeOrg) return;
    const res = await apiRequest<any>(`/api/corporate/securities?orgId=${encodeURIComponent(activeOrg.id)}`);
    setHoldings(res.holdings || []);
  }, [activeOrg]);

  useEffect(() => { load(); }, [load]);

  const totalMarketValue = holdings.reduce((s, h) => s + (Number(h.market_value) || 0), 0);

  return (
    <div className="bg-white border border-[#D9DEE1]">
      <GeometricHeader title="Securities Services" subtitle={`${activeOrg?.name} • Global Custody, Fund Valuation & Corporate Actions`} />
      {notice && <div className="px-4 py-2.5 bg-[#ECF6F1] border-b border-[#B7DFCC] text-xs text-[#27835B] font-medium">{notice}</div>}
      <div className="p-4 sm:p-5 space-y-4">
        <div className="p-4 border border-[#D9DEE1] bg-[#F4F5F6] flex flex-wrap justify-between items-center gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-[#68727A]">Aggregated Safekeeping Market Value (Mixed Currencies)</div>
            <div className="text-2xl font-semibold text-[#252B30] tabular-nums">{formatFinancialCurrency(totalMarketValue, 'USD', hideBalances)}</div>
          </div>
          <div className="text-xs text-[#68727A]">Custodian: HSBC Securities Services (HSS) • {holdings.length} Active Positions</div>
        </div>

        <div className="overflow-x-auto border border-[#D9DEE1]">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-[#2D373E] text-white">
              <tr>
                <th className="py-2.5 px-3 font-medium">ISIN</th>
                <th className="py-2.5 px-3 font-medium">Security / Fund Name</th>
                <th className="py-2.5 px-3 font-medium">Custody Account</th>
                <th className="py-2.5 px-3 font-medium text-right">Market Value</th>
                <th className="py-2.5 px-3 font-medium">Corporate Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D9DEE1]">
              {holdings.map((h) => (
                <tr key={h.id} className="hover:bg-[#F4F5F6]">
                  <td className="py-3 px-3 font-medium tabular-nums">{h.isin}</td>
                  <td className="py-3 px-3 font-medium text-[#252B30]">
                    {h.security_name}
                    <div className="text-[11px] text-[#68727A] font-normal">{h.asset_class.replace(/_/g, ' ')}</div>
                  </td>
                  <td className="py-3 px-3 text-[#68727A] tabular-nums">{h.custodian_account}</td>
                  <td className="py-3 px-3 text-right font-semibold tabular-nums">{formatFinancialCurrency(h.market_value, h.currency, hideBalances)}</td>
                  <td className="py-3 px-3">
                    {h.corp_action_status === 'ACTION_REQUIRED' ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[#B77A1D] font-medium">{h.corp_action_detail}</span>
                        <Button
                          size="sm"
                          onClick={async () => {
                            await apiRequest(`/api/corporate/securities/${h.id}/elect`, { method: 'POST', body: JSON.stringify({ election: 'ACCEPT_TENDER' }) });
                            setNotice(`Corporate action election submitted for ${h.isin}.`);
                            await load();
                          }}
                        >
                          Submit Election
                        </Button>
                      </div>
                    ) : (
                      <span className="text-[#68727A]">{h.corp_action_detail}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
