import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  Bell,
  Building2,
  CheckSquare,
  Landmark,
  Lock,
  Menu,
  Send,
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
        <div className="p-6 max-w-md mx-auto mt-12 bg-white border border-[#D7D8D6] rounded-[2px] text-center">
          <h1 className="text-base font-semibold text-[#252525]">View Rendering Error</h1>
          <p className="text-xs text-[#767676] mt-2">{this.state.message}</p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, message: '' })}
            className="mt-4 px-4 py-2 text-xs font-semibold bg-[#DB0011] text-white rounded-[2px]"
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
  const { user, activeOrg, organisations, switchOrganisation, lockSession } = useAuth();
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
      // Ignore badge refresh errors
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

  const navItems: { id: PrimaryTab; label: string; icon: React.ComponentType<{ className?: string }>; badge?: number }[] = [
    { id: 'accounts', label: 'Accounts', icon: Landmark },
    { id: 'auth', label: 'Auth', icon: CheckSquare, badge: pendingAuthCount },
    { id: 'payments', label: 'Payments', icon: Send },
    { id: 'track', label: 'Track', icon: Activity },
    { id: 'more', label: 'More', icon: Menu, badge: unreadAlertsCount },
  ];

  return (
    <div className="min-h-dvh bg-[#F4F4F4] flex flex-col">
      <a href="#main-content" className="visually-hidden">
        Skip to main content
      </a>

      {/* Desktop Top Charcoal Utility Bar */}
      <div className="hidden md:block bg-[#252525] text-white text-xs border-b border-[#383838]">
        <div className="max-w-[1320px] mx-auto px-6 h-10 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="inline-flex items-center gap-1.5 text-white/80 shrink-0">
              <Building2 className="w-3.5 h-3.5 text-[#DB0011]" aria-hidden="true" />
              <span>Entity:</span>
            </span>
            {organisations.length > 1 ? (
              <select
                aria-label="Select corporate entity"
                value={activeOrg?.id || ''}
                onChange={(e) => switchOrganisation(e.target.value)}
                className="bg-[#333333] border border-[#4A4A4A] rounded-[2px] px-2 py-1 text-xs font-medium text-white max-w-[280px]"
              >
                {organisations.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name} ({o.country})
                  </option>
                ))}
              </select>
            ) : (
              <span className="font-medium truncate">{activeOrg?.name} ({activeOrg?.country})</span>
            )}
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <span className="text-white/80">{user?.full_name}</span>
            <button
              type="button"
              onClick={lockSession}
              className="inline-flex items-center gap-1.5 text-white/90 hover:text-white font-medium"
            >
              <Lock className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Lock</span>
            </button>
          </div>
        </div>
      </div>

      {/* Primary Navigation Header (Desktop Tab Bar / Mobile Compact Header) */}
      <header className="sticky top-0 z-20 bg-white border-b border-[#D7D8D6]">
        <div className="max-w-[1320px] mx-auto px-4 sm:px-6 h-14 md:h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2.5">
              <BrandMark size={24} />
              <span className="text-base font-bold text-[#252525] tracking-tight">HSBC Cnet</span>
            </div>

            <nav aria-label="Primary" className="hidden md:flex items-center h-16">
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
                    className={`relative h-full px-4 inline-flex items-center gap-2 text-sm font-semibold border-b-[3px] transition-colors ${
                      active
                        ? 'border-[#DB0011] text-[#252525]'
                        : 'border-transparent text-[#555555] hover:text-[#252525] hover:bg-[#F4F4F4]/60'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${active ? 'text-[#DB0011]' : 'text-[#555555]'}`} aria-hidden="true" />
                    <span>{item.label}</span>
                    {!!item.badge && item.badge > 0 && (
                      <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-[#DB0011] text-white tabular-nums">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('more', 'LIQUIDITY')}
              className="hidden lg:inline-flex items-center px-3 py-1.5 text-xs font-semibold text-[#252525] border border-[#D7D8D6] rounded-[2px] hover:bg-[#F4F4F4]"
            >
              Liquidity
            </button>
            <button
              type="button"
              onClick={() => navigate('more', 'TRADE')}
              className="hidden lg:inline-flex items-center px-3 py-1.5 text-xs font-semibold text-[#252525] border border-[#D7D8D6] rounded-[2px] hover:bg-[#F4F4F4]"
            >
              Trade Finance
            </button>
            <button
              type="button"
              aria-label="Open alerts"
              onClick={() => navigate('more', 'ALERTS')}
              className="relative p-2 rounded-[2px] hover:bg-[#F4F4F4] text-[#252525]"
            >
              <Bell className="w-4 h-4" />
              {unreadAlertsCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#DB0011]" />
              )}
            </button>
            <button
              type="button"
              onClick={lockSession}
              aria-label="Lock session"
              className="md:hidden p-2 rounded-[2px] hover:bg-[#F4F4F4] text-[#252525]"
            >
              <Lock className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main id="main-content" tabIndex={-1} className="flex-1 p-3 sm:p-6 pb-24 md:pb-8 max-w-[1320px] w-full mx-auto">
        <AppErrorBoundary>
          {activeTab === 'accounts' && <AccountsPage onNavigate={navigate} />}
          {activeTab === 'auth' && <AuthPage />}
          {activeTab === 'payments' && <PaymentsPage />}
          {activeTab === 'track' && <TrackPage />}
          {activeTab === 'more' && <MorePage initialSubView={moreSubView} />}
        </AppErrorBoundary>
      </main>

      {/* Mobile Fixed Compact Bottom Navigation (5 tabs) */}
      <nav
        aria-label="Mobile Primary"
        className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-[#D7D8D6] pb-safe"
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
                className={`relative flex flex-col items-center justify-center gap-1 text-[11px] font-semibold border-t-[3px] ${
                  active ? 'border-[#DB0011] text-[#DB0011]' : 'border-transparent text-[#555555]'
                }`}
              >
                <div className="relative">
                  <Icon className="w-5 h-5" aria-hidden="true" />
                  {!!item.badge && item.badge > 0 && (
                    <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-[#DB0011] text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
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
