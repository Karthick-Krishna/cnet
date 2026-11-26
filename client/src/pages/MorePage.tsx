import React, { useCallback, useEffect, useState } from 'react';
import {
  Bell,
  Camera,
  Check,
  ChevronRight,
  FileText,
  Fingerprint,
  HelpCircle,
  Info,
  KeyRound,
  Landmark,
  Lock,
  LogOut,
  MessageSquare,
  Settings,
  Shield,
  Ship,
  Smartphone,
  TrendingUp,
  User,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';
import { formatDateTime } from '@shared/utils/formatters';
import { BANK_CONFIG } from '@shared/constants';
import {
  Button,
  EmptyState,
  ErrorBanner,
  FormInput,
  FormSelect,
  NativeDialog,
  SectionCard,
  StatusBadge,
} from '../components/ui/Primitives';
import { LiquidityView, ReceivablesView, TradeFinanceView, RdcView, SelfServiceView } from './EnterpriseServicesPages';
import { detectPasskeySupport, parseCreationOptions, serializeCredential, signalUnknownCredentialIfSupported } from '../lib/webauthn';

export type MoreSubView =
  | 'MENU'
  | 'PROFILE'
  | 'SETTINGS'
  | 'MOBILE_AUTH'
  | 'ALERTS'
  | 'SUPPORT'
  | 'INFO'
  | 'LIQUIDITY'
  | 'TRADE'
  | 'RECEIVABLES'
  | 'RDC'
  | 'SELF_SERVICE';

export const MorePage: React.FC<{ initialSubView?: string }> = ({ initialSubView }) => {
  const { user, activeOrg, countryCapability, inactivityMinutes, setInactivityMinutes, lockSession, logout, hasPermission, hasModule } = useAuth();
  const [subView, setSubView] = useState<MoreSubView>((initialSubView as MoreSubView) || 'MENU');
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

  useEffect(() => {
    if (initialSubView) {
      setSubView(initialSubView.toUpperCase().replace('-', '_') as MoreSubView);
    }
  }, [initialSubView]);

  // Notifications / Alerts
  const [alerts, setAlerts] = useState<any[]>([]);
  const [alertFilter, setAlertFilter] = useState('ALL');
  // Devices & Mobile Auth
  const [devices, setDevices] = useState<any[]>([]);
  const [passkeys, setPasskeys] = useState<any[]>([]);
  const [pendingPushReqs, setPendingPushReqs] = useState<any[]>([]);
  const [softToken, setSoftToken] = useState<{ code: string; expiresAt: string } | null>(null);
  const [newDeviceName, setNewDeviceName] = useState('');
  const [newPin, setNewPin] = useState('');
  const [pinMsg, setPinMsg] = useState<string | null>(null);
  const [passkeySupport, setPasskeySupport] = useState({ webauthnSupported: false, platformAuthenticatorAvailable: false });
  // Support Tickets & FAQ
  const [tickets, setTickets] = useState<any[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [ticketThread, setTicketThread] = useState<any[]>([]);
  const [newTicket, setNewTicket] = useState({ subject: '', category: 'GENERAL', description: '' });
  const [replyBody, setReplyBody] = useState('');
  const [faqQuery, setFaqQuery] = useState('');
  const [sessions, setSessions] = useState<any[]>([]);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadAuxData = useCallback(async () => {
    try {
      const [notifRes, devRes, pushRes, tickRes, sessRes] = await Promise.all([
        apiRequest<any>('/api/notifications').catch(() => ({ notifications: [] })),
        apiRequest<any>('/api/auth/devices').catch(() => ({ devices: [], passkeys: [] })),
        apiRequest<any>('/api/auth/login-approval/pending').catch(() => ({ requests: [] })),
        apiRequest<any>('/api/support/tickets').catch(() => ({ tickets: [] })),
        apiRequest<any>('/api/profile/sessions').catch(() => ({ sessions: [] })),
      ]);
      setAlerts(notifRes.notifications || []);
      setDevices(devRes.devices || []);
      setPasskeys(devRes.passkeys || []);
      setPendingPushReqs(pushRes.requests || []);
      setTickets(tickRes.tickets || []);
      setSessions(sessRes.sessions || []);
    } catch {
      // Non-blocking
    }
  }, []);

  useEffect(() => {
    loadAuxData();
    detectPasskeySupport().then(setPasskeySupport);
  }, [loadAuxData]);

  const markAlertRead = async (id: string) => {
    await apiRequest(`/api/notifications/${id}/read`, { method: 'POST' });
    await loadAuxData();
  };

  const markAllRead = async () => {
    await apiRequest('/api/notifications/read-all', { method: 'POST' });
    await loadAuxData();
  };

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
        setStatusNotice('WebAuthn passkey registered successfully for biometric sign-in and step-up approval.');
        await loadAuxData();
      } catch (err) {
        await signalUnknownCredentialIfSupported(optionsJson.rp?.id, serialized.id);
        throw err;
      }
    } catch (err: any) {
      setError(err?.message || 'Passkey registration cancelled or unavailable on this browser.');
    }
  };

  const handleSetPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinMsg(null);
    setError(null);
    try {
      const res = await apiRequest<any>('/api/auth/pin/set', {
        method: 'POST',
        body: JSON.stringify({ newPin }),
      });
      setPinMsg(res.message);
      setNewPin('');
    } catch (err: any) {
      setError(err?.message || 'Unable to update Security PIN.');
    }
  };

  const handleRegisterDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeviceName.trim()) return;
    await apiRequest('/api/auth/devices', {
      method: 'POST',
      body: JSON.stringify({ deviceName: newDeviceName, platform: navigator.userAgent.slice(0, 40), deviceType: 'MOBILE_AUTH' }),
    });
    setNewDeviceName('');
    await loadAuxData();
  };

  const handleDeactivateDevice = async (id: string) => {
    await apiRequest(`/api/auth/devices/${id}/deactivate`, { method: 'POST' });
    await loadAuxData();
  };

  const handleGenerateCode = async () => {
    if (!user) return;
    const res = await apiRequest<any>('/api/auth/security-code/generate', {
      method: 'POST',
      body: JSON.stringify({ identifier: user.username, purpose: 'AUTHORISATION' }),
    });
    setSoftToken({ code: res.code, expiresAt: res.expiresAt });
  };

  const respondPush = async (id: string, decision: 'APPROVED' | 'REJECTED') => {
    await apiRequest(`/api/auth/login-approval/${id}/respond`, {
      method: 'POST',
      body: JSON.stringify({ decision }),
    });
    await loadAuxData();
  };

  const openTicketThread = async (t: any) => {
    setSelectedTicket(t);
    const res = await apiRequest<any>(`/api/support/tickets/${t.id}`);
    setTicketThread(res.messages || []);
  };

  const createTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiRequest('/api/support/tickets', {
      method: 'POST',
      body: JSON.stringify(newTicket),
    });
    setNewTicket({ subject: '', category: 'GENERAL', description: '' });
    await loadAuxData();
  };

  const replyTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !replyBody.trim()) return;
    await apiRequest(`/api/support/tickets/${selectedTicket.id}/message`, {
      method: 'POST',
      body: JSON.stringify({ message: replyBody }),
    });
    setReplyBody('');
    await openTicketThread(selectedTicket);
  };

  const FAQS = [
    { q: 'How does Dual / Multi-Level Payment Authorisation work?', a: 'Payment instructions above configured thresholds automatically route through independent authorisers. An initiator cannot approve their own payment (maker-checker).' },
    { q: 'Why is Remote Deposit Capture unavailable in India?', a: 'Module availability follows country regulatory configuration. Remote cheque deposit is active for GB and US entities and disabled for India.' },
    { q: 'How do I generate a desktop logon security code?', a: 'Open More > Mobile Authentication and click Generate Backend Security Code, or select Generate Security Code from the Welcome Screen.' },
    { q: 'What is the difference between Available and Ledger Balance?', a: 'Available balance reflects immediately spendable funds; Ledger balance includes uncleared credits or pending holds.' },
  ];

  const unreadAlerts = alerts.filter((a) => !a.is_read).length;

  return (
    <div className="space-y-5">
      {subView !== 'MENU' && (
        <button
          type="button"
          onClick={() => setSubView('MENU')}
          className="text-xs font-semibold text-[#DB0011] hover:underline"
        >
          &larr; Back to More Menu
        </button>
      )}

      {statusNotice && <div className="p-3 rounded bg-[#EBF7F0] border border-[#B7E1CD] text-xs text-[#008A52]">{statusNotice}</div>}
      {error && <ErrorBanner message={error} />}

      {subView === 'MENU' && (
        <div className="space-y-5">
          <div className="bg-white border border-[#D7D8D6] rounded-[2px] p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-[#252525] text-white flex items-center justify-center font-semibold text-sm">
                {user?.full_name?.split(' ').map((n) => n[0]).join('').slice(0, 2)}
              </div>
              <div>
                <h1 className="text-lg font-semibold text-[#252525]">{user?.full_name}</h1>
                <p className="text-xs text-[#767676]">{activeOrg?.name} • Role: {activeOrg?.role}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={lockSession}>
                <Lock className="w-3.5 h-3.5" /> Lock Screen
              </Button>
              <Button size="sm" variant="danger" onClick={() => setLogoutConfirmOpen(true)}>
                <LogOut className="w-3.5 h-3.5" /> Log out
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SectionCard title="Enterprise Services">
              <div className="divide-y divide-[#D7D8D6]">
                {hasPermission('VIEW_LIQUIDITY') && hasModule('liquidity') && (
                  <MenuRow icon={TrendingUp} title="Liquidity Dashboard" desc="Multi-currency cash overview & charts" onClick={() => setSubView('LIQUIDITY')} />
                )}
                {hasPermission('ACCESS_TRADE_FINANCE') && hasModule('tradeFinance') && (
                  <MenuRow icon={Ship} title="Trade Finance" desc="Documentary credits, bills & trade approvals" onClick={() => setSubView('TRADE')} />
                )}
                {hasPermission('ACCESS_RECEIVABLES_FINANCE') && hasModule('receivablesFinance') && (
                  <MenuRow icon={Landmark} title="Receivables Finance" desc="Draws, facility limits & message centre" onClick={() => setSubView('RECEIVABLES')} />
                )}
                <MenuRow
                  icon={Camera}
                  title="Remote Deposit Capture"
                  desc={countryCapability.supportsRDC ? 'Cheque deposit capture (Sandbox)' : `Disabled in ${countryCapability.name}`}
                  onClick={() => setSubView('RDC')}
                />
                {hasPermission('REQUEST_DOCUMENTS') && (
                  <MenuRow icon={FileText} title="Self-Service & Document Requests" desc="Balance certificates & historical statements" onClick={() => setSubView('SELF_SERVICE')} />
                )}
              </div>
            </SectionCard>

            <SectionCard title="Security, Profile & Support">
              <div className="divide-y divide-[#D7D8D6]">
                <MenuRow icon={User} title="Profile" desc="Corporate identity, role & active sessions" onClick={() => setSubView('PROFILE')} />
                <MenuRow icon={Settings} title="Settings" desc="Biometrics, Security PIN, timeout & devices" onClick={() => setSubView('SETTINGS')} />
                <MenuRow
                  icon={KeyRound}
                  title="Mobile Authentication"
                  desc="Generate security codes & approve logins"
                  badge={pendingPushReqs.length > 0 ? `${pendingPushReqs.length} pending` : undefined}
                  onClick={() => setSubView('MOBILE_AUTH')}
                />
                <MenuRow
                  icon={Bell}
                  title="My Alerts"
                  desc="Authorisation, payment & security alerts"
                  badge={unreadAlerts > 0 ? `${unreadAlerts} unread` : undefined}
                  onClick={() => setSubView('ALERTS')}
                />
                <MenuRow icon={HelpCircle} title="Help & Support" desc="FAQs, secure messaging & support tickets" onClick={() => setSubView('SUPPORT')} />
                <MenuRow icon={Info} title="Information" desc="Version, legal notices & security policy" onClick={() => setSubView('INFO')} />
              </div>
            </SectionCard>
          </div>
        </div>
      )}

      {subView === 'LIQUIDITY' && <LiquidityView />}
      {subView === 'TRADE' && <TradeFinanceView />}
      {subView === 'RECEIVABLES' && <ReceivablesView />}
      {subView === 'RDC' && <RdcView />}
      {subView === 'SELF_SERVICE' && <SelfServiceView />}

      {subView === 'PROFILE' && (
        <SectionCard title="Corporate User Profile">
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div><dt className="text-[#767676]">Full Name</dt><dd className="font-semibold text-[#252525] mt-0.5">{user?.full_name}</dd></div>
            <div><dt className="text-[#767676]">Username / Profile ID</dt><dd className="font-semibold text-[#252525] mt-0.5">{user?.username} ({user?.customer_id || 'CORP'})</dd></div>
            <div><dt className="text-[#767676]">Organisation</dt><dd className="font-semibold text-[#252525] mt-0.5">{activeOrg?.name} ({activeOrg?.country})</dd></div>
            <div><dt className="text-[#767676]">Assigned Role</dt><dd className="font-semibold text-[#252525] mt-0.5">{activeOrg?.role}</dd></div>
            <div><dt className="text-[#767676]">Email &amp; Phone</dt><dd className="font-medium mt-0.5">{user?.email} • {user?.phone}</dd></div>
            <div><dt className="text-[#767676]">Last Login</dt><dd className="font-medium mt-0.5">{user?.lastLoginAt ? formatDateTime(user.lastLoginAt) : 'Current Session'}</dd></div>
          </dl>
          <div className="mt-5 pt-4 border-t border-[#D7D8D6]">
            <h3 className="text-xs font-semibold text-[#252525] mb-2">Active Device Sessions ({sessions.length})</h3>
            <div className="space-y-2 text-xs">
              {sessions.map((s) => (
                <div key={s.id} className="p-2.5 rounded border border-[#D7D8D6] flex justify-between items-center">
                  <div>
                    <div className="font-medium text-[#252525] truncate max-w-md">{s.device_name}</div>
                    <div className="text-[#767676]">IP: {s.ip_address} • Last active: {formatDateTime(s.last_active)}</div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      await apiRequest(`/api/profile/sessions/${s.id}/revoke`, { method: 'POST' });
                      await loadAuxData();
                    }}
                  >
                    Revoke
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </SectionCard>
      )}

      {subView === 'SETTINGS' && (
        <div className="space-y-5">
          <SectionCard title="Security & Session Preferences">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-[#252525]">Biometrics &amp; WebAuthn Passkeys</h3>
                <p className="text-xs text-[#767676]">
                  {passkeySupport.webauthnSupported
                    ? 'Register a platform passkey (Touch ID / Face ID / Windows Hello) for real WebAuthn login and step-up payment authorisation.'
                    : 'WebAuthn passkeys are unavailable in this browser context. Use your 6-digit Security PIN.'}
                </p>
                {passkeySupport.webauthnSupported && (
                  <Button size="sm" variant="secondary" onClick={handleRegisterPasskey}>
                    <Fingerprint className="w-4 h-4" /> Register Device Passkey
                  </Button>
                )}
                {passkeys.length > 0 && (
                  <ul className="text-xs space-y-1 pt-1">
                    {passkeys.map((pk) => (
                      <li key={pk.id} className="p-2 rounded bg-[#F4F4F4] border border-[#D7D8D6]">
                        {pk.name} • Last used: {pk.last_used_at ? formatDateTime(pk.last_used_at) : 'Just registered'}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <form onSubmit={handleSetPin} className="space-y-3">
                <h3 className="text-xs font-semibold text-[#252525]">Mobile Security PIN Management</h3>
                <FormInput
                  label="New 6-Digit Security PIN"
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                />
                <Button type="submit" size="sm">Update Security PIN</Button>
                {pinMsg && <p className="text-xs text-[#008A52] font-medium">{pinMsg}</p>}
              </form>
            </div>

            <div className="mt-6 pt-5 border-t border-[#D7D8D6] grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormSelect
                label="Inactivity Session Lock"
                value={String(inactivityMinutes)}
                onChange={(e) => setInactivityMinutes(Number(e.target.value))}
              >
                <option value="3">After 3 minutes</option>
                <option value="5">After 5 minutes</option>
                <option value="15">After 15 minutes</option>
                <option value="30">After 30 minutes</option>
              </FormSelect>
              <FormSelect label="Display Language" defaultValue="en">
                <option value="en">English (International)</option>
                <option value="en-US">English (United States)</option>
              </FormSelect>
              <FormSelect label="Preferred Display Currency" defaultValue={activeOrg?.baseCurrency || 'GBP'}>
                <option value="GBP">GBP (£)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="INR">INR (₹)</option>
              </FormSelect>
            </div>
          </SectionCard>

          <SectionCard title="Registered Devices">
            <form onSubmit={handleRegisterDevice} className="flex flex-wrap gap-2 mb-4">
              <input
                type="text"
                placeholder="Register device label (e.g. Corporate iPad Pro)"
                value={newDeviceName}
                onChange={(e) => setNewDeviceName(e.target.value)}
                className="flex-1 min-h-[40px] px-3 text-xs border border-[#9E9E9E] rounded-[2px]"
              />
              <Button type="submit" size="sm">Register Device</Button>
            </form>
            <div className="divide-y divide-[#D7D8D6] text-xs">
              {devices.map((d) => (
                <div key={d.id} className="py-2.5 flex justify-between items-center gap-2">
                  <div>
                    <div className="font-semibold text-[#252525]">{d.device_name}</div>
                    <div className="text-[#767676]">{d.platform} • Last used: {d.last_used_at ? formatDateTime(d.last_used_at) : 'N/A'}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={d.status} />
                    {d.status === 'ACTIVE' && (
                      <Button size="sm" variant="outline" onClick={() => handleDeactivateDevice(d.id)}>Deactivate</Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      )}

      {subView === 'MOBILE_AUTH' && (
        <div className="space-y-5">
          <SectionCard title="Mobile Authentication & Soft Token">
            <div className="space-y-4">
              <p className="text-xs text-[#555555]">
                Generate time-limited 8-digit security codes verified by the backend authentication service, or approve incoming desktop login requests.
              </p>
              <Button onClick={handleGenerateCode}>
                <KeyRound className="w-4 h-4" /> Generate 8-Digit Backend Security Code
              </Button>
              {softToken && (
                <div className="p-4 rounded-[2px] bg-[#252525] text-white max-w-sm">
                  <div className="text-[11px] uppercase text-white/75">Active Security Code (Valid 120s)</div>
                  <div className="text-2xl font-mono font-bold tracking-[0.25em] tabular-nums mt-1">{softToken.code}</div>
                </div>
              )}
            </div>
          </SectionCard>

          <SectionCard title="Pending Push Login Approvals">
            {pendingPushReqs.length === 0 ? (
              <EmptyState icon={Smartphone} title="No pending login requests" description="Incoming desktop logon approval challenges appear here." />
            ) : (
              <div className="divide-y divide-[#D7D8D6] text-xs">
                {pendingPushReqs.map((r) => (
                  <div key={r.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-[#252525]">Challenge Number: {r.challenge_code}</div>
                      <div className="text-[#767676]">{r.device_info} • IP {r.ip_address}</div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => respondPush(r.id, 'APPROVED')}>Approve Login</Button>
                      <Button size="sm" variant="danger" onClick={() => respondPush(r.id, 'REJECTED')}>Reject</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      )}

      {subView === 'ALERTS' && (
        <SectionCard
          title="My Alerts & Notifications"
          action={
            <div className="flex gap-2">
              <select
                aria-label="Filter alert category"
                value={alertFilter}
                onChange={(e) => setAlertFilter(e.target.value)}
                className="min-h-[36px] px-2.5 text-xs border border-[#9E9E9E] rounded bg-white"
              >
                <option value="ALL">All Categories</option>
                <option value="PAYMENT">Payments</option>
                <option value="SECURITY">Security</option>
                <option value="TRANSACTION">Transactions</option>
                <option value="SYSTEM">Trade &amp; System</option>
              </select>
              <Button size="sm" variant="outline" onClick={markAllRead}>Mark all read</Button>
            </div>
          }
        >
          {alerts.length === 0 ? (
            <EmptyState icon={Bell} title="No notifications" description="Alerts generated from real backend events appear here." />
          ) : (
            <div className="divide-y divide-[#D7D8D6]">
              {alerts
                .filter((a) => alertFilter === 'ALL' || a.type === alertFilter)
                .map((a) => (
                  <div key={a.id} className={`py-3 flex justify-between gap-3 text-xs ${!a.is_read ? 'bg-[#F4F4F4]/40 px-2 -mx-2 rounded' : ''}`}>
                    <div>
                      <div className="font-semibold text-[#252525]">{a.title}</div>
                      <div className="text-[#555555] mt-0.5">{a.message}</div>
                      <div className="text-[11px] text-[#767676] mt-0.5">{a.type} • {formatDateTime(a.created_at)}</div>
                    </div>
                    {!a.is_read && (
                      <Button size="sm" variant="ghost" onClick={() => markAlertRead(a.id)}>
                        <Check className="w-3.5 h-3.5" /> Read
                      </Button>
                    )}
                  </div>
                ))}
            </div>
          )}
        </SectionCard>
      )}

      {subView === 'SUPPORT' && (
        <div className="space-y-5">
          <SectionCard title="Help Centre & Frequently Asked Questions">
            <FormInput
              label="Search Help Articles"
              placeholder="Search dual approval, security codes, RDC..."
              value={faqQuery}
              onChange={(e) => setFaqQuery(e.target.value)}
            />
            <div className="mt-4 divide-y divide-[#D7D8D6] text-xs">
              {FAQS.filter((f) => !faqQuery || f.q.toLowerCase().includes(faqQuery.toLowerCase())).map((f) => (
                <div key={f.q} className="py-3">
                  <div className="font-semibold text-[#252525]">{f.q}</div>
                  <div className="text-[#555555] mt-1">{f.a}</div>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Secure Support Messaging (Support Tickets)">
            <form onSubmit={createTicket} className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5 pb-5 border-b border-[#D7D8D6]">
              <FormInput label="Subject" required value={newTicket.subject} onChange={(e) => setNewTicket({ ...newTicket, subject: e.target.value })} />
              <FormSelect label="Category" value={newTicket.category} onChange={(e) => setNewTicket({ ...newTicket, category: e.target.value })}>
                <option value="GENERAL">General Inquiry</option>
                <option value="ACCOUNT_INQUIRY">Account &amp; FX</option>
                <option value="TRANSACTION_DISPUTE">Payment Dispute</option>
                <option value="FRAUD">Security / Fraud Escalation</option>
              </FormSelect>
              <div className="sm:col-span-2">
                <FormInput label="Message" required value={newTicket.description} onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" size="sm">Create Support Conversation</Button>
              </div>
            </form>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="divide-y divide-[#D7D8D6] border border-[#D7D8D6] rounded-[2px]">
                {tickets.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => openTicketThread(t)}
                    className={`w-full p-3 text-left hover:bg-[#F4F4F4] ${selectedTicket?.id === t.id ? 'bg-[#F4F4F4]' : ''}`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-[#252525]">{t.subject}</span>
                      <StatusBadge status={t.status} />
                    </div>
                    <div className="text-[#767676] mt-0.5">{t.ticket_number} • {t.category}</div>
                  </button>
                ))}
              </div>
              <div className="border border-[#D7D8D6] rounded-[2px] p-3 flex flex-col justify-between min-h-[200px]">
                {!selectedTicket ? (
                  <p className="text-[#767676] m-auto">Select a conversation to view messages.</p>
                ) : (
                  <>
                    <div className="space-y-2 max-h-56 overflow-y-auto mb-3">
                      {ticketThread.map((m) => (
                        <div key={m.id} className={`p-2 rounded ${m.sender_type === 'USER' ? 'bg-[#F4F4F4] ml-4' : 'bg-[#F4F4F4] mr-4'}`}>
                          <div className="font-semibold text-[11px]">{m.sender_type}</div>
                          <div>{m.message}</div>
                        </div>
                      ))}
                    </div>
                    <form onSubmit={replyTicket} className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Reply to support..."
                        value={replyBody}
                        onChange={(e) => setReplyBody(e.target.value)}
                        className="flex-1 px-2.5 py-1.5 border border-[#9E9E9E] rounded"
                      />
                      <Button type="submit" size="sm">Send</Button>
                    </form>
                  </>
                )}
              </div>
            </div>
          </SectionCard>
        </div>
      )}

      {subView === 'INFO' && (
        <SectionCard title="About HSBC Cnet & Legal Notices">
          <div className="space-y-3 text-xs text-[#555555] leading-relaxed">
            <p><strong>Application:</strong> {BANK_CONFIG.fullTitle} — Version {BANK_CONFIG.version}</p>
            <p><strong>Independent Identity &amp; Sandbox Disclosure:</strong> {BANK_CONFIG.disclaimer}</p>
            <p><strong>Terms &amp; Privacy:</strong> Corporate access is governed by organisation-assigned permissions, maker-checker approval rules, and server-side audit trails. Sensitive balances are not persisted in unencrypted local storage.</p>
          </div>
        </SectionCard>
      )}

      <NativeDialog open={logoutConfirmOpen} onClose={() => setLogoutConfirmOpen(false)} title="Confirm Secure Sign Out">
        <div className="space-y-4 text-xs">
          <p className="text-[#555555]">Signing out will revoke your active session token and clear in-memory corporate credentials.</p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setLogoutConfirmOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={logout}>Sign Out &amp; Revoke Session</Button>
          </div>
        </div>
      </NativeDialog>
    </div>
  );
};

const MenuRow: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
  badge?: string;
  onClick: () => void;
}> = ({ icon: Icon, title, desc, badge, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full py-3 flex items-center justify-between gap-3 hover:bg-[#FAFAFA] text-left px-1 rounded transition-colors"
  >
    <div className="flex items-center gap-3 min-w-0">
      <div className="w-8 h-8 rounded-[2px] bg-[#F4F4F4] border border-[#D7D8D6] flex items-center justify-center text-[#252525] shrink-0">
        <Icon className="w-4 h-4" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-[#252525] truncate">{title}</div>
        <div className="text-xs text-[#767676] truncate">{desc}</div>
      </div>
    </div>
    <div className="flex items-center gap-2 shrink-0">
      {badge && (
        <span className="px-2 py-0.5 rounded-full bg-[#DB0011] text-white text-[10px] font-semibold">{badge}</span>
      )}
      <ChevronRight className="w-4 h-4 text-[#9CA3AF]" aria-hidden="true" />
    </div>
  </button>
);
