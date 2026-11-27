import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity,
  ArrowLeftRight,
  Bell,
  Building2,
  CheckSquare,
  ChevronDown,
  Globe,
  HelpCircle,
  Lock,
  LogOut,
  Menu,
  Pin,
  ShieldCheck,
  Ship,
  WalletCards,
  X,
} from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { EntryExperience } from './pages/auth/EntryExperience';
import { AccountsPage } from './pages/AccountsPage';
import { AuthPage } from './pages/AuthPage';
import { PaymentsPage } from './pages/PaymentsPage';
import { TrackPage } from './pages/TrackPage';
import { MorePage } from './pages/MorePage';
import { BrandMark } from './components/ui/BrandMark';
import { apiRequest } from './lib/api';
import { formatDateTime } from '@shared/utils/formatters';

type PrimaryTab = 'accounts' | 'auth' | 'payments' | 'track' | 'more';

class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; message: string }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error.message };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 max-w-md mx-auto mt-12 bg-white border border-[#D9DEE1] rounded-[2px] text-center">
          <h1 className="text-base font-medium text-[#252B30]">Unable to load view</h1>
          <p className="text-xs text-[#68727A] mt-2">{this.state.message}</p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, message: '' })}
            className="mt-4 px-4 py-2 text-xs font-medium bg-[#DB001B] text-white rounded-[2px]"
          >
            Reload View
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

interface MegaMenuLink {
  label: string;
  tab: PrimaryTab;
  sub?: string;
}

const MEGA_MENU_PILLARS: { title: string; items: MegaMenuLink[] }[] = [
  {
    title: 'Cash management',
    items: [
      { label: 'Account information', tab: 'accounts' },
      { label: 'Virtual accounts', tab: 'more', sub: 'VIRTUAL_ACCOUNTS' },
      { label: 'Create payment', tab: 'payments' },
      { label: 'Create payment template', tab: 'more', sub: 'PAYMENT_TEMPLATES' },
      { label: 'File upload (ISO 20022 / CSV)', tab: 'more', sub: 'FILE_UPLOAD' },
      { label: 'Authorisations & queue', tab: 'auth' },
      { label: 'Track payment status', tab: 'track' },
      { label: 'Liquidity dashboard', tab: 'more', sub: 'LIQUIDITY' },
      { label: 'Receivables finance', tab: 'more', sub: 'RECEIVABLES' },
      { label: 'Reports & files (MT940 / BAI2 / AFD)', tab: 'more', sub: 'REPORTS_FILES' },
      { label: 'Remote deposit capture', tab: 'more', sub: 'RDC' },
    ],
  },
  {
    title: 'Trade and Supply Chain',
    items: [
      { label: 'Trade Dashboard & Summary', tab: 'more', sub: 'TRADE_HUB' },
      { label: 'Documentary Credits (Import / Export)', tab: 'more', sub: 'TRADE_DC' },
      { label: 'Bank Guarantees & SBLCs', tab: 'more', sub: 'TRADE_GUARANTEES' },
      { label: 'Trade Transaction Tracker (BL / DHL)', tab: 'more', sub: 'TRADE_TRACKER' },
      { label: 'Supply Chain Finance (SCF)', tab: 'more', sub: 'TRADE_SCF' },
      { label: 'Trade Authorisation Queue', tab: 'more', sub: 'TRADE' },
    ],
  },
  {
    title: 'Markets & Securities Services',
    items: [
      { label: 'Foreign Exchange & Deal Execution', tab: 'more', sub: 'FX_MARKETS' },
      { label: 'Live FX Exchange Rates', tab: 'more', sub: 'FX_RATES' },
      { label: 'Securities Custody & Valuation (HSS)', tab: 'more', sub: 'SECURITIES' },
      { label: 'Corporate Actions Election', tab: 'more', sub: 'SECURITIES' },
    ],
  },
  {
    title: 'System administration & Support',
    items: [
      { label: 'Self-service certificates & docs', tab: 'more', sub: 'SELF_SERVICE' },
      { label: 'My alerts & preferences', tab: 'more', sub: 'ALERTS' },
      { label: 'Mobile authentication & PIN', tab: 'more', sub: 'SETTINGS' },
      { label: 'Registered Passkeys & Devices', tab: 'more', sub: 'BIOMETRICS_MANAGE' },
      { label: 'Helpdesk & Support tickets', tab: 'more', sub: 'SUPPORT' },
    ],
  },
];

const AuthenticatedShell: React.FC = () => {
  const { user, activeOrg, organisations, switchOrganisation, lockSession, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<PrimaryTab>('accounts');
  const [moreSubView, setMoreSubView] = useState<string | undefined>(undefined);
  const [pendingAuthCount, setPendingAuthCount] = useState(0);
  const [pendingTradeCount, setPendingTradeCount] = useState(0);
  const [unreadAlertsCount, setUnreadAlertsCount] = useState(0);

  const [megaMenuOpen, setMegaMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [language, setLanguage] = useState('English');
  const [pinnedLabel, setPinnedLabel] = useState('Account information');
  const menuContainerRef = useRef<HTMLDivElement>(null);

  const loadBadges = useCallback(async () => {
    if (!activeOrg) return;
    try {
      const [authRes, tradeRes, notifRes] = await Promise.all([
        apiRequest<any>(`/api/corporate/authorisations?orgId=${encodeURIComponent(activeOrg.id)}`),
        apiRequest<any>(`/api/corporate/trade?orgId=${encodeURIComponent(activeOrg.id)}`).catch(() => ({ transactions: [] })),
        apiRequest<any>('/api/notifications').catch(() => ({ unreadCount: 0 })),
      ]);
      const pendingPay = (authRes.instructions || []).filter((i: any) =>
        ['AWAITING_AUTHORISATION', 'PARTIALLY_AUTHORISED'].includes(i.status)
      ).length;
      const pendingTr = (tradeRes.transactions || []).filter((t: any) => t.status === 'AWAITING_AUTHORISATION').length;
      setPendingAuthCount(pendingPay);
      setPendingTradeCount(pendingTr);
      setUnreadAlertsCount(notifRes.unreadCount || 0);
    } catch {
      // Non-blocking
    }
  }, [activeOrg]);

  useEffect(() => {
    loadBadges();
  }, [loadBadges, activeTab, moreSubView]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMegaMenuOpen(false);
        setUserMenuOpen(false);
        setLangMenuOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const navigate = (tab: string, sub?: string) => {
    setActiveTab(tab as PrimaryTab);
    setMoreSubView(sub);
    setMegaMenuOpen(false);
    setUserMenuOpen(false);
    setLangMenuOpen(false);
  };

  const currentBreadcrumb = (() => {
    if (activeTab === 'accounts') return 'Account information';
    if (activeTab === 'auth') return 'Authorisations & Tasks';
    if (activeTab === 'payments') return 'Payments & Transfers';
    if (activeTab === 'track') return 'Track payment status';
    const subNames: Record<string, string> = {
      TRADE_HUB: 'Trade and Supply Chain',
      TRADE_DC: 'Documentary Credits',
      TRADE_GUARANTEES: 'Guarantees & SBLCs',
      TRADE_TRACKER: 'Trade Transaction Tracker',
      TRADE_SCF: 'Supply Chain Finance',
      TRADE: 'Trade Authorisation',
      PAYMENT_TEMPLATES: 'Create payment template',
      FILE_UPLOAD: 'File upload (Batch)',
      VIRTUAL_ACCOUNTS: 'Virtual accounts',
      REPORTS_FILES: 'Reports & files (MT940/BAI2)',
      FX_MARKETS: 'Markets & FX',
      FX_RATES: 'FX exchange rates',
      SECURITIES: 'Securities Services (HSS)',
      LIQUIDITY: 'Liquidity dashboard',
      RECEIVABLES: 'Receivables finance',
      RDC: 'Remote Deposit Capture',
      SELF_SERVICE: 'Self-service documents',
      ALERTS: 'My alerts',
      SETTINGS: 'User settings & PIN',
      BIOMETRICS_MANAGE: 'Passkeys & Devices',
      SUPPORT: 'Help & Support',
    };
    return (moreSubView && subNames[moreSubView]) || 'Services';
  })();

  useEffect(() => {
    document.title = `${currentBreadcrumb} | HSBCnet — Coralgenz Global`;
  }, [currentBreadcrumb]);

  const totalTasks = pendingAuthCount + pendingTradeCount;

  const mobileNav: {
    id: PrimaryTab;
    sub?: string;
    label: string;
    icon: React.ComponentType<{ className?: string; strokeWidth?: string | number }>;
    badge?: number;
  }[] = [
    { id: 'accounts', label: 'Accounts', icon: WalletCards },
    { id: 'auth', label: 'Tasks', icon: ShieldCheck, badge: totalTasks },
    { id: 'payments', label: 'Payments', icon: ArrowLeftRight },
    { id: 'more', sub: 'TRADE_HUB', label: 'Trade', icon: Ship, badge: pendingTradeCount },
    { id: 'more', label: 'Menu', icon: Menu, badge: unreadAlertsCount },
  ];

  return (
    <div className="min-h-dvh bg-[#F4F5F6] flex flex-col" ref={menuContainerRef}>
      <a href="#main-content" className="visually-hidden">
        Skip to main content
      </a>

      {/* =====================================================================
       * ROW 1: HSBCnet TOP PORTAL BAR (#1F2429 — Exact uploaded screenshots)
       * =================================================================== */}
      <header className="sticky top-0 z-40 shadow-sm">
        <div className="bg-[#1F2429] text-white border-b border-black/40">
          <div className="max-w-[1440px] mx-auto px-3 sm:px-6 h-12 flex items-center justify-between gap-3">
            {/* Left: HSBC Hexagon Logo + HSBC Wordmark + Coralgenz Global */}
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => navigate('accounts')}
                className="flex items-center gap-2 shrink-0 text-left focus-visible:outline-white"
              >
                <BrandMark size={38} />
                <span className="text-[16px] font-semibold tracking-tight text-white">HSBC</span>
              </button>
              <span className="hidden lg:inline-flex items-center gap-1.5 pl-3 border-l border-white/15 text-xs text-white/75 truncate">
                <Building2 className="w-3.5 h-3.5 text-[#DB001B] shrink-0" aria-hidden="true" />
                <span className="font-medium text-white">{activeOrg?.name || 'Coralgenz Global UK Ltd'}</span>
              </span>
            </div>

            {/* Right: Alerts Bell, Help ?, Language, Profile/Last Logon, Log off */}
            <div className="flex items-center h-full text-xs">
              <button
                type="button"
                onClick={() => navigate('more', 'ALERTS')}
                aria-label="Open alerts"
                className="relative h-full px-3 border-l border-white/10 flex items-center justify-center text-white/85 hover:bg-white/10"
              >
                <Bell className="w-4 h-4" />
                {unreadAlertsCount > 0 && (
                  <span className="absolute top-2.5 right-2 w-2 h-2 rounded-full bg-[#DB001B]" />
                )}
              </button>

              <button
                type="button"
                onClick={() => navigate('more', 'SUPPORT')}
                aria-label="Help and support"
                className="hidden sm:flex h-full px-3 border-l border-white/10 items-center justify-center text-white/85 hover:bg-white/10"
              >
                <HelpCircle className="w-4 h-4" />
              </button>

              {/* Language selector */}
              <div className="relative hidden md:block h-full">
                <button
                  type="button"
                  onClick={() => { setLangMenuOpen((v) => !v); setUserMenuOpen(false); setMegaMenuOpen(false); }}
                  className="h-full px-3 border-l border-white/10 flex items-center gap-1.5 text-white/90 hover:bg-white/10"
                >
                  <Globe className="w-3.5 h-3.5 text-white/70" aria-hidden="true" />
                  <span>{language}</span>
                  <ChevronDown className="w-3 h-3 text-white/70" />
                </button>
                {langMenuOpen && (
                  <div className="absolute right-0 mt-0 w-36 bg-[#262D33] border border-[#454E56] shadow-xl py-1 z-50 text-xs">
                    {['English', 'English (UK)', 'Français', 'Deutsch', 'हिन्दी'].map((l) => (
                      <button
                        key={l}
                        type="button"
                        onClick={() => { setLanguage(l); setLangMenuOpen(false); }}
                        className="w-full px-3 py-2 text-left text-white hover:bg-white/10"
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Karthick Krishna M S + Last logon dropdown */}
              <div className="relative h-full">
                <button
                  type="button"
                  onClick={() => { setUserMenuOpen((v) => !v); setLangMenuOpen(false); setMegaMenuOpen(false); }}
                  className="h-full px-3 border-l border-white/10 flex items-center gap-2 text-left hover:bg-white/10"
                >
                  <div className="leading-tight">
                    <div className="font-medium text-white truncate max-w-[130px] sm:max-w-none">{user?.full_name || 'Karthick Krishna M S'}</div>
                    <div className="hidden sm:block text-[10px] text-white/65 tabular-nums">
                      Last logon: {user?.lastLoginAt ? formatDateTime(user.lastLoginAt) : '27 Nov 26 19:15 IST'}
                    </div>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-white/70 shrink-0" />
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 mt-0 w-72 bg-white text-[#252B30] border border-[#B4BCC2] shadow-xl z-50 text-xs">
                    <div className="p-3 bg-[#F4F5F6] border-b border-[#D9DEE1]">
                      <div className="font-semibold text-[#252B30]">{user?.full_name}</div>
                      <div className="text-[#68727A] mt-0.5">{user?.email} • {activeOrg?.role?.replace(/_/g, ' ')}</div>
                    </div>
                    {organisations.length > 1 && (
                      <div className="p-3 border-b border-[#D9DEE1] space-y-1.5">
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-[#68727A]">Switch Coralgenz Entity</div>
                        {organisations.map((o) => (
                          <button
                            key={o.id}
                            type="button"
                            onClick={() => { switchOrganisation(o.id); setUserMenuOpen(false); }}
                            className={`w-full px-2.5 py-1.5 text-left rounded-[2px] flex justify-between ${
                              activeOrg?.id === o.id ? 'bg-[#2D373E] text-white font-medium' : 'hover:bg-[#F4F5F6]'
                            }`}
                          >
                            <span className="truncate">{o.name}</span>
                            <span className="opacity-75">{o.baseCurrency}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="py-1">
                      <button type="button" onClick={() => navigate('more', 'SETTINGS')} className="w-full px-3 py-2 text-left hover:bg-[#F4F5F6]">
                        Security Settings &amp; PIN
                      </button>
                      <button type="button" onClick={() => navigate('more', 'BIOMETRICS_MANAGE')} className="w-full px-3 py-2 text-left hover:bg-[#F4F5F6]">
                        Registered Passkeys &amp; Devices
                      </button>
                      <button
                        type="button"
                        onClick={() => { setUserMenuOpen(false); lockSession(); }}
                        className="w-full px-3 py-2 text-left hover:bg-[#F4F5F6] flex items-center gap-2"
                      >
                        <Lock className="w-3.5 h-3.5" /> Lock Screen
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Log off button matching Image 1 & 2 */}
              <div className="h-full pl-2.5 border-l border-white/10 flex items-center">
                <button
                  type="button"
                  onClick={logout}
                  className="px-3 py-1.5 border border-[#4E575E] bg-[#262C31] hover:bg-[#343C42] text-xs font-medium text-white rounded-[2px] inline-flex items-center gap-1.5"
                >
                  <span className="hidden sm:inline">Log off</span>
                  <LogOut className="w-3.5 h-3.5 sm:hidden" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ===================================================================
         * ROW 2: HSBCnet SUB-NAVIGATION BAR (#2D343A: ≡ Menu | Active + Pin | Tasks)
         * ================================================================= */}
        <div className="bg-[#2D343A] text-white border-b border-black/40 relative">
          <div className="max-w-[1440px] mx-auto px-3 sm:px-6 h-10 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-4 min-w-0">
              <button
                type="button"
                aria-expanded={megaMenuOpen}
                onClick={() => { setMegaMenuOpen((v) => !v); setUserMenuOpen(false); setLangMenuOpen(false); }}
                className={`h-10 px-2 -ml-2 inline-flex items-center gap-2 font-semibold transition-colors ${
                  megaMenuOpen ? 'bg-[#1F2429] text-white' : 'text-white/95 hover:bg-white/10'
                }`}
              >
                {megaMenuOpen ? <X className="w-4 h-4" aria-hidden="true" /> : <Menu className="w-4 h-4" aria-hidden="true" />}
                <span>Menu</span>
              </button>

              <div className="flex items-center gap-3 overflow-x-auto no-scrollbar">
                <button
                  type="button"
                  onClick={() => navigate('accounts')}
                  className={`inline-flex items-center gap-1.5 py-2 border-b-2 whitespace-nowrap ${
                    activeTab === 'accounts' ? 'border-[#DB001B] text-white font-medium' : 'border-transparent text-white/75 hover:text-white'
                  }`}
                >
                  <span>Account information</span>
                </button>

                <button
                  type="button"
                  onClick={() => navigate('more', 'PAYMENT_TEMPLATES')}
                  className={`hidden md:inline-flex items-center gap-1.5 py-2 border-b-2 whitespace-nowrap ${
                    moreSubView === 'PAYMENT_TEMPLATES' ? 'border-[#DB001B] text-white font-medium' : 'border-transparent text-white/75 hover:text-white'
                  }`}
                >
                  <span>Create payment template</span>
                </button>

                <button
                  type="button"
                  onClick={() => navigate('more', 'TRADE_HUB')}
                  className={`hidden sm:inline-flex items-center gap-1.5 py-2 border-b-2 whitespace-nowrap ${
                    moreSubView?.startsWith('TRADE') ? 'border-[#DB001B] text-white font-medium' : 'border-transparent text-white/75 hover:text-white'
                  }`}
                >
                  <span>Trade &amp; Supply Chain</span>
                </button>

                <button
                  type="button"
                  onClick={() => navigate('payments')}
                  className={`hidden md:inline-flex items-center gap-1.5 py-2 border-b-2 whitespace-nowrap ${
                    activeTab === 'payments' ? 'border-[#DB001B] text-white font-medium' : 'border-transparent text-white/75 hover:text-white'
                  }`}
                >
                  <span>Payments</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPinnedLabel(currentBreadcrumb)}
                  title={`Pin "${currentBreadcrumb}"`}
                  aria-label={`Pinned view ${pinnedLabel}`}
                  className="hidden lg:inline-flex items-center gap-1 text-white/60 hover:text-white"
                >
                  <Pin className="w-3.5 h-3.5 rotate-45" aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* Right: Tasks checklist button matching Image 1 & 2 */}
            <button
              type="button"
              onClick={() => navigate('auth')}
              className={`h-10 px-2.5 inline-flex items-center gap-2 font-medium transition-colors shrink-0 ${
                activeTab === 'auth' ? 'bg-[#1F2429] text-white' : 'text-white/90 hover:bg-white/10'
              }`}
            >
              <span>Tasks</span>
              <span className="relative inline-flex items-center">
                <CheckSquare className="w-4 h-4" aria-hidden="true" />
                {totalTasks > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 text-[10px] font-semibold bg-[#DB001B] text-white rounded-full tabular-nums">
                    {totalTasks}
                  </span>
                )}
              </span>
            </button>
          </div>

          {/* =================================================================
           * HSBCnet FULL MEGA MENU OVERLAY (Triggered by ≡ Menu)
           * =============================================================== */}
          {megaMenuOpen && (
            <div className="absolute left-0 right-0 top-10 bg-[#262D33] text-white border-t border-white/10 border-b-2 border-b-[#DB001B] shadow-2xl z-50">
              <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 text-xs">
                {MEGA_MENU_PILLARS.map((pillar) => (
                  <div key={pillar.title} className="space-y-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-white/60 pb-1.5 border-b border-white/10">
                      {pillar.title}
                    </div>
                    <ul className="space-y-1">
                      {pillar.items.map((item) => (
                        <li key={item.label}>
                          <button
                            type="button"
                            onClick={() => navigate(item.tab, item.sub)}
                            className="w-full py-1.5 px-2 -mx-2 text-left text-white/90 hover:bg-white/10 hover:text-white rounded-[2px] transition-colors flex items-center justify-between"
                          >
                            <span>{item.label}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main Content Container */}
      <main id="main-content" tabIndex={-1} className="flex-1 w-full bg-white pb-20 md:pb-8">
        <div className={activeTab === 'accounts' ? 'w-full' : 'max-w-[1440px] mx-auto md:p-6'}>
          <AppErrorBoundary>
            {activeTab === 'accounts' && <AccountsPage onNavigate={navigate} />}
            {activeTab === 'auth' && <AuthPage />}
            {activeTab === 'payments' && <PaymentsPage onNavigate={navigate} />}
            {activeTab === 'track' && <TrackPage />}
            {activeTab === 'more' && <MorePage initialSubView={moreSubView} onResetSubView={() => setMoreSubView(undefined)} />}
          </AppErrorBoundary>
        </div>
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav aria-label="Mobile Primary" className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-[#D9DEE1] pb-safe">
        <div className="grid grid-cols-5 h-16">
          {mobileNav.map((item) => {
            const Icon = item.icon;
            const active =
              item.sub
                ? activeTab === item.id && moreSubView?.startsWith('TRADE')
                : activeTab === item.id && !(activeTab === 'more' && moreSubView?.startsWith('TRADE'));
            return (
              <button
                key={item.label}
                type="button"
                aria-current={active ? 'page' : undefined}
                onClick={() => navigate(item.id, item.sub)}
                className={`relative flex flex-col items-center justify-center gap-1 text-[11px] font-medium border-t-[3px] transition-colors ${
                  active ? 'border-[#DB001B] text-[#DB001B]' : 'border-transparent text-[#68727A]'
                }`}
              >
                <div className="relative">
                  <Icon className="w-5 h-5" strokeWidth={1.75} aria-hidden="true" />
                  {!!item.badge && item.badge > 0 && (
                    <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-[#DB001B] text-white text-[10px] font-semibold flex items-center justify-center tabular-nums">
                      {item.badge}
                    </span>
                  )}
                </div>
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

const RootRouter: React.FC = () => {
  const { phase } = useAuth();
  if (phase === 'AUTHENTICATED') {
    return <AuthenticatedShell />;
  }
  return <EntryExperience />;
};

export function App() {
  return (
    <AuthProvider>
      <RootRouter />
    </AuthProvider>
  );
}

export default App;
