import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  Download,
  Eye,
  EyeOff,
  FileText,
  Filter,
  RefreshCw,
  Search,
  Star,
  ArrowUp,
  ArrowDown,
  Building2,
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
  NativeDialog,
  SectionCard,
  SkeletonList,
  StatusBadge,
} from '../components/ui/Primitives';

interface AccountRow {
  id: string;
  account_number: string;
  maskedAccountNumber: string;
  account_name: string;
  nickname?: string;
  account_type: string;
  currency: string;
  available_balance: number;
  ledger_balance: number;
  availableBalance: number | null;
  ledgerBalance: number | null;
  status: string;
  country: string;
  branch_name: string;
  ifsc_swift: string;
  iban?: string;
  sort_code?: string;
  isFavourite: boolean;
  favourite_order: number;
}

export const AccountsPage: React.FC<{ onNavigate?: (tab: string, sub?: string) => void }> = ({ onNavigate }) => {
  const { activeOrg, organisations, switchOrganisation, hideBalances, setHideBalances, hasPermission } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [totalAvailableBase, setTotalAvailableBase] = useState<number | null>(0);
  const [baseCurrency, setBaseCurrency] = useState('GBP');
  const [lastUpdated, setLastUpdated] = useState('');

  // Filters & search
  const [searchQuery, setSearchQuery] = useState('');
  const [currencyFilter, setCurrencyFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState<'FAV' | 'BAL_DESC' | 'BAL_ASC' | 'NAME'>('FAV');
  const [collapsedCurrencies, setCollapsedCurrencies] = useState<Record<string, boolean>>({});

  // Selected Account Detail & Transactions
  const [selectedAccount, setSelectedAccount] = useState<AccountRow | null>(null);
  const [detailTab, setDetailTab] = useState<'TRANSACTIONS' | 'INFO' | 'STATEMENTS'>('TRANSACTIONS');
  const [accountTxns, setAccountTxns] = useState<any[]>([]);
  const [statements, setStatements] = useState<any[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // Transaction filters
  const [txnSearch, setTxnSearch] = useState('');
  const [txnEntryType, setTxnEntryType] = useState('ALL');
  const [txnCategory, setTxnCategory] = useState('ALL');
  const [txnDateFrom, setTxnDateFrom] = useState('');
  const [txnDateTo, setTxnDateTo] = useState('');
  const [txnMinAmt, setTxnMinAmt] = useState('');
  const [txnMaxAmt, setTxnMaxAmt] = useState('');
  const [selectedTxn, setSelectedTxn] = useState<any | null>(null);

  const loadAccounts = useCallback(async () => {
    if (!activeOrg) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest<any>(`/api/corporate/accounts?orgId=${encodeURIComponent(activeOrg.id)}`);
      setAccounts(res.accounts || []);
      setTotalAvailableBase(res.totalAvailableBase);
      setBaseCurrency(res.baseCurrency || activeOrg.baseCurrency);
      setLastUpdated(res.lastUpdated || new Date().toISOString());
    } catch (err: any) {
      setError(err?.message || 'Unable to load corporate accounts.');
    } finally {
      setLoading(false);
    }
  }, [activeOrg]);

  useEffect(() => {
    loadAccounts();
    setSelectedAccount(null);
  }, [loadAccounts]);

  const loadAccountDetails = useCallback(
    async (acc: AccountRow) => {
      setSelectedAccount(acc);
      setDetailLoading(true);
      try {
        const params = new URLSearchParams({
          orgId: activeOrg?.id || '',
          accountId: acc.id,
          ...(txnEntryType !== 'ALL' ? { entryType: txnEntryType } : {}),
          ...(txnCategory !== 'ALL' ? { category: txnCategory } : {}),
          ...(txnSearch ? { search: txnSearch } : {}),
          ...(txnDateFrom ? { dateFrom: txnDateFrom } : {}),
          ...(txnDateTo ? { dateTo: txnDateTo } : {}),
          ...(txnMinAmt ? { minAmount: txnMinAmt } : {}),
          ...(txnMaxAmt ? { maxAmount: txnMaxAmt } : {}),
        });
        const [txnRes, stmtRes] = await Promise.all([
          apiRequest<any>(`/api/corporate/transactions?${params.toString()}`),
          apiRequest<any>(`/api/corporate/accounts/${acc.id}/statements`),
        ]);
        setAccountTxns(txnRes.transactions || []);
        setStatements(stmtRes.statements || []);
      } catch {
        setAccountTxns([]);
      } finally {
        setDetailLoading(false);
      }
    },
    [activeOrg?.id, txnEntryType, txnCategory, txnSearch, txnDateFrom, txnDateTo, txnMinAmt, txnMaxAmt]
  );

  useEffect(() => {
    if (selectedAccount) {
      loadAccountDetails(selectedAccount);
    }
  }, [selectedAccount?.id, txnEntryType, txnCategory, txnDateFrom, txnDateTo, txnMinAmt, txnMaxAmt]);

  const toggleFavourite = async (acc: AccountRow, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await apiRequest(`/api/corporate/accounts/${acc.id}/favourite`, {
        method: 'POST',
        body: JSON.stringify({ isFavourite: !acc.isFavourite }),
      });
      await loadAccounts();
    } catch {
      // Ignore
    }
  };

  const reorderFavourite = async (acc: AccountRow, direction: -1 | 1, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextOrder = Math.max(1, (acc.favourite_order || 1) + direction);
    await apiRequest(`/api/corporate/accounts/${acc.id}/favourite`, {
      method: 'POST',
      body: JSON.stringify({ isFavourite: true, favouriteOrder: nextOrder }),
    });
    await loadAccounts();
  };

  const downloadStatement = (stmt: any, acc: AccountRow) => {
    const html = `<!doctype html><html><head><title>Statement ${acc.maskedAccountNumber}</title>
      <style>body{font-family:Inter,sans-serif;padding:32px;color:#252525}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{border-bottom:1px solid #e2e6ec;padding:8px;text-align:left;font-size:12px}th{background:#f5f6f8}</style>
      </head><body>
      <h2>HSBC Cnet Corporate Account Statement (Sandbox Record)</h2>
      <p><strong>Organisation:</strong> ${activeOrg?.name}<br/>
      <strong>Account:</strong> ${acc.account_name} (${acc.account_number})<br/>
      <strong>Period:</strong> ${stmt.period_label} (${stmt.start_date} to ${stmt.end_date})<br/>
      <strong>Opening Balance:</strong> ${formatFinancialCurrency(stmt.opening_balance, acc.currency)}<br/>
      <strong>Closing Balance:</strong> ${formatFinancialCurrency(stmt.closing_balance, acc.currency)}</p>
      <table><thead><tr><th>Date</th><th>Reference</th><th>Counterparty</th><th>Description</th><th>Type</th><th>Amount</th></tr></thead>
      <tbody>${accountTxns
        .map(
          (t) =>
            `<tr><td>${formatDateTime(t.created_at)}</td><td>${t.reference}</td><td>${t.counterparty_name}</td><td>${t.description}</td><td>${t.entry_type || t.transaction_type}</td><td>${formatFinancialCurrency(t.amount, t.currency)}</td></tr>`
        )
        .join('')}</tbody></table>
      <p style="margin-top:24px;font-size:11px;color:#767676">Sandbox platform statement generated by HSBC Cnet. Not an official bank instrument.</p>
      </body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Statement_${acc.account_number}_${stmt.end_date}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const currencies = useMemo(() => Array.from(new Set(accounts.map((a) => a.currency))), [accounts]);
  const types = useMemo(() => Array.from(new Set(accounts.map((a) => a.account_type))), [accounts]);

  const filteredAccounts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return accounts
      .filter((a) => {
        if (currencyFilter !== 'ALL' && a.currency !== currencyFilter) return false;
        if (typeFilter !== 'ALL' && a.account_type !== typeFilter) return false;
        if (q) {
          return (
            a.account_name.toLowerCase().includes(q) ||
            (a.nickname || '').toLowerCase().includes(q) ||
            a.account_number.toLowerCase().includes(q) ||
            a.currency.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'BAL_DESC') return (b.available_balance || 0) - (a.available_balance || 0);
        if (sortBy === 'BAL_ASC') return (a.available_balance || 0) - (b.available_balance || 0);
        if (sortBy === 'NAME') return a.account_name.localeCompare(b.account_name);
        return (a.isFavourite === b.isFavourite ? a.favourite_order - b.favourite_order : a.isFavourite ? -1 : 1);
      });
  }, [accounts, searchQuery, currencyFilter, typeFilter, sortBy]);

  const groupedByCurrency = useMemo(() => {
    const groups: Record<string, AccountRow[]> = {};
    for (const acc of filteredAccounts) {
      if (!groups[acc.currency]) groups[acc.currency] = [];
      groups[acc.currency].push(acc);
    }
    return Object.entries(groups);
  }, [filteredAccounts]);

  const favourites = useMemo(() => accounts.filter((a) => a.isFavourite), [accounts]);

  if (!hasPermission('VIEW_ACCOUNTS')) {
    return (
      <SectionCard>
        <EmptyState
          title="Account Access Restricted"
          description="Your assigned corporate role does not permit viewing accounts. Contact your Organisation Administrator."
        />
      </SectionCard>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header & Summary Strip */}
      <div className="bg-white border border-[#D7D8D6] rounded-[2px] p-4 sm:p-5 shadow-[0_1px_2px_rgba(20,35,60,0.04)]">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-[#252525] tracking-tight">Accounts</h1>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-[#F4F4F4] border border-[#D7D8D6] text-[#555555]">
                {accounts.length} Accounts
              </span>
            </div>
            <p className="text-xs text-[#767676] mt-1">
              Last updated: {lastUpdated ? formatDateTime(lastUpdated) : 'Just now'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {organisations.length > 1 && (
              <div className="flex items-center gap-2 bg-[#F4F4F4] border border-[#D7D8D6] rounded-[2px] px-2.5 py-1.5">
                <Building2 className="w-4 h-4 text-[#252525] shrink-0" aria-hidden="true" />
                <label htmlFor="org-select" className="visually-hidden">
                  Organisation
                </label>
                <select
                  id="org-select"
                  value={activeOrg?.id || ''}
                  onChange={(e) => switchOrganisation(e.target.value)}
                  className="bg-transparent text-xs font-semibold text-[#252525] focus:outline-none max-w-[200px]"
                >
                  {organisations.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name} ({o.country})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <Button variant="outline" size="sm" onClick={() => setHideBalances(!hideBalances)}>
              {hideBalances ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              <span>{hideBalances ? 'Show balances' : 'Hide balances'}</span>
            </Button>

            <Button variant="outline" size="sm" onClick={loadAccounts} loading={loading}>
              <RefreshCw className="w-4 h-4" aria-hidden="true" />
              <span>Refresh</span>
            </Button>
          </div>
        </div>

        {/* Consolidated Total Available Balance */}
        <div className="mt-4 pt-4 border-t border-[#D7D8D6] grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
          <div>
            <div className="text-xs text-[#767676]">Consolidated Available Balance ({baseCurrency} eqv.)</div>
            <div className="mt-1 text-2xl sm:text-3xl font-bold text-[#252525] tabular-nums tracking-tight">
              {totalAvailableBase === null
                ? 'Restricted'
                : formatFinancialCurrency(totalAvailableBase, baseCurrency, hideBalances)}
            </div>
          </div>
          <div className="sm:col-span-2 flex flex-wrap sm:justify-end gap-2">
            {onNavigate && (
              <>
                <Button size="sm" variant="secondary" onClick={() => onNavigate('more', 'liquidity')}>
                  Liquidity Dashboard
                </Button>
                <Button size="sm" variant="outline" onClick={() => onNavigate('payments')}>
                  New Payment
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {error && <ErrorBanner message={error} onRetry={loadAccounts} />}

      {/* Favourites Bar */}
      {favourites.length > 0 && !selectedAccount && (
        <SectionCard title="Favourite Accounts" subtitle="Pinned operating and treasury accounts">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {favourites.map((acc) => (
              <div
                key={acc.id}
                role="button"
                tabIndex={0}
                onClick={() => loadAccountDetails(acc)}
                onKeyDown={(e) => e.key === 'Enter' && loadAccountDetails(acc)}
                className="p-3.5 rounded-[2px] border border-[#D7D8D6] hover:border-[#252525] bg-[#FAFAFA] cursor-pointer transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-[#252525] truncate">{acc.nickname || acc.account_name}</div>
                    <div className="text-[11px] text-[#767676] tabular-nums">{acc.maskedAccountNumber} • {acc.currency}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-label={`Move ${acc.account_name} up`}
                      onClick={(e) => reorderFavourite(acc, -1, e)}
                      className="p-1 text-[#767676] hover:text-[#252525]"
                    >
                      <ArrowUp className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Move ${acc.account_name} down`}
                      onClick={(e) => reorderFavourite(acc, 1, e)}
                      className="p-1 text-[#767676] hover:text-[#252525]"
                    >
                      <ArrowDown className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Remove ${acc.account_name} from favourites`}
                      onClick={(e) => toggleFavourite(acc, e)}
                      className="p-1 text-[#DB0011]"
                    >
                      <Star className="w-3.5 h-3.5 fill-current" />
                    </button>
                  </div>
                </div>
                <div className="mt-2.5 text-base font-bold text-[#252525] tabular-nums">
                  {acc.availableBalance === null ? '••••' : formatFinancialCurrency(acc.availableBalance, acc.currency, hideBalances)}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Account Detail View OR Account List */}
      {selectedAccount ? (
        <div className="space-y-4">
          <div className="bg-white border border-[#D7D8D6] rounded-[2px] p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#D7D8D6]">
              <div>
                <button
                  type="button"
                  onClick={() => setSelectedAccount(null)}
                  className="text-xs font-medium text-[#DB0011] hover:underline mb-1 inline-block"
                >
                  &larr; All {activeOrg?.name} Accounts
                </button>
                <h2 className="text-lg font-semibold text-[#252525]">{selectedAccount.account_name}</h2>
                <p className="text-xs text-[#767676] tabular-nums">
                  {selectedAccount.maskedAccountNumber} • {selectedAccount.account_type.replace(/_/g, ' ')} • {selectedAccount.currency}
                </p>
              </div>
              <StatusBadge status={selectedAccount.status} size="md" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-4 border-b border-[#D7D8D6]">
              <div>
                <div className="text-xs text-[#767676]">Available Balance</div>
                <div className="text-xl font-bold text-[#252525] tabular-nums mt-0.5">
                  {selectedAccount.availableBalance === null
                    ? 'Restricted'
                    : formatFinancialCurrency(selectedAccount.availableBalance, selectedAccount.currency, hideBalances)}
                </div>
              </div>
              <div>
                <div className="text-xs text-[#767676]">Ledger Balance</div>
                <div className="text-xl font-semibold text-[#252525] tabular-nums mt-0.5">
                  {selectedAccount.ledgerBalance === null
                    ? 'Restricted'
                    : formatFinancialCurrency(selectedAccount.ledgerBalance, selectedAccount.currency, hideBalances)}
                </div>
              </div>
              <div>
                <div className="text-xs text-[#767676]">Branch / Clearing</div>
                <div className="text-xs font-medium text-[#252525] mt-1">{selectedAccount.branch_name}</div>
                <div className="text-xs text-[#767676] tabular-nums">SWIFT: {selectedAccount.ifsc_swift}</div>
              </div>
            </div>

            {/* Detail Sub-Tabs */}
            <div className="flex gap-1 pt-3" role="tablist" aria-label="Account detail sections">
              {(['TRANSACTIONS', 'STATEMENTS', 'INFO'] as const).map((t) => (
                <button
                  key={t}
                  role="tab"
                  aria-selected={detailTab === t}
                  onClick={() => setDetailTab(t)}
                  className={`px-3.5 py-2 text-xs font-semibold rounded-[2px] transition-colors ${
                    detailTab === t ? 'bg-[#252525] text-white' : 'text-[#555555] hover:bg-[#EBEBEB]'
                  }`}
                >
                  {t === 'TRANSACTIONS' ? 'Transactions' : t === 'STATEMENTS' ? 'Statements' : 'Account Information'}
                </button>
              ))}
            </div>
          </div>

          {detailTab === 'TRANSACTIONS' && (
            <SectionCard title="Transaction History" subtitle="Search and filter posted ledger entries">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                <FormInput
                  label="Search reference or party"
                  placeholder="TXN-... or counterparty"
                  value={txnSearch}
                  onChange={(e) => setTxnSearch(e.target.value)}
                />
                <FormSelect label="Debit / Credit" value={txnEntryType} onChange={(e) => setTxnEntryType(e.target.value)}>
                  <option value="ALL">All Entries</option>
                  <option value="DEBIT">Debits Only</option>
                  <option value="CREDIT">Credits Only</option>
                </FormSelect>
                <FormSelect label="Category" value={txnCategory} onChange={(e) => setTxnCategory(e.target.value)}>
                  <option value="ALL">All Categories</option>
                  <option value="TRANSFER">Transfers</option>
                  <option value="SALARY">Payroll</option>
                  <option value="UTILITIES">Utilities</option>
                  <option value="SUPPLIER">Supplier</option>
                  <option value="INVESTMENT">Investment</option>
                  <option value="CHARGES">Charges</option>
                </FormSelect>
                <div className="flex items-end gap-2">
                  <Button
                    variant="secondary"
                    fullWidth
                    onClick={() => loadAccountDetails(selectedAccount)}
                  >
                    <Filter className="w-4 h-4" />
                    Apply
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <FormInput label="From Date" type="date" value={txnDateFrom} onChange={(e) => setTxnDateFrom(e.target.value)} />
                <FormInput label="To Date" type="date" value={txnDateTo} onChange={(e) => setTxnDateTo(e.target.value)} />
                <FormInput label="Min Amount" type="number" placeholder="0" value={txnMinAmt} onChange={(e) => setTxnMinAmt(e.target.value)} />
                <FormInput label="Max Amount" type="number" placeholder="Any" value={txnMaxAmt} onChange={(e) => setTxnMaxAmt(e.target.value)} />
              </div>

              {detailLoading ? (
                <SkeletonList rows={4} />
              ) : accountTxns.length === 0 ? (
                <EmptyState title="No matching transactions" description="Adjust your date range, amount, or type filters." />
              ) : (
                <div className="corporate-table-wrapper border border-[#D7D8D6] rounded-[2px]">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-[#F4F4F4] text-[#555555] border-b border-[#D7D8D6]">
                      <tr>
                        <th scope="col" className="py-2.5 px-3 font-semibold">Date</th>
                        <th scope="col" className="py-2.5 px-3 font-semibold">Counterparty &amp; Description</th>
                        <th scope="col" className="py-2.5 px-3 font-semibold">Reference</th>
                        <th scope="col" className="py-2.5 px-3 font-semibold">Status</th>
                        <th scope="col" className="py-2.5 px-3 font-semibold text-right">Amount</th>
                        <th scope="col" className="py-2.5 px-3 font-semibold text-right">Running Bal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#D7D8D6]">
                      {accountTxns.map((t) => {
                        const isCredit = t.entry_type === 'CREDIT' || t.transaction_type === 'DEPOSIT_CREDIT';
                        return (
                          <tr
                            key={t.id}
                            onClick={() => setSelectedTxn(t)}
                            className="hover:bg-[#F9FAFB] cursor-pointer"
                          >
                            <td className="py-3 px-3 whitespace-nowrap text-[#555555]">{formatDateTime(t.created_at)}</td>
                            <td className="py-3 px-3">
                              <div className="font-semibold text-[#252525] flex items-center gap-1.5">
                                {isCredit ? (
                                  <ArrowDownLeft className="w-3.5 h-3.5 text-[#008A52]" />
                                ) : (
                                  <ArrowUpRight className="w-3.5 h-3.5 text-[#DB0011]" />
                                )}
                                {t.counterparty_name}
                              </div>
                              <div className="text-[#767676]">{t.description}</div>
                            </td>
                            <td className="py-3 px-3 tabular-nums text-[#555555]">{t.reference}</td>
                            <td className="py-3 px-3">
                              <StatusBadge status={t.status} />
                            </td>
                            <td className={`py-3 px-3 text-right font-semibold tabular-nums whitespace-nowrap ${isCredit ? 'text-[#008A52]' : 'text-[#252525]'}`}>
                              {isCredit ? '+' : '-'}
                              {formatFinancialCurrency(t.amount, t.currency, hideBalances)}
                            </td>
                            <td className="py-3 px-3 text-right tabular-nums text-[#555555] whitespace-nowrap">
                              {t.balance_after !== null && t.balance_after !== undefined
                                ? formatFinancialCurrency(t.balance_after, t.currency, hideBalances)
                                : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          )}

          {detailTab === 'STATEMENTS' && (
            <SectionCard
              title="Account Statements"
              subtitle="Download available statements or request historical copies"
              action={
                onNavigate && (
                  <Button size="sm" variant="outline" onClick={() => onNavigate('more', 'self-service')}>
                    Request Historical Statement
                  </Button>
                )
              }
            >
              {statements.length === 0 ? (
                <EmptyState title="No statements generated yet" description="Use Self-Service to request a historical statement for this account." />
              ) : (
                <div className="divide-y divide-[#D7D8D6]">
                  {statements.map((s) => (
                    <div key={s.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <FileText className="w-4 h-4 text-[#252525]" aria-hidden="true" />
                        <div>
                          <div className="text-sm font-semibold text-[#252525]">{s.period_label}</div>
                          <div className="text-xs text-[#767676] tabular-nums">
                            {s.start_date} to {s.end_date} • Closing:{' '}
                            {formatFinancialCurrency(s.closing_balance, selectedAccount.currency, hideBalances)}
                          </div>
                        </div>
                      </div>
                      {s.document_available ? (
                        <Button size="sm" variant="outline" onClick={() => downloadStatement(s, selectedAccount)}>
                          <Download className="w-3.5 h-3.5" aria-hidden="true" />
                          Download Statement
                        </Button>
                      ) : (
                        <span className="text-xs text-[#767676]">Document Pending</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          )}

          {detailTab === 'INFO' && (
            <SectionCard title="Account Routing & Identifiers">
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <dt className="text-[#767676]">Full Account Number</dt>
                  <dd className="font-semibold text-[#252525] tabular-nums mt-0.5">{selectedAccount.account_number}</dd>
                </div>
                <div>
                  <dt className="text-[#767676]">SWIFT / BIC</dt>
                  <dd className="font-semibold text-[#252525] tabular-nums mt-0.5">{selectedAccount.ifsc_swift}</dd>
                </div>
                {selectedAccount.iban && (
                  <div>
                    <dt className="text-[#767676]">IBAN</dt>
                    <dd className="font-semibold text-[#252525] tabular-nums mt-0.5">{selectedAccount.iban}</dd>
                  </div>
                )}
                {selectedAccount.sort_code && (
                  <div>
                    <dt className="text-[#767676]">Clearing / Sort Code</dt>
                    <dd className="font-semibold text-[#252525] tabular-nums mt-0.5">{selectedAccount.sort_code}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-[#767676]">Branch</dt>
                  <dd className="font-semibold text-[#252525] mt-0.5">{selectedAccount.branch_name}</dd>
                </div>
                <div>
                  <dt className="text-[#767676]">Jurisdiction Country</dt>
                  <dd className="font-semibold text-[#252525] mt-0.5">{selectedAccount.country}</dd>
                </div>
              </dl>
            </SectionCard>
          )}
        </div>
      ) : (
        /* Accounts Search & Currency-Grouped List */
        <SectionCard
          title="Corporate Account Directory"
          subtitle="Grouped by currency. Click any account to inspect ledger transactions and statements."
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            <div className="relative">
              <label htmlFor="acc-search" className="visually-hidden">
                Search accounts
              </label>
              <Search className="w-4 h-4 text-[#767676] absolute left-3 top-3" aria-hidden="true" />
              <input
                id="acc-search"
                type="search"
                placeholder="Search name, number, currency..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full min-h-[42px] pl-9 pr-3 text-sm bg-white border border-[#9E9E9E] rounded-[2px]"
              />
            </div>
            <select
              aria-label="Filter by currency"
              value={currencyFilter}
              onChange={(e) => setCurrencyFilter(e.target.value)}
              className="min-h-[42px] px-3 text-sm bg-white border border-[#9E9E9E] rounded-[2px]"
            >
              <option value="ALL">All Currencies</option>
              {currencies.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter by account type"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="min-h-[42px] px-3 text-sm bg-white border border-[#9E9E9E] rounded-[2px]"
            >
              <option value="ALL">All Account Types</option>
              {types.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
            <select
              aria-label="Sort accounts"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="min-h-[42px] px-3 text-sm bg-white border border-[#9E9E9E] rounded-[2px]"
            >
              <option value="FAV">Sort: Favourites First</option>
              <option value="BAL_DESC">Sort: Balance High to Low</option>
              <option value="BAL_ASC">Sort: Balance Low to High</option>
              <option value="NAME">Sort: Account Name (A-Z)</option>
            </select>
          </div>

          {loading ? (
            <SkeletonList rows={5} />
          ) : groupedByCurrency.length === 0 ? (
            <EmptyState title="No accounts found" description="No corporate accounts match your active organisation or filter criteria." />
          ) : (
            <div className="space-y-4">
              {groupedByCurrency.map(([currency, list]) => {
                const isCollapsed = !!collapsedCurrencies[currency];
                const groupSum = list.reduce((sum, a) => sum + (a.availableBalance || 0), 0);
                return (
                  <div key={currency} className="border border-[#D7D8D6] rounded-[2px] overflow-hidden">
                    <button
                      type="button"
                      aria-expanded={!isCollapsed}
                      onClick={() => setCollapsedCurrencies((prev) => ({ ...prev, [currency]: !prev[currency] }))}
                      className="w-full flex items-center justify-between px-4 py-3 bg-[#F4F4F4] hover:bg-[#EBEBEB] text-left"
                    >
                      <div className="flex items-center gap-2">
                        {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        <span className="text-xs font-bold text-[#252525] uppercase tracking-wider">{currency} Accounts</span>
                        <span className="text-xs text-[#767676]">({list.length})</span>
                      </div>
                      <span className="text-xs font-bold text-[#252525] tabular-nums">
                        {hasPermission('VIEW_BALANCES')
                          ? formatFinancialCurrency(groupSum, currency, hideBalances)
                          : 'Restricted'}
                      </span>
                    </button>

                    {!isCollapsed && (
                      <div className="divide-y divide-[#D7D8D6]">
                        {list.map((acc) => (
                          <div
                            key={acc.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => loadAccountDetails(acc)}
                            onKeyDown={(e) => e.key === 'Enter' && loadAccountDetails(acc)}
                            className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#FAFAFA] cursor-pointer transition-colors"
                          >
                            <div className="flex items-start gap-3 min-w-0">
                              <button
                                type="button"
                                aria-label={acc.isFavourite ? `Unstar ${acc.account_name}` : `Star ${acc.account_name}`}
                                onClick={(e) => toggleFavourite(acc, e)}
                                className="mt-0.5 p-1 text-[#9CA3AF] hover:text-[#DB0011]"
                              >
                                <Star className={`w-4 h-4 ${acc.isFavourite ? 'text-[#DB0011] fill-current' : ''}`} />
                              </button>
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-sm font-semibold text-[#252525]">{acc.account_name}</span>
                                  {acc.nickname && (
                                    <span className="text-[11px] text-[#767676] bg-[#F4F4F4] px-1.5 py-0.5 rounded">
                                      {acc.nickname}
                                    </span>
                                  )}
                                  <StatusBadge status={acc.status} />
                                </div>
                                <div className="text-xs text-[#767676] mt-1 tabular-nums">
                                  {acc.maskedAccountNumber} • {acc.account_type.replace(/_/g, ' ')} • {acc.country} • {acc.branch_name}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center justify-between sm:justify-end gap-4 pl-7 sm:pl-0">
                              <div className="text-left sm:text-right">
                                <div className="text-sm font-bold text-[#252525] tabular-nums">
                                  {acc.availableBalance === null
                                    ? 'Restricted'
                                    : formatFinancialCurrency(acc.availableBalance, acc.currency, hideBalances)}
                                </div>
                                <div className="text-[11px] text-[#767676] tabular-nums">
                                  Ledger:{' '}
                                  {acc.ledgerBalance === null
                                    ? 'Restricted'
                                    : formatFinancialCurrency(acc.ledgerBalance, acc.currency, hideBalances)}
                                </div>
                              </div>
                              <ChevronRight className="w-4 h-4 text-[#9CA3AF]" aria-hidden="true" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
      )}

      {/* Transaction Details Modal */}
      <NativeDialog
        open={!!selectedTxn}
        onClose={() => setSelectedTxn(null)}
        title="Transaction Detail"
        subtitle={selectedTxn?.reference}
      >
        {selectedTxn && (
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
            <div>
              <dt className="text-[#767676]">Counterparty</dt>
              <dd className="font-semibold text-[#252525] mt-0.5">{selectedTxn.counterparty_name}</dd>
            </div>
            <div>
              <dt className="text-[#767676]">Amount</dt>
              <dd className="font-bold text-[#252525] tabular-nums mt-0.5">
                {formatFinancialCurrency(selectedTxn.amount, selectedTxn.currency, hideBalances)}
              </dd>
            </div>
            <div>
              <dt className="text-[#767676]">Posting Date</dt>
              <dd className="font-medium text-[#252525] mt-0.5">{formatDateTime(selectedTxn.created_at)}</dd>
            </div>
            <div>
              <dt className="text-[#767676]">Status</dt>
              <dd className="mt-0.5">
                <StatusBadge status={selectedTxn.status} />
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-[#767676]">Description &amp; Reference</dt>
              <dd className="font-medium text-[#252525] mt-0.5">{selectedTxn.description}</dd>
            </div>
          </dl>
        )}
      </NativeDialog>
    </div>
  );
};
