import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { apiRequest, getAccessToken, onSessionExpired, setAccessToken } from '../lib/api';
import type { CountryCapability } from '@shared/constants';
import { COUNTRY_CAPABILITIES } from '@shared/constants';

export type AuthPhase = 'LAUNCHING' | 'INIT_ERROR' | 'UNAUTHENTICATED' | 'AUTHENTICATED' | 'LOCKED' | 'SESSION_EXPIRED';

export interface ActiveOrgContext {
  id: string;
  name: string;
  registrationNumber: string;
  country: string;
  baseCurrency: string;
  status: string;
  isSandbox: boolean;
  modules: {
    accounts: boolean;
    authorisations: boolean;
    payments: boolean;
    track: boolean;
    liquidity: boolean;
    tradeFinance: boolean;
    receivablesFinance: boolean;
    remoteDepositCapture: boolean;
    billPayments: boolean;
    selfService: boolean;
  };
  role: string;
  permissions: string[];
}

export interface AuthUser {
  id: string;
  username: string;
  customer_id?: string;
  full_name: string;
  email: string;
  phone: string;
  role: string;
  organisationId: string;
  organisationName: string;
  country: string;
  baseCurrency: string;
  permissions: string[];
  biometric_enabled: boolean;
  hasPinConfigured: boolean;
  mobileAuthActive: boolean;
  preferredCurrency: string;
  lastLoginAt?: string;
}

interface AuthContextValue {
  phase: AuthPhase;
  initError: string | null;
  user: AuthUser | null;
  organisations: ActiveOrgContext[];
  activeOrg: ActiveOrgContext | null;
  countryCapability: CountryCapability;
  hideBalances: boolean;
  setHideBalances: (hide: boolean) => void;
  inactivityMinutes: number;
  setInactivityMinutes: (mins: number) => void;
  retryInit: () => void;
  completeLogin: (accessToken: string, user: AuthUser) => Promise<void>;
  switchOrganisation: (orgId: string) => Promise<void>;
  refreshContext: () => Promise<void>;
  lockSession: () => void;
  unlockSession: () => void;
  logout: () => Promise<void>;
  hasPermission: (perm: string) => boolean;
  hasModule: (mod: keyof ActiveOrgContext['modules']) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [phase, setPhase] = useState<AuthPhase>('LAUNCHING');
  const [initError, setInitError] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [organisations, setOrganisations] = useState<ActiveOrgContext[]>([]);
  const [activeOrg, setActiveOrg] = useState<ActiveOrgContext | null>(null);
  const [hideBalances, setHideBalances] = useState(false);
  const [inactivityMinutes, setInactivityMinutes] = useState<number>(() => {
    const saved = localStorage.getItem('meridian_lock_timeout_mins');
    return saved ? Number(saved) : 5;
  });

  const inactivityTimerRef = useRef<number | null>(null);

  const loadCorporateContext = useCallback(async (orgId?: string) => {
    const qs = orgId ? `?orgId=${encodeURIComponent(orgId)}` : '';
    const ctx = await apiRequest<{
      success: boolean;
      organisations: ActiveOrgContext[];
      activeOrganisation: ActiveOrgContext;
    }>(`/api/corporate/context${qs}`);
    setOrganisations(ctx.organisations || []);
    setActiveOrg(ctx.activeOrganisation || null);
  }, []);

  const initializeApp = useCallback(async () => {
    setPhase('LAUNCHING');
    setInitError(null);
    try {
      // Verify backend health and configuration
      await apiRequest('/api/health', { skipAuthHandling: true });
      const token = getAccessToken();
      if (token) {
        try {
          const sess = await apiRequest<{ success: boolean; user: AuthUser }>('/api/auth/corporate-session', {
            skipAuthHandling: true,
          });
          setUser(sess.user);
          await loadCorporateContext();
          setPhase('AUTHENTICATED');
          return;
        } catch {
          setAccessToken(null);
        }
      }
      // Display HSBCnet photographic launch splash cleanly before entering Welcome username flow
      setTimeout(() => setPhase('UNAUTHENTICATED'), 1600);
    } catch (err: any) {
      setInitError(err?.message || 'Unable to reach HSBC Cnet gateway. Check that the API service is running.');
      setPhase('INIT_ERROR');
    }
  }, [loadCorporateContext]);

  useEffect(() => {
    initializeApp();
    onSessionExpired(() => {
      setAccessToken(null);
      setPhase('SESSION_EXPIRED');
    });
  }, [initializeApp]);

  const lockSession = useCallback(() => {
    if (phase === 'AUTHENTICATED') {
      setPhase('LOCKED');
    }
  }, [phase]);

  const unlockSession = useCallback(() => {
    if (user) {
      setPhase('AUTHENTICATED');
    }
  }, [user]);

  // Inactivity & background lock listener
  useEffect(() => {
    localStorage.setItem('meridian_lock_timeout_mins', String(inactivityMinutes));
    if (phase !== 'AUTHENTICATED' || inactivityMinutes <= 0) return;

    const resetTimer = () => {
      if (inactivityTimerRef.current) window.clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = window.setTimeout(() => {
        lockSession();
      }, inactivityMinutes * 60 * 1000);
    };

    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach((ev) => window.addEventListener(ev, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      if (inactivityTimerRef.current) window.clearTimeout(inactivityTimerRef.current);
      events.forEach((ev) => window.removeEventListener(ev, resetTimer));
    };
  }, [phase, inactivityMinutes, lockSession]);

  const completeLogin = useCallback(
    async (accessToken: string, loggedUser: AuthUser) => {
      setAccessToken(accessToken);
      setUser(loggedUser);
      await loadCorporateContext(loggedUser.organisationId);
      setPhase('AUTHENTICATED');
    },
    [loadCorporateContext]
  );

  const switchOrganisation = useCallback(
    async (orgId: string) => {
      await loadCorporateContext(orgId);
    },
    [loadCorporateContext]
  );

  const refreshContext = useCallback(async () => {
    await loadCorporateContext(activeOrg?.id);
  }, [loadCorporateContext, activeOrg?.id]);

  const logout = useCallback(async () => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST', skipAuthHandling: true });
    } catch {
      // Ignore network errors during logout
    }
    setAccessToken(null);
    setUser(null);
    setActiveOrg(null);
    setOrganisations([]);
    setPhase('UNAUTHENTICATED');
  }, []);

  const hasPermission = useCallback(
    (perm: string) => {
      const perms = activeOrg?.permissions || user?.permissions || [];
      return perms.includes(perm);
    },
    [activeOrg, user]
  );

  const hasModule = useCallback(
    (mod: keyof ActiveOrgContext['modules']) => {
      if (!activeOrg?.modules) return true;
      return !!activeOrg.modules[mod];
    },
    [activeOrg]
  );

  const countryCapability = COUNTRY_CAPABILITIES[activeOrg?.country || 'GB'] || COUNTRY_CAPABILITIES.GB;

  return (
    <AuthContext.Provider
      value={{
        phase,
        initError,
        user,
        organisations,
        activeOrg,
        countryCapability,
        hideBalances,
        setHideBalances,
        inactivityMinutes,
        setInactivityMinutes,
        retryInit: initializeApp,
        completeLogin,
        switchOrganisation,
        refreshContext,
        lockSession,
        unlockSession,
        logout,
        hasPermission,
        hasModule,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
