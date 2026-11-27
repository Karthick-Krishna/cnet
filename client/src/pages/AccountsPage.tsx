import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowDownLeft,
  ArrowUp,
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  Download,
  Eye,
  EyeOff,
  FileText,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Star,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';
import { formatDateTime, formatFinancialCurrency } from '@shared/utils/formatters';
import { GeometricHeader } from '../components/ui/GeometricHeader';
import { BankingHeader } from '../components/ui/BankingHeader';
import {
  BankingListRow,
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
  institution?: string;
  ifsc_swift: string;
  iban?: string;
  sort_code?: string;
  isFavourite: boolean;
  favourite_order: number;
}

const CURRENCY_LABELS: Record<string, string> = {
  AED: 'AED - UAE DIRHAM',
  AUD: 'AUD - AUSTRALIAN DOLLAR',
  EUR: 'EUR - EURO',
  GBP: 'GBP - GREAT BRITISH POUNDS',
  HKD: 'HKD - HONG KONG DOLLARS',
  INR: 'INR - INDIAN RUPEE',
  SGD: 'SGD - SINGAPORE DOLLAR',
  USD: 'USD - US DOLLAR',
};

export const AccountsPage: React.FC<{ onNavigate?: (tab: string, sub?: string) => void }> = ({ onNavigate }) => {
  const { activeOrg, organisations, switchOrganisation, hideBalances, setHideBalances, hasPermission } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [totalAvailableBase, setTotalAvailableBase] = useState<number | null>(0);
  const [baseCurrency, setBaseCurrency] = useState('GBP');
  const [lastUpdated, setLastUpdated] = useState('');

  // Screen mode: LIST | FILTER_SORT | DETAIL
  const [viewMode, setViewMode] = useState<'LIST' | 'FILTER_SORT' | 'DETAIL'>('LIST');
  const [filterTab, setFilterTab] = useState<'FILTER' | 'SORT' | 'FAVOURITES'>('FILTER');

  // Active Filter & Sort states (applied cleanly on Submit / Apply)
  const [searchQuery, setSearchQuery] = useState('');
  const [locationFilter, setLocationFilter] = useState('ALL');
  const [institutionFilter, setInstitutionFilter] = useState('ALL');
  const [currencyFilter, setCurrencyFilter] = useState('ALL');
  const [accountNumberFilter, setAccountNumberFilter] = useState('');
  const [groupingMode, setGroupingMode] = useState<'CURRENCY' | 'LOCATION_CURRENCY'>('CURRENCY');
  const [sortField, setSortField] = useState<'FAV' | 'NAME' | 'CURRENCY' | 'BALANCE' | 'NUMBER'>('CURRENCY');
  const [sortDir, setSortDir] = useState<'ASC' | 'DESC'>('ASC');

  // Pending draft filters inside Filter/Sort drawer
  const [draftLoc, setDraftLoc] = useState('ALL');
  const [draftInst, setDraftInst] = useState('ALL');
  const [draftCur, setDraftCur] = useState('ALL');
  const [draftAccNum, setDraftAccNum] = useState('');
  const [draftGroup, setDraftGroup] = useState<'CURRENCY' | 'LOCATION_CURRENCY'>('CURRENCY');

  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  // Selected Account Detail & Transactions
  const [selectedAccount, setSelectedAccount] = useState<AccountRow | null>(null);
  const [detailTab, setDetailTab] = useState<'TRANSACTIONS' | 'INFO' | 'STATEMENTS'>('TRANSACTIONS');
  const [accountTxns, setAccountTxns] = useState<any[]>([]);
  const [statements, setStatements] = useState<any[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // Transaction filters
  const [txnSearch, setTxnSearch] = useState('');
  const [txnEntryType, setTxnEntryType] = useState('ALL');
  const [txnDateFrom, setTxnDateFrom] = useState('');
  const [txnDateTo, setTxnDateTo] = useState('');
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
    setViewMode('LIST');
  }, [loadAccounts]);

  const loadAccountDetails = useCallback(
    async (acc: AccountRow) => {
      setSelectedAccount(acc);
      setViewMode('DETAIL');
      setDetailLoading(true);
      try {
        const params = new URLSearchParams({
          orgId: activeOrg?.id || '',
          accountId: acc.id,
          ...(txnEntryType !== 'ALL' ? { entryType: txnEntryType } : {}),
          ...(txnSearch ? { search: txnSearch } : {}),
          ...(txnDateFrom ? { dateFrom: txnDateFrom } : {}),
          ...(txnDateTo ? { dateTo: txnDateTo } : {}),
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
    [activeOrg?.id, txnEntryType, txnSearch, txnDateFrom, txnDateTo]
  );

  useEffect(() => {
    if (selectedAccount && viewMode === 'DETAIL') {
      loadAccountDetails(selectedAccount);
    }
  }, [selectedAccount?.id, txnEntryType, txnDateFrom, txnDateTo]);

  const toggleFavourite = async (acc: AccountRow, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await apiRequest(`/api/corporate/accounts/${acc.id}/favourite`, {
        method: 'POST',
        body: JSON.stringify({ isFavourite: !acc.isFavourite }),
      });
      await loadAccounts();
    } catch {
      // ignore
    }
  };

  const reorderFavourite = async (acc: AccountRow, direction: -1 | 1) => {
    const nextOrder = Math.max(1, (acc.favourite_order || 1) + direction);
    await apiRequest(`/api/corporate/accounts/${acc.id}/favourite`, {
      method: 'POST',
      body: JSON.stringify({ isFavourite: true, favouriteOrder: nextOrder }),
    });
    await loadAccounts();
  };

  const downloadStatement = (stmt: any, acc: AccountRow) => {
    const html = `<!doctype html><html><head><title>Statement ${acc.maskedAccountNumber}</title>
      <style>body{font-family:Inter,sans-serif;padding:32px;color:#252B30}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{border-bottom:1px solid #D9DEE1;padding:8px;text-align:left;font-size:12px}th{background:#F4F5F6}</style>
      </head><body>
      <h2>HSBC Cnet Corporate Account Statement (Sandbox)</h2>
      <p><strong>Organisation:</strong> ${activeOrg?.name}<br/>
      <strong>Account:</strong> ${acc.account_name} (${acc.account_number})<br/>
      <strong>Period:</strong> ${stmt.period_label} (${stmt.start_date} to ${stmt.end_date})</p>
      <table><thead><tr><th>Date</th><th>Reference</th><th>Counterparty</th><th>Description</th><th>Type</th><th>Amount</th></tr></thead>
      <tbody>${accountTxns
        .map(
          (t) =>
            `<tr><td>${formatDateTime(t.created_at)}</td><td>${t.reference}</td><td>${t.counterparty_name}</td><td>${t.description}</td><td>${t.entry_type || t.transaction_type}</td><td>${formatFinancialCurrency(t.amount, t.currency)}</td></tr>`
        )
        .join('')}</tbody></table>
      <p style="margin-top:24px;font-size:11px;color:#68727A">Sandbox record generated by HSBC Cnet.</p>
      </body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Statement_${acc.account_number}_${stmt.end_date}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const openFilterView = () => {
    setDraftLoc(locationFilter);
    setDraftInst(institutionFilter);
    setDraftCur(currencyFilter);
    setDraftAccNum(accountNumberFilter);
    setDraftGroup(groupingMode);
    setFilterTab('FILTER');
    setViewMode('FILTER_SORT');
  };

  const applyFilterValues = () => {
    setLocationFilter(draftLoc);
    setInstitutionFilter(draftInst);
    setCurrencyFilter(draftCur);
    setAccountNumberFilter(draftAccNum);
    setGroupingMode(draftGroup);
    setViewMode('LIST');
  };

  const resetFilters = () => {
    setDraftLoc('ALL');
    setDraftInst('ALL');
    setDraftCur('ALL');
    setDraftAccNum('');
    setDraftGroup('CURRENCY');
    setLocationFilter('ALL');
    setInstitutionFilter('ALL');
    setCurrencyFilter('ALL');
    setAccountNumberFilter('');
    setGroupingMode('CURRENCY');
    setSearchQuery('');
  };

  const currencies = useMemo(() => Array.from(new Set(accounts.map((a) => a.currency))), [accounts]);
  const locations = useMemo(() => Array.from(new Set(accounts.map((a) => a.country))), [accounts]);
  const institutions = useMemo(
    () => Array.from(new Set(accounts.map((a) => a.institution || a.branch_name))),
    [accounts]
  );

  const filteredAccounts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const numQ = accountNumberFilter.toLowerCase().trim();
    const dir = sortDir === 'ASC' ? 1 : -1;

    return accounts
      .filter((a) => {
        if (locationFilter !== 'ALL' && a.country !== locationFilter) return false;
        if (institutionFilter !== 'ALL' && (a.institution || a.branch_name) !== institutionFilter) return false;
        if (currencyFilter !== 'ALL' && a.currency !== currencyFilter) return false;
        if (numQ && !a.account_number.toLowerCase().includes(numQ)) return false;
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
        if (sortField === 'BALANCE') return ((a.available_balance || 0) - (b.available_balance || 0)) * dir;
        if (sortField === 'NAME') return a.account_name.localeCompare(b.account_name) * dir;
        if (sortField === 'NUMBER') return a.account_number.localeCompare(b.account_number) * dir;
        if (sortField === 'CURRENCY') return a.currency.localeCompare(b.currency) * dir || a.account_name.localeCompare(b.account_name);
        return (a.isFavourite === b.isFavourite ? a.favourite_order - b.favourite_order : a.isFavourite ? -1 : 1);
      });
  }, [accounts, searchQuery, locationFilter, institutionFilter, currencyFilter, accountNumberFilter, sortField, sortDir]);

  const groupedAccounts = useMemo(() => {
    const groups: Record<string, AccountRow[]> = {};
    for (const acc of filteredAccounts) {
      const key =
        groupingMode === 'LOCATION_CURRENCY'
          ? `${acc.country} • ${CURRENCY_LABELS[acc.currency] || acc.currency}`
          : CURRENCY_LABELS[acc.currency] || `${acc.currency} Accounts`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(acc);
    }
    return Object.entries(groups);
  }, [filteredAccounts, groupingMode]);

  const favourites = useMemo(() => accounts.filter((a) => a.isFavourite).sort((a, b) => a.favourite_order - b.favourite_order), [accounts]);

  if (!hasPermission('VIEW_ACCOUNTS')) {
    return (
      <div>
        <GeometricHeader title="Accounts" />
        <div className="p-4">
          <EmptyState
            title="Account Access Restricted"
            description="Your assigned corporate role does not permit viewing accounts. Contact your Organisation Administrator."
          />
        </div>
      </div>
    );
  }

  // =========================================================================
  // FILTER, SORT & FAVOURITES MANAGEMENT SUB-VIEW
  // =========================================================================
  if (viewMode === 'FILTER_SORT') {
    return (
      <div className="bg-white border-x border-b border-[#D9DEE1] min-h-[540px] flex flex-col">
        <BankingHeader
          title="Filter, Sort & Favourites"
          onBack={() => setViewMode('LIST')}
          rightSlot={
            <button type="button" onClick={resetFilters} className="px-2 text-xs font-medium text-[#DB001B]">
              Reset
            </button>
          }
        />

        {/* Tab switcher */}
        <div className="grid grid-cols-3 border-b border-[#D9DEE1] bg-white text-xs font-medium" role="tablist">
          {(
            [
              { id: 'FILTER', label: 'Filter & Group' },
              { id: 'SORT', label: 'Sort' },
              { id: 'FAVOURITES', label: `Favourites (${favourites.length})` },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={filterTab === t.id}
              onClick={() => setFilterTab(t.id)}
              className={`py-3 text-center border-b-[2px] ${
                filterTab === t.id ? 'border-[#DB001B] text-[#252B30] font-semibold' : 'border-transparent text-[#68727A]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 p-4 space-y-4">
          {filterTab === 'FILTER' && (
            <>
              <FormSelect label="Location / Country" value={draftLoc} onChange={(e) => setDraftLoc(e.target.value)}>
                <option value="ALL">All Locations</option>
                {locations.map((loc) => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </FormSelect>
              <FormSelect label="Institution / Hub" value={draftInst} onChange={(e) => setDraftInst(e.target.value)}>
                <option value="ALL">All Institutions</option>
                {institutions.map((inst) => (
                  <option key={inst} value={inst}>{inst}</option>
                ))}
              </FormSelect>
              <FormSelect label="Currency" value={draftCur} onChange={(e) => setDraftCur(e.target.value)}>
                <option value="ALL">All Currencies</option>
                {currencies.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </FormSelect>
              <FormInput
                label="Account number"
                placeholder="Contains digits..."
                value={draftAccNum}
                onChange={(e) => setDraftAccNum(e.target.value)}
              />
              <fieldset className="space-y-2 pt-2">
                <legend className="text-xs font-medium text-[#252B30] mb-1">Account grouping</legend>
                <label className="flex items-center gap-2.5 p-3 border border-[#D9DEE1] rounded-[2px] text-sm">
                  <input
                    type="radio"
                    name="acc-grouping"
                    checked={draftGroup === 'CURRENCY'}
                    onChange={() => setDraftGroup('CURRENCY')}
                    className="accent-[#DB001B]"
                  />
                  <span>Currency only</span>
                </label>
                <label className="flex items-center gap-2.5 p-3 border border-[#D9DEE1] rounded-[2px] text-sm">
                  <input
                    type="radio"
                    name="acc-grouping"
                    checked={draftGroup === 'LOCATION_CURRENCY'}
                    onChange={() => setDraftGroup('LOCATION_CURRENCY')}
                    className="accent-[#DB001B]"
                  />
                  <span>Location and Currency</span>
                </label>
              </fieldset>
            </>
          )}

          {filterTab === 'SORT' && (
            <div className="space-y-4">
              <fieldset className="space-y-2">
                <legend className="text-xs font-medium text-[#252B30]">Sort accounts by</legend>
                {(
                  [
                    { id: 'CURRENCY', label: 'Currency' },
                    { id: 'NAME', label: 'Account name' },
                    { id: 'BALANCE', label: 'Available balance' },
                    { id: 'NUMBER', label: 'Account number' },
                    { id: 'FAV', label: 'Favourites order' },
                  ] as const
                ).map((opt) => (
                  <label key={opt.id} className="flex items-center gap-2.5 p-3 border border-[#D9DEE1] text-sm">
                    <input
                      type="radio"
                      name="sort-field"
                      checked={sortField === opt.id}
                      onChange={() => setSortField(opt.id)}
                      className="accent-[#DB001B]"
                    />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </fieldset>
              <FormSelect label="Direction" value={sortDir} onChange={(e) => setSortDir(e.target.value as any)}>
                <option value="ASC">Ascending</option>
                <option value="DESC">Descending</option>
              </FormSelect>
            </div>
          )}

          {filterTab === 'FAVOURITES' && (
            <div className="space-y-3">
              <p className="text-xs text-[#68727A]">
                Select or reorder favourite accounts to appear at the top of your Accounts screen.
              </p>
              <div className="divide-y divide-[#D9DEE1] border border-[#D9DEE1]">
                {accounts.map((acc) => (
                  <div key={acc.id} className="p-3 flex items-center justify-between gap-2 text-xs">
                    <div className="min-w-0">
                      <div className="font-medium text-[#252B30] truncate">{acc.account_name}</div>
                      <div className="text-[#68727A] tabular-nums">{acc.maskedAccountNumber} • {acc.currency}</div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {acc.isFavourite && (
                        <>
                          <button
                            type="button"
                            aria-label={`Move ${acc.account_name} up`}
                            onClick={() => reorderFavourite(acc, -1)}
                            className="p-1.5 border border-[#D9DEE1] text-[#68727A] hover:text-[#252B30]"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            aria-label={`Move ${acc.account_name} down`}
                            onClick={() => reorderFavourite(acc, 1)}
                            className="p-1.5 border border-[#D9DEE1] text-[#68727A] hover:text-[#252B30]"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        aria-label={acc.isFavourite ? `Remove ${acc.account_name} from favourites` : `Add ${acc.account_name} to favourites`}
                        onClick={() => toggleFavourite(acc)}
                        className="p-1.5"
                      >
                        <Star className={`w-4 h-4 ${acc.isFavourite ? 'text-[#DB001B] fill-current' : 'text-[#B4BCC2]'}`} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-[#D9DEE1] grid grid-cols-2 gap-3 bg-[#F4F5F6]">
          <Button variant="outline" onClick={resetFilters}>
            Reset
          </Button>
          <Button onClick={applyFilterValues}>Apply filters</Button>
        </div>
      </div>
    );
  }

  // =========================================================================
  // ACCOUNT DETAIL SUB-SCREEN
  // =========================================================================
  if (viewMode === 'DETAIL' && selectedAccount) {
    return (
      <div className="bg-white border-x border-b border-[#D9DEE1]">
        <BankingHeader
          title="Account details"
          onBack={() => {
            setSelectedAccount(null);
            setViewMode('LIST');
          }}
          rightSlot={
            <button
              type="button"
              aria-label={selectedAccount.isFavourite ? 'Remove favourite' : 'Add favourite'}
              onClick={() => toggleFavourite(selectedAccount)}
              className="p-2"
            >
              <Star className={`w-4 h-4 ${selectedAccount.isFavourite ? 'text-[#DB001B] fill-current' : 'text-[#68727A]'}`} />
            </button>
          }
        />

        {/* Account Summary Header */}
        <div className="p-4 sm:p-5 border-b border-[#D9DEE1]">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h1 className="text-lg font-medium text-[#252B30]">{selectedAccount.account_name}</h1>
              <div className="text-xs text-[#68727A] tabular-nums mt-0.5">
                {selectedAccount.maskedAccountNumber} • {selectedAccount.currency} • {selectedAccount.account_type.replace(/_/g, ' ')}
              </div>
            </div>
            <StatusBadge status={selectedAccount.status} />
          </div>

          <div className="mt-4 pt-4 border-t border-[#D9DEE1] grid grid-cols-2 gap-4">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-[#68727A]">Available balance</div>
              <div className="text-xl font-semibold text-[#252B30] tabular-nums mt-0.5">
                {selectedAccount.availableBalance === null
                  ? 'Not Available'
                  : formatFinancialCurrency(selectedAccount.availableBalance, selectedAccount.currency, hideBalances)}
              </div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-[#68727A]">Ledger balance</div>
              <div className="text-xl font-normal text-[#252B30] tabular-nums mt-0.5">
                {selectedAccount.ledgerBalance === null
                  ? 'Not Available'
                  : formatFinancialCurrency(selectedAccount.ledgerBalance, selectedAccount.currency, hideBalances)}
              </div>
            </div>
          </div>
        </div>

        {/* Sub-Tabs */}
        <div className="grid grid-cols-3 border-b border-[#D9DEE1] bg-white text-xs font-medium" role="tablist">
          {(['TRANSACTIONS', 'STATEMENTS', 'INFO'] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={detailTab === t}
              onClick={() => setDetailTab(t)}
              className={`py-3 text-center border-b-[2px] ${
                detailTab === t ? 'border-[#DB001B] text-[#252B30] font-semibold' : 'border-transparent text-[#68727A]'
              }`}
            >
              {t === 'TRANSACTIONS' ? 'Transactions' : t === 'STATEMENTS' ? 'Statements' : 'Account info'}
            </button>
          ))}
        </div>

        {detailTab === 'TRANSACTIONS' && (
          <div>
            <div className="p-4 bg-[#F4F5F6] border-b border-[#D9DEE1] grid grid-cols-1 sm:grid-cols-4 gap-2.5">
              <div className="relative sm:col-span-2">
                <Search className="w-4 h-4 text-[#68727A] absolute left-3 top-3" aria-hidden="true" />
                <input
                  type="search"
                  placeholder="Search reference or counterparty..."
                  value={txnSearch}
                  onChange={(e) => setTxnSearch(e.target.value)}
                  className="w-full min-h-[40px] pl-9 pr-3 text-xs bg-white border border-[#B4BCC2] rounded-[2px]"
                />
              </div>
              <select
                aria-label="Filter debit or credit"
                value={txnEntryType}
                onChange={(e) => setTxnEntryType(e.target.value)}
                className="min-h-[40px] px-3 text-xs bg-white border border-[#B4BCC2] rounded-[2px]"
              >
                <option value="ALL">Debits &amp; Credits</option>
                <option value="DEBIT">Debits Only</option>
                <option value="CREDIT">Credits Only</option>
              </select>
              <Button size="sm" variant="secondary" onClick={() => loadAccountDetails(selectedAccount)}>
                Search
              </Button>
            </div>

            {detailLoading ? (
              <SkeletonList rows={4} />
            ) : accountTxns.length === 0 ? (
              <EmptyState title="No recent transactions" description="No transactions match your filter criteria." />
            ) : (
              <div className="divide-y divide-[#D9DEE1]">
                {accountTxns.map((t) => {
                  const isCredit = t.entry_type === 'CREDIT' || t.transaction_type === 'DEPOSIT_CREDIT';
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelectedTxn(t)}
                      className="w-full px-4 py-3.5 flex items-center justify-between gap-3 hover:bg-[#F4F5F6] text-left"
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        {isCredit ? (
                          <ArrowDownLeft className="w-4 h-4 text-[#27835B] mt-0.5 shrink-0" aria-hidden="true" />
                        ) : (
                          <ArrowUpRight className="w-4 h-4 text-[#C83A42] mt-0.5 shrink-0" aria-hidden="true" />
                        )}
                        <div className="min-w-0">
                          <div className="text-sm text-[#252B30] truncate">{t.counterparty_name}</div>
                          <div className="text-xs text-[#68727A] truncate">
                            {t.description} • {formatDateTime(t.created_at)}
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className={`text-sm font-medium tabular-nums ${isCredit ? 'text-[#27835B]' : 'text-[#252B30]'}`}>
                          {isCredit ? '+' : '-'}
                          {formatFinancialCurrency(t.amount, t.currency, hideBalances)}
                        </div>
                        <div className="text-[11px] text-[#68727A] tabular-nums">{t.reference}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {detailTab === 'STATEMENTS' && (
          <div className="divide-y divide-[#D9DEE1]">
            {statements.length === 0 ? (
              <EmptyState title="No statements generated yet" description="Use Self-Service under More to request historical statements." />
            ) : (
              statements.map((s) => (
                <div key={s.id} className="px-4 py-3.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <FileText className="w-4 h-4 text-[#263640]" aria-hidden="true" />
                    <div>
                      <div className="text-sm font-medium text-[#252B30]">{s.period_label}</div>
                      <div className="text-xs text-[#68727A] tabular-nums">
                        {s.start_date} – {s.end_date}
                      </div>
                    </div>
                  </div>
                  {s.document_available ? (
                    <Button size="sm" variant="outline" onClick={() => downloadStatement(s, selectedAccount)}>
                      <Download className="w-3.5 h-3.5" />
                      Download
                    </Button>
                  ) : (
                    <span className="text-xs text-[#68727A]">Pending</span>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {detailTab === 'INFO' && (
          <dl className="divide-y divide-[#D9DEE1] text-xs">
            <div className="px-4 py-3 flex justify-between"><dt className="text-[#68727A]">Account Number</dt><dd className="font-medium tabular-nums">{selectedAccount.account_number}</dd></div>
            <div className="px-4 py-3 flex justify-between"><dt className="text-[#68727A]">SWIFT / BIC</dt><dd className="font-medium tabular-nums">{selectedAccount.ifsc_swift}</dd></div>
            {selectedAccount.iban && (
              <div className="px-4 py-3 flex justify-between"><dt className="text-[#68727A]">IBAN</dt><dd className="font-medium tabular-nums">{selectedAccount.iban}</dd></div>
            )}
            {selectedAccount.sort_code && (
              <div className="px-4 py-3 flex justify-between"><dt className="text-[#68727A]">Clearing / Sort Code</dt><dd className="font-medium tabular-nums">{selectedAccount.sort_code}</dd></div>
            )}
            <div className="px-4 py-3 flex justify-between"><dt className="text-[#68727A]">Branch</dt><dd className="font-medium">{selectedAccount.branch_name}</dd></div>
            <div className="px-4 py-3 flex justify-between"><dt className="text-[#68727A]">Country</dt><dd className="font-medium">{selectedAccount.country}</dd></div>
          </dl>
        )}

        <NativeDialog open={!!selectedTxn} onClose={() => setSelectedTxn(null)} title="Transaction Details" subtitle={selectedTxn?.reference}>
          {selectedTxn && (
            <dl className="divide-y divide-[#D9DEE1] text-xs">
              <div className="py-2.5 flex justify-between"><dt className="text-[#68727A]">Counterparty</dt><dd className="font-medium">{selectedTxn.counterparty_name}</dd></div>
              <div className="py-2.5 flex justify-between"><dt className="text-[#68727A]">Amount</dt><dd className="font-semibold tabular-nums">{formatFinancialCurrency(selectedTxn.amount, selectedTxn.currency, hideBalances)}</dd></div>
              <div className="py-2.5 flex justify-between"><dt className="text-[#68727A]">Date &amp; Time</dt><dd className="font-medium">{formatDateTime(selectedTxn.created_at)}</dd></div>
              <div className="py-2.5 flex justify-between"><dt className="text-[#68727A]">Status</dt><dd><StatusBadge status={selectedTxn.status} /></dd></div>
              <div className="py-2.5 flex justify-between gap-4"><dt className="text-[#68727A]">Description</dt><dd className="text-right font-medium">{selectedTxn.description}</dd></div>
            </dl>
          )}
        </NativeDialog>
      </div>
    );
  }

  // =========================================================================
  // ACCOUNTS HOME — Matching mobile.pdf p.5 & liquidity.pdf p.1 structure
  // =========================================================================
  return (
    <div className="bg-white md:border md:border-[#D9DEE1]">
      <GeometricHeader
        title="Accounts"
        subtitle={activeOrg?.name}
        actions={
          <>
            <button
              type="button"
              onClick={() => setHideBalances(!hideBalances)}
              aria-label={hideBalances ? 'Show balances' : 'Hide balances'}
              className="min-w-[40px] min-h-[40px] flex items-center justify-center text-white/90 hover:bg-white/10 rounded-[2px]"
            >
              {hideBalances ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={loadAccounts}
              aria-label="Refresh accounts"
              className="min-w-[40px] min-h-[40px] flex items-center justify-center text-white/90 hover:bg-white/10 rounded-[2px]"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={openFilterView}
              aria-label="Filter, sort and favourites"
              className="min-w-[40px] min-h-[40px] flex items-center justify-center text-white/90 hover:bg-white/10 rounded-[2px]"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
          </>
        }
      />

      {/* Mobile Entity Selector + Consolidated Balance Strip */}
      <div className="px-4 py-3 bg-[#F4F5F6] border-b border-[#D9DEE1] flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-3 min-w-0">
          {organisations.length > 1 && (
            <select
              aria-label="Switch corporate entity"
              value={activeOrg?.id || ''}
              onChange={(e) => switchOrganisation(e.target.value)}
              className="md:hidden bg-white border border-[#B4BCC2] rounded-[2px] px-2 py-1 text-xs font-medium text-[#252B30] max-w-[200px]"
            >
              {organisations.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          )}
          <div>
            <span className="text-[#68727A]">Total available ({baseCurrency}): </span>
            <strong className="text-[#252B30] tabular-nums">
              {totalAvailableBase === null
                ? 'Not Available'
                : formatFinancialCurrency(totalAvailableBase, baseCurrency, hideBalances)}
            </strong>
          </div>
        </div>
        <div className="text-[11px] text-[#68727A]">
          {accounts.length} accounts • Updated {lastUpdated ? formatDateTime(lastUpdated) : 'now'}
        </div>
      </div>

      {/* Compact Search Bar */}
      <search className="px-4 py-2.5 bg-white border-b border-[#D9DEE1] flex items-center gap-2">
        <Search className="w-4 h-4 text-[#68727A] shrink-0" aria-hidden="true" />
        <label htmlFor="accounts-search" className="visually-hidden">Search accounts</label>
        <input
          id="accounts-search"
          type="search"
          placeholder="Search account name, number, or currency"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full py-1.5 text-sm text-[#252B30] placeholder:text-[#68727A]/70 focus:outline-none"
        />
      </search>

      {error && (
        <div className="p-4">
          <ErrorBanner message={error} onRetry={loadAccounts} />
        </div>
      )}

      {/* Optional Compact Favourites Section */}
      {favourites.length > 0 && !searchQuery && currencyFilter === 'ALL' && (
        <div>
          <div className="px-4 py-2 bg-[#F4F5F6] border-b border-[#D9DEE1] flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-[#68727A]">
            <span>FAVOURITE ACCOUNTS</span>
            <button type="button" onClick={() => { openFilterView(); setFilterTab('FAVOURITES'); }} className="text-[#263640] hover:underline normal-case font-medium">
              Manage
            </button>
          </div>
          {favourites.map((acc) => (
            <BankingListRow
              key={`fav-${acc.id}`}
              title={acc.nickname || acc.account_name}
              subtitle={`${acc.maskedAccountNumber} • ${acc.currency}`}
              rightText={
                acc.availableBalance === null
                  ? 'Not Available'
                  : formatFinancialCurrency(acc.availableBalance, acc.currency, hideBalances)
              }
              onClick={() => loadAccountDetails(acc)}
            />
          ))}
        </div>
      )}

      {/* Main Currency-Grouped Account List */}
      {loading ? (
        <SkeletonList rows={5} />
      ) : groupedAccounts.length === 0 ? (
        <EmptyState
          title="No matching accounts"
          description="Adjust your search or filters to view your organisation's corporate accounts."
          action={
            onNavigate ? (
              <Button size="sm" variant="outline" onClick={resetFilters}>
                Reset filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div>
          {groupedAccounts.map(([groupLabel, list]) => {
            const isCollapsed = !!collapsedGroups[groupLabel];
            return (
              <div key={groupLabel}>
                <button
                  type="button"
                  aria-expanded={!isCollapsed}
                  onClick={() => setCollapsedGroups((p) => ({ ...p, [groupLabel]: !p[groupLabel] }))}
                  className="w-full px-4 py-2 bg-[#F4F5F6] border-b border-[#D9DEE1] flex items-center justify-between text-left"
                >
                  <span className="text-[11px] font-semibold tracking-wide text-[#68727A] uppercase">
                    {groupLabel}
                  </span>
                  {isCollapsed ? (
                    <ChevronRight className="w-3.5 h-3.5 text-[#68727A]" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-[#68727A]" />
                  )}
                </button>

                {!isCollapsed &&
                  list.map((acc) => (
                    <BankingListRow
                      key={acc.id}
                      title={acc.account_name}
                      subtitle={`${acc.maskedAccountNumber}${acc.status !== 'ACTIVE' ? ` • ${acc.status}` : ''}`}
                      rightText={
                        acc.availableBalance === null
                          ? 'Not Available'
                          : formatFinancialCurrency(acc.availableBalance, acc.currency, hideBalances)
                      }
                      onClick={() => loadAccountDetails(acc)}
                    />
                  ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
