import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Building2,
  Database,
  FileCheck,
  LayoutDashboard,
  Lock,
  LogOut,
  MessageSquare,
  Plus,
  RefreshCw,
  ScrollText,
  Shield,
  Sliders,
  Users,
} from 'lucide-react';
import { adminRequest, getAdminToken, setAdminToken } from './lib/api';
import { AdminBadge, AdminBrandMark, AdminButton, AdminCard, AdminDialog, AdminError } from './components/AdminPrimitives';
import { CORPORATE_PERMISSIONS, COUNTRY_CAPABILITIES, ROLE_PERMISSION_DEFAULTS } from '@shared/constants';
import { formatDateTime, formatFinancialCurrency } from '@shared/utils/formatters';

type AdminTab =
  | 'DASHBOARD'
  | 'ORGANISATIONS'
  | 'USERS'
  | 'POLICIES'
  | 'SANDBOX'
  | 'SUPPORT'
  | 'SECURITY'
  | 'AUDIT';

const ADMIN_ALLOWED_ROLES = ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'ORG_ADMIN', 'OPERATIONS', 'SUPPORT', 'SUPPORT_ADMIN', 'COMPLIANCE', 'AUDITOR'];

export function App() {
  const [adminUser, setAdminUser] = useState<any>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [loginId, setLoginId] = useState('super_admin');
  const [loginPass, setLoginPass] = useState('Admin@123');
  const [loginErr, setLoginErr] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const [tab, setTab] = useState<AdminTab>('DASHBOARD');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [notice, setNotice] = useState('');

  // Data stores
  const [summary, setSummary] = useState<any>(null);
  const [organisations, setOrganisations] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [policies, setPolicies] = useState<any[]>([]);
  const [sandboxAccounts, setSandboxAccounts] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [fraudReports, setFraudReports] = useState<any[]>([]);
  const [securityEvents, setSecurityEvents] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [approvals, setApprovals] = useState<any[]>([]);

  // Modals
  const [orgModalOpen, setOrgModalOpen] = useState(false);
  const [newOrg, setNewOrg] = useState({ name: '', registrationNumber: '', country: 'GB', baseCurrency: 'GBP' });

  const [userModalOpen, setUserModalOpen] = useState(false);
  const [newUser, setNewUser] = useState({
    username: '', email: '', phone: '+44 7700 909999', password: '', fullName: '',
    role: 'PAYMENT_INITIATOR', organisationId: 'org-meridian-in',
    permissions: [...ROLE_PERMISSION_DEFAULTS.PAYMENT_INITIATOR] as string[],
  });

  const [editUser, setEditUser] = useState<any>(null);

  const [policyModalOpen, setPolicyModalOpen] = useState(false);
  const [newPolicy, setNewPolicy] = useState({
    organisationId: 'org-meridian-in', name: '', currency: 'ALL',
    minAmount: '0', maxAmount: '50000', requiredApprovals: '2',
    makerCheckerEnforced: true, requireStepUpAuth: true,
  });

  // Sandbox adjustments
  const [balAdj, setBalAdj] = useState({ accountId: '', newAvailableBalance: '', reason: '' });
  const [injTxn, setInjTxn] = useState({ accountId: '', entryType: 'CREDIT', amount: '', counterpartyName: '', description: '', reason: '' });
  const [auditFilter, setAuditFilter] = useState('');

  const verifySession = useCallback(async () => {
    const token = getAdminToken();
    if (!token) {
      setAuthChecking(false);
      return;
    }
    try {
      const res = await adminRequest<any>('/api/auth/corporate-session');
      if (ADMIN_ALLOWED_ROLES.includes(res.user.role)) {
        setAdminUser(res.user);
      } else {
        setAdminToken(null);
      }
    } catch {
      setAdminToken(null);
    } finally {
      setAuthChecking(false);
    }
  }, []);

  useEffect(() => {
    verifySession();
  }, [verifySession]);

  const loadAllAdminData = useCallback(async () => {
    if (!adminUser) return;
    setLoading(true);
    setErr('');
    try {
      const [sumRes, orgRes, usrRes, polRes, sbxRes, tckRes, frdRes, secRes, audRes, appRes] = await Promise.all([
        adminRequest<any>('/api/admin/enterprise-summary'),
        adminRequest<any>('/api/admin/organisations'),
        adminRequest<any>('/api/admin/users'),
        adminRequest<any>('/api/admin/policies'),
        adminRequest<any>('/api/admin/sandbox/accounts'),
        adminRequest<any>('/api/admin/tickets'),
        adminRequest<any>('/api/admin/fraud-reports'),
        adminRequest<any>('/api/admin/security-events'),
        adminRequest<any>('/api/admin/audit-logs'),
        adminRequest<any>('/api/admin/approvals'),
      ]);
      setSummary(sumRes.summary);
      setOrganisations(orgRes.organisations || []);
      setUsers(usrRes.users || []);
      setPolicies(polRes.policies || []);
      const accs = sbxRes.accounts || [];
      setSandboxAccounts(accs);
      if (accs[0] && !balAdj.accountId) {
        setBalAdj((p) => ({ ...p, accountId: accs[0].id }));
        setInjTxn((p) => ({ ...p, accountId: accs[0].id }));
      }
      setTickets(tckRes.tickets || []);
      setFraudReports(frdRes.reports || []);
      setSecurityEvents(secRes.events || []);
      setAuditLogs(audRes.logs || []);
      setApprovals(appRes.approvals || []);
    } catch (e: any) {
      setErr(e?.message || 'Unable to load administrative records.');
    } finally {
      setLoading(false);
    }
  }, [adminUser, balAdj.accountId]);

  useEffect(() => {
    loadAllAdminData();
  }, [loadAllAdminData]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginErr('');
    setLoginLoading(true);
    try {
      const res = await adminRequest<any>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier: loginId.trim(), password: loginPass }),
      });
      if (!ADMIN_ALLOWED_ROLES.includes(res.user.role)) {
        throw new Error('Access denied: Administrative role required for the Enterprise Admin Console.');
      }
      setAdminToken(res.accessToken);
      setAdminUser(res.user);
    } catch (e: any) {
      setLoginErr(e?.message || 'Admin login failed.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    setAdminToken(null);
    setAdminUser(null);
  };

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    await adminRequest('/api/admin/organisations', { method: 'POST', body: JSON.stringify(newOrg) });
    setOrgModalOpen(false);
    setNewOrg({ name: '', registrationNumber: '', country: 'GB', baseCurrency: 'GBP' });
    setNotice('Organisation created and recorded in immutable audit log.');
    await loadAllAdminData();
  };

  const toggleOrgStatus = async (org: any) => {
    const nextStatus = org.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    await adminRequest(`/api/admin/organisations/${org.id}`, {
      method: 'PUT',
      body: JSON.stringify({ status: nextStatus }),
    });
    await loadAllAdminData();
  };

  const toggleOrgModule = async (org: any, modKey: string) => {
    const nextModules = { ...org.modules, [modKey]: !org.modules[modKey] };
    await adminRequest(`/api/admin/organisations/${org.id}`, {
      method: 'PUT',
      body: JSON.stringify({ modules: nextModules }),
    });
    await loadAllAdminData();
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    await adminRequest('/api/admin/users', { method: 'POST', body: JSON.stringify(newUser) });
    setUserModalOpen(false);
    setNotice(`User ${newUser.username} provisioned with ${newUser.role} permissions.`);
    await loadAllAdminData();
  };

  const handleUpdateUser = async (payload: any) => {
    await adminRequest(`/api/admin/users/${payload.id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    setEditUser(null);
    setNotice('User permissions/security state updated and audited.');
    await loadAllAdminData();
  };

  const handleCreatePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    await adminRequest('/api/admin/policies', {
      method: 'POST',
      body: JSON.stringify({
        ...newPolicy,
        minAmount: Number(newPolicy.minAmount),
        maxAmount: Number(newPolicy.maxAmount),
        requiredApprovals: Number(newPolicy.requiredApprovals),
      }),
    });
    setPolicyModalOpen(false);
    setNotice('Approval policy created.');
    await loadAllAdminData();
  };

  const togglePolicyActive = async (p: any) => {
    await adminRequest(`/api/admin/policies/${p.id}`, {
      method: 'PUT',
      body: JSON.stringify({ isActive: !p.is_active }),
    });
    await loadAllAdminData();
  };

  const handleSandboxBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setNotice('');
    try {
      await adminRequest('/api/admin/sandbox/accounts/adjust-balance', {
        method: 'POST',
        body: JSON.stringify({
          accountId: balAdj.accountId,
          newAvailableBalance: Number(balAdj.newAvailableBalance),
          reason: balAdj.reason,
        }),
      });
      setNotice('Sandbox balance adjusted and recorded in audit log.');
      setBalAdj((p) => ({ ...p, newAvailableBalance: '', reason: '' }));
      await loadAllAdminData();
    } catch (e: any) {
      setErr(e?.message);
    }
  };

  const handleSandboxTxn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setNotice('');
    try {
      const res = await adminRequest<any>('/api/admin/sandbox/transactions', {
        method: 'POST',
        body: JSON.stringify({
          ...injTxn,
          amount: Number(injTxn.amount),
        }),
      });
      setNotice(`Sandbox transaction ${res.reference} injected into ledger.`);
      setInjTxn((p) => ({ ...p, amount: '', counterpartyName: '', description: '', reason: '' }));
      await loadAllAdminData();
    } catch (e: any) {
      setErr(e?.message);
    }
  };

  const resolveTicket = async (id: string, status: string) => {
    await adminRequest(`/api/admin/tickets/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, resolutionNote: `Updated to ${status} by ${adminUser.full_name}` }),
    });
    await loadAllAdminData();
  };

  if (authChecking) {
    return <div className="min-h-dvh flex items-center justify-center text-xs text-[#6B7280]">Verifying administrative session...</div>;
  }

  if (!adminUser) {
    return (
      <main className="min-h-dvh bg-[#14233C] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-lg border border-[#E2E6EC] shadow-xl p-6 sm:p-8">
          <div className="flex items-center gap-3 pb-4 border-b border-[#E2E6EC]">
            <div className="w-10 h-10 rounded-md bg-[#14233C] flex items-center justify-center">
              <AdminBrandMark size={28} />
            </div>
            <div>
              <h1 className="text-base font-bold text-[#14233C]">Coralgenz Global — HSBCnet Admin</h1>
              <p className="text-xs text-[#6B7280]">Independent Administration &amp; Governance Console</p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="mt-5 space-y-4">
            <div>
              <label htmlFor="admin-user" className="block text-xs font-semibold text-[#181C20] mb-1">Admin Username</label>
              <input
                id="admin-user"
                type="text"
                autoComplete="username"
                required
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                className="w-full min-h-[42px] px-3 text-sm border border-[#CBD2DC] rounded-md"
              />
            </div>
            <div>
              <label htmlFor="admin-pass" className="block text-xs font-semibold text-[#181C20] mb-1">Passphrase</label>
              <input
                id="admin-pass"
                type="password"
                autoComplete="current-password"
                required
                value={loginPass}
                onChange={(e) => setLoginPass(e.target.value)}
                className="w-full min-h-[42px] px-3 text-sm border border-[#CBD2DC] rounded-md"
              />
              <p className="text-[11px] text-[#6B7280] mt-1">Sandbox default: <code>super_admin</code> / <code>Admin@123</code></p>
            </div>
            {loginErr && <AdminError message={loginErr} />}
            <AdminButton type="submit" loading={loginLoading} className="w-full">
              Authenticate to Admin Console
            </AdminButton>
          </form>
        </div>
      </main>
    );
  }

  const navItems: { id: AdminTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'DASHBOARD', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'ORGANISATIONS', label: 'Organisations', icon: Building2 },
    { id: 'USERS', label: 'Users & Roles', icon: Users },
    { id: 'POLICIES', label: 'Approval Policies', icon: Sliders },
    { id: 'SANDBOX', label: 'Sandbox Data', icon: Database },
    { id: 'SUPPORT', label: 'Support & Fraud', icon: MessageSquare },
    { id: 'SECURITY', label: 'Security Events', icon: Shield },
    { id: 'AUDIT', label: 'Audit Logs', icon: ScrollText },
  ];

  return (
    <div className="min-h-dvh bg-[#F5F6F8] flex flex-col lg:flex-row">
      {/* Admin Sidebar */}
      <aside className="lg:w-64 bg-[#14233C] text-white flex flex-col shrink-0">
        <div className="h-16 px-5 flex items-center gap-3 border-b border-white/10">
          <AdminBrandMark size={28} />
          <div className="min-w-0">
            <div className="text-sm font-bold truncate">Enterprise Admin</div>
            <div className="text-[11px] text-white/65 truncate">{adminUser.role}</div>
          </div>
        </div>
        <nav aria-label="Admin Navigation" className="p-3 flex lg:flex-col gap-1 overflow-x-auto">
          {navItems.map((n) => {
            const Icon = n.icon;
            const active = tab === n.id;
            return (
              <button
                key={n.id}
                type="button"
                aria-current={active ? 'page' : undefined}
                onClick={() => setTab(n.id)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                  active ? 'bg-[#C8102E] text-white' : 'text-white/80 hover:bg-white/10'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{n.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="mt-auto p-4 border-t border-white/10 hidden lg:flex items-center justify-between text-xs">
          <span className="truncate text-white/80">{adminUser.full_name}</span>
          <button type="button" onClick={handleLogout} aria-label="Sign out" className="p-1.5 rounded hover:bg-white/10">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-[#E2E6EC] h-14 px-4 sm:px-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs">
            <span className="px-2 py-0.5 rounded bg-[#FEF7EC] border border-[#FCD9A5] text-[#9A4A06] font-semibold">
              SANDBOX GOVERNANCE CONSOLE
            </span>
            <span className="text-[#6B7280] hidden sm:inline">All changes are immutably logged</span>
          </div>
          <div className="flex items-center gap-2">
            <AdminButton size="sm" variant="outline" loading={loading} onClick={loadAllAdminData}>
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </AdminButton>
            <AdminButton size="sm" variant="outline" className="lg:hidden" onClick={handleLogout}>
              Sign Out
            </AdminButton>
          </div>
        </header>

        <main className="p-4 sm:p-6 space-y-5 max-w-[1400px] w-full mx-auto">
          {notice && <div className="p-3 rounded-md bg-[#ECFDF3] border border-[#ABEFC6] text-xs text-[#0E6235] font-medium">{notice}</div>}
          {err && <AdminError message={err} />}

          {/* DASHBOARD */}
          {tab === 'DASHBOARD' && summary && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: 'Organisations', val: summary.organisations },
                  { label: 'Corporate Users', val: summary.users },
                  { label: 'Active Sessions', val: summary.activeSessions },
                  { label: 'Managed Accounts', val: summary.accounts },
                  { label: 'Pending Approvals', val: summary.pendingApprovals },
                  { label: 'Payment Requests', val: summary.totalPayments },
                  { label: 'Open Support Tickets', val: summary.openTickets },
                  { label: 'Security Events', val: summary.securityEvents },
                ].map((k) => (
                  <div key={k.label} className="bg-white border border-[#E2E6EC] rounded-lg p-4">
                    <div className="text-xs text-[#6B7280]">{k.label}</div>
                    <div className="text-2xl font-bold text-[#14233C] tabular-nums mt-1">{k.val}</div>
                  </div>
                ))}
              </div>

              <AdminCard title="Recent Payment Approval Queue" subtitle="Live corporate payment instructions across organisations">
                <div className="divide-y divide-[#E2E6EC] text-xs">
                  {approvals.slice(0, 8).map((a) => (
                    <div key={a.id} className="py-2.5 flex flex-wrap justify-between items-center gap-2">
                      <div>
                        <span className="font-semibold text-[#181C20]">{a.reference}</span> — {a.beneficiary_name} ({a.organisation_name})
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold tabular-nums">{formatFinancialCurrency(a.amount, a.currency)}</span>
                        <AdminBadge status={a.status} />
                      </div>
                    </div>
                  ))}
                </div>
              </AdminCard>
            </div>
          )}

          {/* ORGANISATIONS */}
          {tab === 'ORGANISATIONS' && (
            <AdminCard
              title="Organisation Management"
              subtitle="Configure corporate entities, countries, currencies, and enabled modules"
              action={<AdminButton size="sm" onClick={() => setOrgModalOpen(true)}><Plus className="w-3.5 h-3.5" /> New Organisation</AdminButton>}
            >
              <div className="space-y-4">
                {organisations.map((org) => (
                  <div key={org.id} className="p-4 border border-[#E2E6EC] rounded-md space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-[#181C20]">{org.name}</span>
                          <AdminBadge status={org.status} />
                          <span className="text-[11px] px-2 py-0.5 rounded bg-[#F5F6F8] border border-[#E2E6EC]">Sandbox</span>
                        </div>
                        <div className="text-xs text-[#6B7280] mt-0.5">
                          Reg: {org.registration_number} • Country: {org.country} • Base Currency: {org.base_currency}
                        </div>
                      </div>
                      <AdminButton size="sm" variant={org.status === 'ACTIVE' ? 'danger' : 'secondary'} onClick={() => toggleOrgStatus(org)}>
                        {org.status === 'ACTIVE' ? 'Suspend Entity' : 'Activate Entity'}
                      </AdminButton>
                    </div>
                    <div className="pt-2 border-t border-[#E2E6EC]">
                      <div className="text-[11px] font-semibold text-[#6B7280] uppercase mb-2">Enabled Modules</div>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(org.modules || {}).map(([k, enabled]) => (
                          <button
                            key={k}
                            type="button"
                            onClick={() => toggleOrgModule(org, k)}
                            className={`px-2.5 py-1 rounded text-xs font-medium border ${
                              enabled ? 'bg-[#ECFDF3] border-[#ABEFC6] text-[#0E6235]' : 'bg-[#F5F6F8] border-[#E2E6EC] text-[#6B7280]'
                            }`}
                          >
                            {k}: {enabled ? 'ON' : 'OFF'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </AdminCard>
          )}

          {/* USERS & ROLES */}
          {tab === 'USERS' && (
            <AdminCard
              title="Users, Roles & Granular Permissions"
              action={<AdminButton size="sm" onClick={() => setUserModalOpen(true)}><Plus className="w-3.5 h-3.5" /> Create User</AdminButton>}
            >
              <div className="divide-y divide-[#E2E6EC] text-xs">
                {users.map((u) => (
                  <div key={u.id} className="py-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-[#181C20]">{u.full_name}</span>
                        <span className="px-2 py-0.5 rounded bg-[#14233C] text-white text-[10px] font-semibold">{u.role}</span>
                        <AdminBadge status={u.is_locked ? 'LOCKED' : u.is_active ? 'ACTIVE' : 'SUSPENDED'} />
                      </div>
                      <div className="text-[#6B7280] mt-0.5">
                        @{u.username} • {u.email} • {u.organisation_name || 'Global'} • {u.permissions?.length || 0} permissions
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <AdminButton size="sm" variant="outline" onClick={() => setEditUser({ ...u })}>Edit Role / Perms</AdminButton>
                      {u.is_locked === 1 && (
                        <AdminButton size="sm" variant="secondary" onClick={() => handleUpdateUser({ id: u.id, isLocked: false })}>Unlock</AdminButton>
                      )}
                      <AdminButton
                        size="sm"
                        variant={u.is_active ? 'danger' : 'secondary'}
                        onClick={() => handleUpdateUser({ id: u.id, isActive: !u.is_active })}
                      >
                        {u.is_active ? 'Suspend' : 'Activate'}
                      </AdminButton>
                      <AdminButton size="sm" variant="outline" onClick={() => handleUpdateUser({ id: u.id, resetPin: true })}>
                        Reset Security PIN
                      </AdminButton>
                    </div>
                  </div>
                ))}
              </div>
            </AdminCard>
          )}

          {/* APPROVAL POLICIES */}
          {tab === 'POLICIES' && (
            <AdminCard
              title="Authorisation & Maker-Checker Policies"
              subtitle="Single, dual, and multi-level approval thresholds enforced by backend"
              action={<AdminButton size="sm" onClick={() => setPolicyModalOpen(true)}><Plus className="w-3.5 h-3.5" /> Add Policy</AdminButton>}
            >
              <div className="divide-y divide-[#E2E6EC] text-xs">
                {policies.map((p) => (
                  <div key={p.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-[#181C20]">{p.name}</span>
                        <AdminBadge status={p.is_active ? 'ACTIVE' : 'SUSPENDED'} />
                      </div>
                      <div className="text-[#6B7280] mt-0.5">
                        {p.organisation_name} • Currency: {p.currency} • Range: {p.min_amount.toLocaleString()} – {p.max_amount.toLocaleString()} •{' '}
                        <strong>{p.required_approvals} approval(s)</strong> • Maker-Checker: {p.maker_checker_enforced ? 'Enforced' : 'Off'}
                      </div>
                    </div>
                    <AdminButton size="sm" variant="outline" onClick={() => togglePolicyActive(p)}>
                      {p.is_active ? 'Disable' : 'Enable'}
                    </AdminButton>
                  </div>
                ))}
              </div>
            </AdminCard>
          )}

          {/* SANDBOX DATA MANAGEMENT */}
          {tab === 'SANDBOX' && (
            <div className="space-y-5">
              <div className="p-3.5 rounded-md bg-[#FEF7EC] border border-[#FCD9A5] text-xs text-[#9A4A06] flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                  <strong>SANDBOX DEMONSTRATION ENVIRONMENT:</strong> Adjustments below modify internal sandbox balances and ledger entries only. They do not represent genuine bank balances or external clearing movements.
                </span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <AdminCard title="Sandbox Account Balance Override">
                  <form onSubmit={handleSandboxBalance} className="space-y-3 text-xs">
                    <div>
                      <label className="block font-semibold mb-1">Target Sandbox Account</label>
                      <select
                        value={balAdj.accountId}
                        onChange={(e) => setBalAdj({ ...balAdj, accountId: e.target.value })}
                        className="w-full min-h-[40px] px-3 border border-[#CBD2DC] rounded-md bg-white"
                      >
                        {sandboxAccounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.organisation_name} — {a.account_name} ({formatFinancialCurrency(a.available_balance, a.currency)})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block font-semibold mb-1">New Sandbox Balance</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={balAdj.newAvailableBalance}
                        onChange={(e) => setBalAdj({ ...balAdj, newAvailableBalance: e.target.value })}
                        className="w-full min-h-[40px] px-3 border border-[#CBD2DC] rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1">Mandatory Audit Reason</label>
                      <input
                        type="text"
                        required
                        minLength={5}
                        placeholder="e.g. Sandbox treasury liquidity demonstration funding"
                        value={balAdj.reason}
                        onChange={(e) => setBalAdj({ ...balAdj, reason: e.target.value })}
                        className="w-full min-h-[40px] px-3 border border-[#CBD2DC] rounded-md"
                      />
                    </div>
                    <AdminButton type="submit">Apply Audited Sandbox Override</AdminButton>
                  </form>
                </AdminCard>

                <AdminCard title="Inject Sandbox Ledger Transaction">
                  <form onSubmit={handleSandboxTxn} className="space-y-3 text-xs">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block font-semibold mb-1">Account</label>
                        <select
                          value={injTxn.accountId}
                          onChange={(e) => setInjTxn({ ...injTxn, accountId: e.target.value })}
                          className="w-full min-h-[40px] px-3 border border-[#CBD2DC] rounded-md bg-white"
                        >
                          {sandboxAccounts.map((a) => (
                            <option key={a.id} value={a.id}>{a.account_name} ({a.currency})</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">Entry Type</label>
                        <select
                          value={injTxn.entryType}
                          onChange={(e) => setInjTxn({ ...injTxn, entryType: e.target.value })}
                          className="w-full min-h-[40px] px-3 border border-[#CBD2DC] rounded-md bg-white"
                        >
                          <option value="CREDIT">CREDIT (+)</option>
                          <option value="DEBIT">DEBIT (-)</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block font-semibold mb-1">Amount</label>
                        <input type="number" step="0.01" required value={injTxn.amount} onChange={(e) => setInjTxn({ ...injTxn, amount: e.target.value })} className="w-full min-h-[40px] px-3 border border-[#CBD2DC] rounded-md" />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">Counterparty</label>
                        <input type="text" required value={injTxn.counterpartyName} onChange={(e) => setInjTxn({ ...injTxn, counterpartyName: e.target.value })} className="w-full min-h-[40px] px-3 border border-[#CBD2DC] rounded-md" />
                      </div>
                    </div>
                    <div>
                      <label className="block font-semibold mb-1">Description</label>
                      <input type="text" required value={injTxn.description} onChange={(e) => setInjTxn({ ...injTxn, description: e.target.value })} className="w-full min-h-[40px] px-3 border border-[#CBD2DC] rounded-md" />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1">Mandatory Audit Reason</label>
                      <input type="text" required value={injTxn.reason} onChange={(e) => setInjTxn({ ...injTxn, reason: e.target.value })} className="w-full min-h-[40px] px-3 border border-[#CBD2DC] rounded-md" />
                    </div>
                    <AdminButton type="submit" variant="secondary">Record Sandbox Transaction</AdminButton>
                  </form>
                </AdminCard>
              </div>
            </div>
          )}

          {/* SUPPORT & FRAUD */}
          {tab === 'SUPPORT' && (
            <div className="space-y-5">
              <AdminCard title="Corporate Support Tickets">
                <div className="divide-y divide-[#E2E6EC] text-xs">
                  {tickets.map((t) => (
                    <div key={t.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-[#181C20]">{t.subject}</span>
                          <AdminBadge status={t.status} />
                        </div>
                        <div className="text-[#6B7280] mt-0.5">{t.ticket_number} • {t.customer_name} • {t.category}</div>
                      </div>
                      <div className="flex gap-2">
                        {t.status !== 'RESOLVED' && (
                          <AdminButton size="sm" onClick={() => resolveTicket(t.id, 'RESOLVED')}>Mark Resolved</AdminButton>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </AdminCard>

              <AdminCard title="Fraud Case Reports (Sandbox)">
                {fraudReports.length === 0 ? (
                  <p className="text-xs text-[#6B7280]">No fraud reports filed.</p>
                ) : (
                  <div className="divide-y divide-[#E2E6EC] text-xs">
                    {fraudReports.map((f) => (
                      <div key={f.id} className="py-3 flex justify-between items-center">
                        <div>
                          <div className="font-semibold text-[#181C20]">{f.reference} — Payment {f.payment_reference}</div>
                          <div className="text-[#6B7280]">Reporter: {f.reporter_name} • Reason: {f.reason}</div>
                        </div>
                        <AdminBadge status={f.status} />
                      </div>
                    ))}
                  </div>
                )}
              </AdminCard>
            </div>
          )}

          {/* SECURITY EVENTS */}
          {tab === 'SECURITY' && (
            <AdminCard title="Security & Authentication Events">
              <div className="divide-y divide-[#E2E6EC] text-xs">
                {securityEvents.map((ev) => (
                  <div key={ev.id} className="py-2.5 flex justify-between items-center gap-2">
                    <div>
                      <span className="font-semibold text-[#181C20]">{ev.action}</span> — {ev.actor_username || ev.actor_role} ({ev.resource})
                      <div className="text-[#6B7280]">{ev.details}</div>
                    </div>
                    <span className="text-[#6B7280] shrink-0">{formatDateTime(ev.created_at)}</span>
                  </div>
                ))}
              </div>
            </AdminCard>
          )}

          {/* IMMUTABLE AUDIT LOGS */}
          {tab === 'AUDIT' && (
            <AdminCard
              title="Immutable Regulatory Audit Log"
              action={
                <input
                  type="search"
                  placeholder="Filter action, actor, resource..."
                  value={auditFilter}
                  onChange={(e) => setAuditFilter(e.target.value)}
                  className="min-h-[36px] px-3 text-xs border border-[#CBD2DC] rounded-md"
                />
              }
            >
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-[#F5F6F8] border-b border-[#E2E6EC]">
                    <tr>
                      <th className="py-2 px-3">Timestamp</th>
                      <th className="py-2 px-3">Actor</th>
                      <th className="py-2 px-3">Action</th>
                      <th className="py-2 px-3">Resource</th>
                      <th className="py-2 px-3">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E6EC]">
                    {auditLogs
                      .filter(
                        (l) =>
                          !auditFilter ||
                          l.action.toLowerCase().includes(auditFilter.toLowerCase()) ||
                          (l.actor_username || '').toLowerCase().includes(auditFilter.toLowerCase()) ||
                          (l.details || '').toLowerCase().includes(auditFilter.toLowerCase())
                      )
                      .map((l) => (
                        <tr key={l.id}>
                          <td className="py-2 px-3 whitespace-nowrap text-[#6B7280]">{formatDateTime(l.created_at)}</td>
                          <td className="py-2 px-3">{l.actor_username || l.actor_role}</td>
                          <td className="py-2 px-3 font-semibold text-[#14233C]">{l.action}</td>
                          <td className="py-2 px-3">{l.resource}</td>
                          <td className="py-2 px-3 text-[#4B5563] max-w-md truncate">{l.details}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </AdminCard>
          )}
        </main>
      </div>

      {/* Create Org Modal */}
      <AdminDialog open={orgModalOpen} onClose={() => setOrgModalOpen(false)} title="Create Corporate Organisation">
        <form onSubmit={handleCreateOrg} className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold mb-1">Organisation Legal Name</label>
            <input type="text" required value={newOrg.name} onChange={(e) => setNewOrg({ ...newOrg, name: e.target.value })} className="w-full min-h-[40px] px-3 border border-[#CBD2DC] rounded-md" />
          </div>
          <div>
            <label className="block font-semibold mb-1">Registration Number</label>
            <input type="text" required value={newOrg.registrationNumber} onChange={(e) => setNewOrg({ ...newOrg, registrationNumber: e.target.value })} className="w-full min-h-[40px] px-3 border border-[#CBD2DC] rounded-md" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold mb-1">Country</label>
              <select value={newOrg.country} onChange={(e) => setNewOrg({ ...newOrg, country: e.target.value })} className="w-full min-h-[40px] px-3 border border-[#CBD2DC] rounded-md bg-white">
                {Object.values(COUNTRY_CAPABILITIES).map((c) => (
                  <option key={c.code} value={c.code}>{c.name} ({c.code})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold mb-1">Base Currency</label>
              <select value={newOrg.baseCurrency} onChange={(e) => setNewOrg({ ...newOrg, baseCurrency: e.target.value })} className="w-full min-h-[40px] px-3 border border-[#CBD2DC] rounded-md bg-white">
                {['GBP', 'USD', 'EUR', 'INR', 'SGD', 'AED'].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <AdminButton type="submit" className="w-full">Create Organisation</AdminButton>
        </form>
      </AdminDialog>

      {/* Create User Modal */}
      <AdminDialog open={userModalOpen} onClose={() => setUserModalOpen(false)} title="Provision Corporate User">
        <form onSubmit={handleCreateUser} className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block font-semibold mb-1">Username</label><input type="text" required value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })} className="w-full min-h-[40px] px-3 border border-[#CBD2DC] rounded-md" /></div>
            <div><label className="block font-semibold mb-1">Full Name</label><input type="text" required value={newUser.fullName} onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })} className="w-full min-h-[40px] px-3 border border-[#CBD2DC] rounded-md" /></div>
            <div><label className="block font-semibold mb-1">Email</label><input type="email" required value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} className="w-full min-h-[40px] px-3 border border-[#CBD2DC] rounded-md" /></div>
            <div><label className="block font-semibold mb-1">Initial Password</label><input type="password" required minLength={8} value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} className="w-full min-h-[40px] px-3 border border-[#CBD2DC] rounded-md" /></div>
            <div>
              <label className="block font-semibold mb-1">Organisation</label>
              <select value={newUser.organisationId} onChange={(e) => setNewUser({ ...newUser, organisationId: e.target.value })} className="w-full min-h-[40px] px-3 border border-[#CBD2DC] rounded-md bg-white">
                {organisations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block font-semibold mb-1">Role</label>
              <select
                value={newUser.role}
                onChange={(e) => {
                  const role = e.target.value;
                  setNewUser({ ...newUser, role, permissions: [...(ROLE_PERMISSION_DEFAULTS[role] || [])] });
                }}
                className="w-full min-h-[40px] px-3 border border-[#CBD2DC] rounded-md bg-white"
              >
                {Object.keys(ROLE_PERMISSION_DEFAULTS).map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>
          <AdminButton type="submit" className="w-full">Create User</AdminButton>
        </form>
      </AdminDialog>

      {/* Edit User Permissions Modal */}
      <AdminDialog open={!!editUser} onClose={() => setEditUser(null)} title={`Edit Role & Permissions: ${editUser?.full_name}`}>
        {editUser && (
          <div className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold mb-1">Role</label>
              <select
                value={editUser.role}
                onChange={(e) => {
                  const role = e.target.value;
                  setEditUser({ ...editUser, role, permissions: [...(ROLE_PERMISSION_DEFAULTS[role] || editUser.permissions)] });
                }}
                className="w-full min-h-[40px] px-3 border border-[#CBD2DC] rounded-md bg-white"
              >
                {Object.keys(ROLE_PERMISSION_DEFAULTS).map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <div className="font-semibold mb-2">Granular Permissions</div>
              <div className="grid grid-cols-2 gap-2">
                {CORPORATE_PERMISSIONS.map((perm) => {
                  const checked = (editUser.permissions || []).includes(perm);
                  return (
                    <label key={perm} className="flex items-center gap-2 p-1.5 rounded border border-[#E2E6EC]">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          const cur = editUser.permissions || [];
                          setEditUser({
                            ...editUser,
                            permissions: checked ? cur.filter((x: string) => x !== perm) : [...cur, perm],
                          });
                        }}
                        className="accent-[#C8102E]"
                      />
                      <span>{perm}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            <AdminButton className="w-full" onClick={() => handleUpdateUser({ id: editUser.id, role: editUser.role, permissions: editUser.permissions })}>
              Save Role &amp; Permissions
            </AdminButton>
          </div>
        )}
      </AdminDialog>

      {/* Create Policy Modal */}
      <AdminDialog open={policyModalOpen} onClose={() => setPolicyModalOpen(false)} title="Create Approval Policy">
        <form onSubmit={handleCreatePolicy} className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold mb-1">Organisation</label>
            <select value={newPolicy.organisationId} onChange={(e) => setNewPolicy({ ...newPolicy, organisationId: e.target.value })} className="w-full min-h-[40px] px-3 border border-[#CBD2DC] rounded-md bg-white">
              {organisations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
          <div><label className="block font-semibold mb-1">Policy Name</label><input type="text" required value={newPolicy.name} onChange={(e) => setNewPolicy({ ...newPolicy, name: e.target.value })} className="w-full min-h-[40px] px-3 border border-[#CBD2DC] rounded-md" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block font-semibold mb-1">Min Amount</label><input type="number" required value={newPolicy.minAmount} onChange={(e) => setNewPolicy({ ...newPolicy, minAmount: e.target.value })} className="w-full min-h-[40px] px-3 border border-[#CBD2DC] rounded-md" /></div>
            <div><label className="block font-semibold mb-1">Max Amount</label><input type="number" required value={newPolicy.maxAmount} onChange={(e) => setNewPolicy({ ...newPolicy, maxAmount: e.target.value })} className="w-full min-h-[40px] px-3 border border-[#CBD2DC] rounded-md" /></div>
            <div><label className="block font-semibold mb-1">Currency</label><input type="text" value={newPolicy.currency} onChange={(e) => setNewPolicy({ ...newPolicy, currency: e.target.value })} className="w-full min-h-[40px] px-3 border border-[#CBD2DC] rounded-md" /></div>
            <div><label className="block font-semibold mb-1">Required Approvals</label><input type="number" min={1} max={5} value={newPolicy.requiredApprovals} onChange={(e) => setNewPolicy({ ...newPolicy, requiredApprovals: e.target.value })} className="w-full min-h-[40px] px-3 border border-[#CBD2DC] rounded-md" /></div>
          </div>
          <label className="flex items-center gap-2"><input type="checkbox" checked={newPolicy.makerCheckerEnforced} onChange={(e) => setNewPolicy({ ...newPolicy, makerCheckerEnforced: e.target.checked })} className="accent-[#C8102E]" /> Enforce Maker-Checker Separation</label>
          <AdminButton type="submit" className="w-full">Save Approval Policy</AdminButton>
        </form>
      </AdminDialog>
    </div>
  );
}

export default App;
