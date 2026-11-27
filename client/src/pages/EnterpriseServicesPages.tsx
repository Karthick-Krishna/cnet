import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  FileCheck,
  FileText,
  Fingerprint,
  Maximize2,
  Search,
  Settings,
  Ship,
  SlidersHorizontal,
  Upload,
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
  FormSelect,
  NativeDialog,
  SkeletonList,
  StatusBadge,
} from '../components/ui/Primitives';
import { parseRequestOptions, serializeCredential } from '../lib/webauthn';

/* ============================================================================
 * 1. LIQUIDITY DASHBOARD (liquidity.pdf p.2-8 structure)
 * ========================================================================== */
export const LiquidityView: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const { activeOrg, hideBalances, hasPermission } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Screens: DASHBOARD | FILTER | SETTINGS
  const [subScreen, setSubScreen] = useState<'DASHBOARD' | 'FILTER' | 'SETTINGS'>('DASHBOARD');
  const [kpiExpanded, setKpiExpanded] = useState(false);

  // Summary balances controls
  const [dim1, setDim1] = useState<'PRODUCT' | 'CURRENCY'>('PRODUCT');
  const [summaryMode, setSummaryMode] = useState<'GRAPH' | 'LIST'>('GRAPH');
  const [expandedChartTitle, setExpandedChartTitle] = useState<string | null>(null);

  // Balance over time & trend controls
  const [timePeriod, setTimePeriod] = useState<'W' | 'M' | 'Q' | 'Y'>('M');
  const [trendPeriod, setTrendPeriod] = useState<'M' | 'Q'>('M');
  const [selectedPoint, setSelectedPoint] = useState<any | null>(null);

  // Filters
  const [filterSearch, setFilterSearch] = useState('');
  const [productFilter, setProductFilter] = useState('ALL');
  const [depositFilter, setDepositFilter] = useState('ALL');
  const [locationFilter, setLocationFilter] = useState('ALL');
  const [institutionFilter, setInstitutionFilter] = useState('ALL');

  // Settings
  const [refCurrency, setRefCurrency] = useState('');
  const [dateFmt, setDateFmt] = useState('DD-MM-YYYY');
  const [decSep, setDecSep] = useState('.');
  const [thouSep, setThouSep] = useState(',');
  const [accFormat, setAccFormat] = useState('MASKED');
  const [showSummaryChart, setShowSummaryChart] = useState(true);
  const [showOverTimeChart, setShowOverTimeChart] = useState(true);
  const [showTrendChart, setShowTrendChart] = useState(true);

  const load = useCallback(async () => {
    if (!activeOrg) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest<any>(`/api/corporate/liquidity?orgId=${encodeURIComponent(activeOrg.id)}`);
      setData(res);
      if (!refCurrency) setRefCurrency(res.baseCurrency);
    } catch (err: any) {
      setError(err?.message || 'Unable to load liquidity dashboard.');
    } finally {
      setLoading(false);
    }
  }, [activeOrg, refCurrency]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredAccounts = useMemo(() => {
    const list = data?.accounts || [];
    const q = filterSearch.toLowerCase().trim();
    return list.filter((a: any) => {
      if (productFilter !== 'ALL' && a.account_type !== productFilter) return false;
      if (depositFilter === 'TERM' && a.account_type !== 'FIXED_DEPOSIT') return false;
      if (depositFilter === 'DEMAND' && a.account_type === 'FIXED_DEPOSIT') return false;
      if (locationFilter !== 'ALL' && a.country !== locationFilter) return false;
      if (institutionFilter !== 'ALL' && a.branch_name !== institutionFilter) return false;
      if (q) {
        return a.account_name.toLowerCase().includes(q) || a.currency.toLowerCase().includes(q) || a.country.toLowerCase().includes(q);
      }
      return true;
    });
  }, [data, filterSearch, productFilter, depositFilter, locationFilter, institutionFilter]);

  if (!hasPermission('VIEW_LIQUIDITY')) {
    return (
      <div className="bg-white md:border md:border-[#D9DEE1]">
        <GeometricHeader title="Liquidity dashboard" />
        <EmptyState title="Liquidity Restricted" description="Requires VIEW_LIQUIDITY permission." />
      </div>
    );
  }
  if (loading) return <SkeletonList rows={5} />;
  if (error) return <ErrorBanner message={error} onRetry={load} />;
  if (!data) return null;

  const displayCurrency = refCurrency || data.baseCurrency;
  const totalPos = filteredAccounts.reduce((s: number, a: any) => s + (a.baseEquivalent || 0), 0);
  const demandTotal = filteredAccounts.filter((a: any) => a.account_type !== 'FIXED_DEPOSIT' && a.available_balance >= 0).reduce((s: number, a: any) => s + (a.baseEquivalent || 0), 0);
  const termTotal = filteredAccounts.filter((a: any) => a.account_type === 'FIXED_DEPOSIT').reduce((s: number, a: any) => s + (a.baseEquivalent || 0), 0);
  const overdraftTotal = filteredAccounts.filter((a: any) => a.available_balance < 0).reduce((s: number, a: any) => s + (a.baseEquivalent || 0), 0);

  // LMD Settings Screen (liquidity.pdf p.3)
  if (subScreen === 'SETTINGS') {
    return (
      <div className="bg-white md:border md:border-[#D9DEE1]">
        <BankingHeader title="Settings" onBack={() => setSubScreen('DASHBOARD')} />
        <div className="p-4 sm:p-5 space-y-4">
          <FormSelect label="Reference currency" value={displayCurrency} onChange={(e) => setRefCurrency(e.target.value)}>
            <option value="GBP">GBP</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="INR">INR</option>
          </FormSelect>
          <FormSelect label="Date format" value={dateFmt} onChange={(e) => setDateFmt(e.target.value)}>
            <option value="DD-MM-YYYY">DD-MM-YYYY</option>
            <option value="MM-DD-YYYY">MM-DD-YYYY</option>
          </FormSelect>
          <FormSelect label="Decimal separator" value={decSep} onChange={(e) => setDecSep(e.target.value)}>
            <option value=".">. (Dot)</option>
            <option value=",">, (Comma)</option>
          </FormSelect>
          <FormSelect label="Thousands separator" value={thouSep} onChange={(e) => setThouSep(e.target.value)}>
            <option value=",">, (Comma)</option>
            <option value=".">. (Dot)</option>
          </FormSelect>
          <FormSelect label="Account number format" value={accFormat} onChange={(e) => setAccFormat(e.target.value)}>
            <option value="MASKED">Masked (•••• 0291)</option>
            <option value="DEFAULT">Full corporate account number</option>
          </FormSelect>

          <div className="pt-2 space-y-2 border-t border-[#D9DEE1] text-xs">
            <div className="font-semibold text-[#68727A] uppercase">Visible Dashboard Charts</div>
            <label className="flex items-center justify-between py-2">
              <span>Summary balances</span>
              <input type="checkbox" checked={showSummaryChart} onChange={(e) => setShowSummaryChart(e.target.checked)} className="w-4 h-4 accent-[#DB001B]" />
            </label>
            <label className="flex items-center justify-between py-2">
              <span>Balance over time</span>
              <input type="checkbox" checked={showOverTimeChart} onChange={(e) => setShowOverTimeChart(e.target.checked)} className="w-4 h-4 accent-[#DB001B]" />
            </label>
            <label className="flex items-center justify-between py-2">
              <span>Balance trend analysis</span>
              <input type="checkbox" checked={showTrendChart} onChange={(e) => setShowTrendChart(e.target.checked)} className="w-4 h-4 accent-[#DB001B]" />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3 pt-2">
            <Button variant="outline" onClick={() => { setShowSummaryChart(true); setShowOverTimeChart(true); setShowTrendChart(true); }}>Reset</Button>
            <Button onClick={() => setSubScreen('DASHBOARD')}>Apply</Button>
          </div>
        </div>
      </div>
    );
  }

  // LMD Filter Screen (liquidity.pdf p.4)
  if (subScreen === 'FILTER') {
    const locs = Array.from(new Set((data.accounts || []).map((a: any) => a.country)));
    const insts = Array.from(new Set((data.accounts || []).map((a: any) => a.branch_name)));
    return (
      <div className="bg-white md:border md:border-[#D9DEE1]">
        <BankingHeader title="Filter" onBack={() => setSubScreen('DASHBOARD')} />
        <div className="p-4 sm:p-5 space-y-4">
          <div className="relative">
            <Search className="w-4 h-4 text-[#68727A] absolute left-3 top-3" />
            <input
              type="search"
              placeholder="Search accounts, currency, country..."
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              className="w-full min-h-[42px] pl-9 pr-3 text-sm border border-[#B4BCC2] rounded-[2px]"
            />
          </div>
          <FormSelect label="Product type" value={productFilter} onChange={(e) => setProductFilter(e.target.value)}>
            <option value="ALL">All</option>
            <option value="SAVINGS">Operating Savings</option>
            <option value="CURRENT">Current</option>
            <option value="TREASURY">Treasury Pool</option>
            <option value="FIXED_DEPOSIT">Term Deposit</option>
            <option value="FOREIGN_CURRENCY">Foreign Currency</option>
          </FormSelect>
          <FormSelect label="Deposit type" value={depositFilter} onChange={(e) => setDepositFilter(e.target.value)}>
            <option value="ALL">All</option>
            <option value="DEMAND">Demand deposit</option>
            <option value="TERM">Term deposit</option>
          </FormSelect>
          <FormSelect label="Location" value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)}>
            <option value="ALL">All</option>
            {locs.map((l: any) => <option key={l} value={l}>{l}</option>)}
          </FormSelect>
          <FormSelect label="Financial institution" value={institutionFilter} onChange={(e) => setInstitutionFilter(e.target.value)}>
            <option value="ALL">All</option>
            {insts.map((i: any) => <option key={i} value={i}>{i}</option>)}
          </FormSelect>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => {
                setFilterSearch('');
                setProductFilter('ALL');
                setDepositFilter('ALL');
                setLocationFilter('ALL');
                setInstitutionFilter('ALL');
              }}
            >
              Reset
            </Button>
            <Button onClick={() => setSubScreen('DASHBOARD')}>Apply</Button>
          </div>
        </div>
      </div>
    );
  }

  const maxHist = Math.max(...(data.history || []).map((h: any) => h.ledger), 1);

  return (
    <div className="bg-white md:border md:border-[#D9DEE1]">
      <GeometricHeader
        title="Liquidity dashboard"
        subtitle={activeOrg?.name}
        actions={
          <>
            {onBack && (
              <button type="button" onClick={onBack} className="px-2.5 py-1.5 text-xs text-white/85 hover:bg-white/10 rounded-[2px]">
                More
              </button>
            )}
            <button type="button" onClick={() => setSubScreen('SETTINGS')} aria-label="Liquidity settings" className="min-w-[40px] min-h-[40px] flex items-center justify-center text-white/90 hover:bg-white/10">
              <Settings className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => setSubScreen('FILTER')} aria-label="Filter liquidity" className="min-w-[40px] min-h-[40px] flex items-center justify-center text-white/90 hover:bg-white/10">
              <SlidersHorizontal className="w-4 h-4" />
            </button>
          </>
        }
      />

      {/* Current balance compared to yesterday */}
      <div className="px-4 py-2 bg-[#F4F5F6] border-b border-[#D9DEE1] text-[11px] text-[#68727A]">
        Current balance compared to yesterday
      </div>

      {/* Expandable Total Position KPI (liquidity.pdf p.5) */}
      <div className="p-4 border-b border-[#D9DEE1]">
        <div className="text-xs text-[#68727A]">Total position</div>
        <div className="text-2xl font-normal text-[#252B30] tabular-nums mt-0.5">
          {formatFinancialCurrency(totalPos, displayCurrency, hideBalances)}
        </div>
        <div className="text-xs text-[#27835B] font-medium mt-1">↑ 2.4% (Sandbox comparative)</div>

        {kpiExpanded && (
          <div className="mt-4 pt-3 border-t border-[#D9DEE1] grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <div className="text-[#68727A]">Demand deposits</div>
              <div className="font-semibold text-[#252B30] tabular-nums mt-0.5">{formatFinancialCurrency(demandTotal, displayCurrency, hideBalances)}</div>
            </div>
            <div>
              <div className="text-[#68727A]">Overdrafts</div>
              <div className="font-semibold text-[#252B30] tabular-nums mt-0.5">{formatFinancialCurrency(overdraftTotal, displayCurrency, hideBalances)}</div>
            </div>
            <div>
              <div className="text-[#68727A]">Term deposits</div>
              <div className="font-semibold text-[#252B30] tabular-nums mt-0.5">{formatFinancialCurrency(termTotal, displayCurrency, hideBalances)}</div>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => setKpiExpanded((v) => !v)}
          aria-expanded={kpiExpanded}
          className="w-full pt-2 flex justify-center text-[#68727A] hover:text-[#252B30]"
          aria-label={kpiExpanded ? 'Collapse KPI breakdown' : 'Expand KPI breakdown'}
        >
          {kpiExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Summary Balances Chart & List View */}
      {showSummaryChart && (
        <div className="p-4 border-b border-[#D9DEE1]">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="text-sm font-medium text-[#252B30]">Summary balances</h2>
            <button type="button" onClick={() => setExpandedChartTitle('Summary balances')} aria-label="Expand summary chart" className="p-1.5 text-[#68727A] hover:text-[#252B30]">
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="mb-3">
            <FormSelect label="Dimension" value={dim1} onChange={(e) => setDim1(e.target.value as any)}>
              <option value="PRODUCT">Product &amp; Currency</option>
              <option value="CURRENCY">Currency Only</option>
            </FormSelect>
          </div>

          <div className="flex gap-4 border-b border-[#D9DEE1] text-xs font-medium mb-4" role="tablist">
            <button
              role="tab"
              aria-selected={summaryMode === 'GRAPH'}
              onClick={() => setSummaryMode('GRAPH')}
              className={`pb-2 border-b-[2px] ${summaryMode === 'GRAPH' ? 'border-[#DB001B] text-[#252B30]' : 'border-transparent text-[#68727A]'}`}
            >
              Graph view
            </button>
            <button
              role="tab"
              aria-selected={summaryMode === 'LIST'}
              onClick={() => setSummaryMode('LIST')}
              className={`pb-2 border-b-[2px] ${summaryMode === 'LIST' ? 'border-[#DB001B] text-[#252B30]' : 'border-transparent text-[#68727A]'}`}
            >
              List view
            </button>
          </div>

          {summaryMode === 'GRAPH' ? (
            <div className="flex items-end gap-4 h-40 pt-3">
              {filteredAccounts.map((a: any) => {
                const maxVal = Math.max(...filteredAccounts.map((x: any) => x.baseEquivalent || 1), 1);
                const pct = Math.max(12, Math.round(((a.baseEquivalent || 0) / maxVal) * 100));
                return (
                  <div key={a.id} className="flex-1 flex flex-col items-center justify-end h-full gap-1">
                    <div className="w-full max-w-[36px] bg-[#1E6B7B]" style={{ height: `${pct}%` }} title={`${a.account_name}: ${a.baseEquivalent}`} />
                    <div className="text-[10px] text-[#68727A] truncate max-w-full">{a.currency}</div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="divide-y divide-[#D9DEE1] text-xs">
              {filteredAccounts.map((a: any) => (
                <div key={a.id} className="py-2.5 flex justify-between gap-3">
                  <div>
                    <div className="font-medium text-[#252B30]">{a.account_name}</div>
                    <div className="text-[#68727A]">{accFormat === 'MASKED' ? a.maskedAccountNumber : a.account_number} • {a.currency}</div>
                  </div>
                  <div className="text-right font-semibold tabular-nums">
                    {formatFinancialCurrency(a.available_balance, a.currency, hideBalances)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Balance Over Time Chart (liquidity.pdf p.7) */}
      {showOverTimeChart && (
        <div className="p-4 border-b border-[#D9DEE1]">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="text-sm font-medium text-[#252B30]">Balance over time</h2>
            <button type="button" onClick={() => setExpandedChartTitle('Balance over time')} aria-label="Expand balance over time" className="p-1.5 text-[#68727A] hover:text-[#252B30]">
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex gap-4 border-b border-[#D9DEE1] text-xs font-medium mb-4">
            {(['W', 'M', 'Q', 'Y'] as const).map((p) => (
              <button key={p} type="button" onClick={() => setTimePeriod(p)} className={`pb-2 border-b-[2px] ${timePeriod === p ? 'border-[#DB001B] text-[#252B30]' : 'border-transparent text-[#68727A]'}`}>
                {p}
              </button>
            ))}
          </div>
          <div className="flex items-end gap-3 h-36 pt-2">
            {(data.history || []).map((pt: any) => {
              const pct = Math.max(12, Math.round((pt.available / maxHist) * 100));
              return (
                <button
                  key={pt.label}
                  type="button"
                  onClick={() => setSelectedPoint(pt)}
                  className="flex-1 flex flex-col items-center justify-end h-full gap-1 hover:opacity-80"
                >
                  <div className="w-full max-w-[40px] bg-[#263640]" style={{ height: `${pct}%` }} />
                  <div className="text-[10px] text-[#68727A]">{pt.label}</div>
                </button>
              );
            })}
          </div>
          {selectedPoint && (
            <div className="mt-2 p-2.5 bg-[#F4F5F6] border border-[#D9DEE1] text-xs flex justify-between">
              <span>{selectedPoint.label} ({timePeriod})</span>
              <strong className="tabular-nums">{formatFinancialCurrency(selectedPoint.available, displayCurrency, hideBalances)}</strong>
            </div>
          )}
        </div>
      )}

      {/* Balance Trend Analysis Chart (liquidity.pdf p.8) */}
      {showTrendChart && (
        <div className="p-4">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="text-sm font-medium text-[#252B30]">Balance trend analysis</h2>
            <button type="button" onClick={() => setExpandedChartTitle('Balance trend analysis')} aria-label="Expand trend analysis" className="p-1.5 text-[#68727A] hover:text-[#252B30]">
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex gap-4 border-b border-[#D9DEE1] text-xs font-medium mb-4">
            {(['M', 'Q'] as const).map((p) => (
              <button key={p} type="button" onClick={() => setTrendPeriod(p)} className={`pb-2 border-b-[2px] ${trendPeriod === p ? 'border-[#DB001B] text-[#252B30]' : 'border-transparent text-[#68727A]'}`}>
                {p}
              </button>
            ))}
          </div>
          <svg viewBox="0 0 600 120" className="w-full h-28" role="img" aria-label="Balance trend line">
            <line x1="0" y1="100" x2="600" y2="100" stroke="#D9DEE1" strokeWidth="1" />
            <line x1="0" y1="50" x2="600" y2="50" stroke="#D9DEE1" strokeDasharray="3 3" strokeWidth="1" />
            <polyline
              fill="none"
              stroke="#1E6B7B"
              strokeWidth="2.5"
              points={(data.history || [])
                .map((pt: any, idx: number, arr: any[]) => {
                  const x = arr.length > 1 ? (idx / (arr.length - 1)) * 560 + 20 : 300;
                  const y = 105 - Math.round((pt.available / maxHist) * 85);
                  return `${x},${y}`;
                })
                .join(' ')}
            />
          </svg>
        </div>
      )}

      <NativeDialog open={!!expandedChartTitle} onClose={() => setExpandedChartTitle(null)} title={expandedChartTitle || 'Chart'} maxWidth="max-w-3xl">
        <div className="text-xs text-[#68727A] space-y-3">
          <div className="p-4 bg-[#F4F5F6] border border-[#D9DEE1]">
            <div className="font-medium text-[#252B30] mb-2">Total Position ({displayCurrency})</div>
            <div className="text-xl font-semibold tabular-nums">{formatFinancialCurrency(totalPos, displayCurrency, hideBalances)}</div>
          </div>
          <div className="divide-y divide-[#D9DEE1] border border-[#D9DEE1]">
            {filteredAccounts.map((a: any) => (
              <div key={a.id} className="p-3 flex justify-between">
                <span>{a.account_name} ({a.currency})</span>
                <strong className="tabular-nums">{formatFinancialCurrency(a.available_balance, a.currency, hideBalances)}</strong>
              </div>
            ))}
          </div>
        </div>
      </NativeDialog>
    </div>
  );
};

/* ============================================================================
 * 2. RECEIVABLES FINANCE (rece_finance.pdf p.2-4 structure)
 * ========================================================================== */
export const ReceivablesView: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const { activeOrg, hideBalances, hasPermission } = useAuth();
  const [data, setData] = useState<any>(null);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selectedFacility, setSelectedFacility] = useState<any>(null);

  // Screens: ACCOUNTS | SERVICES | MESSAGE_CENTRE | DRAW_PAYMENT | CREDIT_LIMIT | TRANSACTIONS
  const [screen, setScreen] = useState<'ACCOUNTS' | 'SERVICES' | 'MESSAGE_CENTRE' | 'DRAW_PAYMENT' | 'CREDIT_LIMIT' | 'TRANSACTIONS'>('ACCOUNTS');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  // Draw Payment State (rece_finance.pdf p.3)
  const [drawMode, setDrawMode] = useState<'SPECIFIED' | 'FULL_NEXT_DAY'>('SPECIFIED');
  const [drawAmount, setDrawAmount] = useState('');
  const [drawDate, setDrawDate] = useState('ASAP');
  const [drawAccount, setDrawAccount] = useState('');
  const [drawMethod] = useState('TRANSFER');
  const [drawInvoice, setDrawInvoice] = useState('');

  // Limit Increase
  const [reqLimit, setReqLimit] = useState('');
  const [reqReason, setReqReason] = useState('');
  const [reqDoc, setReqDoc] = useState('Sales_Ledger_Forecast.pdf');

  // Messages
  const [newMsgOpen, setNewMsgOpen] = useState(false);
  const [newMsgSubject, setNewMsgSubject] = useState('');
  const [newMsgBody, setNewMsgBody] = useState('');
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
      const accs = accRes.accounts || [];
      setAccounts(accs);
      if (accs[0] && !drawAccount) setDrawAccount(accs[0].id);
      if (selectedFacility) {
        const updated = (rfRes.facilities || []).find((f: any) => f.id === selectedFacility.id);
        if (updated) setSelectedFacility(updated);
      }
    } catch (err: any) {
      setError(err?.message || 'Unable to load Receivables Finance.');
    } finally {
      setLoading(false);
    }
  }, [activeOrg, drawAccount, selectedFacility?.id]);

  useEffect(() => {
    load();
  }, [load]);

  if (!hasPermission('ACCESS_RECEIVABLES_FINANCE')) {
    return (
      <div className="bg-white md:border md:border-[#D9DEE1]">
        <GeometricHeader title="Receivables Finance" />
        <EmptyState title="Receivables Finance Restricted" description="Requires ACCESS_RECEIVABLES_FINANCE permission." />
      </div>
    );
  }
  if (loading) return <SkeletonList rows={4} />;
  if (error) return <ErrorBanner message={error} onRetry={load} />;

  // SCREEN 1: ACCOUNT SELECTION (rece_finance.pdf p.2)
  if (screen === 'ACCOUNTS') {
    return (
      <div className="bg-white md:border md:border-[#D9DEE1]">
        <GeometricHeader
          title="Receivables Finance"
          subtitle={activeOrg?.country}
          actions={
            onBack && (
              <button type="button" onClick={onBack} className="px-2.5 py-1.5 text-xs text-white/85 hover:bg-white/10">
                More
              </button>
            )
          }
        />
        {(data?.facilities || []).length === 0 ? (
          <EmptyState title="No receivables facilities" description="No active facilities configured for this entity." />
        ) : (
          <div className="divide-y divide-[#D9DEE1]">
            {data.facilities.map((f: any) => (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  setSelectedFacility(f);
                  setDrawAmount(String(f.available_limit));
                  setScreen('SERVICES');
                }}
                className="w-full px-4 py-4 flex items-center justify-between gap-3 hover:bg-[#F4F5F6] text-left"
              >
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-[#252B30]">{f.scenario}</div>
                  <div className="text-sm text-[#252B30] mt-0.5">{f.account_name}</div>
                  <div className="text-xs text-[#68727A] mt-0.5 tabular-nums">{f.facility_number}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-semibold text-[#252B30]">{f.currency}</span>
                  <ChevronRight className="w-4 h-4 text-[#68727A]" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // SCREEN 2: SERVICES MENU (rece_finance.pdf p.2 bottom)
  if (screen === 'SERVICES' && selectedFacility) {
    return (
      <div className="bg-white md:border md:border-[#D9DEE1]">
        <BankingHeader title="Receivables Finance" onBack={() => setScreen('ACCOUNTS')} />

        <div className="px-4 py-3 bg-[#F4F5F6] border-b border-[#D9DEE1] flex items-center justify-between gap-3 text-xs">
          <div>
            <div className="font-semibold text-[#252B30]">User Account Information</div>
            <div className="text-[#68727A] mt-0.5">{selectedFacility.account_name} ({selectedFacility.currency})</div>
          </div>
          <button type="button" onClick={() => setScreen('ACCOUNTS')} className="text-[#263640] font-medium hover:underline">
            Change Account
          </button>
        </div>

        <div className="divide-y divide-[#D9DEE1]">
          {(
            [
              { id: 'MESSAGE_CENTRE', label: 'Message Centre' },
              { id: 'DRAW_PAYMENT', label: 'Draw Payment' },
              { id: 'CREDIT_LIMIT', label: 'Request Increased Credit Limit' },
              { id: 'TRANSACTIONS', label: 'Recent Transactions' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setMsg(null);
                setError(null);
                setScreen(item.id);
              }}
              className="w-full px-4 py-4 flex items-center justify-between hover:bg-[#F4F5F6] text-left"
            >
              <span className="text-sm text-[#252B30]">{item.label}</span>
              <ChevronRight className="w-4 h-4 text-[#68727A]" />
            </button>
          ))}
        </div>
      </div>
    );
  }

  // MESSAGE CENTRE (rece_finance.pdf p.3 top)
  if (screen === 'MESSAGE_CENTRE' && selectedFacility) {
    return (
      <div className="bg-white md:border md:border-[#D9DEE1] min-h-[500px] flex flex-col justify-between">
        <div>
          <BankingHeader
            title="Message Centre"
            onBack={() => setScreen('SERVICES')}
            rightSlot={<button type="button" onClick={() => setScreen('SERVICES')} className="px-2 text-xs font-medium text-[#263640]">Services</button>}
          />
          <div className="px-4 py-2.5 bg-[#F4F5F6] border-b border-[#D9DEE1] flex justify-between text-xs">
            <span className="font-medium text-[#252B30]">User Account Information • {selectedFacility.facility_number}</span>
            <button type="button" onClick={() => setScreen('ACCOUNTS')} className="text-[#263640] underline">Change Account</button>
          </div>
          <div className="divide-y divide-[#D9DEE1]">
            {(data.messages || []).map((m: any) => (
              <div key={m.id} className="p-4 space-y-2 text-xs">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <div className="font-medium text-[#252B30]">{m.subject}</div>
                    <div className="text-[#68727A] mt-0.5">{m.status} • {formatDateTime(m.created_at)}</div>
                  </div>
                  {m.status === 'UNREAD' && (
                    <button
                      type="button"
                      onClick={async () => {
                        await apiRequest(`/api/corporate/receivables/messages/${m.id}/read`, { method: 'POST' });
                        await load();
                      }}
                      className="text-xs font-medium text-[#DB001B]"
                    >
                      Mark read
                    </button>
                  )}
                </div>
                <p className="text-[#252B30]">{m.body}</p>
                <div className="flex gap-2 pt-1">
                  <input
                    type="text"
                    placeholder="Reply to desk..."
                    value={replyMap[m.id] || ''}
                    onChange={(e) => setReplyMap((p) => ({ ...p, [m.id]: e.target.value }))}
                    className="flex-1 min-h-[38px] px-2.5 border border-[#B4BCC2] rounded-[2px]"
                  />
                  <Button
                    size="sm"
                    onClick={async () => {
                      const b = replyMap[m.id];
                      if (!b?.trim()) return;
                      await apiRequest(`/api/corporate/receivables/messages/${m.id}/reply`, {
                        method: 'POST',
                        body: JSON.stringify({ orgId: activeOrg?.id, body: b }),
                      });
                      setReplyMap((p) => ({ ...p, [m.id]: '' }));
                      await load();
                    }}
                  >
                    Reply
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="p-4 border-t border-[#D9DEE1]">
          <Button fullWidth onClick={() => setNewMsgOpen(true)}>New Message</Button>
        </div>

        <NativeDialog open={newMsgOpen} onClose={() => setNewMsgOpen(false)} title="New Receivables Message">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await apiRequest('/api/corporate/receivables/messages', {
                method: 'POST',
                body: JSON.stringify({ orgId: activeOrg?.id, facilityId: selectedFacility.id, subject: newMsgSubject, body: newMsgBody }),
              });
              setNewMsgOpen(false);
              setNewMsgSubject('');
              setNewMsgBody('');
              await load();
            }}
            className="space-y-3"
          >
            <FormInput label="Subject" required value={newMsgSubject} onChange={(e) => setNewMsgSubject(e.target.value)} />
            <FormInput label="Message" required value={newMsgBody} onChange={(e) => setNewMsgBody(e.target.value)} />
            <Button type="submit" fullWidth>Send Message</Button>
          </form>
        </NativeDialog>
      </div>
    );
  }

  // DRAW PAYMENT (rece_finance.pdf p.3 bottom)
  if (screen === 'DRAW_PAYMENT' && selectedFacility) {
    return (
      <div className="bg-white md:border md:border-[#D9DEE1]">
        <BankingHeader title="Draw Payment" onBack={() => setScreen('SERVICES')} />
        <div className="px-4 py-3 bg-[#F4F5F6] border-b border-[#D9DEE1] flex justify-between items-center text-xs">
          <span>Current availability</span>
          <strong className="tabular-nums text-sm text-[#252B30]">
            {formatFinancialCurrency(selectedFacility.available_limit, selectedFacility.currency, hideBalances)}
          </strong>
        </div>

        {msg && <div className="p-3 bg-[#ECF6F1] border-b border-[#B7DFCC] text-xs text-[#27835B]">{msg}</div>}
        {error && <div className="p-4 pb-0"><ErrorBanner message={error} /></div>}

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null);
            setMsg(null);
            const amt = drawMode === 'FULL_NEXT_DAY' ? selectedFacility.available_limit : Number(drawAmount);
            try {
              const res = await apiRequest<any>('/api/corporate/receivables/draw', {
                method: 'POST',
                body: JSON.stringify({
                  orgId: activeOrg?.id,
                  facilityId: selectedFacility.id,
                  amount: amt,
                  destinationAccountId: drawAccount,
                  invoiceReference: drawInvoice || `${drawMode} (${drawDate})`,
                }),
              });
              setMsg(`Draw ${res.reference} recorded: ${res.message}`);
              await load();
            } catch (err: any) {
              setError(err?.message || 'Draw failed.');
            }
          }}
          className="p-4 space-y-4"
        >
          <fieldset className="divide-y divide-[#D9DEE1] border border-[#D9DEE1]">
            <legend className="visually-hidden">Draw payment mode</legend>
            <label className="p-3 flex items-center gap-3 text-xs cursor-pointer">
              <input type="radio" name="draw-mode" checked={drawMode === 'SPECIFIED'} onChange={() => setDrawMode('SPECIFIED')} className="accent-[#DB001B]" />
              <span>Use specified payment value and date</span>
            </label>
            <label className="p-3 flex items-center gap-3 text-xs cursor-pointer">
              <input
                type="radio"
                name="draw-mode"
                checked={drawMode === 'FULL_NEXT_DAY'}
                onChange={() => {
                  setDrawMode('FULL_NEXT_DAY');
                  setDrawAmount(String(selectedFacility.available_limit));
                }}
                className="accent-[#DB001B]"
              />
              <span>100% availability to be taken next working day</span>
            </label>
          </fieldset>

          {drawMode === 'SPECIFIED' && (
            <FormInput label={`Payment amount (${selectedFacility.currency})`} type="number" step="0.01" required value={drawAmount} onChange={(e) => setDrawAmount(e.target.value)} />
          )}
          <FormSelect label="Payment date" value={drawDate} onChange={(e) => setDrawDate(e.target.value)}>
            <option value="ASAP">ASAP</option>
            <option value={new Date(Date.now() + 86400000).toISOString().slice(0, 10)}>Next working day</option>
          </FormSelect>
          <FormSelect label="Bank account" value={drawAccount} onChange={(e) => setDrawAccount(e.target.value)}>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.account_name} ({a.currency})</option>)}
          </FormSelect>
          <div className="p-3 border border-[#D9DEE1] text-xs flex justify-between">
            <span className="text-[#68727A]">Payment method</span>
            <strong>{drawMethod}</strong>
          </div>
          <FormInput label="Invoice schedule reference (optional)" value={drawInvoice} onChange={(e) => setDrawInvoice(e.target.value)} />
          <Button type="submit" fullWidth size="lg">Draw Payment</Button>
        </form>
      </div>
    );
  }

  // CREDIT LIMIT REQUEST (rece_finance.pdf p.4 left)
  if (screen === 'CREDIT_LIMIT' && selectedFacility) {
    return (
      <div className="bg-white md:border md:border-[#D9DEE1]">
        <BankingHeader title="Customer Credit Limit" onBack={() => setScreen('SERVICES')} />
        <div className="px-4 py-3 bg-[#F4F5F6] border-b border-[#D9DEE1] flex justify-between text-xs">
          <span>Existing Limit</span>
          <strong className="tabular-nums">{formatFinancialCurrency(selectedFacility.total_limit, selectedFacility.currency, hideBalances)}</strong>
        </div>
        {msg && <div className="p-3 bg-[#ECF6F1] border-b border-[#B7DFCC] text-xs text-[#27835B]">{msg}</div>}
        {error && <div className="p-4 pb-0"><ErrorBanner message={error} /></div>}

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null);
            setMsg(null);
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
              setMsg(`Limit request ${res.reference} submitted (${res.status}).`);
              setReqLimit('');
              setReqReason('');
              await load();
            } catch (err: any) {
              setError(err?.message || 'Limit request failed.');
            }
          }}
          className="p-4 space-y-4"
        >
          <FormInput label={`Limit Required (${selectedFacility.currency})`} type="number" required value={reqLimit} onChange={(e) => setReqLimit(e.target.value)} />
          <FormInput label="Reason / Justification" required value={reqReason} onChange={(e) => setReqReason(e.target.value)} />
          <FormInput label="Supporting Document Reference" value={reqDoc} onChange={(e) => setReqDoc(e.target.value)} />
          <Button type="submit" fullWidth>Request new limit</Button>
        </form>
      </div>
    );
  }

  // RECENT TRANSACTIONS (rece_finance.pdf p.4 right)
  return (
    <div className="bg-white md:border md:border-[#D9DEE1]">
      <BankingHeader title="Recent transactions" onBack={() => setScreen('SERVICES')} />
      {(data?.draws || []).length === 0 && (data?.limitRequests || []).length === 0 ? (
        <EmptyState title="No transaction history records found" description="Draws and limit requests submitted for this facility appear here." />
      ) : (
        <div className="divide-y divide-[#D9DEE1] text-xs">
          {(data?.draws || []).map((d: any) => (
            <div key={d.id} className="p-4 flex justify-between items-center">
              <div>
                <div className="font-medium text-[#252B30]">Draw: {d.reference}</div>
                <div className="text-[#68727A]">{d.invoice_reference || 'Facility Drawdown'}</div>
              </div>
              <strong className="tabular-nums">{formatFinancialCurrency(d.amount, d.currency, hideBalances)}</strong>
            </div>
          ))}
          {(data?.limitRequests || []).map((r: any) => (
            <div key={r.id} className="p-4 flex justify-between items-center">
              <div>
                <div className="font-medium text-[#252B30]">Limit Request: {r.reference}</div>
                <div className="text-[#68727A]">Requested: {formatFinancialCurrency(r.requested_limit, selectedFacility?.currency)}</div>
              </div>
              <StatusBadge status={r.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* ============================================================================
 * 3. TRADE AUTHORISATION (Part 13 categories & step-up confirmation)
 * ========================================================================== */
const TRADE_CATEGORIES = [
  { id: 'IMPORT_DC', label: 'Import DCs', match: ['IMPORT_DC', 'DC_AMENDMENT'] },
  { id: 'IMPORT_PRESENTATION', label: 'Import Presentations', match: ['IMPORT_PRESENTATION', 'IMPORT_BILL'] },
  { id: 'TRADE_LOAN', label: 'Trade Loans', match: ['TRADE_LOAN'] },
  { id: 'GUARANTEE_STANDBY_DC', label: 'Guarantee/Standby DCs', match: ['GUARANTEE_STANDBY_DC'] },
];

export const TradeFinanceView: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const { activeOrg, hideBalances, hasPermission } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [detailItem, setDetailItem] = useState<any | null>(null);
  const [decisionModal, setDecisionModal] = useState<{ item: any; decision: 'APPROVED' | 'REJECTED' } | null>(null);
  const [stepUpPin, setStepUpPin] = useState('');
  const [ackMsg, setAckMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeOrg) return;
    setLoading(true);
    try {
      const res = await apiRequest<any>(`/api/corporate/trade?orgId=${encodeURIComponent(activeOrg.id)}`);
      setItems(res.transactions || []);
    } catch (err: any) {
      setError(err?.message || 'Unable to load trade authorisations.');
    } finally {
      setLoading(false);
    }
  }, [activeOrg]);

  useEffect(() => {
    load();
  }, [load]);

  const executeTradeDecision = async (usePasskey = false) => {
    if (!decisionModal) return;
    setError(null);
    try {
      if (decisionModal.decision === 'APPROVED') {
        if (usePasskey) {
          const opts = await apiRequest('/api/auth/webauthn/reauth/options', { method: 'POST' });
          const cred = (await navigator.credentials.get({ publicKey: parseRequestOptions(opts) })) as PublicKeyCredential | null;
          if (!cred) throw new Error('Biometric cancelled.');
          await apiRequest('/api/auth/webauthn/reauth/verify', { method: 'POST', body: JSON.stringify(serializeCredential(cred)) });
        } else {
          await apiRequest('/api/auth/pin/verify', { method: 'POST', body: JSON.stringify({ pin: stepUpPin }) });
        }
      }
      await apiRequest(`/api/corporate/trade/${decisionModal.item.id}/decide`, {
        method: 'POST',
        body: JSON.stringify({ orgId: activeOrg?.id, decision: decisionModal.decision }),
      });
      setAckMsg(`${decisionModal.item.reference} ${decisionModal.decision === 'APPROVED' ? 'authorised' : 'rejected'}.`);
      setDecisionModal(null);
      setDetailItem(null);
      setStepUpPin('');
      await load();
    } catch (err: any) {
      setError(err?.message || 'Trade decision failed.');
    }
  };

  if (!hasPermission('ACCESS_TRADE_FINANCE')) {
    return (
      <div className="bg-white md:border md:border-[#D9DEE1]">
        <GeometricHeader title="Trade Authorisation" />
        <EmptyState title="Trade Finance Restricted" description="Requires ACCESS_TRADE_FINANCE permission." />
      </div>
    );
  }

  if (loading) return <SkeletonList rows={4} />;

  if (detailItem) {
    return (
      <div className="bg-white md:border md:border-[#D9DEE1]">
        <BankingHeader title="Trade Transaction" onBack={() => setDetailItem(null)} subHeader={detailItem.reference} />
        <div className="p-4 border-b border-[#D9DEE1] flex justify-between items-start gap-3">
          <div>
            <div className="text-base font-medium text-[#252B30]">{detailItem.counterparty}</div>
            <div className="text-xs text-[#68727A]">{detailItem.trade_category.replace(/_/g, ' ')}</div>
          </div>
          <div className="text-right">
            <div className="text-lg font-semibold tabular-nums">{formatFinancialCurrency(detailItem.amount, detailItem.currency, hideBalances)}</div>
            <StatusBadge status={detailItem.status} />
          </div>
        </div>
        <div className="p-4 border-b border-[#D9DEE1]">
          <div className="text-xs font-semibold uppercase text-[#68727A] mb-2">Supporting Documents</div>
          <div className="divide-y divide-[#D9DEE1] border border-[#D9DEE1] text-xs">
            {(detailItem.documents || []).map((d: any) => (
              <div key={d.id} className="p-3 flex justify-between">
                <span className="flex items-center gap-2"><FileText className="w-4 h-4 text-[#263640]" /> {d.name}</span>
                <span className="text-[#68727A]">{d.size}</span>
              </div>
            ))}
          </div>
        </div>
        {detailItem.status === 'AWAITING_AUTHORISATION' && hasPermission('APPROVE_PAYMENTS') && (
          <div className="p-4 grid grid-cols-2 gap-3">
            <Button onClick={() => setDecisionModal({ item: detailItem, decision: 'APPROVED' })}>Authorise</Button>
            <Button variant="outline" onClick={() => setDecisionModal({ item: detailItem, decision: 'REJECTED' })}>Reject</Button>
          </div>
        )}

        <NativeDialog open={!!decisionModal} onClose={() => setDecisionModal(null)} title="Confirm Trade Decision">
          {decisionModal && (
            <div className="space-y-4 text-xs">
              <p className="text-[#68727A]">{decisionModal.item.counterparty} • <strong>{decisionModal.item.reference}</strong></p>
              {error && <ErrorBanner message={error} />}
              {decisionModal.decision === 'APPROVED' && (
                <FormInput label="6-Digit Mobile Security PIN" type="password" inputMode="numeric" maxLength={6} value={stepUpPin} onChange={(e) => setStepUpPin(e.target.value.replace(/\D/g, '').slice(0, 6))} />
              )}
              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="outline" onClick={() => setDecisionModal(null)}>Cancel</Button>
                {decisionModal.decision === 'APPROVED' && typeof window !== 'undefined' && !!window.PublicKeyCredential && (
                  <Button variant="secondary" onClick={() => executeTradeDecision(true)}>
                    <Fingerprint className="w-4 h-4" /> Biometrics
                  </Button>
                )}
                <Button onClick={() => executeTradeDecision(false)}>Confirm</Button>
              </div>
            </div>
          )}
        </NativeDialog>
      </div>
    );
  }

  if (selectedCat) {
    const def = TRADE_CATEGORIES.find((c) => c.id === selectedCat)!;
    const list = items.filter((i) => def.match.includes(i.trade_category));
    return (
      <div className="bg-white md:border md:border-[#D9DEE1]">
        <BankingHeader title={def.label} onBack={() => setSelectedCat(null)} />
        {list.length === 0 ? (
          <EmptyState icon={Ship} title={`No ${def.label}`} description="No trade instructions pending in this category." />
        ) : (
          <div className="divide-y divide-[#D9DEE1]">
            {list.map((t) => (
              <button key={t.id} type="button" onClick={() => setDetailItem(t)} className="w-full px-4 py-3.5 flex items-center justify-between gap-3 hover:bg-[#F4F5F6] text-left">
                <div>
                  <div className="text-sm font-medium text-[#252B30]">{t.counterparty}</div>
                  <div className="text-xs text-[#68727A]">{t.reference} • {t.status.replace(/_/g, ' ')}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold tabular-nums">{formatFinancialCurrency(t.amount, t.currency, hideBalances)}</span>
                  <ChevronRight className="w-4 h-4 text-[#68727A]" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white md:border md:border-[#D9DEE1]">
      <GeometricHeader
        title="Trade Authorisation"
        subtitle={activeOrg?.name}
        actions={onBack && <button type="button" onClick={onBack} className="px-2.5 py-1.5 text-xs text-white/85 hover:bg-white/10">More</button>}
      />
      {ackMsg && <div className="p-3 bg-[#ECF6F1] border-b border-[#B7DFCC] text-xs text-[#27835B] font-medium flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />{ackMsg}</div>}
      <div className="px-4 py-2.5 bg-[#F4F5F6] border-b border-[#D9DEE1] text-xs font-medium text-[#252B30]">Trade categories</div>
      <div className="divide-y divide-[#D9DEE1]">
        {TRADE_CATEGORIES.map((cat) => {
          const pendingCount = items.filter((i) => cat.match.includes(i.trade_category) && i.status === 'AWAITING_AUTHORISATION').length;
          return (
            <button key={cat.id} type="button" onClick={() => setSelectedCat(cat.id)} className="w-full px-4 py-4 flex items-center justify-between hover:bg-[#F4F5F6] text-left">
              <span className="text-sm text-[#252B30]">{cat.label}</span>
              <span className="flex items-center gap-2">
                <span className={`text-sm tabular-nums ${pendingCount > 0 ? 'font-semibold text-[#DB001B]' : 'text-[#68727A]'}`}>{pendingCount}</span>
                <ChevronRight className="w-4 h-4 text-[#68727A]" />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

/* ============================================================================
 * 4. REMOTE DEPOSIT CAPTURE (COUNTRY-GATED)
 * ========================================================================== */
export const RdcView: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const { activeOrg, countryCapability, hasModule } = useAuth();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [deposits, setDeposits] = useState<any[]>([]);
  const [accountId, setAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [chequeDate, setChequeDate] = useState(new Date().toISOString().slice(0, 10));
  const [frontFile, setFrontFile] = useState('');
  const [backFile, setBackFile] = useState('');
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

  useEffect(() => { load(); }, [load]);

  if (!isEnabled) {
    return (
      <div className="bg-white md:border md:border-[#D9DEE1]">
        <BankingHeader title="Remote Deposit Capture" onBack={onBack} />
        <EmptyState
          icon={Camera}
          title={`Unavailable in ${countryCapability.name}`}
          description={`Remote Deposit Capture is disabled for entities domiciled in ${countryCapability.name} (${countryCapability.code}).`}
        />
      </div>
    );
  }

  return (
    <div className="bg-white md:border md:border-[#D9DEE1]">
      <BankingHeader title="Remote Deposit Capture" onBack={onBack} subHeader={`${countryCapability.name} (${countryCapability.code}) — Sandbox`} />
      <div className="p-4 sm:p-5 space-y-4">
        {error && <ErrorBanner message={error} />}
        {successMsg && <div className="p-3 bg-[#ECF6F1] border border-[#B7DFCC] text-xs text-[#27835B]">{successMsg}</div>}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null);
            try {
              const res = await apiRequest<any>('/api/corporate/rdc', {
                method: 'POST',
                body: JSON.stringify({ orgId: activeOrg?.id, accountId, amount: Number(amount), chequeDate, frontImageName: frontFile || 'front.jpg', backImageName: backFile || 'back.jpg' }),
              });
              setSuccessMsg(`Sandbox cheque deposit ${res.deposit.reference} queued.`);
              setAmount('');
              await load();
            } catch (err: any) {
              setError(err?.message || 'Submission failed.');
            }
          }}
          className="space-y-4"
        >
          <FormSelect label="Deposit account" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.account_name} ({a.currency})</option>)}
          </FormSelect>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <FormInput label="Amount" type="number" step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} />
            <FormInput label="Cheque date" type="date" required value={chequeDate} onChange={(e) => setChequeDate(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="p-4 border border-dashed border-[#B4BCC2] text-center text-xs cursor-pointer hover:bg-[#F4F5F6]">
              <Upload className="w-4 h-4 mx-auto mb-1" />
              {frontFile || 'Front cheque image'}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => setFrontFile(e.target.files?.[0]?.name || '')} />
            </label>
            <label className="p-4 border border-dashed border-[#B4BCC2] text-center text-xs cursor-pointer hover:bg-[#F4F5F6]">
              <Upload className="w-4 h-4 mx-auto mb-1" />
              {backFile || 'Back cheque image'}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => setBackFile(e.target.files?.[0]?.name || '')} />
            </label>
          </div>
          <Button type="submit" fullWidth>Submit Cheque Deposit</Button>
        </form>
        {deposits.length > 0 && (
          <div className="divide-y divide-[#D9DEE1] border-t border-[#D9DEE1] text-xs pt-2">
            {deposits.map((d) => (
              <div key={d.id} className="py-2.5 flex justify-between">
                <span><strong>{d.reference}</strong></span>
                <StatusBadge status={d.status} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

/* ============================================================================
 * 5. SELF-SERVICE & DOCUMENT REQUESTS
 * ========================================================================== */
export const SelfServiceView: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const { activeOrg, hasPermission } = useAuth();
  const [requests, setRequests] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [reqType, setReqType] = useState('BALANCE_CERTIFICATE');
  const [accountId, setAccountId] = useState('');
  const [period, setPeriod] = useState('FY 2026 YTD');
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

  useEffect(() => { load(); }, [load]);

  if (!hasPermission('REQUEST_DOCUMENTS')) {
    return (
      <div className="bg-white md:border md:border-[#D9DEE1]">
        <BankingHeader title="Self-Service" onBack={onBack} />
        <EmptyState title="Self-Service Restricted" description="Requires REQUEST_DOCUMENTS permission." />
      </div>
    );
  }

  return (
    <div className="bg-white md:border md:border-[#D9DEE1]">
      <BankingHeader title="Self-Service & Documents" onBack={onBack} />
      <div className="p-4 sm:p-5 space-y-5">
        {msg && <div className="p-3 bg-[#ECF6F1] border border-[#B7DFCC] text-xs text-[#27835B]">{msg}</div>}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const res = await apiRequest<any>('/api/corporate/self-service', {
              method: 'POST',
              body: JSON.stringify({ orgId: activeOrg?.id, requestType: reqType, accountId, period }),
            });
            setMsg(`Document request ${res.request.reference} recorded.`);
            await load();
          }}
          className="space-y-3.5"
        >
          <FormSelect label="Document type" value={reqType} onChange={(e) => setReqType(e.target.value)}>
            <option value="BALANCE_CERTIFICATE">Balance Certificate</option>
            <option value="BANKER_CERTIFICATE">Audit Confirmation</option>
            <option value="HISTORICAL_STATEMENT">Historical Statement</option>
          </FormSelect>
          <FormSelect label="Account" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.account_name} ({a.currency})</option>)}
          </FormSelect>
          <FormInput label="Period" value={period} onChange={(e) => setPeriod(e.target.value)} />
          <Button type="submit" fullWidth>Submit Document Request</Button>
        </form>

        <div className="divide-y divide-[#D9DEE1] border-t border-[#D9DEE1] text-xs">
          {requests.map((r) => (
            <div key={r.id} className="py-3 flex justify-between items-center">
              <div>
                <div className="font-medium text-[#252B30]">{r.request_type.replace(/_/g, ' ')} — {r.reference}</div>
                <div className="text-[#68727A]">{r.period}</div>
              </div>
              <span className="flex items-center gap-1.5 text-[#27835B] font-medium">
                <FileCheck className="w-4 h-4" /> {r.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
