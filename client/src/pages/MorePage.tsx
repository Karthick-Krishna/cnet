import React, { useCallback, useEffect, useState } from 'react';
import {
  Bell,
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  FileCheck,
  FileText,
  Fingerprint,
  HelpCircle,
  Info,
  KeyRound,
  Landmark,
  LogOut,
  MessageCircle,
  Phone,
  RefreshCw,
  Settings,
  ShieldCheck,
  Smartphone,
  TrendingUp,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';
import { formatDateTime } from '@shared/utils/formatters';
import { BANK_CONFIG } from '@shared/constants';
import { BrandMark } from '../components/ui/BrandMark';
import { BankingHeader } from '../components/ui/BankingHeader';
import {
  Button,
  EmptyState,
  ErrorBanner,
  FormInput,
  FormSelect,
  NativeDialog,
  StatusBadge,
} from '../components/ui/Primitives';
import { LiquidityView, ReceivablesView, TradeFinanceView, RdcView, SelfServiceView } from './EnterpriseServicesPages';
import {
  FileUploadView,
  FxMarketsView,
  PaymentTemplatesView,
  ReportsFilesView,
  SecuritiesServicesView,
  TradeSuiteView,
  VirtualAccountsView,
} from './ExtendedPortalPages';
import { detectPasskeySupport, parseCreationOptions, serializeCredential, signalUnknownCredentialIfSupported } from '../lib/webauthn';

export type MoreSubView =
  | 'MENU'
  | 'SETTINGS'
  | 'BIOMETRICS_MANAGE'
  | 'BIOMETRICS_TERMS'
  | 'PIN_CHANGE'
  | 'PIN_RESET'
  | 'MOBILE_AUTH'
  | 'ALERTS'
  | 'FX_RATES'
  | 'FX_MARKETS'
  | 'SUPPORT'
  | 'SUPPORT_CHAT'
  | 'INFO'
  | 'LIQUIDITY'
  | 'TRADE'
  | 'TRADE_HUB'
  | 'TRADE_DC'
  | 'TRADE_GUARANTEES'
  | 'TRADE_TRACKER'
  | 'TRADE_SCF'
  | 'RECEIVABLES'
  | 'VIRTUAL_ACCOUNTS'
  | 'PAYMENT_TEMPLATES'
  | 'FILE_UPLOAD'
  | 'REPORTS_FILES'
  | 'SECURITIES'
  | 'RDC'
  | 'SELF_SERVICE';

export const MorePage: React.FC<{ initialSubView?: string; onResetSubView?: () => void }> = ({
  initialSubView,
  onResetSubView,
}) => {
  const { user, activeOrg, countryCapability, inactivityMinutes, setInactivityMinutes, logout, hasPermission, hasModule } = useAuth();
  const [subView, setSubView] = useState<MoreSubView>((initialSubView as MoreSubView) || 'MENU');
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

  useEffect(() => {
    if (initialSubView) {
      setSubView(initialSubView.toUpperCase().replace('-', '_') as MoreSubView);
    } else {
      setSubView('MENU');
    }
  }, [initialSubView]);

  const goBackToMenu = () => {
    setSubView('MENU');
    onResetSubView?.();
  };

  // Notifications / Alerts + preferences
  const [alerts, setAlerts] = useState<any[]>([]);
  const [alertPrefs, setAlertPrefs] = useState({
    paymentAuth: true,
    securityAlerts: true,
    paymentStatus: true,
    messages: true,
    accountEvents: true,
  });

  // Devices & Biometrics & Mobile Auth
  const [devices, setDevices] = useState<any[]>([]);
  const [passkeys, setPasskeys] = useState<any[]>([]);
  const [mobileAuthEnabled, setMobileAuthEnabled] = useState(true);
  const [biometricsEnabled, setBiometricsEnabled] = useState(true);
  const [deviceConfirm, setDeviceConfirm] = useState<{ device: any; action: 'DEACTIVATE' | 'REMOVE' } | null>(null);
  const [pendingPushReqs, setPendingPushReqs] = useState<any[]>([]);
  const [softToken, setSoftToken] = useState<{ code: string; expiresAt: string } | null>(null);
  const [newDeviceName, setNewDeviceName] = useState('');
  const [passkeySupport, setPasskeySupport] = useState({ webauthnSupported: false, platformAuthenticatorAvailable: false });

  // PIN management (Change & Reset)
  const [curPin, setCurPin] = useState('');
  const [nextPin, setNextPin] = useState('');
  const [confirmNextPin, setConfirmNextPin] = useState('');
  const [pinMsg, setPinMsg] = useState<string | null>(null);
  const [resetStep, setResetStep] = useState<'REQ' | 'NEW' | 'DONE'>('REQ');
  const [resetHint, setResetHint] = useState('');
  const [resetCodeInput, setResetCodeInput] = useState('');

  // App Preferences
  const [appPrefs, setAppPrefs] = useState({
    language: 'en-GB',
    dateFormat: 'DD/MM/YYYY',
    numberFormat: '1,234.56',
    currencyDisplay: activeOrg?.baseCurrency || 'GBP',
  });

  // FX Rates board
  const [fxRates, setFxRates] = useState<any[]>([]);
  const [fxLoading, setFxLoading] = useState(false);

  // Support Tickets & FAQ
  const [tickets, setTickets] = useState<any[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [ticketThread, setTicketThread] = useState<any[]>([]);
  const [newTicket, setNewTicket] = useState({ subject: '', category: 'GENERAL', description: '' });
  const [replyBody, setReplyBody] = useState('');
  const [faqQuery, setFaqQuery] = useState('');
  const [callModalOpen, setCallModalOpen] = useState(false);

  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadAuxData = useCallback(async () => {
    try {
      const [notifRes, devRes, pushRes, tickRes] = await Promise.all([
        apiRequest<any>('/api/notifications').catch(() => ({ notifications: [] })),
        apiRequest<any>('/api/auth/devices').catch(() => ({ devices: [], passkeys: [] })),
        apiRequest<any>('/api/auth/login-approval/pending').catch(() => ({ requests: [] })),
        apiRequest<any>('/api/support/tickets').catch(() => ({ tickets: [] })),
      ]);
      setAlerts(notifRes.notifications || []);
      setDevices(devRes.devices || []);
      setPasskeys(devRes.passkeys || []);
      setPendingPushReqs(pushRes.requests || []);
      setTickets(tickRes.tickets || []);
    } catch {
      // Non-blocking
    }
  }, []);

  const loadFxRates = useCallback(async () => {
    setFxLoading(true);
    try {
      const res = await apiRequest<any>('/api/corporate/fx-rates');
      setFxRates(res.rates || []);
    } catch {
      // ignore
    } finally {
      setFxLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAuxData();
    loadFxRates();
    detectPasskeySupport().then(setPasskeySupport);
  }, [loadAuxData, loadFxRates]);

  const handleRegisterPasskey = async () => {
    setError(null);
    setStatusNotice(null);
    try {
      const optionsJson = await apiRequest('/api/auth/webauthn/register/options', {
        method: 'POST',
        body: JSON.stringify({ promotion: false }),
      });
      const publicKey = parseCreationOptions(optionsJson);
      const cred = (await navigator.credentials.create({ publicKey })) as PublicKeyCredential | null;
      if (!cred) return;
      const serialized = serializeCredential(cred);
      try {
        await apiRequest('/api/auth/webauthn/register/verify', {
          method: 'POST',
          body: JSON.stringify({ ...serialized, name: `${navigator.platform || 'Browser'} Passkey` }),
        });
        setBiometricsEnabled(true);
        setStatusNotice('Platform biometric passkey activated for HSBC Cnet.');
        setSubView('BIOMETRICS_MANAGE');
        await loadAuxData();
      } catch (err) {
        await signalUnknownCredentialIfSupported(optionsJson.rp?.id, serialized.id);
        throw err;
      }
    } catch (err: any) {
      setError(err?.message || 'Biometric passkey setup unavailable or cancelled.');
      setSubView('BIOMETRICS_MANAGE');
    }
  };

  const handleChangePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPinMsg(null);
    if (nextPin !== confirmNextPin || !/^\d{6}$/.test(nextPin)) {
      setError('New PIN and confirmation must both match 6 digits.');
      return;
    }
    try {
      const res = await apiRequest<any>('/api/auth/pin/change', {
        method: 'POST',
        body: JSON.stringify({ currentPin: curPin, newPin: nextPin }),
      });
      setPinMsg(res.message);
      setCurPin('');
      setNextPin('');
      setConfirmNextPin('');
    } catch (err: any) {
      setError(err?.message || 'Unable to change Security PIN.');
    }
  };

  const handleStartPinReset = async () => {
    setError(null);
    if (!user) return;
    const res = await apiRequest<any>('/api/auth/pin/reset-request', {
      method: 'POST',
      body: JSON.stringify({ identifier: user.username }),
    });
    setResetHint(res.sandboxResetCode || '');
    setResetStep('NEW');
  };

  const handleConfirmPinReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!user || nextPin !== confirmNextPin || !/^\d{6}$/.test(nextPin)) {
      setError('Confirm your 6-digit new Security PIN.');
      return;
    }
    try {
      await apiRequest('/api/auth/pin/reset-confirm', {
        method: 'POST',
        body: JSON.stringify({ identifier: user.username, resetCode: resetCodeInput, newPin: nextPin }),
      });
      setNextPin('');
      setConfirmNextPin('');
      setResetCodeInput('');
      setResetStep('DONE');
    } catch (err: any) {
      setError(err?.message || 'PIN reset failed.');
    }
  };

  const confirmDeviceAction = async () => {
    if (!deviceConfirm) return;
    if (deviceConfirm.action === 'DEACTIVATE') {
      await apiRequest(`/api/auth/devices/${deviceConfirm.device.id}/deactivate`, { method: 'POST' });
    } else {
      await apiRequest(`/api/auth/devices/${deviceConfirm.device.id}`, { method: 'DELETE' });
    }
    setDeviceConfirm(null);
    await loadAuxData();
  };

  const openTicketThread = async (t: any) => {
    setSelectedTicket(t);
    const res = await apiRequest<any>(`/api/support/tickets/${t.id}`);
    setTicketThread(res.messages || []);
  };

  const unreadAlerts = alerts.filter((a) => !a.is_read).length;

  const FAQS = [
    { q: 'How does Dual Payment Authorisation work?', a: 'Payments above configured thresholds route to independent authorisers. Initiators cannot approve their own payments (maker-checker).' },
    { q: 'Which services are country-specific?', a: 'Remote Deposit Capture is active for GB and US entities and disabled for India entities.' },
    { q: 'Will my biometrics be stored on the server?', a: 'No. Biometric verification stays on your device via WebAuthn platform authenticators.' },
    { q: 'How do I generate a security code?', a: 'Select Mobile Authentication under Settings, or select Generate a security code from the Welcome screen.' },
  ];

  // =========================================================================
  // SUB-VIEWS ROUTING
  // =========================================================================
  if (subView === 'LIQUIDITY') {
    return <LiquidityView onBack={goBackToMenu} />;
  }
  if (subView === 'RECEIVABLES') {
    return <ReceivablesView onBack={goBackToMenu} />;
  }
  if (subView === 'TRADE') {
    return <TradeFinanceView onBack={goBackToMenu} />;
  }
  if (subView === 'RDC') {
    return <RdcView onBack={goBackToMenu} />;
  }
  if (subView === 'SELF_SERVICE') {
    return <SelfServiceView onBack={goBackToMenu} />;
  }

  // =========================================================================
  // SETTINGS SCREEN (manage_pin.pdf & enable_biometrics.pdf structure)
  // =========================================================================
  if (subView === 'SETTINGS') {
    return (
      <div className="bg-white md:border md:border-[#D9DEE1]">
        <BankingHeader title="Settings" onBack={goBackToMenu} />

        {statusNotice && <div className="p-3 bg-[#ECF6F1] border-b border-[#B7DFCC] text-xs text-[#27835B]">{statusNotice}</div>}

        <div className="px-4 py-2 bg-[#F4F5F6] border-b border-[#D9DEE1] text-[11px] font-semibold uppercase tracking-wide text-[#68727A]">
          This device &amp; Authentication
        </div>

        <div className="px-4 py-3.5 border-b border-[#D9DEE1] flex items-center justify-between gap-3">
          <div>
            <div className="text-sm text-[#252B30]">Mobile authentication</div>
            <div className="text-xs text-[#68727A]">Use this device to log on and authorise instructions</div>
          </div>
          <input
            type="checkbox"
            aria-label="Toggle mobile authentication"
            checked={mobileAuthEnabled}
            onChange={(e) => setMobileAuthEnabled(e.target.checked)}
            className="w-5 h-5 accent-[#27835B]"
          />
        </div>

        <div className="divide-y divide-[#D9DEE1] border-b border-[#D9DEE1]">
          <button
            type="button"
            onClick={() => { setError(null); setPinMsg(null); setSubView('PIN_CHANGE'); }}
            className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-[#F4F5F6] text-left"
          >
            <span className="text-sm text-[#252B30]">Change security PIN</span>
            <ChevronRight className="w-4 h-4 text-[#68727A]" />
          </button>
          <button
            type="button"
            onClick={() => { setError(null); setResetStep('REQ'); setSubView('PIN_RESET'); }}
            className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-[#F4F5F6] text-left"
          >
            <span className="text-sm text-[#252B30]">Reset your security PIN</span>
            <ChevronRight className="w-4 h-4 text-[#68727A]" />
          </button>
          <button
            type="button"
            onClick={() => { setError(null); setSubView('BIOMETRICS_MANAGE'); }}
            className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-[#F4F5F6] text-left"
          >
            <span className="text-sm text-[#252B30]">Manage biometric authentication</span>
            <ChevronRight className="w-4 h-4 text-[#68727A]" />
          </button>
          <button
            type="button"
            onClick={() => setSubView('MOBILE_AUTH')}
            className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-[#F4F5F6] text-left"
          >
            <span className="text-sm text-[#252B30]">Generate security code &amp; push approvals</span>
            <ChevronRight className="w-4 h-4 text-[#68727A]" />
          </button>
        </div>

        <div className="px-4 py-2 bg-[#F4F5F6] border-b border-[#D9DEE1] text-[11px] font-semibold uppercase tracking-wide text-[#68727A]">
          Registered Devices
        </div>
        <div className="p-4 border-b border-[#D9DEE1]">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!newDeviceName.trim()) return;
              await apiRequest('/api/auth/devices', {
                method: 'POST',
                body: JSON.stringify({ deviceName: newDeviceName, platform: navigator.platform || 'Browser', deviceType: 'MOBILE_AUTH' }),
              });
              setNewDeviceName('');
              await loadAuxData();
            }}
            className="flex gap-2 mb-3"
          >
            <input
              type="text"
              placeholder="Register device label"
              value={newDeviceName}
              onChange={(e) => setNewDeviceName(e.target.value)}
              className="flex-1 min-h-[40px] px-3 text-xs border border-[#B4BCC2] rounded-[2px]"
            />
            <Button type="submit" size="sm">Register</Button>
          </form>
          <div className="divide-y divide-[#D9DEE1] text-xs">
            {devices.map((d) => (
              <div key={d.id} className="py-2.5 flex items-center justify-between gap-2">
                <div>
                  <div className="font-medium text-[#252B30]">{d.device_name}</div>
                  <div className="text-[#68727A]">
                    {d.platform} • Last used: {d.last_used_at ? formatDateTime(d.last_used_at) : 'N/A'}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={d.status} />
                  {d.status === 'ACTIVE' ? (
                    <button type="button" onClick={() => setDeviceConfirm({ device: d, action: 'DEACTIVATE' })} className="text-[#DB001B] font-medium">
                      Deactivate
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={async () => {
                        await apiRequest(`/api/auth/devices/${d.id}/activate`, { method: 'POST' });
                        await loadAuxData();
                      }}
                      className="text-[#27835B] font-medium"
                    >
                      Activate
                    </button>
                  )}
                  <button type="button" onClick={() => setDeviceConfirm({ device: d, action: 'REMOVE' })} className="text-[#68727A] hover:text-[#C83A42]">
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="px-4 py-2 bg-[#F4F5F6] border-b border-[#D9DEE1] text-[11px] font-semibold uppercase tracking-wide text-[#68727A]">
          Application Preferences
        </div>
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <FormSelect label="Language" value={appPrefs.language} onChange={(e) => setAppPrefs({ ...appPrefs, language: e.target.value })}>
            <option value="en-GB">English (United Kingdom)</option>
            <option value="en-US">English (United States)</option>
            <option value="en-IN">English (India)</option>
          </FormSelect>
          <FormSelect label="Date format" value={appPrefs.dateFormat} onChange={(e) => setAppPrefs({ ...appPrefs, dateFormat: e.target.value })}>
            <option value="DD/MM/YYYY">DD/MM/YYYY</option>
            <option value="MM/DD/YYYY">MM/DD/YYYY</option>
            <option value="YYYY-MM-DD">YYYY-MM-DD</option>
          </FormSelect>
          <FormSelect label="Number format" value={appPrefs.numberFormat} onChange={(e) => setAppPrefs({ ...appPrefs, numberFormat: e.target.value })}>
            <option value="1,234.56">1,234.56 (Comma / Dot)</option>
            <option value="1.234,56">1.234,56 (Dot / Comma)</option>
          </FormSelect>
          <FormSelect label="Session inactivity lock" value={String(inactivityMinutes)} onChange={(e) => setInactivityMinutes(Number(e.target.value))}>
            <option value="3">After 3 minutes</option>
            <option value="5">After 5 minutes</option>
            <option value="15">After 15 minutes</option>
            <option value="30">After 30 minutes</option>
          </FormSelect>
        </div>

        <NativeDialog
          open={!!deviceConfirm}
          onClose={() => setDeviceConfirm(null)}
          title={deviceConfirm?.action === 'REMOVE' ? 'Remove Device' : 'Deactivate Device'}
        >
          {deviceConfirm && (
            <div className="space-y-4 text-xs">
              <p className="text-[#68727A]">
                Confirm that {deviceConfirm.action === 'REMOVE' ? 'authentication is to be removed from' : 'authentication is to be switched off for'}{' '}
                <strong className="text-[#252B30]">{deviceConfirm.device.device_name}</strong>.
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDeviceConfirm(null)}>Cancel</Button>
                <Button onClick={confirmDeviceAction}>Confirm</Button>
              </div>
            </div>
          )}
        </NativeDialog>
      </div>
    );
  }

  // BIOMETRICS MANAGEMENT (enable_biometrics.pdf p.2-5)
  if (subView === 'BIOMETRICS_MANAGE') {
    return (
      <div className="bg-white md:border md:border-[#D9DEE1]">
        <BankingHeader title="Biometric Authentication" onBack={() => setSubView('SETTINGS')} />
        {error && <div className="p-4 pb-0"><ErrorBanner message={error} /></div>}
        {statusNotice && <div className="p-3 bg-[#ECF6F1] border-b border-[#B7DFCC] text-xs text-[#27835B]">{statusNotice}</div>}

        <div className="px-4 py-2 bg-[#F4F5F6] border-b border-[#D9DEE1] text-[11px] font-semibold uppercase tracking-wide text-[#68727A]">
          This device
        </div>
        <div className="px-4 py-3.5 border-b border-[#D9DEE1] flex items-center justify-between">
          <span className="text-sm text-[#252B30]">{navigator.platform || 'Current Device'}</span>
          <input
            type="checkbox"
            aria-label="Enable biometric authentication on this device"
            checked={biometricsEnabled}
            onChange={(e) => {
              if (e.target.checked) {
                setSubView('BIOMETRICS_TERMS');
              } else {
                setBiometricsEnabled(false);
                setStatusNotice('Biometric log on switched off for this device.');
              }
            }}
            className="w-5 h-5 accent-[#27835B]"
          />
        </div>

        <div className="px-4 py-2 bg-[#F4F5F6] border-b border-[#D9DEE1] text-[11px] font-semibold uppercase tracking-wide text-[#68727A]">
          Information &amp; Passkeys ({passkeys.length})
        </div>
        <div className="divide-y divide-[#D9DEE1] border-b border-[#D9DEE1]">
          <button type="button" onClick={() => setSubView('BIOMETRICS_TERMS')} className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-[#F4F5F6] text-left">
            <span className="text-sm text-[#252B30]">Biometric authentication terms and conditions</span>
            <ChevronRight className="w-4 h-4 text-[#68727A]" />
          </button>
          {passkeySupport.webauthnSupported && (
            <div className="p-4">
              <Button size="sm" variant="secondary" onClick={() => setSubView('BIOMETRICS_TERMS')}>
                <Fingerprint className="w-4 h-4" /> Register Platform Biometric Passkey
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // BIOMETRICS TERMS & CONDITIONS SCREEN (enable_biometrics.pdf p.3)
  if (subView === 'BIOMETRICS_TERMS') {
    return (
      <div className="bg-white md:border md:border-[#D9DEE1] flex flex-col justify-between min-h-[500px]">
        <div>
          <BankingHeader title="Biometric Sign-On" onBack={() => setSubView('BIOMETRICS_MANAGE')} subHeader="1/2 REVIEW TERMS AND CONDITIONS" />
          <div className="p-4 space-y-3 text-xs text-[#252B30] leading-relaxed">
            <h3 className="font-semibold uppercase tracking-wide text-[#68727A] text-[11px]">TERMS AND CONDITIONS</h3>
            <p>
              These terms apply to your use of platform biometric authentication (WebAuthn passkeys, Touch ID, or Face ID) on HSBC Cnet.
            </p>
            <p>
              Your biometric credentials remain stored exclusively on your personal device hardware and are never transmitted to or stored by the HSBC Cnet backend server.
            </p>
            <p>
              Logging on with biometrics provides access to accounts and balances. Security PIN or step-up authentication may still be required for authorising payments.
            </p>
          </div>
        </div>
        <div className="p-4 border-t border-[#D9DEE1] space-y-2">
          <Button fullWidth onClick={handleRegisterPasskey}>Accept</Button>
          <Button fullWidth variant="outline" onClick={() => setSubView('BIOMETRICS_MANAGE')}>Reject</Button>
        </div>
      </div>
    );
  }

  // CHANGE PIN SCREEN
  if (subView === 'PIN_CHANGE') {
    return (
      <div className="bg-white md:border md:border-[#D9DEE1]">
        <BankingHeader title="Change security PIN" onBack={() => setSubView('SETTINGS')} />
        <form onSubmit={handleChangePin} className="p-4 sm:p-5 space-y-4 max-w-md">
          {error && <ErrorBanner message={error} />}
          {pinMsg && <div className="p-3 bg-[#ECF6F1] border border-[#B7DFCC] text-xs text-[#27835B] font-medium">{pinMsg}</div>}
          <FormInput label="Current 6-digit security PIN" type="password" inputMode="numeric" maxLength={6} required value={curPin} onChange={(e) => setCurPin(e.target.value.replace(/\D/g, '').slice(0, 6))} />
          <FormInput label="Create new security PIN" type="password" inputMode="numeric" maxLength={6} required value={nextPin} onChange={(e) => setNextPin(e.target.value.replace(/\D/g, '').slice(0, 6))} />
          <FormInput label="Confirm new security PIN" type="password" inputMode="numeric" maxLength={6} required value={confirmNextPin} onChange={(e) => setConfirmNextPin(e.target.value.replace(/\D/g, '').slice(0, 6))} />
          <Button type="submit" fullWidth>Continue</Button>
        </form>
      </div>
    );
  }

  // RESET PIN SCREEN
  if (subView === 'PIN_RESET') {
    return (
      <div className="bg-white md:border md:border-[#D9DEE1]">
        <BankingHeader title="Reset your security PIN" onBack={() => setSubView('SETTINGS')} />
        <div className="p-4 sm:p-5 max-w-md space-y-4">
          {error && <ErrorBanner message={error} />}
          {resetStep === 'REQ' && (
            <div className="space-y-4 text-xs">
              <p className="text-[#68727A]">Send a reset verification code to your registered email address to reset your 6-digit Mobile Security PIN.</p>
              <Button fullWidth onClick={handleStartPinReset}>Send reset code</Button>
            </div>
          )}
          {resetStep === 'NEW' && (
            <form onSubmit={handleConfirmPinReset} className="space-y-4">
              {resetHint && <div className="p-2.5 bg-[#F4F5F6] border border-[#D9DEE1] text-xs">Sandbox reset code: <strong className="font-mono">{resetHint}</strong></div>}
              <FormInput label="Reset verification code" inputMode="numeric" required value={resetCodeInput} onChange={(e) => setResetCodeInput(e.target.value)} />
              <FormInput label="New 6-digit security PIN" type="password" inputMode="numeric" maxLength={6} required value={nextPin} onChange={(e) => setNextPin(e.target.value.replace(/\D/g, '').slice(0, 6))} />
              <FormInput label="Confirm security PIN" type="password" inputMode="numeric" maxLength={6} required value={confirmNextPin} onChange={(e) => setConfirmNextPin(e.target.value.replace(/\D/g, '').slice(0, 6))} />
              <Button type="submit" fullWidth>Confirm &amp; Reset PIN</Button>
            </form>
          )}
          {resetStep === 'DONE' && (
            <div className="text-center space-y-4 py-4">
              <CheckCircle2 className="w-10 h-10 text-[#27835B] mx-auto" />
              <div className="text-sm font-medium text-[#252B30]">Your Mobile Security PIN has been reset.</div>
              <Button fullWidth onClick={() => setSubView('SETTINGS')}>Done</Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // MOBILE AUTHENTICATION SOFT TOKEN & PUSH APPROVALS
  if (subView === 'MOBILE_AUTH') {
    return (
      <div className="bg-white md:border md:border-[#D9DEE1]">
        <BankingHeader title="Mobile Authentication" onBack={goBackToMenu} />
        <div className="p-4 sm:p-5 space-y-5">
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-[#252B30]">Generate a security code</h3>
            <p className="text-xs text-[#68727A]">Generate a time-limited backend security code for desktop logon or transaction confirmation.</p>
            <Button
              onClick={async () => {
                if (!user) return;
                const res = await apiRequest<any>('/api/auth/security-code/generate', {
                  method: 'POST',
                  body: JSON.stringify({ identifier: user.username, purpose: 'AUTHORISATION' }),
                });
                setSoftToken({ code: res.code, expiresAt: res.expiresAt });
              }}
            >
              <KeyRound className="w-4 h-4" /> Generate Security Code
            </Button>
            {softToken && (
              <div className="p-4 bg-[#F4F5F6] border border-[#D9DEE1] max-w-xs text-center">
                <div className="text-2xl font-mono font-semibold tracking-[0.25em] text-[#252B30] tabular-nums">{softToken.code}</div>
                <div className="text-[11px] text-[#68727A] mt-1">Expires: {formatDateTime(softToken.expiresAt)}</div>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-[#D9DEE1]">
            <h3 className="text-sm font-medium text-[#252B30] mb-3">Pending Login Approval Requests</h3>
            {pendingPushReqs.length === 0 ? (
              <EmptyState icon={Smartphone} title="No pending logon approvals" description="Desktop logon notification requests appear here." />
            ) : (
              <div className="divide-y divide-[#D9DEE1] border border-[#D9DEE1] text-xs">
                {pendingPushReqs.map((r) => (
                  <div key={r.id} className="p-3 flex items-center justify-between gap-2">
                    <div>
                      <div className="font-medium text-[#252B30]">Challenge: {r.challenge_code}</div>
                      <div className="text-[#68727A]">{r.device_info} • {r.ip_address}</div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={async () => { await apiRequest(`/api/auth/login-approval/${r.id}/respond`, { method: 'POST', body: JSON.stringify({ decision: 'APPROVED' }) }); await loadAuxData(); }}>
                        Approve
                      </Button>
                      <Button size="sm" variant="outline" onClick={async () => { await apiRequest(`/api/auth/login-approval/${r.id}/respond`, { method: 'POST', body: JSON.stringify({ decision: 'REJECTED' }) }); await loadAuxData(); }}>
                        Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // MY ALERTS (Part 11)
  if (subView === 'ALERTS') {
    return (
      <div className="bg-white md:border md:border-[#D9DEE1]">
        <BankingHeader
          title="My Alerts"
          onBack={goBackToMenu}
          rightSlot={
            unreadAlerts > 0 ? (
              <button
                type="button"
                onClick={async () => {
                  await apiRequest('/api/notifications/read-all', { method: 'POST' });
                  await loadAuxData();
                }}
                className="px-2 text-xs font-medium text-[#DB001B]"
              >
                Mark all read
              </button>
            ) : null
          }
        />

        <div className="px-4 py-2 bg-[#F4F5F6] border-b border-[#D9DEE1] text-[11px] font-semibold uppercase tracking-wide text-[#68727A]">
          Notification Preferences
        </div>
        <div className="divide-y divide-[#D9DEE1] border-b border-[#D9DEE1] text-xs">
          {(
            [
              { key: 'paymentAuth', label: 'Payment awaiting authorisation (Priority, SEPA, ACH, Bill, Transfer)' },
              { key: 'securityAlerts', label: 'Security alerts & logon events' },
              { key: 'paymentStatus', label: 'Payment status updates' },
              { key: 'messages', label: 'New message & receivables alerts' },
            ] as const
          ).map((item) => (
            <label key={item.key} className="px-4 py-3 flex items-center justify-between gap-3 cursor-pointer">
              <span className="text-[#252B30]">{item.label}</span>
              <input
                type="checkbox"
                checked={alertPrefs[item.key]}
                onChange={(e) => setAlertPrefs((p) => ({ ...p, [item.key]: e.target.checked }))}
                className="w-4 h-4 accent-[#27835B]"
              />
            </label>
          ))}
        </div>

        <div className="px-4 py-2 bg-[#F4F5F6] border-b border-[#D9DEE1] text-[11px] font-semibold uppercase tracking-wide text-[#68727A]">
          Notification History ({alerts.length})
        </div>
        {alerts.length === 0 ? (
          <EmptyState icon={Bell} title="No notifications" description="Real-time alerts from authorisations and security events appear here." />
        ) : (
          <div className="divide-y divide-[#D9DEE1]">
            {alerts.map((a) => (
              <div key={a.id} className={`px-4 py-3.5 flex justify-between items-start gap-3 text-xs ${!a.is_read ? 'bg-[#FDF2F3]/35' : ''}`}>
                <div>
                  <div className="font-medium text-[#252B30]">{a.title}</div>
                  <div className="text-[#68727A] mt-0.5">{a.message}</div>
                  <div className="text-[11px] text-[#68727A] mt-1">{a.type} • {formatDateTime(a.created_at)}</div>
                </div>
                {!a.is_read && (
                  <button
                    type="button"
                    onClick={async () => {
                      await apiRequest(`/api/notifications/${a.id}/read`, { method: 'POST' });
                      await loadAuxData();
                    }}
                    className="text-xs font-medium text-[#263640] flex items-center gap-1 shrink-0"
                  >
                    <Check className="w-3.5 h-3.5" /> Read
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Extended Enterprise Services views
  if (subView === 'TRADE_HUB') return <TradeSuiteView initialTab="DASHBOARD" />;
  if (subView === 'TRADE_DC') return <TradeSuiteView initialTab="DOC_CREDITS" />;
  if (subView === 'TRADE_GUARANTEES') return <TradeSuiteView initialTab="GUARANTEES" />;
  if (subView === 'TRADE_TRACKER') return <TradeSuiteView initialTab="TRACKER" />;
  if (subView === 'TRADE_SCF') return <TradeSuiteView initialTab="SCF" />;
  if (subView === 'VIRTUAL_ACCOUNTS') return <VirtualAccountsView />;
  if (subView === 'PAYMENT_TEMPLATES') return <PaymentTemplatesView />;
  if (subView === 'FILE_UPLOAD') return <FileUploadView />;
  if (subView === 'REPORTS_FILES') return <ReportsFilesView />;
  if (subView === 'FX_MARKETS') return <FxMarketsView />;
  if (subView === 'SECURITIES') return <SecuritiesServicesView />;

  // FX EXCHANGE RATES (Preview exchange rates board)
  if (subView === 'FX_RATES') {
    return (
      <div className="bg-white md:border md:border-[#D9DEE1]">
        <BankingHeader
          title="FX exchange rates"
          onBack={goBackToMenu}
          rightSlot={
            <button type="button" onClick={loadFxRates} aria-label="Refresh rates" className="p-2 text-[#263640]">
              <RefreshCw className={`w-4 h-4 ${fxLoading ? 'animate-spin' : ''}`} />
            </button>
          }
        />
        <div className="p-3 bg-[#F4F5F6] border-b border-[#D9DEE1] text-[11px] text-[#68727A]">
          Indicative sandbox FX rates supplied by backend. Not live interbank market quotes.
        </div>
        <div className="divide-y divide-[#D9DEE1]">
          {fxRates.map((r) => (
            <div key={`${r.base}-${r.quote}`} className="px-4 py-3.5 flex items-center justify-between text-xs">
              <div>
                <div className="text-sm font-medium text-[#252B30]">{r.base} / {r.quote}</div>
                <div className="text-[#68727A]">Inverse: 1 {r.quote} = {r.inverseRate} {r.base}</div>
              </div>
              <div className="text-right font-semibold text-sm text-[#252B30] tabular-nums">{r.rate}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // HELP AND SUPPORT (mobile.pdf p.15 structure)
  if (subView === 'SUPPORT') {
    return (
      <div className="bg-white md:border md:border-[#D9DEE1]">
        <BankingHeader title="Help and support" onBack={goBackToMenu} />

        <div className="p-4 sm:p-5 space-y-5 border-b border-[#D9DEE1]">
          <h1 className="text-base font-medium text-[#252B30]">{countryCapability.name} helpdesk</h1>

          <div className="space-y-2">
            <div className="text-xs font-medium text-[#252B30]">Need our help?</div>
            <p className="text-xs text-[#68727A]">The easiest and quickest way to get in touch via in-app messaging.</p>
            <Button variant="secondary" fullWidth onClick={() => setSubView('SUPPORT_CHAT')}>
              <MessageCircle className="w-4 h-4" /> Chat with us (Support Tickets)
            </Button>
            <div className="text-[11px] text-[#68727A]">Languages supported: English</div>
          </div>

          <div className="space-y-2 pt-2">
            <div className="text-xs font-medium text-[#252B30]">Need to speak to us?</div>
            <Button variant="secondary" fullWidth onClick={() => setCallModalOpen(true)}>
              <Phone className="w-4 h-4" /> Call us
            </Button>
            <div className="text-[11px] text-[#68727A]">Sandbox Corporate Support Line ({countryCapability.code})</div>
          </div>
        </div>

        <div className="p-4 space-y-3">
          <FormInput label="Search Frequently Asked Questions" placeholder="Search topic..." value={faqQuery} onChange={(e) => setFaqQuery(e.target.value)} />
          <div className="divide-y divide-[#D9DEE1] border-t border-[#D9DEE1] text-xs">
            {FAQS.filter((f) => !faqQuery || f.q.toLowerCase().includes(faqQuery.toLowerCase())).map((f) => (
              <div key={f.q} className="py-3">
                <div className="font-medium text-[#252B30]">{f.q}</div>
                <div className="text-[#68727A] mt-1 leading-relaxed">{f.a}</div>
              </div>
            ))}
          </div>
        </div>

        <NativeDialog open={callModalOpen} onClose={() => setCallModalOpen(false)} title={`${countryCapability.name} Corporate Helpdesk`}>
          <div className="space-y-3 text-xs text-[#68727A]">
            <p className="text-[#252B30] font-medium">Sandbox Demonstration Notice: No live telephone PBX is connected.</p>
            <p>For interactive support inquiries in this sandbox, use <strong>Chat with us</strong> to open and reply to a persisted support ticket.</p>
          </div>
        </NativeDialog>
      </div>
    );
  }

  // SUPPORT CHAT / TICKETS
  if (subView === 'SUPPORT_CHAT') {
    return (
      <div className="bg-white md:border md:border-[#D9DEE1]">
        <BankingHeader title="Support Messaging" onBack={() => setSubView('SUPPORT')} />
        <div className="p-4 space-y-5">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await apiRequest('/api/support/tickets', { method: 'POST', body: JSON.stringify(newTicket) });
              setNewTicket({ subject: '', category: 'GENERAL', description: '' });
              await loadAuxData();
            }}
            className="space-y-3 pb-4 border-b border-[#D9DEE1]"
          >
            <FormInput label="New inquiry subject" required value={newTicket.subject} onChange={(e) => setNewTicket({ ...newTicket, subject: e.target.value })} />
            <FormInput label="Message" required value={newTicket.description} onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })} />
            <Button type="submit" size="sm">Create Support Ticket</Button>
          </form>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="divide-y divide-[#D9DEE1] border border-[#D9DEE1]">
              {tickets.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => openTicketThread(t)}
                  className={`w-full p-3 text-left hover:bg-[#F4F5F6] ${selectedTicket?.id === t.id ? 'bg-[#F4F5F6]' : ''}`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-[#252B30]">{t.subject}</span>
                    <StatusBadge status={t.status} />
                  </div>
                  <div className="text-[#68727A] mt-0.5">{t.ticket_number}</div>
                </button>
              ))}
            </div>
            <div className="border border-[#D9DEE1] p-3 flex flex-col justify-between min-h-[200px]">
              {!selectedTicket ? (
                <p className="text-[#68727A] m-auto">Select a conversation to view replies.</p>
              ) : (
                <>
                  <div className="space-y-2 max-h-56 overflow-y-auto mb-3">
                    {ticketThread.map((m) => (
                      <div key={m.id} className="p-2.5 bg-[#F4F5F6] border border-[#D9DEE1]">
                        <div className="font-semibold text-[11px] text-[#252B30]">{m.sender_type}</div>
                        <div className="text-[#252B30] mt-0.5">{m.message}</div>
                      </div>
                    ))}
                  </div>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!replyBody.trim()) return;
                      await apiRequest(`/api/support/tickets/${selectedTicket.id}/message`, {
                        method: 'POST',
                        body: JSON.stringify({ message: replyBody }),
                      });
                      setReplyBody('');
                      await openTicketThread(selectedTicket);
                    }}
                    className="flex gap-2"
                  >
                    <input
                      type="text"
                      placeholder="Write reply..."
                      value={replyBody}
                      onChange={(e) => setReplyBody(e.target.value)}
                      className="flex-1 px-2.5 py-1.5 border border-[#B4BCC2] rounded-[2px]"
                    />
                    <Button type="submit" size="sm">Send</Button>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // INFORMATION & LEGAL DISCLOSURES
  if (subView === 'INFO') {
    return (
      <div className="bg-white md:border md:border-[#D9DEE1]">
        <BankingHeader title="Information" onBack={goBackToMenu} />
        <div className="divide-y divide-[#D9DEE1] text-xs">
          <div className="p-4">
            <div className="font-semibold text-[#252B30]">Application Version</div>
            <div className="text-[#68727A] mt-0.5">{BANK_CONFIG.fullTitle} — Version {BANK_CONFIG.version}</div>
          </div>
          <div className="p-4">
            <div className="font-semibold text-[#252B30]">Terms &amp; Conditions</div>
            <div className="text-[#68727A] mt-0.5 leading-relaxed">
              Corporate access is governed by organisation-scoped permissions, dual-control policies, and backend audit logs.
            </div>
          </div>
          <div className="p-4">
            <div className="font-semibold text-[#252B30]">Privacy &amp; Security Policy</div>
            <div className="text-[#68727A] mt-0.5 leading-relaxed">
              PINs and WebAuthn secrets are never persisted in browser localStorage. All balance and authorisation checks are enforced on the server.
            </div>
          </div>
          <div className="p-4">
            <div className="font-semibold text-[#252B30]">Independent Platform &amp; Sandbox Disclosure</div>
            <div className="text-[#68727A] mt-0.5 leading-relaxed">{BANK_CONFIG.disclaimer}</div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // MORE MAIN SCREEN — Full #263640 Dark Blue-Grey Menu (liquidity.pdf p.2, rece_finance.pdf p.1)
  // =========================================================================
  return (
    <div className="relative overflow-hidden bg-[#263640] text-white min-h-[calc(100dvh-64px)] md:min-h-[600px] md:border md:border-[#344651] flex flex-col justify-between">
      {/* Subtle geometric background facet */}
      <svg
        aria-hidden="true"
        viewBox="0 0 800 900"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 w-full h-full"
      >
        <rect width="800" height="900" fill="#263640" />
        <polygon points="0,0 800,0 800,320 200,520 0,380" fill="#344651" opacity="0.45" />
        <polygon points="350,900 800,900 800,400 180,680" fill="#202A30" opacity="0.7" />
      </svg>

      <div className="relative z-10 p-5 sm:p-6">
        {/* Top User Identity Section */}
        <div className="pb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[28px] font-light tracking-tight text-white">More</h1>
            <div className="mt-3 text-sm font-medium text-white">{user?.full_name}</div>
            <div className="text-xs text-white/70 mt-0.5">
              Last logon: {user?.lastLoginAt ? formatDateTime(user.lastLoginAt) : 'Current session'}
            </div>
            <div className="text-xs text-white/60 mt-0.5">{activeOrg?.name} ({activeOrg?.country})</div>
          </div>
          <BrandMark size={44} className="rounded-[4px]" />
        </div>

        {/* Main Service List */}
        <ul className="space-y-1">
          {hasPermission('ACCESS_RECEIVABLES_FINANCE') && hasModule('receivablesFinance') && (
            <li>
              <DarkMenuRow icon={Landmark} label="Receivables finance" onClick={() => setSubView('RECEIVABLES')} />
            </li>
          )}
          {hasPermission('ACCESS_TRADE_FINANCE') && hasModule('tradeFinance') && (
            <>
              <li>
                <DarkMenuRow icon={ShieldCheck} label="Trade & Supply Chain Suite" onClick={() => setSubView('TRADE_HUB')} />
              </li>
              <li>
                <DarkMenuRow icon={FileCheck} label="Trade authorisation" onClick={() => setSubView('TRADE')} />
              </li>
            </>
          )}
          <li>
            <DarkMenuRow icon={KeyRound} label="Payment templates" onClick={() => setSubView('PAYMENT_TEMPLATES')} />
          </li>
          <li>
            <DarkMenuRow icon={FileText} label="File upload (ISO 20022 / CSV)" onClick={() => setSubView('FILE_UPLOAD')} />
          </li>
          <li>
            <DarkMenuRow icon={Landmark} label="Virtual accounts" onClick={() => setSubView('VIRTUAL_ACCOUNTS')} />
          </li>
          <li>
            <DarkMenuRow icon={FileText} label="Reports & files (MT940/BAI2)" onClick={() => setSubView('REPORTS_FILES')} />
          </li>
          <li>
            <DarkMenuRow
              icon={Bell}
              label="My alerts"
              badge={unreadAlerts > 0 ? String(unreadAlerts) : undefined}
              onClick={() => setSubView('ALERTS')}
            />
          </li>
          <li>
            <DarkMenuRow icon={CircleDollarSign} label="Markets & FX Deal Desk" onClick={() => setSubView('FX_MARKETS')} />
          </li>
          <li>
            <DarkMenuRow icon={TrendingUp} label="Securities Services (HSS)" onClick={() => setSubView('SECURITIES')} />
          </li>
          {hasPermission('VIEW_LIQUIDITY') && hasModule('liquidity') && (
            <li>
              <DarkMenuRow icon={TrendingUp} label="Liquidity dashboard" onClick={() => setSubView('LIQUIDITY')} />
            </li>
          )}
          {hasPermission('ACCESS_RDC') && hasModule('remoteDepositCapture') && countryCapability.supportsRDC && (
            <li>
              <DarkMenuRow icon={Camera} label="Remote Deposit Capture" onClick={() => setSubView('RDC')} />
            </li>
          )}
          {hasPermission('REQUEST_DOCUMENTS') && (
            <li>
              <DarkMenuRow icon={FileText} label="Self-service documents" onClick={() => setSubView('SELF_SERVICE')} />
            </li>
          )}
        </ul>

        {/* Thin Divider */}
        <hr className="my-5 border-white/15" />

        {/* Secondary Support & Settings Section */}
        <ul className="space-y-1">
          <li>
            <DarkMenuRow icon={HelpCircle} label="Help and support" onClick={() => setSubView('SUPPORT')} />
          </li>
          <li>
            <DarkMenuRow icon={Settings} label="Settings" onClick={() => setSubView('SETTINGS')} />
          </li>
          <li>
            <DarkMenuRow icon={Info} label="Information" onClick={() => setSubView('INFO')} />
          </li>
          <li>
            <DarkMenuRow icon={LogOut} label="Log off" onClick={() => setLogoutConfirmOpen(true)} />
          </li>
        </ul>
      </div>

      <NativeDialog open={logoutConfirmOpen} onClose={() => setLogoutConfirmOpen(false)} title="Log off">
        <div className="space-y-4 text-xs">
          <p className="text-[#68727A]">Are you sure you want to log off from HSBC Cnet and revoke your active session?</p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setLogoutConfirmOpen(false)}>Cancel</Button>
            <Button onClick={logout}>Log off</Button>
          </div>
        </div>
      </NativeDialog>
    </div>
  );
};

const DarkMenuRow: React.FC<{
  icon: React.ComponentType<{ className?: string; strokeWidth?: string | number }>;
  label: string;
  badge?: string;
  onClick: () => void;
}> = ({ icon: Icon, label, badge, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full py-3 px-2 -mx-2 flex items-center justify-between text-left hover:bg-white/10 rounded-[2px] transition-colors"
  >
    <span className="flex items-center gap-3.5 text-sm font-normal text-white/95">
      <Icon className="w-4 h-4 text-white/80 shrink-0" strokeWidth={1.75} aria-hidden="true" />
      <span>{label}</span>
    </span>
    <span className="flex items-center gap-2">
      {badge && (
        <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-[#DB001B] text-white rounded-full tabular-nums">
          {badge}
        </span>
      )}
      <ChevronRight className="w-4 h-4 text-white/50" aria-hidden="true" />
    </span>
  </button>
);
