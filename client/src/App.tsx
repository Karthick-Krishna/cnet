import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  ArrowLeftRight,
  Bell,
  Building2,
  Landmark,
  Lock,
  LogOut,
  Menu,
  ShieldCheck,
  Ship,
  TrendingUp,
  WalletCards,
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

const AuthenticatedShell: React.FC = () => {
  const { user, activeOrg, organisations, switchOrganisation, lockSession, logout, hasPermission, hasModule } = useAuth();
  const [activeTab, setActiveTab] = useState<PrimaryTab>('accounts');
  const [moreSubView, setMoreSubView] = useState<string | undefined>(undefined);
  const [pendingAuthCount, setPendingAuthCount] = useState(0);
  const [unreadAlertsCount, setUnreadAlertsCount] = useState(0);

  const loadBadges = useCallback(async () => {
    if (!activeOrg) return;
    try {
      const [authRes, notifRes] = await Promise.all([
        apiRequest<any>(`/api/corporate/authorisations?orgId=${encodeURIComponent(activeOrg.id)}`),
        apiRequest<any>('/api/notifications').catch(() => ({ unreadCount: 0 })),
      ]);
      const pending = (authRes.instructions || []).filter((i: any) =>
        ['AWAITING_AUTHORISATION', 'PARTIALLY_AUTHORISED'].includes(i.status)
      ).length;
      setPendingAuthCount(pending);
      setUnreadAlertsCount(notifRes.unreadCount || 0);
    } catch {
      // Non-blocking badge refresh
    }
  }, [activeOrg]);

  useEffect(() => {
    loadBadges();
  }, [loadBadges, activeTab]);

  useEffect(() => {
    const titles: Record<PrimaryTab, string> = {
      accounts: 'Accounts',
      auth: 'Authorisations',
      payments: 'Payments',
      track: 'Track',
      more: 'More',
    };
    document.title = `${titles[activeTab]} | HSBC Cnet`;
  }, [activeTab]);

  const navigate = (tab: string, sub?: string) => {
    setActiveTab(tab as PrimaryTab);
    setMoreSubView(sub);
  };

  // Documented 5-section HSBCnet Mobile primary navigation in exact order
  const navItems: {
    id: PrimaryTab;
    label: string;
    icon: React.ComponentType<{ className?: string; strokeWidth?: string | number }>;
    badge?: number;
  }[] = [
    { id: 'accounts', label: 'Accounts', icon: WalletCards },
    { id: 'auth', label: 'Auth', icon: ShieldCheck, badge: pendingAuthCount },
    { id: 'payments', label: 'Payments', icon: ArrowLeftRight },
    { id: 'track', label: 'Track', icon: Activity },
    { id: 'more', label: 'More', icon: Menu, badge: unreadAlertsCount },
  ];

  return (
    <div className="min-h-dvh bg-[#F4F5F6] flex flex-col">
      <a href="#main-content" className="visually-hidden">
        Skip to main content
      </a>

      {/* Desktop Enterprise Top Utility Bar (#202A30 Deep Charcoal) */}
      <div className="hidden md:block bg-[#202A30] text-white text-xs border-b border-[#344651]">
        <div className="max-w-[1400px] mx-auto px-5 h-11 flex items-center justify-between gap-4">
          <div className="flex items-center gap-5 min-w-0">
            <div className="flex items-center gap-2.5 shrink-0">
              <BrandMark size={28} />
              <span className="text-sm font-semibold tracking-tight text-white">HSBC Cnet</span>
              <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 bg-[#344651] text-white/80 rounded-[2px]">
                Sandbox
              </span>
            </div>

            <div className="h-4 w-px bg-white/15" aria-hidden="true" />

            <div className="flex items-center gap-2 min-w-0">
              <Building2 className="w-3.5 h-3.5 text-[#DB001B] shrink-0" aria-hidden="true" />
              {organisations.length > 1 ? (
                <select
                  aria-label="Select corporate entity"
                  value={activeOrg?.id || ''}
                  onChange={(e) => switchOrganisation(e.target.value)}
                  className="bg-[#263640] border border-[#344651] rounded-[2px] px-2.5 py-1 text-xs text-white max-w-[290px]"
                >
                  {organisations.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name} ({o.country})
                    </option>
                  ))}
                </select>
              ) : (
                <span className="font-medium truncate">
                  {activeOrg?.name} ({activeOrg?.country})
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <span className="text-white/80">{user?.full_name}</span>
            <button
              type="button"
              onClick={() => navigate('more', 'ALERTS')}
              aria-label="Open alerts"
              className="relative p-1.5 text-white/80 hover:text-white"
            >
              <Bell className="w-4 h-4" />
              {unreadAlertsCount > 0 && (
                <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-[#DB001B]" />
              )}
            </button>
            <button
              type="button"
              onClick={lockSession}
              className="inline-flex items-center gap-1.5 text-white/85 hover:text-white font-medium"
            >
              <Lock className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Lock</span>
            </button>
            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center gap-1.5 text-white/85 hover:text-white font-medium"
            >
              <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Log off</span>
            </button>
          </div>
        </div>
      </div>

      {/* Responsive Frame: Desktop Sidebar + Fluid Content Area / Mobile Full-Width */}
      <div className="flex-1 flex max-w-[1400px] w-full mx-auto">
        {/* Desktop Enterprise Left Rail (Replaces stretched mobile tab bar on md+) */}
        <aside className="hidden md:flex md:flex-col w-60 shrink-0 bg-[#263640] text-white border-r border-[#344651]">
          <nav aria-label="Primary" className="py-3 flex-1">
            <div className="px-4 pb-2 text-[10px] font-semibold uppercase tracking-wider text-white/50">
              Core Banking
            </div>
            <ul className="space-y-0.5">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id && !moreSubView;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      aria-current={active ? 'page' : undefined}
                      onClick={() => {
                        setActiveTab(item.id);
                        if (item.id !== 'more') setMoreSubView(undefined);
                      }}
                      className={`w-full px-4 py-3 flex items-center justify-between text-sm transition-colors border-l-[3px] ${
                        active
                          ? 'border-[#DB001B] bg-[#344651] text-white font-medium'
                          : 'border-transparent text-white/80 hover:bg-[#344651]/50 hover:text-white'
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        <Icon className="w-4 h-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                        <span>{item.label}</span>
                      </span>
                      {!!item.badge && item.badge > 0 && (
                        <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-[#DB001B] text-white tabular-nums">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="mt-6 px-4 pb-2 text-[10px] font-semibold uppercase tracking-wider text-white/50 border-t border-white/10 pt-4">
              Enterprise Services
            </div>
            <ul className="space-y-0.5">
              {hasPermission('VIEW_LIQUIDITY') && hasModule('liquidity') && (
                <li>
                  <button
                    type="button"
                    onClick={() => navigate('more', 'LIQUIDITY')}
                    className={`w-full px-4 py-2.5 flex items-center gap-3 text-xs transition-colors border-l-[3px] ${
                      activeTab === 'more' && moreSubView === 'LIQUIDITY'
                        ? 'border-[#DB001B] bg-[#344651] text-white font-medium'
                        : 'border-transparent text-white/75 hover:bg-[#344651]/50 hover:text-white'
                    }`}
                  >
                    <TrendingUp className="w-4 h-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                    <span>Liquidity Dashboard</span>
                  </button>
                </li>
              )}
              {hasPermission('ACCESS_RECEIVABLES_FINANCE') && hasModule('receivablesFinance') && (
                <li>
                  <button
                    type="button"
                    onClick={() => navigate('more', 'RECEIVABLES')}
                    className={`w-full px-4 py-2.5 flex items-center gap-3 text-xs transition-colors border-l-[3px] ${
                      activeTab === 'more' && moreSubView === 'RECEIVABLES'
                        ? 'border-[#DB001B] bg-[#344651] text-white font-medium'
                        : 'border-transparent text-white/75 hover:bg-[#344651]/50 hover:text-white'
                    }`}
                  >
                    <Landmark className="w-4 h-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                    <span>Receivables Finance</span>
                  </button>
                </li>
              )}
              {hasPermission('ACCESS_TRADE_FINANCE') && hasModule('tradeFinance') && (
                <li>
                  <button
                    type="button"
                    onClick={() => navigate('more', 'TRADE')}
                    className={`w-full px-4 py-2.5 flex items-center gap-3 text-xs transition-colors border-l-[3px] ${
                      activeTab === 'more' && moreSubView === 'TRADE'
                        ? 'border-[#DB001B] bg-[#344651] text-white font-medium'
                        : 'border-transparent text-white/75 hover:bg-[#344651]/50 hover:text-white'
                    }`}
                  >
                    <Ship className="w-4 h-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                    <span>Trade Authorisation</span>
                  </button>
                </li>
              )}
            </ul>
          </nav>

          <div className="p-4 border-t border-white/10 text-[11px] text-white/60">
            <div>{activeOrg?.baseCurrency} Treasury Entity</div>
            <div className="truncate text-white/80 mt-0.5">{activeOrg?.role?.replace(/_/g, ' ')}</div>
          </div>
        </aside>

        {/* Main View Canvas */}
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 min-w-0 bg-white md:bg-[#F4F5F6] md:p-6 pb-20 md:pb-8"
        >
          <div className="md:max-w-5xl md:mx-auto">
            <AppErrorBoundary>
              {activeTab === 'accounts' && <AccountsPage onNavigate={navigate} />}
              {activeTab === 'auth' && <AuthPage />}
              {activeTab === 'payments' && <PaymentsPage onNavigate={navigate} />}
              {activeTab === 'track' && <TrackPage />}
              {activeTab === 'more' && <MorePage initialSubView={moreSubView} onResetSubView={() => setMoreSubView(undefined)} />}
            </AppErrorBoundary>
          </div>
        </main>
      </div>

      {/* Documented 5-Tab Fixed Mobile Bottom Navigation Bar */}
      <nav
        aria-label="Mobile Primary"
        className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-[#D9DEE1] pb-safe"
      >
        <div className="grid grid-cols-5 h-16">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-current={active ? 'page' : undefined}
                onClick={() => {
                  setActiveTab(item.id);
                  if (item.id !== 'more') setMoreSubView(undefined);
                }}
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
