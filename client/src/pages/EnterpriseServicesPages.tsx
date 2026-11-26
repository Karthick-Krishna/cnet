import React, { useCallback, useEffect, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  FileCheck,
  FileText,
  Landmark,
  MessageSquare,
  Ship,
  TrendingUp,
  Upload,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';
import { formatDateTime, formatFinancialCurrency } from '@shared/utils/formatters';
import {
  Button,
  EmptyState,
  ErrorBanner,
  FormInput,
  FormSelect,
  SectionCard,
  SkeletonList,
  StatusBadge,
} from '../components/ui/Primitives';

/* ============================================================================
 * 1. LIQUIDITY DASHBOARD
 * ========================================================================== */
export const LiquidityView: React.FC = () => {
  const { activeOrg, hideBalances, hasPermission } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currencyFilter, setCurrencyFilter] = useState('ALL');
  const [showChart, setShowChart] = useState(true);
  const [showCurrencyCards, setShowCurrencyCards] = useState(true);

  const load = useCallback(async () => {
    if (!activeOrg) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest<any>(`/api/corporate/liquidity?orgId=${encodeURIComponent(activeOrg.id)}`);
      setData(res);
    } catch (err: any) {
      setError(err?.message || 'Unable to load liquidity position.');
    } finally {
      setLoading(false);
    }
  }, [activeOrg]);

  useEffect(() => {
    load();
  }, [load]);

  if (!hasPermission('VIEW_LIQUIDITY')) {
    return <EmptyState title="Liquidity Restricted" description="Requires VIEW_LIQUIDITY permission." />;
  }
  if (loading) return <SkeletonList rows={4} />;
  if (error) return <ErrorBanner message={error} onRetry={load} />;
  if (!data) return null;

  const filteredAccounts = (data.accounts || []).filter((a: any) => currencyFilter === 'ALL' || a.currency === currencyFilter);
  const maxHist = Math.max(...(data.history || []).map((h: any) => h.ledger), 1);

  return (
    <div className="space-y-5">
      <div className="bg-white border border-[#D7D8D6] rounded-[2px] p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[#252525]">Liquidity Dashboard</h1>
          <p className="text-xs text-[#767676] mt-0.5">Consolidated treasury cash position for {activeOrg?.name}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <label className="flex items-center gap-1.5 px-2.5 py-1.5 border border-[#D7D8D6] rounded bg-[#F9FAFB]">
            <input type="checkbox" checked={showCurrencyCards} onChange={(e) => setShowCurrencyCards(e.target.checked)} className="accent-[#DB0011]" />
            <span>Currency Breakdown</span>
          </label>
          <label className="flex items-center gap-1.5 px-2.5 py-1.5 border border-[#D7D8D6] rounded bg-[#F9FAFB]">
            <input type="checkbox" checked={showChart} onChange={(e) => setShowChart(e.target.checked)} className="accent-[#DB0011]" />
            <span>Trend Graph</span>
          </label>
          <select
            aria-label="Filter liquidity currency"
            value={currencyFilter}
            onChange={(e) => setCurrencyFilter(e.target.value)}
            className="min-h-[36px] px-2.5 border border-[#9E9E9E] rounded bg-white"
          >
            <option value="ALL">All Currencies</option>
            {(data.byCurrency || []).map((c: any) => (
              <option key={c.currency} value={c.currency}>{c.currency}</option>
            ))}
          </select>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-[#D7D8D6] rounded-[2px] p-4">
          <div className="text-xs text-[#767676]">Total Available Liquidity ({data.baseCurrency})</div>
          <div className="text-2xl font-bold text-[#252525] tabular-nums mt-1">
            {formatFinancialCurrency(data.totalAvailableBase, data.baseCurrency, hideBalances)}
          </div>
        </div>
        <div className="bg-white border border-[#D7D8D6] rounded-[2px] p-4">
          <div className="text-xs text-[#767676]">Total Ledger Position ({data.baseCurrency})</div>
          <div className="text-2xl font-semibold text-[#252525] tabular-nums mt-1">
            {formatFinancialCurrency(data.totalLedgerBase, data.baseCurrency, hideBalances)}
          </div>
        </div>
        <div className="bg-white border border-[#D7D8D6] rounded-[2px] p-4">
          <div className="text-xs text-[#767676]">Active Currencies &amp; Accounts</div>
          <div className="text-2xl font-semibold text-[#252525] tabular-nums mt-1">
            {data.byCurrency?.length || 0} Currencies / {data.accounts?.length || 0} Accts
          </div>
        </div>
      </div>

      {showCurrencyCards && (
        <SectionCard title="Balance by Currency" subtitle={`Converted to ${data.baseCurrency} using sandbox treasury rates`}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {(data.byCurrency || []).map((c: any) => (
              <div key={c.currency} className="p-3.5 rounded-[2px] border border-[#D7D8D6] bg-[#FAFAFA]">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[#252525]">{c.currency}</span>
                  <span className="text-[#767676]">{c.accountCount} acct(s)</span>
                </div>
                <div className="mt-2 text-base font-bold text-[#252525] tabular-nums">
                  {formatFinancialCurrency(c.available, c.currency, hideBalances)}
                </div>
                <div className="text-[11px] text-[#767676] tabular-nums mt-0.5">
                  Eqv: {formatFinancialCurrency(c.baseEquivalent, data.baseCurrency, hideBalances)}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {showChart && (
        <SectionCard title="Summary Balance Trajectory" subtitle="Historical available vs ledger trajectory">
          <div className="flex items-end gap-3 h-44 pt-4">
            {(data.history || []).map((pt: any) => {
              const pct = Math.max(12, Math.round((pt.available / maxHist) * 100));
              return (
                <div key={pt.label} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                  <div className="text-[10px] text-[#555555] tabular-nums hidden sm:block">
                    {hideBalances ? '••••' : Math.round(pt.available).toLocaleString()}
                  </div>
                  <div className="w-full max-w-[44px] bg-[#252525] rounded-t" style={{ height: `${pct}%` }} />
                  <div className="text-[11px] font-medium text-[#767676]">{pt.label}</div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}

      <SectionCard title="Account Distribution">
        <div className="divide-y divide-[#D7D8D6]">
          {filteredAccounts.map((a: any) => (
            <div key={a.id} className="py-3 flex items-center justify-between gap-3 text-xs">
              <div>
                <div className="font-semibold text-[#252525]">{a.account_name}</div>
                <div className="text-[#767676] tabular-nums">{a.account_number} • {a.currency}</div>
              </div>
              <div className="text-right">
                <div className="font-bold text-[#252525] tabular-nums">{formatFinancialCurrency(a.available_balance, a.currency, hideBalances)}</div>
                <div className="text-[#767676] tabular-nums">{data.baseCurrency} eqv: {formatFinancialCurrency(a.baseEquivalent, data.baseCurrency, hideBalances)}</div>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
};

/* ============================================================================
 * 2. RECEIVABLES FINANCE
 * ========================================================================== */
export const ReceivablesView: React.FC = () => {
  const { activeOrg, hideBalances, hasPermission } = useAuth();
  const [data, setData] = useState<any>(null);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selectedFacility, setSelectedFacility] = useState<any>(null);
  const [subTab, setSubTab] = useState<'MESSAGES' | 'DRAW' | 'LIMIT' | 'HISTORY'>('MESSAGES');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  // Forms
  const [drawAmount, setDrawAmount] = useState('');
  const [drawAccount, setDrawAccount] = useState('');
  const [drawInvoice, setDrawInvoice] = useState('');
  const [reqLimit, setReqLimit] = useState('');
  const [reqReason, setReqReason] = useState('');
  const [reqDoc, setReqDoc] = useState('Q4_Sales_Ledger_Forecast.pdf');
  const [replyMap, setReplyMap] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!activeOrg) return;
    setLoading(true);
    setError(null);
    try {
      const [rfRes, accRes] = await Promise.all([
        apiRequest<any>(`/api/corporate/receivables?orgId=${encodeURIComponent(activeOrg.id)}`),
        apiRequest<any>(`/api/corporate/accounts?orgId=${encodeURIComponent(activeOrg.id)}`),
      ]);
      setData(rfRes);
      const facs = rfRes.facilities || [];
      setSelectedFacility((prev: any) => facs.find((f: any) => f.id === prev?.id) || facs[0] || null);
      const accs = accRes.accounts || [];
      setAccounts(accs);
      if (accs[0] && !drawAccount) setDrawAccount(accs[0].id);
    } catch (err: any) {
      setError(err?.message || 'Unable to load Receivables Finance.');
    } finally {
      setLoading(false);
    }
  }, [activeOrg, drawAccount]);

  useEffect(() => {
    load();
  }, [load]);

  if (!hasPermission('ACCESS_RECEIVABLES_FINANCE')) {
    return <EmptyState title="Receivables Finance Restricted" description="Requires ACCESS_RECEIVABLES_FINANCE permission." />;
  }
  if (loading) return <SkeletonList rows={4} />;
  if (error) return <ErrorBanner message={error} onRetry={load} />;

  const handleDraw = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setError(null);
    try {
      const res = await apiRequest<any>('/api/corporate/receivables/draw', {
        method: 'POST',
        body: JSON.stringify({
          orgId: activeOrg?.id,
          facilityId: selectedFacility.id,
          amount: Number(drawAmount),
          destinationAccountId: drawAccount,
          invoiceReference: drawInvoice,
        }),
      });
      setMsg(`Draw ${res.reference} completed: ${res.message}`);
      setDrawAmount('');
      setDrawInvoice('');
      await load();
    } catch (err: any) {
      setError(err?.message || 'Draw failed.');
    }
  };

  const handleLimitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setError(null);
    try {
      const res = await apiRequest<any>('/api/corporate/receivables/limit-request', {
        method: 'POST',
        body: JSON.stringify({
          orgId: activeOrg?.id,
          facilityId: selectedFacility.id,
          requestedLimit: Number(reqLimit),
          reason: reqReason,
          supportingDocName: reqDoc,
        }),
      });
      setMsg(`Credit limit increase request ${res.reference} submitted (${res.status}).`);
      setReqLimit('');
      setReqReason('');
      await load();
    } catch (err: any) {
      setError(err?.message || 'Limit request failed.');
    }
  };

  const handleReply = async (messageId: string) => {
    const body = replyMap[messageId];
    if (!body?.trim()) return;
    await apiRequest(`/api/corporate/receivables/messages/${messageId}/reply`, {
      method: 'POST',
      body: JSON.stringify({ orgId: activeOrg?.id, body }),
    });
    setReplyMap((p) => ({ ...p, [messageId]: '' }));
    await load();
  };

  return (
    <div className="space-y-5">
      <div className="bg-white border border-[#D7D8D6] rounded-[2px] p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[#252525]">Receivables Finance</h1>
          <p className="text-xs text-[#767676] mt-0.5">Invoice discounting facilities, drawdowns &amp; credit limit management</p>
        </div>
        {(data?.facilities || []).length > 0 && (
          <select
            aria-label="Change receivables facility"
            value={selectedFacility?.id || ''}
            onChange={(e) => setSelectedFacility(data.facilities.find((f: any) => f.id === e.target.value))}
            className="min-h-[40px] px-3 text-xs font-semibold border border-[#9E9E9E] rounded bg-white"
          >
            {data.facilities.map((f: any) => (
              <option key={f.id} value={f.id}>{f.account_name} ({f.facility_number})</option>
            ))}
          </select>
        )}
      </div>

      {msg && <div className="p-3 rounded bg-[#EBF7F0] border border-[#B7E1CD] text-xs text-[#008A52] font-medium">{msg}</div>}
      {error && <ErrorBanner message={error} />}

      {!selectedFacility ? (
        <EmptyState title="No receivables facilities" description="No active invoice financing facilities configured for this organisation." />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white border border-[#D7D8D6] rounded-[2px] p-4">
              <div className="text-xs text-[#767676]">Facility Limit ({selectedFacility.scenario})</div>
              <div className="text-xl font-bold text-[#252525] tabular-nums mt-1">
                {formatFinancialCurrency(selectedFacility.total_limit, selectedFacility.currency, hideBalances)}
              </div>
            </div>
            <div className="bg-white border border-[#D7D8D6] rounded-[2px] p-4">
              <div className="text-xs text-[#767676]">Available to Draw ({selectedFacility.advance_rate_pct}% Advance)</div>
              <div className="text-xl font-bold text-[#008A52] tabular-nums mt-1">
                {formatFinancialCurrency(selectedFacility.available_limit, selectedFacility.currency, hideBalances)}
              </div>
            </div>
            <div className="bg-white border border-[#D7D8D6] rounded-[2px] p-4">
              <div className="text-xs text-[#767676]">Utilised Balance</div>
              <div className="text-xl font-semibold text-[#252525] tabular-nums mt-1">
                {formatFinancialCurrency(selectedFacility.utilised_amount, selectedFacility.currency, hideBalances)}
              </div>
            </div>
          </div>

          <SectionCard noPadding>
            <div className="p-3 border-b border-[#D7D8D6] flex flex-wrap gap-1.5">
              {(
                [
                  { id: 'MESSAGES', label: 'Message Centre' },
                  { id: 'DRAW', label: 'Draw Payment' },
                  { id: 'LIMIT', label: 'Request Limit Increase' },
                  { id: 'HISTORY', label: 'Recent Draws & Requests' },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSubTab(t.id)}
                  className={`px-3 py-1.5 rounded text-xs font-semibold ${subTab === t.id ? 'bg-[#252525] text-white' : 'text-[#555555] hover:bg-[#EBEBEB]'}`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="p-4 sm:p-5">
              {subTab === 'MESSAGES' && (
                <div className="space-y-4">
                  {(data.messages || []).map((m: any) => (
                    <div key={m.id} className="p-4 rounded-[2px] border border-[#D7D8D6] space-y-2 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-sm text-[#252525]">{m.subject}</span>
                        <StatusBadge status={m.status} />
                      </div>
                      <p className="text-[#555555]">{m.body}</p>
                      <div className="text-[11px] text-[#767676]">{m.sender_name} • {formatDateTime(m.created_at)}</div>
                      {m.attachments?.length > 0 && (
                        <div className="text-[11px] text-[#252525] font-medium">Attachment: {m.attachments[0].name}</div>
                      )}
                      <div className="flex gap-2 pt-2">
                        <input
                          type="text"
                          placeholder="Write reply to Receivables Desk..."
                          value={replyMap[m.id] || ''}
                          onChange={(e) => setReplyMap((p) => ({ ...p, [m.id]: e.target.value }))}
                          className="flex-1 min-h-[38px] px-3 border border-[#9E9E9E] rounded text-xs"
                        />
                        <Button size="sm" onClick={() => handleReply(m.id)}>Reply</Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {subTab === 'DRAW' && (
                <form onSubmit={handleDraw} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormInput
                    label={`Draw Amount (${selectedFacility.currency})`}
                    type="number"
                    requiredMark
                    value={drawAmount}
                    onChange={(e) => setDrawAmount(e.target.value)}
                  />
                  <FormSelect label="Credit Operating Account" requiredMark value={drawAccount} onChange={(e) => setDrawAccount(e.target.value)}>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>{a.account_name} ({a.currency})</option>
                    ))}
                  </FormSelect>
                  <FormInput label="Invoice Batch / Schedule Ref" value={drawInvoice} onChange={(e) => setDrawInvoice(e.target.value)} />
                  <div className="sm:col-span-2">
                    <Button type="submit">Confirm &amp; Execute Drawdown</Button>
                  </div>
                </form>
              )}

              {subTab === 'LIMIT' && (
                <form onSubmit={handleLimitRequest} className="space-y-4 max-w-lg">
                  <FormInput
                    label={`Requested New Limit (${selectedFacility.currency})`}
                    type="number"
                    requiredMark
                    hint={`Current Limit: ${formatFinancialCurrency(selectedFacility.total_limit, selectedFacility.currency)}`}
                    value={reqLimit}
                    onChange={(e) => setReqLimit(e.target.value)}
                  />
                  <FormInput label="Business Justification" requiredMark value={reqReason} onChange={(e) => setReqReason(e.target.value)} />
                  <FormInput label="Supporting Document Reference" value={reqDoc} onChange={(e) => setReqDoc(e.target.value)} />
                  <Button type="submit">Submit Limit Increase Request</Button>
                </form>
              )}

              {subTab === 'HISTORY' && (
                <div className="space-y-4 text-xs">
                  <h3 className="font-semibold text-[#252525]">Recent Drawdowns</h3>
                  {(data.draws || []).length === 0 ? <p className="text-[#767676]">No draws yet.</p> : (
                    <div className="divide-y divide-[#D7D8D6]">
                      {data.draws.map((d: any) => (
                        <div key={d.id} className="py-2 flex justify-between">
                          <span>{d.reference} • {d.invoice_reference || 'General Draw'}</span>
                          <span className="font-bold tabular-nums">{formatFinancialCurrency(d.amount, d.currency, hideBalances)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <h3 className="font-semibold text-[#252525] pt-2">Limit Increase Requests</h3>
                  {(data.limitRequests || []).length === 0 ? <p className="text-[#767676]">No limit requests submitted.</p> : (
                    <div className="divide-y divide-[#D7D8D6]">
                      {data.limitRequests.map((r: any) => (
                        <div key={r.id} className="py-2 flex justify-between items-center">
                          <span>{r.reference} — {formatFinancialCurrency(r.requested_limit, selectedFacility.currency)}</span>
                          <StatusBadge status={r.status} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </SectionCard>
        </>
      )}
    </div>
  );
};

/* ============================================================================
 * 3. TRADE FINANCE
 * ========================================================================== */
export const TradeFinanceView: React.FC = () => {
  const { activeOrg, hideBalances, hasPermission } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeOrg) return;
    setLoading(true);
    try {
      const res = await apiRequest<any>(`/api/corporate/trade?orgId=${encodeURIComponent(activeOrg.id)}`);
      setItems(res.transactions || []);
    } catch (err: any) {
      setError(err?.message || 'Unable to load trade finance.');
    } finally {
      setLoading(false);
    }
  }, [activeOrg]);

  useEffect(() => {
    load();
  }, [load]);

  const decide = async (id: string, decision: 'APPROVED' | 'REJECTED') => {
    await apiRequest(`/api/corporate/trade/${id}/decide`, {
      method: 'POST',
      body: JSON.stringify({ orgId: activeOrg?.id, decision }),
    });
    await load();
  };

  if (!hasPermission('ACCESS_TRADE_FINANCE')) {
    return <EmptyState title="Trade Finance Restricted" description="Requires ACCESS_TRADE_FINANCE permission." />;
  }
  if (loading) return <SkeletonList rows={3} />;
  if (error) return <ErrorBanner message={error} onRetry={load} />;

  return (
    <div className="space-y-5">
      <div className="bg-white border border-[#D7D8D6] rounded-[2px] p-4 sm:p-5">
        <h1 className="text-xl font-semibold text-[#252525]">Trade Finance</h1>
        <p className="text-xs text-[#767676] mt-0.5">Import Documentary Credits, Amendments, Import Bills &amp; Trade Authorisations</p>
      </div>
      <SectionCard>
        {items.length === 0 ? (
          <EmptyState icon={Ship} title="No trade instruments" description="No documentary credits or import bills for this entity." />
        ) : (
          <div className="divide-y divide-[#D7D8D6]">
            {items.map((t) => (
              <div key={t.id} className="py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-[#252525]">{t.counterparty}</span>
                    <StatusBadge status={t.status} />
                  </div>
                  <div className="text-xs text-[#767676]">
                    {t.reference} • {t.trade_category.replace(/_/g, ' ')} ({t.direction}) • {t.pending_action}
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {(t.documents || []).map((d: any) => (
                      <span key={d.id} className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-[#F4F4F4] border border-[#D7D8D6]">
                        <FileText className="w-3 h-3" /> {d.name}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-[#252525] tabular-nums">{formatFinancialCurrency(t.amount, t.currency, hideBalances)}</span>
                  {t.status === 'AWAITING_AUTHORISATION' && hasPermission('APPROVE_PAYMENTS') && (
                    <>
                      <Button size="sm" onClick={() => decide(t.id, 'APPROVED')}>Authorise</Button>
                      <Button size="sm" variant="danger" onClick={() => decide(t.id, 'REJECTED')}>Reject</Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
};

/* ============================================================================
 * 4. REMOTE DEPOSIT CAPTURE (COUNTRY-GATED)
 * ========================================================================== */
export const RdcView: React.FC = () => {
  const { activeOrg, countryCapability, hasModule } = useAuth();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [deposits, setDeposits] = useState<any[]>([]);
  const [accountId, setAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [chequeDate, setChequeDate] = useState(new Date().toISOString().slice(0, 10));
  const [frontFile, setFrontFile] = useState<string>('');
  const [backFile, setBackFile] = useState<string>('');
  const [frontPreview, setFrontPreview] = useState<string>('');
  const [backPreview, setBackPreview] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const isEnabled = hasModule('remoteDepositCapture') && countryCapability.supportsRDC;

  const load = useCallback(async () => {
    if (!activeOrg || !isEnabled) return;
    try {
      const [rdcRes, accRes] = await Promise.all([
        apiRequest<any>(`/api/corporate/rdc?orgId=${encodeURIComponent(activeOrg.id)}`),
        apiRequest<any>(`/api/corporate/accounts?orgId=${encodeURIComponent(activeOrg.id)}`),
      ]);
      setDeposits(rdcRes.deposits || []);
      const accs = accRes.accounts || [];
      setAccounts(accs);
      if (accs[0] && !accountId) setAccountId(accs[0].id);
    } catch (err: any) {
      setError(err?.message);
    }
  }, [activeOrg, isEnabled, accountId]);

  useEffect(() => {
    load();
  }, [load]);

  if (!isEnabled) {
    return (
      <SectionCard title="Remote Deposit Capture">
        <EmptyState
          icon={Camera}
          title={`Unavailable in ${countryCapability.name}`}
          description={`Remote cheque deposit capture is disabled for organisations domiciled in ${countryCapability.name} (${countryCapability.code}). Switch to a UK or US corporate entity to access Remote Deposit Capture.`}
        />
      </SectionCard>
    );
  }

  const handleImagePick = (side: 'front' | 'back', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    if (side === 'front') {
      setFrontFile(file.name);
      setFrontPreview(url);
    } else {
      setBackFile(file.name);
      setBackPreview(url);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await apiRequest<any>('/api/corporate/rdc', {
        method: 'POST',
        body: JSON.stringify({
          orgId: activeOrg?.id,
          accountId,
          amount: Number(amount),
          chequeDate,
          frontImageName: frontFile,
          backImageName: backFile,
        }),
      });
      setSuccessMsg(`Sandbox cheque deposit ${res.deposit.reference} queued for clearing. (No real cheque clearing network connected.)`);
      setAmount('');
      await load();
    } catch (err: any) {
      setError(err?.message || 'Submission failed.');
    }
  };

  return (
    <div className="space-y-5">
      <div className="bg-white border border-[#D7D8D6] rounded-[2px] p-4 sm:p-5">
        <h1 className="text-xl font-semibold text-[#252525]">Remote Deposit Capture</h1>
        <p className="text-xs text-[#767676] mt-0.5">Enabled for {countryCapability.name} ({countryCapability.code}) — Sandbox Cheque Workflow</p>
      </div>
      {error && <ErrorBanner message={error} />}
      {successMsg && <div className="p-3 rounded bg-[#EBF7F0] border border-[#B7E1CD] text-xs text-[#008A52]">{successMsg}</div>}
      <SectionCard title="Capture Cheque Images &amp; Submit">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormSelect label="Deposit Account" requiredMark value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.account_name} ({a.currency})</option>
              ))}
            </FormSelect>
            <FormInput label="Cheque Amount" type="number" step="0.01" requiredMark value={amount} onChange={(e) => setAmount(e.target.value)} />
            <FormInput label="Cheque Date" type="date" requiredMark value={chequeDate} onChange={(e) => setChequeDate(e.target.value)} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="p-4 border border-dashed border-[#9E9E9E] rounded-[2px] flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-[#F9FAFB]">
              <Upload className="w-5 h-5 text-[#252525]" />
              <span className="text-xs font-semibold text-[#252525]">{frontFile || 'Capture / Upload Front Cheque Image'}</span>
              {frontPreview && <img src={frontPreview} alt="Front cheque preview" className="max-h-24 rounded border" />}
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleImagePick('front', e)} />
            </label>
            <label className="p-4 border border-dashed border-[#9E9E9E] rounded-[2px] flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-[#F9FAFB]">
              <Upload className="w-5 h-5 text-[#252525]" />
              <span className="text-xs font-semibold text-[#252525]">{backFile || 'Capture / Upload Back Cheque Image'}</span>
              {backPreview && <img src={backPreview} alt="Back cheque preview" className="max-h-24 rounded border" />}
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleImagePick('back', e)} />
            </label>
          </div>
          <Button type="submit">Submit Cheque Deposit (Sandbox)</Button>
        </form>
      </SectionCard>
      {deposits.length > 0 && (
        <SectionCard title="Recent Remote Deposits">
          <div className="divide-y divide-[#D7D8D6] text-xs">
            {deposits.map((d) => (
              <div key={d.id} className="py-2.5 flex justify-between items-center">
                <div><strong>{d.reference}</strong> • Quality: {d.quality_status}</div>
                <div className="flex items-center gap-3">
                  <span className="font-bold tabular-nums">{formatFinancialCurrency(d.amount, d.currency)}</span>
                  <StatusBadge status={d.status} />
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
};

/* ============================================================================
 * 5. SELF-SERVICE & DOCUMENT REQUESTS
 * ========================================================================== */
export const SelfServiceView: React.FC = () => {
  const { activeOrg, hasPermission } = useAuth();
  const [requests, setRequests] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [reqType, setReqType] = useState('BALANCE_CERTIFICATE');
  const [accountId, setAccountId] = useState('');
  const [period, setPeriod] = useState('FY 2026 YTD');
  const [notes, setNotes] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeOrg) return;
    const [srRes, accRes] = await Promise.all([
      apiRequest<any>(`/api/corporate/self-service?orgId=${encodeURIComponent(activeOrg.id)}`),
      apiRequest<any>(`/api/corporate/accounts?orgId=${encodeURIComponent(activeOrg.id)}`),
    ]);
    setRequests(srRes.requests || []);
    const accs = accRes.accounts || [];
    setAccounts(accs);
    if (accs[0] && !accountId) setAccountId(accs[0].id);
  }, [activeOrg, accountId]);

  useEffect(() => {
    load();
  }, [load]);

  if (!hasPermission('REQUEST_DOCUMENTS')) {
    return <EmptyState title="Self-Service Restricted" description="Requires REQUEST_DOCUMENTS permission." />;
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await apiRequest<any>('/api/corporate/self-service', {
      method: 'POST',
      body: JSON.stringify({ orgId: activeOrg?.id, requestType: reqType, accountId, period, details: { notes } }),
    });
    setMsg(`Request ${res.request.reference} submitted (${res.request.status}).`);
    setNotes('');
    await load();
  };

  return (
    <div className="space-y-5">
      <div className="bg-white border border-[#D7D8D6] rounded-[2px] p-4 sm:p-5">
        <h1 className="text-xl font-semibold text-[#252525]">Self-Service &amp; Document Requests</h1>
        <p className="text-xs text-[#767676] mt-0.5">Request official balance certificates, banker letters, and duplicate statements</p>
      </div>
      {msg && <div className="p-3 rounded bg-[#EBF7F0] border border-[#B7E1CD] text-xs text-[#008A52] font-medium">{msg}</div>}
      <SectionCard title="New Service Request">
        <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormSelect label="Request Type" value={reqType} onChange={(e) => setReqType(e.target.value)}>
            <option value="BALANCE_CERTIFICATE">Balance Certificate</option>
            <option value="BANKER_CERTIFICATE">Banker / Audit Confirmation</option>
            <option value="HISTORICAL_STATEMENT">Historical Statement</option>
            <option value="DUPLICATE_STATEMENT">Duplicate Statement</option>
            <option value="STATEMENT_EMAIL_UPDATE">Statement Email Delivery Update</option>
            <option value="ACCOUNT_INFO_REQUEST">Account Information Request</option>
          </FormSelect>
          <FormSelect label="Target Account" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.account_name} ({a.currency})</option>
            ))}
          </FormSelect>
          <FormInput label="Statement / Certificate Period" value={period} onChange={(e) => setPeriod(e.target.value)} />
          <FormInput label="Additional Instructions" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <div className="sm:col-span-2">
            <Button type="submit">Submit Request</Button>
          </div>
        </form>
      </SectionCard>
      <SectionCard title="Submitted Requests">
        <div className="divide-y divide-[#D7D8D6] text-xs">
          {requests.map((r) => (
            <div key={r.id} className="py-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-semibold text-[#252525]">{r.request_type.replace(/_/g, ' ')} — {r.reference}</div>
                <div className="text-[#767676]">Period: {r.period} • {formatDateTime(r.created_at)}</div>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={r.status} />
                {r.document_name && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-[#F4F4F4] border border-[#D7D8D6] font-medium">
                    <FileCheck className="w-3.5 h-3.5 text-[#008A52]" /> {r.document_name}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
};
