import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Clock,
  Eye,
  EyeOff,
  FileKey2,
  Fingerprint,
  HelpCircle,
  Info,
  KeyRound,
  Lock,
  RefreshCw,
  Shield,
  ShieldAlert,
  Ship,
  Smartphone,
} from 'lucide-react';
import { useAuth, AuthUser } from '../../context/AuthContext';
import { apiRequest, ApiError } from '../../lib/api';
import { BrandMark } from '../../components/ui/BrandMark';
import { BankingHeader } from '../../components/ui/BankingHeader';
import { Button, FormInput, NativeDialog } from '../../components/ui/Primitives';
import {
  detectPasskeySupport,
  parseRequestOptions,
  serializeCredential,
  signalUnknownCredentialIfSupported,
} from '../../lib/webauthn';
import { BANK_CONFIG } from '@shared/constants';

type AuthStep =
  | 'WELCOME'
  | 'INFO_MENU'
  | 'INFO_DETAIL'
  | 'SELECT_METHOD'
  | 'PASSWORD'
  | 'PIN'
  | 'PIN_RESET_CODE'
  | 'PIN_RESET_NEW'
  | 'PIN_RESET_SUCCESS'
  | 'SECURITY_CODE'
  | 'MOBILE_PUSH'
  | 'PASSKEY'
  | 'SUCCESS'
  | 'FAILED'
  | 'LOCKED_ACCOUNT'
  | 'GENERATE_CODE_USERNAME'
  | 'GENERATE_CODE_ACTION'
  | 'GENERATE_CODE_VERIFY'
  | 'GENERATE_CODE_RESULT'
  | 'TRADE_TRACKER_PUBLIC';

type SecurityCodeAction = 'LOGIN' | 'REAUTHENTICATE' | 'AUTHORISATION';

interface LookupProfile {
  username: string;
  fullName: string;
  organisationName: string;
  country: string;
  methods: {
    password: boolean;
    securityPin: boolean;
    mobileAuth: boolean;
    securityCode: boolean;
    passkey: boolean;
    passkeyCount: number;
  };
}

/** Masked 6-slot PIN indicator replicating the HSBCnet Mobile PIN input UI */
const PinSlotDisplay: React.FC<{ value: string; length?: number }> = ({ value, length = 6 }) => (
  <div aria-hidden="true" className="grid grid-cols-6 gap-2.5 max-w-[260px] mx-auto pt-1 pb-2">
    {Array.from({ length }).map((_, idx) => {
      const filled = idx < value.length;
      return (
        <div
          key={idx}
          className={`h-10 flex items-center justify-center border-b-2 text-lg font-semibold ${
            filled ? 'border-[#252B30] text-[#252B30]' : 'border-[#B4BCC2] text-transparent'
          }`}
        >
          {filled ? '•' : '·'}
        </div>
      );
    })}
  </div>
);

export const EntryExperience: React.FC = () => {
  const { phase, initError, retryInit, completeLogin, user, unlockSession, logout } = useAuth();

  const [step, setStep] = useState<AuthStep>('WELCOME');
  const [username, setUsername] = useState('');
  const [usernameTouched, setUsernameTouched] = useState(false);
  const [usernameError, setUsernameError] = useState('');
  const [lookup, setLookup] = useState<LookupProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  // Remembered usernames on this browser (usernames only, never secrets/PINs)
  const [rememberedUsers, setRememberedUsers] = useState<string[]>(() => {
    try {
      const raw = sessionStorage.getItem('hsbc_cnet_recent_ids');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pin, setPin] = useState('');
  const [secCode, setSecCode] = useState('');

  // Reset Forgotten / Locked PIN state
  const [resetMaskedEmail, setResetMaskedEmail] = useState('');
  const [sandboxResetHint, setSandboxResetHint] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newResetPin, setNewResetPin] = useState('');
  const [confirmResetPin, setConfirmResetPin] = useState('');

  // Generate Security Code Flow
  const [genUsername, setGenUsername] = useState('');
  const [genAction, setGenAction] = useState<SecurityCodeAction>('LOGIN');
  const [genPin, setGenPin] = useState('');
  const [generatedCode, setGeneratedCode] = useState<{ code: string; expiresAt: string; ttlSeconds: number } | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  // Push approval & WebAuthn
  const [pushApproval, setPushApproval] = useState<{ requestId: string; challengeCode: string; status: string } | null>(null);
  const [passkeyCap, setPasskeyCap] = useState({ webauthnSupported: false, platformAuthenticatorAvailable: false });
  const [verifiedSession, setVerifiedSession] = useState<{ accessToken: string; user: AuthUser } | null>(null);

  // Trade tracker preview lookup
  const [tradeTrackQuery, setTradeTrackQuery] = useState('');
  const [tradeTrackSample, setTradeTrackSample] = useState<any | null>(null);

  const [helpOpen, setHelpOpen] = useState(false);
  const [securityInfoOpen, setSecurityInfoOpen] = useState(false);
  const [selectedInfoId, setSelectedInfoId] = useState<string | null>(null);
  const [preferredLang, setPreferredLang] = useState(() => sessionStorage.getItem('hsbc_lang_pref') || 'English (Global)');
  const [healthPingResult, setHealthPingResult] = useState<string | null>(null);
  const [secChecks, setSecChecks] = useState<Record<string, boolean>>({
    bec: true,
    pin: true,
    dual: true,
    domain: true,
  });

  const [unlockPin, setUnlockPin] = useState('');
  const [unlockError, setUnlockError] = useState('');
  const [unlockLoading, setUnlockLoading] = useState(false);

  useEffect(() => {
    detectPasskeySupport().then((s) => setPasskeyCap(s));
  }, []);

  useEffect(() => {
    if (!generatedCode?.expiresAt) return;
    const tick = () => {
      const diff = Math.max(0, Math.round((new Date(generatedCode.expiresAt).getTime() - Date.now()) / 1000));
      setRemainingSeconds(diff);
    };
    tick();
    const t = window.setInterval(tick, 1000);
    return () => window.clearInterval(t);
  }, [generatedCode]);

  useEffect(() => {
    if (step !== 'MOBILE_PUSH' || !pushApproval?.requestId) return;
    if (['APPROVED', 'REJECTED', 'EXPIRED'].includes(pushApproval.status)) return;

    const timer = window.setInterval(async () => {
      try {
        const res = await apiRequest<any>(`/api/auth/login-approval/${pushApproval.requestId}/status`, {
          skipAuthHandling: true,
        });
        if (res.status === 'APPROVED' && res.accessToken) {
          setPushApproval((prev) => (prev ? { ...prev, status: 'APPROVED' } : null));
          setVerifiedSession({ accessToken: res.accessToken, user: res.user });
          setStep('SUCCESS');
        } else if (res.status === 'REJECTED' || res.status === 'EXPIRED') {
          setPushApproval((prev) => (prev ? { ...prev, status: res.status } : null));
          setAuthError(
            res.status === 'REJECTED'
              ? 'Log on request was declined on your registered device.'
              : 'Log on request expired. Please try again.'
          );
          setStep('FAILED');
        }
      } catch {
        // Ignore transient poll errors
      }
    }, 2000);

    return () => window.clearInterval(timer);
  }, [step, pushApproval]);

  const rememberUsername = (id: string) => {
    const clean = id.trim();
    if (!clean) return;
    const next = [clean, ...rememberedUsers.filter((u) => u !== clean)].slice(0, 4);
    setRememberedUsers(next);
    try {
      sessionStorage.setItem('hsbc_cnet_recent_ids', JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  // 1. Application Launch Screen — Exact match to uploaded Splash Screen image
  if (phase === 'LAUNCHING') {
    return (
      <main className="relative min-h-dvh bg-[#0F151B] flex flex-col items-center justify-center p-6 overflow-hidden">
        <img
          src="/welcome-bg.jpg"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-b from-[#0A0F14]/25 via-[#0A0F14]/15 to-[#0A0F14]/45"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.45 }}
          className="relative z-10 flex items-center justify-center gap-3.5"
        >
          <span
            className="text-[36px] sm:text-[44px] font-normal tracking-wide text-white leading-none drop-shadow-[0_2px_10px_rgba(0,0,0,0.65)]"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
          >
            HSBC
          </span>
          <BrandMark size={72} />
        </motion.div>
      </main>
    );
  }

  // 2. Network / Init Failure Screen
  if (phase === 'INIT_ERROR') {
    return (
      <main className="min-h-dvh bg-[#263640] flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white border border-[#D9DEE1] rounded-[2px] p-6 text-center">
          <BrandMark size={64} className="mx-auto rounded-[4px]" />
          <h1 className="mt-4 text-base font-medium text-[#252B30]">Connection Interrupted</h1>
          <p className="mt-2 text-xs text-[#68727A] leading-relaxed">{initError}</p>
          <div className="mt-5">
            <Button onClick={retryInit} fullWidth>
              <RefreshCw className="w-4 h-4" aria-hidden="true" />
              Retry Connection
            </Button>
          </div>
        </div>
      </main>
    );
  }

  // 3. Session Lock Screen (using consistent dark welcome backdrop)
  if (phase === 'LOCKED' && user) {
    const handleUnlockWithPin = async (e: React.FormEvent) => {
      e.preventDefault();
      setUnlockError('');
      setUnlockLoading(true);
      try {
        await apiRequest('/api/auth/pin/verify', {
          method: 'POST',
          body: JSON.stringify({ pin: unlockPin }),
        });
        setUnlockPin('');
        unlockSession();
      } catch (err: any) {
        setUnlockError(err?.message || 'Incorrect 6-digit Mobile Security PIN.');
      } finally {
        setUnlockLoading(false);
      }
    };

    const handleUnlockWithPasskey = async () => {
      setUnlockError('');
      setUnlockLoading(true);
      try {
        const opts = await apiRequest('/api/auth/webauthn/reauth/options', { method: 'POST' });
        const publicKey = parseRequestOptions(opts);
        const cred = (await navigator.credentials.get({ publicKey })) as PublicKeyCredential | null;
        if (!cred) throw new Error('Verification cancelled.');
        const serialized = serializeCredential(cred);
        await apiRequest('/api/auth/webauthn/reauth/verify', {
          method: 'POST',
          body: JSON.stringify(serialized),
        });
        unlockSession();
      } catch (err: any) {
        setUnlockError(err?.message || 'Biometric verification unavailable. Please enter your Mobile Security PIN.');
      } finally {
        setUnlockLoading(false);
      }
    };

    return (
      <main className="relative min-h-dvh flex items-center justify-center p-4 overflow-hidden bg-[#202A30]">
        <img
          src="/welcome-bg.jpg"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover blur-[4px] scale-105 opacity-45"
        />
        <div className="absolute inset-0 bg-[#202A30]/75" aria-hidden="true" />

        <div className="relative z-10 w-full max-w-sm bg-white border border-[#D9DEE1] rounded-[2px]">
          <div className="px-5 py-4 bg-[#263640] text-white flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Lock className="w-5 h-5 text-[#DB001B] shrink-0" aria-hidden="true" />
              <div>
                <h1 className="text-base font-medium">Session locked</h1>
                <p className="text-xs text-white/75">{user.full_name}</p>
              </div>
            </div>
            <BrandMark size={36} />
          </div>

          <div className="p-5">
            <form onSubmit={handleUnlockWithPin} className="space-y-4">
              <PinSlotDisplay value={unlockPin} />
              <FormInput
                label="Mobile Security PIN"
                type="password"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                required
                autoFocus
                value={unlockPin}
                onChange={(e) => setUnlockPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                error={unlockError}
              />
              <Button type="submit" fullWidth loading={unlockLoading}>
                Continue
              </Button>
            </form>

            {passkeyCap.webauthnSupported && (
              <div className="mt-3">
                <Button variant="outline" fullWidth onClick={handleUnlockWithPasskey} disabled={unlockLoading}>
                  <Fingerprint className="w-4 h-4" aria-hidden="true" />
                  Use Biometrics
                </Button>
              </div>
            )}

            <div className="mt-5 pt-4 border-t border-[#D9DEE1] text-center">
              <button type="button" onClick={logout} className="text-xs font-medium text-[#DB001B] hover:underline">
                Log off
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const handleUsernameLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setUsernameTouched(true);
    setUsernameError('');
    setAuthError('');
    const trimmed = username.trim();
    if (trimmed.length < 3) {
      setUsernameError('Please enter your corporate username.');
      return;
    }
    setLoading(true);
    try {
      const res = await apiRequest<{ success: boolean; profile: LookupProfile }>('/api/auth/lookup', {
        method: 'POST',
        body: JSON.stringify({ identifier: trimmed }),
        skipAuthHandling: true,
      });
      rememberUsername(res.profile.username);
      setLookup(res.profile);
      setStep('SELECT_METHOD');
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 403 && err.message.toLowerCase().includes('locked')) {
        setAuthError(err.message);
        setStep('LOCKED_ACCOUNT');
      } else {
        setUsernameError(err?.message || 'Username not recognised. Check your entry and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setLoading(true);
    try {
      const res = await apiRequest<any>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier: username.trim(), password }),
        skipAuthHandling: true,
      });
      const sess = await apiRequest<{ success: boolean; user: AuthUser }>('/api/auth/corporate-session', {
        headers: { Authorization: `Bearer ${res.accessToken}` },
        skipAuthHandling: true,
      });
      setVerifiedSession({ accessToken: res.accessToken, user: sess.user });
      setStep('SUCCESS');
    } catch (err: any) {
      if (err?.message?.toLowerCase().includes('locked')) {
        setAuthError(err.message);
        setStep('LOCKED_ACCOUNT');
      } else {
        setAuthError(err?.message || 'Incorrect credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setLoading(true);
    try {
      const res = await apiRequest<any>('/api/auth/login-pin', {
        method: 'POST',
        body: JSON.stringify({ identifier: username.trim(), pin }),
        skipAuthHandling: true,
      });
      setVerifiedSession({ accessToken: res.accessToken, user: res.user });
      setStep('SUCCESS');
    } catch (err: any) {
      if (err?.message?.toLowerCase().includes('locked')) {
        setAuthError(err.message);
        setStep('LOCKED_ACCOUNT');
      } else {
        setAuthError(err?.message || 'Incorrect Mobile Security PIN.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRequestPinReset = async () => {
    setAuthError('');
    setLoading(true);
    try {
      const targetId = (username || genUsername).trim();
      const res = await apiRequest<any>('/api/auth/pin/reset-request', {
        method: 'POST',
        body: JSON.stringify({ identifier: targetId }),
        skipAuthHandling: true,
      });
      setResetMaskedEmail(res.maskedEmail || 'registered email');
      setSandboxResetHint(res.sandboxResetCode || '');
      setResetCode('');
      setStep('PIN_RESET_CODE');
    } catch (err: any) {
      setAuthError(err?.message || 'Unable to initiate Security PIN reset.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmPinReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    if (!/^\d{6}$/.test(newResetPin) || newResetPin !== confirmResetPin) {
      setAuthError('Both Security PIN entries must match and contain 6 digits.');
      return;
    }
    setLoading(true);
    try {
      await apiRequest('/api/auth/pin/reset-confirm', {
        method: 'POST',
        body: JSON.stringify({
          identifier: (username || genUsername).trim(),
          resetCode: resetCode.trim(),
          newPin: newResetPin,
        }),
        skipAuthHandling: true,
      });
      setNewResetPin('');
      setConfirmResetPin('');
      setResetCode('');
      setStep('PIN_RESET_SUCCESS');
    } catch (err: any) {
      setAuthError(err?.message || 'PIN reset verification failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleSecurityCodeLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setLoading(true);
    try {
      const res = await apiRequest<any>('/api/auth/login-security-code', {
        method: 'POST',
        body: JSON.stringify({ identifier: username.trim(), code: secCode }),
        skipAuthHandling: true,
      });
      setVerifiedSession({ accessToken: res.accessToken, user: res.user });
      setStep('SUCCESS');
    } catch (err: any) {
      setAuthError(err?.message || 'Invalid or expired security code.');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateCodeFlow = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    if (!/^\d{6}$/.test(genPin)) {
      setAuthError('Enter your 6-digit Mobile Security PIN.');
      return;
    }
    setLoading(true);
    try {
      await apiRequest('/api/auth/login-pin', {
        method: 'POST',
        body: JSON.stringify({ identifier: genUsername.trim(), pin: genPin }),
        skipAuthHandling: true,
      });
      const res = await apiRequest<any>('/api/auth/security-code/generate', {
        method: 'POST',
        body: JSON.stringify({ identifier: genUsername.trim(), purpose: genAction }),
        skipAuthHandling: true,
      });
      setGeneratedCode({ code: res.code, expiresAt: res.expiresAt, ttlSeconds: res.ttlSeconds });
      setGenPin('');
      setStep('GENERATE_CODE_RESULT');
    } catch (err: any) {
      setAuthError(err?.message || 'Unable to verify PIN and generate security code.');
    } finally {
      setLoading(false);
    }
  };

  const handleStartPushApproval = async () => {
    setAuthError('');
    setLoading(true);
    try {
      const res = await apiRequest<any>('/api/auth/login-approval/request', {
        method: 'POST',
        body: JSON.stringify({ identifier: username.trim() }),
        skipAuthHandling: true,
      });
      setPushApproval({ requestId: res.requestId, challengeCode: res.challengeCode, status: 'PENDING' });
      setStep('MOBILE_PUSH');
    } catch (err: any) {
      setAuthError(err?.message || 'Could not initiate push approval.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasskeyAuth = async () => {
    setAuthError('');
    setLoading(true);
    try {
      const optionsJson = await apiRequest('/api/auth/webauthn/auth/options', {
        method: 'POST',
        body: JSON.stringify({ identifier: username.trim() }),
        skipAuthHandling: true,
      });
      if (!optionsJson.allowCredentials || optionsJson.allowCredentials.length === 0) {
        throw new Error(
          'No biometric passkey is registered on this browser yet. Log on using your Mobile Security PIN or Password, then enable Biometrics under Settings.'
        );
      }
      const publicKey = parseRequestOptions(optionsJson);
      const cred = (await navigator.credentials.get({ publicKey })) as PublicKeyCredential | null;
      if (!cred) throw new Error('Biometric verification cancelled.');
      const encoded = serializeCredential(cred);
      try {
        const res = await apiRequest<any>('/api/auth/webauthn/auth/verify', {
          method: 'POST',
          body: JSON.stringify(encoded),
          skipAuthHandling: true,
        });
        setVerifiedSession({ accessToken: res.accessToken, user: res.user });
        setStep('SUCCESS');
      } catch (verifyErr: any) {
        if (verifyErr instanceof ApiError && verifyErr.status === 404) {
          await signalUnknownCredentialIfSupported(optionsJson.rpId, encoded.id);
        }
        throw verifyErr;
      }
    } catch (err: any) {
      setAuthError(err?.message || 'Biometric verification unavailable. Please use Mobile Security PIN or Password.');
    } finally {
      setLoading(false);
    }
  };

  const handlePublicTradeLookup = (e: React.FormEvent) => {
    e.preventDefault();
    const q = tradeTrackQuery.trim().toUpperCase();
    if (!q) return;
    setTradeTrackSample({
      reference: q,
      type: 'Import Documentary Credit (Sandbox Preview)',
      status: 'IN_TRANSIT',
      lastUpdate: new Date().toISOString(),
      timeline: [
        { label: 'Application Issued', detail: 'Recorded in HSBC Cnet Trade Registry', state: 'COMPLETED' },
        { label: 'Document Examination', detail: 'Awaiting corporate sign-off (sign on to authorise)', state: 'CURRENT' },
      ],
    });
  };

  // =========================================================================
  // WELCOME SCREEN — Replicating HSBCnet Mobile Dark Photographic Welcome Layout
  // =========================================================================
  if (step === 'WELCOME') {
    return (
      <main className="relative min-h-dvh flex flex-col justify-between bg-[#202A30] text-white overflow-hidden">
        {/* Consistent Blurred Night Highway Background */}
        <img
          src="/welcome-bg.jpg"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover blur-[5px] scale-105 opacity-70"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-b from-[#202A30]/85 via-[#263640]/55 to-[#202A30]/92"
        />

        {/* Top Identity Header Bar — Logo ONLY without name on Welcome username screen */}
        <header className="relative z-10 w-full">
          <div className="max-w-md mx-auto px-4 pt-4 pb-1 flex items-center justify-between">
            <div className="w-10" aria-hidden="true" />
            <div className="flex items-center justify-center">
              <BrandMark size={52} />
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedInfoId(null);
                setStep('INFO_MENU');
              }}
              aria-label="Legal and security information"
              className="min-w-[40px] min-h-[40px] flex items-center justify-center text-white/90 hover:text-white"
            >
              <Info className="w-5 h-5" strokeWidth={1.75} aria-hidden="true" />
            </button>
          </div>
        </header>

        {/* Center Heading + Minimal Underline Username Entry */}
        <div className="relative z-10 flex-1 flex flex-col justify-center px-6 py-8 max-w-md w-full mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            {phase === 'SESSION_EXPIRED' && (
              <div
                role="alert"
                className="mb-6 p-3 bg-[#202A30]/90 border-l-2 border-[#B77A1D] text-xs text-white flex items-center gap-2"
              >
                <Clock className="w-4 h-4 text-[#FCD9A5] shrink-0" aria-hidden="true" />
                <span>Your session expired due to inactivity. Please log on again.</span>
              </div>
            )}

            <h1 className="text-[28px] sm:text-[32px] font-light text-center tracking-tight text-white">
              Welcome to <span className="italic font-normal">{BANK_CONFIG.appName}</span>
            </h1>
            <p className="mt-2 text-xs text-center text-white/75">
              Enterprise treasury, payments &amp; corporate authorisations
            </p>

            <form onSubmit={handleUsernameLookup} className="mt-10 space-y-5" noValidate>
              <div>
                <label
                  htmlFor="welcome-username"
                  className="block text-xs font-medium text-white/90 text-center mb-1.5"
                >
                  Enter your username
                </label>
                <div className="relative flex items-center border-b border-white/65 focus-within:border-white transition-colors">
                  <input
                    id="welcome-username"
                    name="username"
                    type="text"
                    autoComplete="username webauthn"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    enterKeyHint="next"
                    required
                    autoFocus
                    placeholder="Corporate username"
                    value={username}
                    onBlur={() => setUsernameTouched(true)}
                    onChange={(e) => {
                      setUsername(e.target.value);
                      if (usernameError) setUsernameError('');
                    }}
                    aria-invalid={usernameTouched && !!usernameError ? 'true' : undefined}
                    aria-describedby={usernameError ? 'welcome-user-err' : undefined}
                    className="w-full min-h-[44px] bg-transparent px-1 pr-9 text-base sm:text-sm text-white text-center placeholder:text-white/45 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setHelpOpen(true)}
                    aria-label="Username help and support"
                    className="absolute right-0 min-w-[36px] min-h-[36px] flex items-center justify-center text-white/85 hover:text-white"
                  >
                    <HelpCircle className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
                {usernameError && (
                  <p id="welcome-user-err" role="alert" className="mt-2 text-xs text-[#FFB3B7] text-center font-medium">
                    {usernameError}
                  </p>
                )}
              </div>

              {rememberedUsers.length > 0 && (
                <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
                  <span className="text-[11px] text-white/60">Registered:</span>
                  {rememberedUsers.map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setUsername(id)}
                      className="px-2 py-0.5 text-[11px] bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-[2px]"
                    >
                      {id}
                    </button>
                  ))}
                </div>
              )}

              <Button
                type="submit"
                fullWidth
                size="lg"
                loading={loading}
                className={username.trim().length > 0 ? 'bg-[#DB001B]' : 'bg-[#DB001B]/80 hover:bg-[#DB001B]'}
              >
                Continue
              </Button>
            </form>
          </motion.div>
        </div>

        {/* Bottom Dual Action Bar matching official Welcome screen */}
        <footer className="relative z-10 w-full bg-[#202A30]/85 border-t border-white/15 backdrop-blur-sm pb-safe">
          <div className="max-w-md mx-auto grid grid-cols-2 divide-x divide-white/15">
            <button
              type="button"
              onClick={() => {
                setGenUsername(username);
                setGenPin('');
                setAuthError('');
                setStep('GENERATE_CODE_USERNAME');
              }}
              className="py-4 px-3 flex flex-col items-center justify-center gap-1.5 text-white/90 hover:bg-white/5 transition-colors"
            >
              <FileKey2 className="w-5 h-5" strokeWidth={1.6} aria-hidden="true" />
              <span className="text-[11px] font-medium leading-tight text-center">
                Generate a<br />security code
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setTradeTrackSample(null);
                setTradeTrackQuery('');
                setStep('TRADE_TRACKER_PUBLIC');
              }}
              className="py-4 px-3 flex flex-col items-center justify-center gap-1.5 text-white/90 hover:bg-white/5 transition-colors"
            >
              <Activity className="w-5 h-5" strokeWidth={1.6} aria-hidden="true" />
              <span className="text-[11px] font-medium leading-tight text-center">
                Trade Transaction<br />Tracker
              </span>
            </button>
          </div>
        </footer>

        {/* Modals */}
        <NativeDialog open={helpOpen} onClose={() => setHelpOpen(false)} title="Help and Support">
          <div className="space-y-3 text-xs text-[#68727A] leading-relaxed">
            <p className="text-[#252B30]">
              Enter your HSBC Cnet corporate username and select <strong>Continue</strong> to choose your authentication method (Biometrics, Mobile Security PIN, Corporate Password, Security Device Code, or Registered Device Push).
            </p>
            <div className="p-3 bg-[#F4F5F6] border border-[#D9DEE1] rounded-[2px]">
              <p className="font-semibold text-[#252B30] mb-1">Sandbox Test Credentials</p>
              <ul className="space-y-1">
                <li><code>premier_user</code> / <code>Password@123</code> (Org Admin)</li>
                <li><code>corp_initiator</code> / <code>CorpPass@2026</code> (Initiator)</li>
                <li><code>corp_authoriser</code> / <code>CorpPass@2026</code> (Authoriser)</li>
                <li><code>corp_viewer</code> / <code>CorpPass@2026</code> (Finance Viewer)</li>
                <li>Default 6-digit Mobile Security PIN: <code>123456</code></li>
              </ul>
            </div>
          </div>
        </NativeDialog>

        <NativeDialog open={securityInfoOpen} onClose={() => setSecurityInfoOpen(false)} title="Security Information">
          <div className="space-y-3 text-xs text-[#68727A] leading-relaxed">
            <p className="text-[#252B30]">
              Keep your Mobile Security PIN and one-time security codes confidential. Never authorise payment instructions without reviewing the exact beneficiary name, bank account, and amount.
            </p>
            <p>{BANK_CONFIG.disclaimer}</p>
          </div>
        </NativeDialog>
      </main>
    );
  }

  // =========================================================================
  // INFORMATION SCREEN & WORKING SUB-PAGES — Exact match to uploaded Image 2
  // =========================================================================
  const INFO_ROWS = [
    { id: 'TERMS', title: 'Terms and Conditions of Use' },
    { id: 'PRIVACY', title: 'Privacy and Data Protection Statement' },
    { id: 'LANG', title: 'HSBCnet condition of national language use' },
    { id: 'IMPORTANT', title: 'Important Information' },
    { id: 'SECURITY_TIPS', title: 'Security Tips' },
    { id: 'EULA', title: 'End User Licence Agreement' },
    { id: 'ACKNOWLEDGEMENT', title: 'Acknowledgement' },
  ];

  if (step === 'INFO_MENU') {
    return (
      <main className="min-h-dvh bg-[#F4F5F6] flex flex-col items-center justify-center sm:p-6">
        <div className="w-full max-w-md bg-white sm:border sm:border-[#D9DEE1] min-h-dvh sm:min-h-[680px] flex flex-col justify-between">
          <div>
            {/* Top Bar: Back to Username Welcome + Centered Red/White Hexagon Logo ONLY */}
            <header className="px-4 pt-4 pb-3 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep('WELCOME')}
                aria-label="Back to welcome screen"
                className="min-w-[36px] min-h-[36px] flex items-center justify-start text-[#252B30] hover:text-[#DB001B]"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <BrandMark size={54} />
              <div className="w-9" aria-hidden="true" />
            </header>

            <nav aria-label="HSBCnet legal and security information" className="mt-2">
              <ul className="divide-y divide-transparent">
                {INFO_ROWS.map((row) => (
                  <li key={row.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedInfoId(row.id);
                        setHealthPingResult(null);
                        setStep('INFO_DETAIL');
                      }}
                      className="w-full px-5 py-4 flex items-center justify-between gap-4 text-left hover:bg-[#F4F5F6] transition-colors"
                    >
                      <span className="text-[16px] font-normal text-[#1E2328] leading-snug">{row.title}</span>
                      <ChevronRight className="w-5 h-5 text-[#DB001B] shrink-0" strokeWidth={2.25} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          <footer className="px-6 py-6 text-center text-xs text-[#252B30] leading-relaxed">
            <div>&copy; HSBC Bank plc 2026. All rights reserved.</div>
            <div>App Version 3.26.11.0</div>
          </footer>
        </div>
      </main>
    );
  }

  if (step === 'INFO_DETAIL' && selectedInfoId) {
    const activeInfo = INFO_ROWS.find((r) => r.id === selectedInfoId) || INFO_ROWS[0];
    return (
      <main className="min-h-dvh bg-[#F4F5F6] flex flex-col items-center justify-center sm:p-6">
        <div className="w-full max-w-md bg-white sm:border sm:border-[#D9DEE1] min-h-dvh sm:min-h-[680px] flex flex-col justify-between">
          <div>
            <BankingHeader title={activeInfo.title} onBack={() => setStep('INFO_MENU')} />
            <div className="p-5 space-y-4 text-xs text-[#252B30] leading-relaxed">
              {selectedInfoId === 'TERMS' && (
                <>
                  <div className="p-3 bg-[#F4F5F6] border border-[#D9DEE1] font-medium">
                    Master Electronic Banking Terms — Coralgenz Global India Pvt Ltd
                  </div>
                  <p>1. Access to HSBCnet services is granted exclusively to authorised corporate users appointed by Coralgenz Global India Pvt Ltd System Administrators.</p>
                  <p>2. Dual-control payment mandates require independent Maker initiation and Authoriser verification via 6-digit Mobile Security PIN, Hardware Token, or Platform Passkey.</p>
                  <p>3. Trade Finance instruments (Documentary Credits, SBLCs, Supply Chain Finance) remain subject to UCP 600 and applicable RBI / FEMA corporate guidelines.</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const blob = new Blob([
                        'HSBCnet Terms and Conditions of Use (2026)\nEntity: Coralgenz Global India Pvt Ltd\nVersion: App Version 3.26.11.0\n\nAll corporate instructions are governed by organisation-scoped entitlements and maker-checker authorisation controls.',
                      ], { type: 'text/plain' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = 'HSBCnet_Terms_Coralgenz_Global_India.txt';
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                  >
                    Download Terms Summary (.txt)
                  </Button>
                </>
              )}

              {selectedInfoId === 'PRIVACY' && (
                <>
                  <p><strong>Privacy and Data Protection Statement:</strong> Corporate banking credentials, biometric WebAuthn public keys, and audit trails for Coralgenz Global India Pvt Ltd are processed in strict accordance with India Digital Personal Data Protection (DPDP) Act and UK/EU GDPR principles.</p>
                  <p>Authentication secrets (PINs and passkeys) never leave secure server verification endpoints in plaintext and are never stored in browser localStorage.</p>
                </>
              )}

              {selectedInfoId === 'LANG' && (
                <div className="space-y-3">
                  <p>Select your preferred portal interface language under HSBCnet national language conditions:</p>
                  <div className="divide-y divide-[#D9DEE1] border border-[#D9DEE1]">
                    {['English (Global)', 'English (India)', 'हिन्दी (Hindi)', 'Français', 'Deutsch'].map((lang) => (
                      <label key={lang} className="p-3 flex items-center justify-between cursor-pointer hover:bg-[#F4F5F6]">
                        <span>{lang}</span>
                        <input
                          type="radio"
                          name="hsbc-info-lang"
                          checked={preferredLang === lang}
                          onChange={() => {
                            setPreferredLang(lang);
                            sessionStorage.setItem('hsbc_lang_pref', lang);
                          }}
                          className="accent-[#DB001B]"
                        />
                      </label>
                    ))}
                  </div>
                  <div className="p-2.5 bg-[#ECF6F1] border border-[#B7DFCC] text-[#27835B]">
                    Active language preference: <strong>{preferredLang}</strong>
                  </div>
                </div>
              )}

              {selectedInfoId === 'IMPORTANT' && (
                <div className="space-y-3">
                  <div className="p-3 bg-[#F4F5F6] border border-[#D9DEE1]">
                    <div><strong>Entity:</strong> Coralgenz Global India Pvt Ltd</div>
                    <div><strong>Primary Clearing Desk:</strong> Chennai Anna Salai Corporate Hub (IFSC CGLB0641002)</div>
                    <div><strong>Cut-off Windows:</strong> RTGS/NEFT 18:00 IST • SEPA EUR 15:30 GMT</div>
                  </div>
                  <Button
                    size="sm"
                    onClick={async () => {
                      try {
                        const r = await apiRequest<any>('/api/health', { skipAuthHandling: true });
                        setHealthPingResult(`Gateway ${r.status || 'ONLINE'} • Mode: ${r.mode || 'LIVE_API'}`);
                      } catch {
                        setHealthPingResult('Gateway check failed.');
                      }
                    }}
                  >
                    Run Live Gateway Connectivity Check
                  </Button>
                  {healthPingResult && (
                    <div className="p-2.5 bg-[#ECF6F1] border border-[#B7DFCC] text-[#27835B] font-medium">{healthPingResult}</div>
                  )}
                </div>
              )}

              {selectedInfoId === 'SECURITY_TIPS' && (
                <div className="space-y-3">
                  <p>Interactive corporate cyber-hygiene checklist for Coralgenz Global India Pvt Ltd:</p>
                  <div className="divide-y divide-[#D9DEE1] border border-[#D9DEE1]">
                    {[
                      { k: 'bec', label: 'Verify beneficiary IBAN/IFSC changes verbally before authorising wires' },
                      { k: 'pin', label: 'Never share your 6-digit Mobile Security PIN or 8-digit generated code' },
                      { k: 'dual', label: 'Enforce Maker-Checker dual authorisation for wires above INR 500,000' },
                      { k: 'domain', label: 'Always inspect transaction amounts on the Push / Step-Up screen' },
                    ].map((tip) => (
                      <label key={tip.k} className="p-3 flex items-start gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!secChecks[tip.k]}
                          onChange={(e) => setSecChecks((p) => ({ ...p, [tip.k]: e.target.checked }))}
                          className="mt-0.5 accent-[#DB001B]"
                        />
                        <span>{tip.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {selectedInfoId === 'EULA' && (
                <div className="space-y-2.5">
                  <p><strong>End User Licence Agreement (App Version 3.26.11.0):</strong> Licensed solely for authorised corporate treasury operations on behalf of Coralgenz Global India Pvt Ltd. Reverse engineering, credential scraping, or automated bypassing of security controls is prohibited.</p>
                </div>
              )}

              {selectedInfoId === 'ACKNOWLEDGEMENT' && (
                <div className="space-y-2.5">
                  <p>HSBCnet Web &amp; Mobile client components utilise standards-compliant FIDO2 / WebAuthn cryptographic verification, ISO 20022 payment schema validation, SWIFT MT940 / BAI2 reporting engines, and Lucide vector iconography.</p>
                </div>
              )}
            </div>
          </div>
          <div className="p-4 border-t border-[#D9DEE1]">
            <Button variant="outline" fullWidth onClick={() => setStep('INFO_MENU')}>
              Back to Information Menu
            </Button>
          </div>
        </div>
      </main>
    );
  }

  // =========================================================================
  // SUB-FLOWS (White clean navigation shell matching logon_with_mobile.pdf & manage_pin.pdf)
  // =========================================================================
  const subTitle =
    step === 'GENERATE_CODE_USERNAME' || step === 'GENERATE_CODE_ACTION' || step === 'GENERATE_CODE_VERIFY' || step === 'GENERATE_CODE_RESULT'
      ? 'Generate a security code'
      : step === 'PIN_RESET_CODE' || step === 'PIN_RESET_NEW' || step === 'PIN_RESET_SUCCESS'
      ? 'Reset your security PIN'
      : step === 'TRADE_TRACKER_PUBLIC'
      ? 'Trade Transaction Tracker'
      : 'Log on to HSBC Cnet';

  const handleBack = () => {
    setAuthError('');
    if (step === 'SELECT_METHOD' || step === 'FAILED' || step === 'LOCKED_ACCOUNT' || step === 'GENERATE_CODE_USERNAME' || step === 'TRADE_TRACKER_PUBLIC') {
      setStep('WELCOME');
    } else if (step === 'GENERATE_CODE_ACTION') {
      setStep('GENERATE_CODE_USERNAME');
    } else if (step === 'GENERATE_CODE_VERIFY') {
      setStep('GENERATE_CODE_ACTION');
    } else if (step === 'GENERATE_CODE_RESULT') {
      setGeneratedCode(null);
      setStep('WELCOME');
    } else if (step === 'PIN_RESET_CODE' || step === 'PIN_RESET_NEW') {
      setStep(lookup ? 'PIN' : 'WELCOME');
    } else {
      setStep('SELECT_METHOD');
    }
  };

  return (
    <main className="min-h-dvh bg-[#F4F5F6] flex flex-col items-center justify-center sm:p-6">
      <div className="w-full max-w-md bg-white sm:border sm:border-[#D9DEE1] min-h-dvh sm:min-h-[600px] flex flex-col">
        <BankingHeader
          title={subTitle}
          onBack={step === 'SUCCESS' || step === 'PIN_RESET_SUCCESS' ? undefined : handleBack}
          rightSlot={
            <button
              type="button"
              onClick={() => setSecurityInfoOpen(true)}
              aria-label="Security information"
              className="p-2 text-[#68727A] hover:text-[#252B30]"
            >
              <Info className="w-4 h-4" aria-hidden="true" />
            </button>
          }
        />

        <div className="flex-1 flex flex-col justify-between">
          {/* SELECT AUTHENTICATION METHOD */}
          {step === 'SELECT_METHOD' && lookup && (
            <div className="flex-1 flex flex-col justify-between">
              <div>
                <div className="px-4 py-4 bg-[#F4F5F6] border-b border-[#D9DEE1]">
                  <div className="text-[11px] uppercase tracking-wider text-[#68727A]">Corporate Profile</div>
                  <div className="text-base font-medium text-[#252B30] mt-0.5">{lookup.fullName}</div>
                  <div className="text-xs text-[#68727A]">{lookup.organisationName} ({lookup.country})</div>
                </div>

                <div className="px-4 pt-4 pb-2">
                  <h1 className="text-sm font-medium text-[#252B30]">Select authentication method</h1>
                </div>

                {authError && (
                  <div role="alert" className="mx-4 mb-3 p-3 bg-[#FDF2F3] border-l-4 border-[#C83A42] text-xs text-[#C83A42]">
                    {authError}
                  </div>
                )}

                <div className="divide-y divide-[#D9DEE1] border-y border-[#D9DEE1]">
                  {passkeyCap.webauthnSupported && (
                    <button
                      type="button"
                      onClick={() => {
                        setAuthError('');
                        setStep('PASSKEY');
                      }}
                      className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-[#F4F5F6] text-left"
                    >
                      <div className="flex items-center gap-3">
                        <Fingerprint className="w-5 h-5 text-[#DB001B]" strokeWidth={1.75} aria-hidden="true" />
                        <div>
                          <div className="text-sm font-medium text-[#252B30]">Biometrics</div>
                          <div className="text-xs text-[#68727A]">Face ID / Touch ID / Platform Passkey</div>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-[#68727A]" aria-hidden="true" />
                    </button>
                  )}

                  {lookup.methods.securityPin && (
                    <button
                      type="button"
                      onClick={() => {
                        setAuthError('');
                        setPin('');
                        setStep('PIN');
                      }}
                      className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-[#F4F5F6] text-left"
                    >
                      <div className="flex items-center gap-3">
                        <Smartphone className="w-5 h-5 text-[#263640]" strokeWidth={1.75} aria-hidden="true" />
                        <div>
                          <div className="text-sm font-medium text-[#252B30]">Mobile Security PIN</div>
                          <div className="text-xs text-[#68727A]">Authenticate using your 6-digit PIN</div>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-[#68727A]" aria-hidden="true" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setAuthError('');
                      setPassword('');
                      setStep('PASSWORD');
                    }}
                    className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-[#F4F5F6] text-left"
                  >
                    <div className="flex items-center gap-3">
                      <Lock className="w-5 h-5 text-[#263640]" strokeWidth={1.75} aria-hidden="true" />
                      <div>
                        <div className="text-sm font-medium text-[#252B30]">Password</div>
                        <div className="text-xs text-[#68727A]">Corporate username &amp; password</div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#68727A]" aria-hidden="true" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAuthError('');
                      setSecCode('');
                      setStep('SECURITY_CODE');
                    }}
                    className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-[#F4F5F6] text-left"
                  >
                    <div className="flex items-center gap-3">
                      <KeyRound className="w-5 h-5 text-[#263640]" strokeWidth={1.75} aria-hidden="true" />
                      <div>
                        <div className="text-sm font-medium text-[#252B30]">Security Device / Security Code</div>
                        <div className="text-xs text-[#68727A]">Enter a time-limited security code</div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#68727A]" aria-hidden="true" />
                  </button>

                  {lookup.methods.mobileAuth && (
                    <button
                      type="button"
                      onClick={handleStartPushApproval}
                      className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-[#F4F5F6] text-left"
                    >
                      <div className="flex items-center gap-3">
                        <Shield className="w-5 h-5 text-[#263640]" strokeWidth={1.75} aria-hidden="true" />
                        <div>
                          <div className="text-sm font-medium text-[#252B30]">Push notification approval</div>
                          <div className="text-xs text-[#68727A]">Approve sign-in from your registered device</div>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-[#68727A]" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>

              <div className="p-4 border-t border-[#D9DEE1] bg-[#F4F5F6] text-[11px] text-[#68727A]">
                Protected by multi-stage authentication and backend session controls.
              </div>
            </div>
          )}

          {/* PASSWORD VERIFICATION */}
          {step === 'PASSWORD' && (
            <form onSubmit={handlePasswordSubmit} className="p-5 space-y-5 flex-1 flex flex-col justify-between">
              <div className="space-y-4">
                <h1 className="text-base font-medium text-[#252B30]">Enter your corporate password</h1>
                <p className="text-xs text-[#68727A]">Profile: <strong className="text-[#252B30]">{username}</strong></p>
                <FormInput
                  label="Password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  requiredMark
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  error={authError}
                  rightAdornment={
                    <button
                      type="button"
                      aria-pressed={showPassword}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      onClick={() => setShowPassword((v) => !v)}
                      className="p-1.5 text-[#68727A] hover:text-[#252B30]"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  }
                />
              </div>
              <Button type="submit" fullWidth size="lg" loading={loading}>
                Log on
              </Button>
            </form>
          )}

          {/* MOBILE SECURITY PIN SCREEN (manage_pin.pdf style) */}
          {step === 'PIN' && (
            <form onSubmit={handlePinSubmit} className="p-5 space-y-5 flex-1 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="text-center pt-2">
                  <h1 className="text-base font-medium text-[#252B30]">Enter your security PIN</h1>
                  <p className="text-xs text-[#68727A] mt-1">Profile: {username}</p>
                </div>
                <PinSlotDisplay value={pin} />
                <FormInput
                  label="6-Digit Mobile Security PIN"
                  name="pin"
                  type="password"
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  required
                  autoFocus
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  error={authError}
                />
                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={handleRequestPinReset}
                    className="text-xs font-medium text-[#263640] underline hover:text-[#DB001B]"
                  >
                    Forget your security PIN?
                  </button>
                </div>
              </div>
              <Button type="submit" fullWidth size="lg" loading={loading}>
                Continue
              </Button>
            </form>
          )}

          {/* PIN RESET STEP 1: ENTER RESET CODE */}
          {step === 'PIN_RESET_CODE' && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setAuthError('');
                if (resetCode.trim().length < 4) {
                  setAuthError('Enter the verification code sent to your registered email.');
                  return;
                }
                setStep('PIN_RESET_NEW');
              }}
              className="p-5 space-y-4 flex-1 flex flex-col justify-between"
            >
              <div className="space-y-4">
                <div className="text-xs text-[#68727A]">1/3 ENTER RESET CODE</div>
                <h1 className="text-base font-medium text-[#252B30]">Verify code</h1>
                <p className="text-xs text-[#68727A] leading-relaxed">
                  We have sent a verification code to <strong className="text-[#252B30]">{resetMaskedEmail}</strong>. Valid for 30 minutes.
                </p>
                {sandboxResetHint && (
                  <div className="p-2.5 bg-[#F4F5F6] border border-[#D9DEE1] text-[11px] text-[#252B30]">
                    Sandbox reset code: <strong className="font-mono">{sandboxResetHint}</strong>
                  </div>
                )}
                <FormInput
                  label="Enter reset code"
                  inputMode="numeric"
                  maxLength={8}
                  required
                  autoFocus
                  value={resetCode}
                  onChange={(e) => setResetCode(e.target.value)}
                  error={authError}
                />
              </div>
              <Button type="submit" fullWidth size="lg">
                Continue
              </Button>
            </form>
          )}

          {/* PIN RESET STEP 2: CREATE & CONFIRM NEW PIN */}
          {step === 'PIN_RESET_NEW' && (
            <form onSubmit={handleConfirmPinReset} className="p-5 space-y-4 flex-1 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="text-xs text-[#68727A]">2/3 CREATE A SECURITY PIN</div>
                <h1 className="text-base font-medium text-[#252B30]">Create and confirm your new PIN</h1>
                <FormInput
                  label="Create a security PIN"
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  autoFocus
                  value={newResetPin}
                  onChange={(e) => setNewResetPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                />
                <FormInput
                  label="Confirm security PIN"
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  value={confirmResetPin}
                  onChange={(e) => setConfirmResetPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  error={authError}
                />
                <p className="text-[11px] text-[#68727A] bg-[#F4F5F6] p-3 border border-[#D9DEE1]">
                  You will need this PIN when confirming your identity on HSBC Cnet or approving instructions.
                </p>
              </div>
              <Button type="submit" fullWidth size="lg" loading={loading}>
                Continue
              </Button>
            </form>
          )}

          {/* PIN RESET ACKNOWLEDGEMENT */}
          {step === 'PIN_RESET_SUCCESS' && (
            <div className="p-6 flex-1 flex flex-col justify-between text-center">
              <div className="my-auto space-y-3">
                <CheckCircle2 className="w-12 h-12 text-[#27835B] mx-auto" strokeWidth={1.75} aria-hidden="true" />
                <h1 className="text-lg font-medium text-[#252B30]">Success</h1>
                <p className="text-xs text-[#68727A]">
                  You can now log on to HSBC Cnet with your new Mobile Security PIN.
                </p>
              </div>
              <Button fullWidth size="lg" onClick={() => setStep('WELCOME')}>
                Continue
              </Button>
            </div>
          )}

          {/* SECURITY DEVICE CODE */}
          {step === 'SECURITY_CODE' && (
            <form onSubmit={handleSecurityCodeLogin} className="p-5 space-y-4 flex-1 flex flex-col justify-between">
              <div className="space-y-4">
                <h1 className="text-base font-medium text-[#252B30]">Security device code</h1>
                <p className="text-xs text-[#68727A]">Enter the 8-digit code generated on your security device or mobile soft token.</p>
                <FormInput
                  label="Security code"
                  name="securityCode"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={8}
                  required
                  autoFocus
                  value={secCode}
                  onChange={(e) => setSecCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  error={authError}
                />
              </div>
              <Button type="submit" fullWidth size="lg" loading={loading}>
                Log on
              </Button>
            </form>
          )}

          {/* BIOMETRICS / WEBAUTHN PASSKEY */}
          {step === 'PASSKEY' && (
            <div className="p-5 space-y-4 flex-1 flex flex-col justify-between">
              <div className="space-y-4">
                <h1 className="text-base font-medium text-[#252B30]">Biometric logon</h1>
                <p className="text-xs text-[#68727A] leading-relaxed">
                  Verify using your platform authenticator (Face ID, Touch ID, Windows Hello, or browser passkey).
                </p>
                {authError && (
                  <div role="alert" className="p-3 bg-[#FDF2F3] border-l-4 border-[#C83A42] text-xs text-[#C83A42]">
                    {authError}
                  </div>
                )}
              </div>
              <div className="space-y-2.5">
                <Button onClick={handlePasskeyAuth} loading={loading} fullWidth size="lg">
                  <Fingerprint className="w-4 h-4" aria-hidden="true" />
                  Verify with Biometrics
                </Button>
                <Button variant="outline" onClick={() => setStep('PIN')} fullWidth>
                  Use Mobile Security PIN instead
                </Button>
              </div>
            </div>
          )}

          {/* PUSH APPROVAL CHALLENGE */}
          {step === 'MOBILE_PUSH' && pushApproval && (
            <div className="p-5 space-y-4 flex-1 flex flex-col justify-between">
              <div className="space-y-4">
                <h1 className="text-base font-medium text-[#252B30]">We&apos;ve sent a notification</h1>
                <p className="text-xs text-[#68727A]">
                  Open the notification on your registered mobile device and match this challenge number:
                </p>
                <div className="p-6 bg-[#F4F5F6] border border-[#D9DEE1] text-center">
                  <div className="text-3xl font-semibold text-[#252B30] tabular-nums tracking-wider">
                    {pushApproval.challengeCode}
                  </div>
                </div>
                <p className="text-[11px] text-[#68727A] text-center">Waiting for approval from your registered device...</p>
              </div>
              <Button variant="outline" fullWidth onClick={() => setStep('PIN')}>
                Use Mobile Security PIN instead
              </Button>
            </div>
          )}

          {/* SUCCESSFUL LOGON CONFIRMATION */}
          {step === 'SUCCESS' && verifiedSession && (
            <div className="p-6 flex-1 flex flex-col justify-between">
              <div className="my-auto text-center space-y-3">
                <CheckCircle2 className="w-12 h-12 text-[#27835B] mx-auto" strokeWidth={1.75} aria-hidden="true" />
                <h1 className="text-lg font-medium text-[#252B30]">Logon successful</h1>
                <p className="text-xs text-[#68727A]">
                  Authenticated as <strong className="text-[#252B30]">{verifiedSession.user.full_name}</strong>
                  <br />
                  {verifiedSession.user.organisationName}
                </p>
              </div>
              <Button fullWidth size="lg" onClick={() => completeLogin(verifiedSession.accessToken, verifiedSession.user)}>
                Go to Accounts
              </Button>
            </div>
          )}

          {/* FAILED / LOCKED ACCOUNT */}
          {(step === 'FAILED' || step === 'LOCKED_ACCOUNT') && (
            <div className="p-6 flex-1 flex flex-col justify-between">
              <div className="my-auto text-center space-y-3">
                <ShieldAlert className="w-12 h-12 text-[#C83A42] mx-auto" strokeWidth={1.75} aria-hidden="true" />
                <h1 className="text-lg font-medium text-[#252B30]">
                  {step === 'LOCKED_ACCOUNT' ? 'Security PIN locked' : 'Logon unsuccessful'}
                </h1>
                <p className="text-xs text-[#68727A] leading-relaxed">{authError}</p>
              </div>
              <div className="space-y-2">
                {step === 'LOCKED_ACCOUNT' && (
                  <Button fullWidth onClick={handleRequestPinReset} loading={loading}>
                    Reset your security PIN
                  </Button>
                )}
                <Button fullWidth variant="outline" onClick={() => { setAuthError(''); setStep('WELCOME'); }}>
                  Return to Welcome
                </Button>
              </div>
            </div>
          )}

          {/* GENERATE CODE STEP 1: USERNAME */}
          {step === 'GENERATE_CODE_USERNAME' && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setAuthError('');
                if (genUsername.trim().length < 3) {
                  setAuthError('Enter your corporate username.');
                  return;
                }
                setStep('GENERATE_CODE_ACTION');
              }}
              className="p-5 space-y-4 flex-1 flex flex-col justify-between"
            >
              <div className="space-y-4">
                <h1 className="text-base font-medium text-[#252B30]">Enter your username</h1>
                <FormInput
                  label="HSBC Cnet username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  required
                  autoFocus
                  value={genUsername}
                  onChange={(e) => setGenUsername(e.target.value)}
                  error={authError}
                />
                <div className="p-3 bg-[#F4F5F6] border border-[#D9DEE1] text-[11px] text-[#68727A] flex gap-2">
                  <Info className="w-4 h-4 shrink-0 text-[#263640]" aria-hidden="true" />
                  <span>Please enter the corporate username registered to your security profile.</span>
                </div>
              </div>
              <Button type="submit" fullWidth size="lg">
                Continue
              </Button>
            </form>
          )}

          {/* GENERATE CODE STEP 2: 3 CLEAR MOBILE AUTH ACTIONS (logon_with_mobile.pdf p.6) */}
          {step === 'GENERATE_CODE_ACTION' && (
            <div>
              <div className="px-4 py-3 bg-[#F4F5F6] border-b border-[#D9DEE1] text-xs text-[#68727A]">
                Select security action for <strong className="text-[#252B30]">{genUsername}</strong>
              </div>
              <div className="divide-y divide-[#D9DEE1] border-b border-[#D9DEE1]">
                {(
                  [
                    { id: 'LOGIN', title: 'Log on', desc: 'Access HSBC Cnet on desktop browser' },
                    { id: 'REAUTHENTICATE', title: 'Re-authenticate', desc: 'Verify your identity to access some functions' },
                    { id: 'AUTHORISATION', title: 'Confirm an instruction', desc: 'Authorise a transaction or request' },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setGenAction(item.id);
                      setGenPin('');
                      setAuthError('');
                      setStep('GENERATE_CODE_VERIFY');
                    }}
                    className={`w-full px-4 py-4 flex items-center justify-between text-left transition-colors ${
                      genAction === item.id ? 'bg-[#F4F5F6]' : 'bg-white hover:bg-[#F4F5F6]'
                    }`}
                  >
                    <div>
                      <div className="text-sm font-medium text-[#252B30]">{item.title}</div>
                      <div className="text-xs text-[#68727A] mt-0.5">{item.desc}</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#68727A]" aria-hidden="true" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* GENERATE CODE STEP 3: VERIFY PIN */}
          {step === 'GENERATE_CODE_VERIFY' && (
            <form onSubmit={handleGenerateCodeFlow} className="p-5 space-y-4 flex-1 flex flex-col justify-between">
              <div className="space-y-4">
                <h1 className="text-base font-medium text-[#252B30] text-center">Enter your security PIN</h1>
                <PinSlotDisplay value={genPin} />
                <FormInput
                  label="Security PIN"
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  autoFocus
                  value={genPin}
                  onChange={(e) => setGenPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  error={authError}
                />
                <div className="p-3 bg-[#F4F5F6] border border-[#D9DEE1] text-[11px] text-[#68727A] flex gap-2">
                  <Info className="w-4 h-4 shrink-0 text-[#263640]" aria-hidden="true" />
                  <span>If you enter the wrong security PIN, the security code generated will not authenticate.</span>
                </div>
              </div>
              <Button type="submit" fullWidth size="lg" loading={loading}>
                Continue
              </Button>
            </form>
          )}

          {/* GENERATE CODE STEP 4: DISPLAY BACKEND CODE */}
          {step === 'GENERATE_CODE_RESULT' && generatedCode && (
            <div className="p-5 space-y-5 flex-1 flex flex-col justify-between">
              <div className="space-y-4">
                <h1 className="text-base font-medium text-[#252B30]">Your security code</h1>
                <div className="p-5 bg-[#F4F5F6] border border-[#D9DEE1] text-center">
                  <div className="text-3xl font-mono font-semibold tracking-[0.25em] text-[#252B30] tabular-nums">
                    {generatedCode.code}
                  </div>
                </div>
                <p className="text-xs text-[#252B30]">
                  Security code is available for{' '}
                  <strong className="tabular-nums">{remainingSeconds} seconds</strong>.
                </p>
                <div className="p-3 bg-[#F4F5F6] border border-[#D9DEE1] text-[11px] text-[#68727A] space-y-1">
                  <p>Please use this code before it expires ({genAction.toLowerCase()}).</p>
                  <p>To keep your corporate account safe, never share your security codes with anyone.</p>
                </div>
              </div>
              <Button fullWidth variant="outline" onClick={() => { setGeneratedCode(null); setStep('WELCOME'); }}>
                Done
              </Button>
            </div>
          )}

          {/* PUBLIC TRADE TRANSACTION TRACKER ENTRY POINT */}
          {step === 'TRADE_TRACKER_PUBLIC' && (
            <div className="p-5 space-y-5 flex-1 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-[#263640]">
                  <Ship className="w-5 h-5" aria-hidden="true" />
                  <h1 className="text-base font-medium text-[#252B30]">Trade Transaction Tracker</h1>
                </div>
                <p className="text-xs text-[#68727A] leading-relaxed">
                  Track status updates for Documentary Credits, Amendments, and Import Bills by reference number, or sign on for full corporate trade workflows.
                </p>
                <form onSubmit={handlePublicTradeLookup} className="space-y-3">
                  <FormInput
                    label="Trade Transaction Reference"
                    placeholder="e.g. TRD-2026-11092"
                    value={tradeTrackQuery}
                    onChange={(e) => setTradeTrackQuery(e.target.value)}
                  />
                  <Button type="submit" variant="secondary" fullWidth>
                    Track Reference (Sandbox)
                  </Button>
                </form>

                {tradeTrackSample && (
                  <div className="p-4 bg-[#F4F5F6] border border-[#D9DEE1] space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <strong className="text-[#252B30]">{tradeTrackSample.reference}</strong>
                      <span className="px-2 py-0.5 bg-white border border-[#D9DEE1] text-[11px] font-medium text-[#B77A1D]">
                        {tradeTrackSample.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="text-[#68727A]">{tradeTrackSample.type}</div>
                    <ul className="pt-2 space-y-1.5 border-t border-[#D9DEE1]">
                      {tradeTrackSample.timeline.map((t: any) => (
                        <li key={t.label} className="text-[#252B30]">
                          <strong>{t.label}:</strong> <span className="text-[#68727A]">{t.detail}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <Button fullWidth onClick={() => setStep('WELCOME')}>
                Log on to Full Trade Portal
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Security Info Modal */}
      <NativeDialog open={securityInfoOpen} onClose={() => setSecurityInfoOpen(false)} title="Security Information">
        <div className="space-y-3 text-xs text-[#68727A] leading-relaxed">
          <p className="text-[#252B30]">
            Always verify the exact beneficiary details and amounts before authorising any instruction. Never disclose your PIN or security codes.
          </p>
          <p>{BANK_CONFIG.disclaimer}</p>
        </div>
      </NativeDialog>
    </main>
  );
};
