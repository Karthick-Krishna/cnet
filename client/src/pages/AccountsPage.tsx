import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowDownLeft,
  ArrowUp,
  ArrowUpRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  EyeOff,
  FileText,
  Filter,
  Info,
  Lock,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Star,
  Unlock,
  X,
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
  AED: 'AED - UAE Dirham',
  AUD: 'AUD - Australian Dollar',
  EUR: 'EUR - Euro',
  GBP: 'GBP - Sterling Pound',
  HKD: 'HKD - Hong Kong Dollar',
  INR: 'INR - Indian Rupee',
  SGD: 'SGD - Singapore Dollar',
  USD: 'USD - US Dollar',
};

const COUNTRY_NAMES: Record<string, string> = {
  GB: 'Great Britain KCTR',
  IN: 'India KCTR',
  DE: 'Germany KCTR',
  US: 'United States KCTR',
  SG: 'Singapore KCTR',
};

const HERO_SLIDES = [
  {
    id: 'tour',
    image: '/welcome-bg.jpg',
    title: 'Welcome to the start of your new HSBCnet. Here\'s a quick tour of the features that will help you do things faster and more easily.',
    cta: 'Read more',
    actionTab: 'MORE_TOUR',
  },
  {
    id: 'award',
    image: '/hero-turbine.jpg',
    title: 'Coralgenz Global Treasury Portal — Real-time visibility across global accounts, Trade & Supply Chain, FX markets, and instant payment authorisations.',
    cta: 'Read more',
    actionTab: 'TRADE_HUB',
  },
  {
    id: 'trade',
    image: '/welcome-bg.jpg',
    title: 'Trade and Supply Chain — Issue Documentary Credits, Bank Guarantees, Supply Chain Finance offers, and track Bills of Lading live.',
    cta: 'Open Trade Suite',
    actionTab: 'TRADE_HUB',
  },
  {
    id: 'fx',
    image: '/hero-turbine.jpg',
    title: 'Global Markets & Virtual Accounts — Execute live Get Rate FX conversions and automate receivables reconciliation across Coralgenz Global.',
    cta: 'Explore Markets',
    actionTab: 'FX_MARKETS',
  },
];

const SECURITY_NOTICES = [
  {
    lead: 'Business Email Compromise: a growing online security threat:',
    rest: 'plus other articles to help you get the most out of HSBCnet.',
  },
  {
    lead: 'Security Devices: do you know what to do when the battery is low?:',
    rest: 'plus other articles to help you get the most out of HSBCnet.',
  },
];

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
  const [accountScope, setAccountScope] = useState<'ALL' | 'FAVOURITES' | 'OPERATING' | 'TREASURY'>('ALL');
  const [groupingMode, setGroupingMode] = useState<'CURRENCY' | 'LOCATION_CURRENCY'>('LOCATION_CURRENCY');
  const [sortField, setSortField] = useState<'FAV' | 'NAME' | 'CURRENCY' | 'BALANCE' | 'NUMBER'>('NUMBER');
  const [sortDir, setSortDir] = useState<'ASC' | 'DESC'>('ASC');

  // Portal toolbar controls matching HSBCnet screenshots
  const [heroSlideIdx, setHeroSlideIdx] = useState(0);
  const [showNoticeBanner, setShowNoticeBanner] = useState(true);
  const [noticeIdx] = useState(0);
  const [articlesModalOpen, setArticlesModalOpen] = useState(false);
  const [tourModalOpen, setTourModalOpen] = useState(false);
  const [showSubtotalRow, setShowSubtotalRow] = useState(true);
  const [inlineFilterOpen, setInlineFilterOpen] = useState(false);
  const [customiseOpen, setCustomiseOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [unmaskNumbers, setUnmaskNumbers] = useState(false);
  const [showLedgerColumn, setShowLedgerColumn] = useState(false);
  const [showSwiftColumn, setShowSwiftColumn] = useState(false);

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
        if (accountScope === 'FAVOURITES' && !a.isFavourite) return false;
        if (accountScope === 'OPERATING' && !['SAVINGS', 'CURRENT', 'OPERATING'].includes(a.account_type)) return false;
        if (accountScope === 'TREASURY' && !['TREASURY', 'FIXED_DEPOSIT', 'FOREIGN_CURRENCY'].includes(a.account_type)) return false;
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
  }, [accounts, accountScope, searchQuery, locationFilter, institutionFilter, currencyFilter, accountNumberFilter, sortField, sortDir]);

  const groupedAccounts = useMemo(() => {
    const groups: Record<string, AccountRow[]> = {};
    for (const acc of filteredAccounts) {
      const countryTitle = COUNTRY_NAMES[acc.country] || acc.country;
      const curTitle = CURRENCY_LABELS[acc.currency] || acc.currency;
      const key = groupingMode === 'LOCATION_CURRENCY' ? `${countryTitle} (${curTitle})` : curTitle;
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
  // ACCOUNTS HOME — Exact HSBCnet Desktop & Mobile Portal Workspace
  // =========================================================================
  const activeSlide = HERO_SLIDES[heroSlideIdx] || HERO_SLIDES[0];
  const activeNotice = SECURITY_NOTICES[noticeIdx] || SECURITY_NOTICES[0];

  const handleHeaderSort = (field: 'FAV' | 'NAME' | 'BALANCE' | 'NUMBER') => {
    if (sortField === field) {
      setSortDir((d) => (d === 'ASC' ? 'DESC' : 'ASC'));
    } else {
      setSortField(field);
      setSortDir('ASC');
    }
  };

  const exportAccounts = (fmt: 'CSV' | 'MT940' | 'BAI2') => {
    setExportMenuOpen(false);
    const dateTag = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    let content = '';
    if (fmt === 'CSV') {
      content =
        'Account Number,Account Title,Country,Currency,Current Available,Ledger Balance,As At\n' +
        filteredAccounts
          .map(
            (a) =>
              `"${unmaskNumbers ? a.account_number : a.maskedAccountNumber}","${a.account_name}","${a.country}","${a.currency}",${a.available_balance},${a.ledger_balance},"${lastUpdated || new Date().toISOString()}"`
          )
          .join('\n');
    } else if (fmt === 'MT940') {
      content = filteredAccounts
        .map(
          (a) =>
            `:20:CGLB${dateTag}\n:25:${a.account_number}\n:28C:00124/001\n:60F:C${dateTag.slice(2)}${a.currency}${Number(a.available_balance).toFixed(2).replace('.', ',')}\n:62F:C${dateTag.slice(2)}${a.currency}${Number(a.available_balance).toFixed(2).replace('.', ',')}\n-`
        )
        .join('\n');
    } else {
      content =
        `01,HSBCNET,CORALGENZ,${dateTag},1915,1,80,,2/\n` +
        filteredAccounts.map((a) => `03,${a.account_number},${a.currency},010,${Math.round(a.available_balance * 100)},,,/`).join('\n') +
        '\n99,1,1,1/';
    }
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Coralgenz_Account_Information_${fmt}_${dateTag}.${fmt === 'CSV' ? 'csv' : 'txt'}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white">
      {/* 1. Full-Bleed Photographic Hero Carousel Banner (Matching uploaded screenshots) */}
      <section aria-label="Welcome to HSBCnet banner" className="relative overflow-hidden bg-[#0E1317] min-h-[215px] sm:min-h-[250px] flex items-center">
        <img
          src={activeSlide.image}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover object-right opacity-90 transition-opacity duration-500"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-r from-[#0B0F12]/95 via-[#0E1317]/65 to-transparent"
        />

        <div className="relative z-10 w-full max-w-[1440px] mx-auto px-4 sm:px-6 py-4">
          <div className="max-w-[395px] text-white">
            <h1 className="text-[22px] sm:text-[26px] font-normal tracking-tight leading-tight mb-2.5">
              Welcome to HSBC<span className="italic font-light">net</span>
            </h1>

            <div className="bg-[#11161B]/80 border border-white/15 p-3.5 sm:p-4 backdrop-blur-[2px]">
              <p className="text-xs leading-relaxed text-white/95 min-h-[60px]">{activeSlide.title}</p>
              <button
                type="button"
                onClick={() => {
                  if (activeSlide.actionTab === 'MORE_TOUR') {
                    setTourModalOpen(true);
                  } else {
                    onNavigate?.('more', activeSlide.actionTab);
                  }
                }}
                className="mt-2.5 inline-flex items-center gap-1 text-xs font-medium text-white hover:underline"
              >
                <span>{activeSlide.cta}</span>
                <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>

            {/* Carousel Pagination: < [ - - - - ] > */}
            <div className="mt-2.5 flex items-center justify-between max-w-[395px]">
              <button
                type="button"
                aria-label="Previous welcome highlight"
                onClick={() => setHeroSlideIdx((i) => (i - 1 + HERO_SLIDES.length) % HERO_SLIDES.length)}
                className="w-7 h-7 bg-[#22282E]/90 border border-white/15 flex items-center justify-center text-white/85 hover:text-white"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              <div className="flex items-center gap-2" role="tablist" aria-label="Welcome slides">
                {HERO_SLIDES.map((s, idx) => (
                  <button
                    key={s.id}
                    type="button"
                    aria-label={`Slide ${idx + 1}`}
                    aria-selected={idx === heroSlideIdx}
                    onClick={() => setHeroSlideIdx(idx)}
                    className={`h-[3px] w-4 transition-colors ${idx === heroSlideIdx ? 'bg-[#DB001B]' : 'bg-white/40 hover:bg-white/65'}`}
                  />
                ))}
              </div>

              <button
                type="button"
                aria-label="Next welcome highlight"
                onClick={() => setHeroSlideIdx((i) => (i + 1) % HERO_SLIDES.length)}
                className="w-7 h-7 bg-[#22282E]/90 border border-white/15 flex items-center justify-center text-white/85 hover:text-white"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Security & Portal Advisory Banner directly below Hero */}
      {showNoticeBanner && (
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 pt-3.5">
          <div className="border border-[#5A656E] bg-[#EEF2F5] px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs text-[#252B30]">
            <div className="flex items-start sm:items-center gap-2.5 min-w-0">
              <Info className="w-4 h-4 text-[#263640] shrink-0 mt-0.5 sm:mt-0" aria-hidden="true" />
              <p className="leading-snug">
                <strong className="font-semibold">{activeNotice.lead}</strong> {activeNotice.rest}{' '}
                <button
                  type="button"
                  onClick={() => setArticlesModalOpen(true)}
                  className="underline font-medium text-[#252B30] hover:text-[#DB001B]"
                >
                  Read all articles
                </button>
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowNoticeBanner(false)}
              className="text-xs text-[#68727A] hover:text-[#252B30] font-medium shrink-0 ml-auto"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* 3. Main Account Information Section */}
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3 mb-4">
          <div>
            <h2 className="text-[24px] font-light text-[#252B30] tracking-tight">Account information</h2>
            <p className="text-xs text-[#68727A] mt-0.5">
              {activeOrg?.name} • Total available ({baseCurrency}):{' '}
              <strong className="text-[#252B30] tabular-nums">
                {totalAvailableBase === null ? 'Not Available' : formatFinancialCurrency(totalAvailableBase, baseCurrency, hideBalances)}
              </strong>
            </p>
          </div>

          {organisations.length > 1 && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-[#68727A]">Entity:</span>
              <select
                aria-label="Switch corporate entity"
                value={activeOrg?.id || ''}
                onChange={(e) => switchOrganisation(e.target.value)}
                className="bg-white border border-[#B4BCC2] rounded-[2px] px-2.5 py-1.5 text-xs font-medium text-[#252B30]"
              >
                {organisations.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name} ({o.country})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Exact HSBCnet Toolbar Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#D9DEE1] text-xs">
          {/* Left Toolbar Controls */}
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <select
              aria-label="Account view scope"
              value={accountScope}
              onChange={(e) => setAccountScope(e.target.value as any)}
              className="h-8 px-2.5 bg-white border border-[#B4BCC2] rounded-[2px] text-xs text-[#252B30]"
            >
              <option value="ALL">Show all accounts</option>
              <option value="FAVOURITES">Favourites only ({favourites.length})</option>
              <option value="OPERATING">Operating accounts</option>
              <option value="TREASURY">Treasury &amp; Term reserves</option>
            </select>

            <div className="flex items-center gap-2.5">
              <span className="text-[#68727A]">Group by</span>
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="portal-grouping"
                  checked={groupingMode === 'LOCATION_CURRENCY'}
                  onChange={() => setGroupingMode('LOCATION_CURRENCY')}
                  className="accent-[#263640]"
                />
                <span>Location/Currency</span>
              </label>
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="portal-grouping"
                  checked={groupingMode === 'CURRENCY'}
                  onChange={() => setGroupingMode('CURRENCY')}
                  className="accent-[#263640]"
                />
                <span>Currency</span>
              </label>
            </div>

            <button
              type="button"
              onClick={() => setInlineFilterOpen((v) => !v)}
              className={`h-8 px-2.5 inline-flex items-center gap-1.5 border rounded-[2px] ${
                inlineFilterOpen || locationFilter !== 'ALL' || currencyFilter !== 'ALL' || searchQuery
                  ? 'border-[#263640] bg-[#EEF2F5] font-medium text-[#252B30]'
                  : 'border-transparent hover:border-[#D9DEE1] text-[#252B30]'
              }`}
            >
              <Filter className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Filter</span>
              <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>

          {/* Right Toolbar Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-1.5 mr-1 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showSubtotalRow}
                onChange={(e) => setShowSubtotalRow(e.target.checked)}
                className="w-3.5 h-3.5 accent-[#263640]"
              />
              <span>Subtotal row</span>
            </label>

            <div className="relative">
              <button
                type="button"
                onClick={() => { setCustomiseOpen((v) => !v); setExportMenuOpen(false); }}
                className="h-8 px-3 bg-white border border-[#B4BCC2] hover:bg-[#F4F5F6] text-xs font-medium text-[#252B30] rounded-[2px]"
              >
                Customise view
              </button>
              {customiseOpen && (
                <div className="absolute right-0 mt-1 w-56 bg-white border border-[#B4BCC2] shadow-lg p-3 z-20 space-y-2 text-xs">
                  <div className="font-semibold text-[#252B30] pb-1 border-b border-[#D9DEE1]">Display Columns &amp; Privacy</div>
                  <label className="flex items-center justify-between py-1 cursor-pointer">
                    <span>Ledger balance column</span>
                    <input type="checkbox" checked={showLedgerColumn} onChange={(e) => setShowLedgerColumn(e.target.checked)} className="accent-[#DB001B]" />
                  </label>
                  <label className="flex items-center justify-between py-1 cursor-pointer">
                    <span>SWIFT / BIC column</span>
                    <input type="checkbox" checked={showSwiftColumn} onChange={(e) => setShowSwiftColumn(e.target.checked)} className="accent-[#DB001B]" />
                  </label>
                  <label className="flex items-center justify-between py-1 cursor-pointer">
                    <span>Show full account numbers</span>
                    <input type="checkbox" checked={unmaskNumbers} onChange={(e) => setUnmaskNumbers(e.target.checked)} className="accent-[#DB001B]" />
                  </label>
                  <label className="flex items-center justify-between py-1 cursor-pointer">
                    <span>Mask currency balances</span>
                    <input type="checkbox" checked={hideBalances} onChange={(e) => setHideBalances(e.target.checked)} className="accent-[#DB001B]" />
                  </label>
                  <button
                    type="button"
                    onClick={() => { setCustomiseOpen(false); openFilterView(); }}
                    className="w-full pt-1.5 border-t border-[#D9DEE1] text-left text-[#DB001B] font-medium hover:underline"
                  >
                    Manage favourites &amp; sort order →
                  </button>
                </div>
              )}
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => { setExportMenuOpen((v) => !v); setCustomiseOpen(false); }}
                className="h-8 px-3 bg-white border border-[#B4BCC2] hover:bg-[#F4F5F6] text-xs font-medium text-[#252B30] inline-flex items-center gap-1.5 rounded-[2px]"
              >
                <span>Export</span>
                <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
              {exportMenuOpen && (
                <div className="absolute right-0 mt-1 w-44 bg-white border border-[#B4BCC2] shadow-lg py-1 z-20 text-xs">
                  <button type="button" onClick={() => exportAccounts('CSV')} className="w-full px-3 py-2 text-left hover:bg-[#F4F5F6]">Export CSV (.csv)</button>
                  <button type="button" onClick={() => exportAccounts('MT940')} className="w-full px-3 py-2 text-left hover:bg-[#F4F5F6]">Export SWIFT MT940</button>
                  <button type="button" onClick={() => exportAccounts('BAI2')} className="w-full px-3 py-2 text-left hover:bg-[#F4F5F6]">Export BAI2 Extract</button>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setHideBalances(!hideBalances)}
              title={hideBalances ? 'Show balances' : 'Mask balances'}
              aria-label={hideBalances ? 'Show balances' : 'Mask balances'}
              className="w-8 h-8 bg-white border border-[#B4BCC2] hover:bg-[#F4F5F6] flex items-center justify-center rounded-[2px] text-[#252B30]"
            >
              {hideBalances ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
            </button>

            <button
              type="button"
              onClick={loadAccounts}
              title="Refresh account balances"
              aria-label="Refresh accounts"
              className="w-8 h-8 bg-white border border-[#B4BCC2] hover:bg-[#F4F5F6] flex items-center justify-center rounded-[2px] text-[#252B30]"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Collapsible Filter Drawer */}
        {inlineFilterOpen && (
          <div className="p-3.5 bg-[#F4F5F6] border-x border-b border-[#D9DEE1] grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
            <input
              type="search"
              placeholder="Search account title or number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 px-3 bg-white border border-[#B4BCC2] rounded-[2px]"
            />
            <select
              aria-label="Filter by location"
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="h-9 px-2.5 bg-white border border-[#B4BCC2] rounded-[2px]"
            >
              <option value="ALL">All Locations</option>
              {locations.map((l) => <option key={l} value={l}>{COUNTRY_NAMES[l] || l}</option>)}
            </select>
            <select
              aria-label="Filter by currency"
              value={currencyFilter}
              onChange={(e) => setCurrencyFilter(e.target.value)}
              className="h-9 px-2.5 bg-white border border-[#B4BCC2] rounded-[2px]"
            >
              <option value="ALL">All Currencies</option>
              {currencies.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={resetFilters} fullWidth>Reset</Button>
              <Button size="sm" onClick={() => setInlineFilterOpen(false)} fullWidth>Done</Button>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4">
            <ErrorBanner message={error} onRetry={loadAccounts} />
          </div>
        )}

        {/* Exact HSBCnet Grouped Data Table */}
        {loading ? (
          <SkeletonList rows={5} />
        ) : groupedAccounts.length === 0 ? (
          <EmptyState
            title="No matching accounts"
            description="Adjust your search or filters to view Coralgenz Global corporate accounts."
            action={<Button size="sm" variant="outline" onClick={resetFilters}>Reset filters</Button>}
          />
        ) : (
          <div
            tabIndex={0}
            role="region"
            aria-label="Account information table"
            className="mt-3 corporate-table-wrapper border border-[#D9DEE1]"
          >
            <table className="w-full min-w-[660px] text-left border-collapse text-xs">
              <caption className="visually-hidden">Coralgenz Global Corporate Account Information</caption>
              <thead>
                <tr className="border-b border-[#C6CDD2]">
                  <th scope="col" className="w-10 bg-[#E6EAED] py-2.5 px-3 text-center font-medium text-[#252B30]">
                    <Star className="w-3.5 h-3.5 mx-auto text-[#252B30]" aria-hidden="true" />
                    <span className="visually-hidden">Favourite</span>
                  </th>
                  <th
                    scope="col"
                    aria-sort={sortField === 'NUMBER' ? (sortDir === 'ASC' ? 'ascending' : 'descending') : undefined}
                    className={`p-0 border-r border-[#C6CDD2] ${sortField === 'NUMBER' ? 'bg-[#2D373E] text-white' : 'bg-[#E6EAED] text-[#252B30]'}`}
                  >
                    <button
                      type="button"
                      onClick={() => handleHeaderSort('NUMBER')}
                      className="w-full py-2.5 px-3 flex items-center justify-between gap-2 font-medium text-left"
                    >
                      <span>Account number</span>
                      <span aria-hidden="true" className="text-[10px]">{sortField === 'NUMBER' ? (sortDir === 'ASC' ? '▲' : '▼') : '▾'}</span>
                    </button>
                  </th>
                  <th
                    scope="col"
                    aria-sort={sortField === 'NAME' ? (sortDir === 'ASC' ? 'ascending' : 'descending') : undefined}
                    className={`p-0 border-r border-[#C6CDD2] ${sortField === 'NAME' ? 'bg-[#2D373E] text-white' : 'bg-[#E6EAED] text-[#252B30]'}`}
                  >
                    <button
                      type="button"
                      onClick={() => handleHeaderSort('NAME')}
                      className="w-full py-2.5 px-3 flex items-center justify-between gap-2 font-medium text-left"
                    >
                      <span>Account title</span>
                      <span aria-hidden="true" className="text-[10px]">{sortField === 'NAME' ? (sortDir === 'ASC' ? '▲' : '▼') : '▾'}</span>
                    </button>
                  </th>
                  {showSwiftColumn && (
                    <th scope="col" className="bg-[#E6EAED] py-2.5 px-3 border-r border-[#C6CDD2] font-medium text-[#252B30]">
                      SWIFT / Clearing
                    </th>
                  )}
                  {showLedgerColumn && (
                    <th scope="col" className="bg-[#E6EAED] py-2.5 px-3 border-r border-[#C6CDD2] text-right font-medium text-[#252B30]">
                      Ledger balance
                    </th>
                  )}
                  <th
                    scope="col"
                    aria-sort={sortField === 'BALANCE' ? (sortDir === 'ASC' ? 'ascending' : 'descending') : undefined}
                    className={`p-0 border-r border-[#C6CDD2] ${sortField === 'BALANCE' ? 'bg-[#2D373E] text-white' : 'bg-[#E6EAED] text-[#252B30]'}`}
                  >
                    <button
                      type="button"
                      onClick={() => handleHeaderSort('BALANCE')}
                      className="w-full py-2.5 px-3 flex items-center justify-end gap-2 font-medium text-right"
                    >
                      <span>Current available</span>
                      <span aria-hidden="true" className="text-[10px]">{sortField === 'BALANCE' ? (sortDir === 'ASC' ? '▲' : '▼') : '▾'}</span>
                    </button>
                  </th>
                  <th scope="col" className="bg-[#E6EAED] py-2.5 px-3 text-right font-medium text-[#252B30]">
                    As at date/time
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[#D9DEE1]">
                {groupedAccounts.map(([groupLabel, list]) => {
                  const isCollapsed = !!collapsedGroups[groupLabel];
                  const colSpanCount = 5 + (showLedgerColumn ? 1 : 0) + (showSwiftColumn ? 1 : 0);
                  const groupSubtotal = list.reduce((sum, item) => sum + (item.availableBalance || 0), 0);
                  const groupCurrency = list[0]?.currency || baseCurrency;
                  return (
                    <React.Fragment key={groupLabel}>
                      {/* Group Banner Row matching Image 1 & 2 */}
                      <tr className="bg-[#EDF1F4]">
                        <td colSpan={colSpanCount} className="p-0">
                          <button
                            type="button"
                            aria-expanded={!isCollapsed}
                            onClick={() => setCollapsedGroups((p) => ({ ...p, [groupLabel]: !p[groupLabel] }))}
                            className="w-full py-2 px-3 flex items-center justify-between text-left font-semibold text-[#252B30] hover:bg-[#E4EAEE]"
                          >
                            <span>{groupLabel}</span>
                            {isCollapsed ? <ChevronRight className="w-3.5 h-3.5 text-[#68727A]" /> : <ChevronDown className="w-3.5 h-3.5 text-[#68727A]" />}
                          </button>
                        </td>
                      </tr>

                      {!isCollapsed &&
                        list.map((acc) => (
                          <tr
                            key={acc.id}
                            onClick={() => loadAccountDetails(acc)}
                            className="bg-white hover:bg-[#F4F5F6] cursor-pointer transition-colors"
                          >
                            <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                aria-label={acc.isFavourite ? `Unstar ${acc.account_name}` : `Star ${acc.account_name}`}
                                onClick={(e) => toggleFavourite(acc, e)}
                                className="p-1"
                              >
                                <Star className={`w-3.5 h-3.5 ${acc.isFavourite ? 'text-[#DB001B] fill-current' : 'text-[#B4BCC2]'}`} />
                              </button>
                            </td>
                            <th scope="row" className="py-3 px-3 font-medium text-[#252B30] tabular-nums whitespace-nowrap">
                              {unmaskNumbers ? acc.account_number : acc.maskedAccountNumber}
                            </th>
                            <td className="py-3 px-3 text-[#252B30]">
                              <div className="font-medium">{acc.account_name}</div>
                              <div className="text-[11px] text-[#68727A]">
                                {acc.institution || acc.branch_name} • {acc.account_type.replace(/_/g, ' ')}
                              </div>
                            </td>
                            {showSwiftColumn && (
                              <td className="py-3 px-3 text-[#68727A] tabular-nums">{acc.ifsc_swift}</td>
                            )}
                            {showLedgerColumn && (
                              <td className="py-3 px-3 text-right tabular-nums text-[#68727A]">
                                {acc.ledgerBalance === null
                                  ? 'Not Available'
                                  : formatFinancialCurrency(acc.ledgerBalance, acc.currency, hideBalances)}
                              </td>
                            )}
                            <td className="py-3 px-3 text-right font-semibold tabular-nums text-[#252B30]">
                              {acc.availableBalance === null
                                ? 'Not Available'
                                : formatFinancialCurrency(acc.availableBalance, acc.currency, hideBalances)}
                            </td>
                            <td className="py-3 px-3 text-right text-[#68727A] tabular-nums whitespace-nowrap">
                              {lastUpdated ? formatDateTime(lastUpdated) : '27 Nov 26 19:15 IST'}
                            </td>
                          </tr>
                        ))}

                      {/* Subtotal row matching Image 2 */}
                      {!isCollapsed && showSubtotalRow && (
                        <tr className="bg-[#FAFBFB] font-semibold text-[#252B30]">
                          <td className="py-2.5 px-3" />
                          <td className="py-2.5 px-3">Subtotal</td>
                          <td className="py-2.5 px-3 text-[#68727A] font-normal">{list.length} account{list.length > 1 ? 's' : ''}</td>
                          {showSwiftColumn && <td className="py-2.5 px-3" />}
                          {showLedgerColumn && <td className="py-2.5 px-3" />}
                          <td className="py-2.5 px-3 text-right tabular-nums">
                            {formatFinancialCurrency(groupSubtotal, groupCurrency, hideBalances)}
                          </td>
                          <td className="py-2.5 px-3" />
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Articles Modal */}
      <NativeDialog open={articlesModalOpen} onClose={() => setArticlesModalOpen(false)} title="HSBCnet Security & Operations Articles">
        <div className="space-y-3 text-xs text-[#252B30]">
          <div className="p-3 border border-[#D9DEE1] bg-[#F4F5F6]">
            <div className="font-semibold">1. Business Email Compromise: a growing online security threat</div>
            <p className="text-[#68727A] mt-1">Verify any beneficiary bank detail change out-of-band before initiating Priority Payments or SEPA transfers. Use Restricted Payment Templates for locked supplier disbursements.</p>
          </div>
          <div className="p-3 border border-[#D9DEE1] bg-[#F4F5F6]">
            <div className="font-semibold">2. Security Devices &amp; Platform Passkeys</div>
            <p className="text-[#68727A] mt-1">Keep a backup Mobile Security PIN or registered WebAuthn passkey active under Security Settings so Coralgenz Global sign-offs stay uninterrupted.</p>
          </div>
        </div>
      </NativeDialog>

      {/* Tour Modal */}
      <NativeDialog open={tourModalOpen} onClose={() => setTourModalOpen(false)} title="Coralgenz Global — HSBCnet Quick Tour">
        <div className="space-y-2.5 text-xs text-[#252B30]">
          <p><strong>≡ Menu Mega-Menu:</strong> Access Cash Management, Trade &amp; Supply Chain, Global Markets FX, HSBC Securities Services, and System Administration from the top bar.</p>
          <p><strong>Tasks &amp; Authorisations:</strong> Review pending dual-authorisation wires and Trade Documentary Credits directly from Tasks in the upper-right bar.</p>
          <p><strong>Account information:</strong> Click any account row for full transaction history, downloadable statements, SWIFT MT940 &amp; BAI2 exports.</p>
        </div>
      </NativeDialog>
    </div>
  );
};
