import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Eye,
  EyeOff,
  Fingerprint,
  HelpCircle,
  KeyRound,
  Lock,
  RefreshCw,
  Shield,
  ShieldAlert,
  Ship,
  Smartphone,
  Clock,
} from 'lucide-react';
import { useAuth, AuthUser } from '../../context/AuthContext';
import { apiRequest, ApiError } from '../../lib/api';
import { BrandMark } from '../../components/ui/BrandMark';
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
  | 'SELECT_METHOD'
  | 'PASSWORD'
  | 'PIN'
  | 'SECURITY_CODE'
  | 'MOBILE_PUSH'
  | 'PASSKEY'
  | 'SUCCESS'
  | 'FAILED'
  | 'LOCKED_ACCOUNT'
  | 'GENERATE_CODE_USERNAME'
  | 'GENERATE_CODE_VERIFY'
  | 'GENERATE_CODE_RESULT'
  | 'TRADE_TRACKER_PUBLIC';

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

export const EntryExperience: React.FC = () => {
  const { phase, initError, retryInit, completeLogin, user, unlockSession, logout } = useAuth();

  const [step, setStep] = useState<AuthStep>('WELCOME');
  const [username, setUsername] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [lookup, setLookup] = useState<LookupProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pin, setPin] = useState('');
  const [secCode, setSecCode] = useState('');
  const [genUsername, setGenUsername] = useState('');
  const [genPin, setGenPin] = useState('');
  const [generatedCode, setGeneratedCode] = useState<{ code: string; expiresAt: string; ttlSeconds: number } | null>(null);
  const [pushApproval, setPushApproval] = useState<{ requestId: string; challengeCode: string; status: string } | null>(null);
  const [passkeyCap, setPasskeyCap] = useState({ webauthnSupported: false, platformAuthenticatorAvailable: false });
  const [verifiedSession, setVerifiedSession] = useState<{ accessToken: string; user: AuthUser } | null>(null);

  const [helpOpen, setHelpOpen] = useState(false);
  const [securityInfoOpen, setSecurityInfoOpen] = useState(false);

  const [unlockPin, setUnlockPin] = useState('');
  const [unlockError, setUnlockError] = useState('');
  const [unlockLoading, setUnlockLoading] = useState(false);

  useEffect(() => {
    detectPasskeySupport().then((s) => setPasskeyCap(s));
  }, []);

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
          setAuthError(res.status === 'REJECTED' ? 'Login request was declined on your registered device.' : 'Login request expired.');
          setStep('FAILED');
        }
      } catch {
        // Ignore transient poll errors
      }
    }, 2000);

    return () => window.clearInterval(timer);
  }, [step, pushApproval]);

  // 1. Launch / Splash Screen (Clean white HSBCnet Mobile launch sequence)
  if (phase === 'LAUNCHING') {
    return (
      <main className="min-h-dvh bg-white flex flex-col items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.35 }}
          className="flex flex-col items-center text-center"
        >
          <BrandMark size={48} />
          <h1 className="mt-4 text-xl font-bold tracking-tight text-[#252525]">{BANK_CONFIG.appName}</h1>
          <div className="mt-5 w-28 h-0.5 bg-[#EBEBEB] overflow-hidden">
            <div className="h-full w-1/2 bg-[#DB0011] animate-pulse" />
          </div>
        </motion.div>
      </main>
    );
  }

  // 2. Network / Init Failure Screen
  if (phase === 'INIT_ERROR') {
    return (
      <main className="min-h-dvh bg-[#F4F4F4] flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white border border-[#D7D8D6] rounded-[2px] p-6 text-center">
          <BrandMark size={36} className="mx-auto" />
          <h1 className="mt-4 text-base font-semibold text-[#252525]">Unable to Connect</h1>
          <p className="mt-2 text-xs text-[#555555] leading-relaxed">{initError}</p>
          <div className="mt-5">
            <Button onClick={retryInit} fullWidth>
              <RefreshCw className="w-4 h-4" aria-hidden="true" />
              Try again
            </Button>
          </div>
        </div>
      </main>
    );
  }

  // 3. Session Lock Screen
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
        setUnlockError(err?.message || 'Biometric verification unavailable. Please use your Mobile Security PIN.');
      } finally {
        setUnlockLoading(false);
      }
    };

    return (
      <main className="min-h-dvh bg-[#252525] flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white rounded-[2px] border border-[#D7D8D6] p-6">
          <div className="flex items-center gap-3 pb-4 border-b border-[#D7D8D6]">
            <Lock className="w-5 h-5 text-[#DB0011] shrink-0" aria-hidden="true" />
            <div>
              <h1 className="text-base font-semibold text-[#252525]">Session locked</h1>
              <p className="text-xs text-[#767676]">{user.full_name}</p>
            </div>
          </div>

          <form onSubmit={handleUnlockWithPin} className="mt-5 space-y-4">
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
              Unlock
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

          <div className="mt-5 pt-4 border-t border-[#D7D8D6] text-center">
            <button type="button" onClick={logout} className="text-xs font-semibold text-[#DB0011] hover:underline">
              Log off
            </button>
          </div>
        </div>
      </main>
    );
  }

  const handleUsernameLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setUsernameError('');
    setAuthError('');
    const trimmed = username.trim();
    if (trimmed.length < 3) {
      setUsernameError('Please enter your username.');
      return;
    }
    setLoading(true);
    try {
      const res = await apiRequest<{ success: boolean; profile: LookupProfile }>('/api/auth/lookup', {
        method: 'POST',
        body: JSON.stringify({ identifier: trimmed }),
        skipAuthHandling: true,
      });
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
        body: JSON.stringify({ identifier: genUsername.trim(), purpose: 'LOGIN' }),
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
        throw new Error('No biometric passkey is registered on this device yet. Log on with your Mobile Security PIN or Password first, then enable biometrics in Settings.');
      }
      const publicKey = parseRequestOptions(optionsJson);
      const cred = (await navigator.credentials.get({ publicKey })) as PublicKeyCredential | null;
      if (!cred) throw new Error('Biometric prompt cancelled.');
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
      setAuthError(err?.message || 'Biometric verification failed. Use Mobile Security PIN or Password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-dvh bg-white sm:bg-[#F4F4F4] flex flex-col">
      {/* Authentic HSBCnet Mobile Top Bar */}
      <header className="bg-white border-b border-[#D7D8D6]">
        <div className="max-w-md mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <BrandMark size={24} />
            <span className="text-base font-bold text-[#252525] tracking-tight">{BANK_CONFIG.appName}</span>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <button
              type="button"
              onClick={() => setSecurityInfoOpen(true)}
              className="text-[#555555] hover:text-[#252525] font-medium"
            >
              Security
            </button>
            <button
              type="button"
              aria-label="Help and support"
              onClick={() => setHelpOpen(true)}
              className="p-1.5 text-[#555555] hover:text-[#252525]"
            >
              <HelpCircle className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile-First Centered App Flow (Clean single-column experience matching HSBCnet Mobile) */}
      <div className="flex-1 flex flex-col sm:justify-center sm:py-8">
        <div className="w-full max-w-md mx-auto bg-white sm:border sm:border-[#D7D8D6] flex-1 sm:flex-initial flex flex-col justify-between">
          <div>
            {phase === 'SESSION_EXPIRED' && step === 'WELCOME' && (
              <div role="alert" className="p-3.5 bg-[#FEF7EC] border-b border-[#FCD9A5] text-xs text-[#9A4A06] flex items-center gap-2">
                <Clock className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Your session has timed out. Please log on again.</span>
              </div>
            )}

            <div className="p-5 sm:p-7">
              {/* STEP 1: WELCOME & ENTER USERNAME */}
              {step === 'WELCOME' && (
                <div>
                  <h1 className="text-2xl font-semibold text-[#252525] tracking-tight">Welcome</h1>
                  <p className="mt-1.5 text-sm text-[#555555]">
                    Log on to {BANK_CONFIG.appName} to manage your global accounts and authorisations.
                  </p>

                  <form onSubmit={handleUsernameLookup} className="mt-6 space-y-4">
                    <FormInput
                      label="Username"
                      name="username"
                      placeholder="Enter your username"
                      autoComplete="username webauthn"
                      autoCorrect="off"
                      autoCapitalize="none"
                      spellCheck={false}
                      enterKeyHint="next"
                      required
                      requiredMark
                      autoFocus
                      value={username}
                      onChange={(e) => {
                        setUsername(e.target.value);
                        if (usernameError) setUsernameError('');
                      }}
                      error={usernameError}
                    />

                    <Button type="submit" fullWidth size="lg" loading={loading}>
                      Continue
                    </Button>
                  </form>
                </div>
              )}

              {/* STEP 2: CHOOSE AUTHENTICATION METHOD */}
              {step === 'SELECT_METHOD' && lookup && (
                <div>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthError('');
                      setStep('WELCOME');
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#DB0011] hover:underline mb-4"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
                    Back
                  </button>

                  <div className="pb-4 border-b border-[#D7D8D6] mb-5">
                    <div className="text-xs text-[#767676]">Logging on as</div>
                    <div className="text-base font-semibold text-[#252525] mt-0.5">{lookup.fullName}</div>
                    <div className="text-xs text-[#555555]">{lookup.organisationName}</div>
                  </div>

                  <h1 className="text-lg font-semibold text-[#252525] mb-3">Log on method</h1>

                  {authError && (
                    <div role="alert" className="mb-4 p-3 bg-[#FDF2F2] border-l-4 border-[#DB0011] text-xs text-[#B0000D] flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{authError}</span>
                    </div>
                  )}

                  <div className="divide-y divide-[#D7D8D6] border-y border-[#D7D8D6] -mx-5 sm:-mx-7">
                    {passkeyCap.webauthnSupported && (
                      <button
                        type="button"
                        onClick={() => {
                          setAuthError('');
                          setStep('PASSKEY');
                        }}
                        className="w-full px-5 sm:px-7 py-4 flex items-center justify-between hover:bg-[#F4F4F4] text-left"
                      >
                        <div className="flex items-center gap-3">
                          <Fingerprint className="w-5 h-5 text-[#DB0011]" />
                          <div>
                            <div className="text-sm font-semibold text-[#252525]">Biometrics</div>
                            <div className="text-xs text-[#767676]">Face ID / Touch ID / Passkey</div>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-[#767676]" />
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
                        className="w-full px-5 sm:px-7 py-4 flex items-center justify-between hover:bg-[#F4F4F4] text-left"
                      >
                        <div className="flex items-center gap-3">
                          <Smartphone className="w-5 h-5 text-[#252525]" />
                          <div>
                            <div className="text-sm font-semibold text-[#252525]">Mobile Security PIN</div>
                            <div className="text-xs text-[#767676]">Enter your 6-digit PIN</div>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-[#767676]" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setAuthError('');
                        setPassword('');
                        setStep('PASSWORD');
                      }}
                      className="w-full px-5 sm:px-7 py-4 flex items-center justify-between hover:bg-[#F4F4F4] text-left"
                    >
                      <div className="flex items-center gap-3">
                        <Lock className="w-5 h-5 text-[#252525]" />
                        <div>
                          <div className="text-sm font-semibold text-[#252525]">Password</div>
                          <div className="text-xs text-[#767676]">Enter your corporate password</div>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-[#767676]" />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setAuthError('');
                        setSecCode('');
                        setStep('SECURITY_CODE');
                      }}
                      className="w-full px-5 sm:px-7 py-4 flex items-center justify-between hover:bg-[#F4F4F4] text-left"
                    >
                      <div className="flex items-center gap-3">
                        <KeyRound className="w-5 h-5 text-[#252525]" />
                        <div>
                          <div className="text-sm font-semibold text-[#252525]">Security device code</div>
                          <div className="text-xs text-[#767676]">Enter an 8-digit security code</div>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-[#767676]" />
                    </button>

                    {lookup.methods.mobileAuth && (
                      <button
                        type="button"
                        onClick={handleStartPushApproval}
                        className="w-full px-5 sm:px-7 py-4 flex items-center justify-between hover:bg-[#F4F4F4] text-left"
                      >
                        <div className="flex items-center gap-3">
                          <Shield className="w-5 h-5 text-[#252525]" />
                          <div>
                            <div className="text-sm font-semibold text-[#252525]">Approve from registered device</div>
                            <div className="text-xs text-[#767676]">Send push notification approval</div>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-[#767676]" />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* STEP 3A: PASSWORD */}
              {step === 'PASSWORD' && (
                <form onSubmit={handlePasswordSubmit} className="space-y-4">
                  <button type="button" onClick={() => setStep('SELECT_METHOD')} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#DB0011] hover:underline">
                    <ArrowLeft className="w-3.5 h-3.5" /> Back
                  </button>
                  <h1 className="text-lg font-semibold text-[#252525]">Enter your password</h1>
                  <p className="text-xs text-[#767676]">Profile: {username}</p>
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
                        className="p-1.5 text-[#555555] hover:text-[#252525]"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    }
                  />
                  <Button type="submit" fullWidth size="lg" loading={loading}>
                    Log on
                  </Button>
                </form>
              )}

              {/* STEP 3B: MOBILE SECURITY PIN */}
              {step === 'PIN' && (
                <form onSubmit={handlePinSubmit} className="space-y-4">
                  <button type="button" onClick={() => setStep('SELECT_METHOD')} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#DB0011] hover:underline">
                    <ArrowLeft className="w-3.5 h-3.5" /> Back
                  </button>
                  <h1 className="text-lg font-semibold text-[#252525]">Mobile Security PIN</h1>
                  <p className="text-xs text-[#767676]">Enter your 6-digit PIN for {username}.</p>
                  <FormInput
                    label="6-Digit Security PIN"
                    name="pin"
                    type="password"
                    inputMode="numeric"
                    pattern="\d{6}"
                    maxLength={6}
                    required
                    requiredMark
                    autoFocus
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    error={authError}
                  />
                  <Button type="submit" fullWidth size="lg" loading={loading}>
                    Log on
                  </Button>
                </form>
              )}

              {/* STEP 3C: SECURITY CODE */}
              {step === 'SECURITY_CODE' && (
                <form onSubmit={handleSecurityCodeLogin} className="space-y-4">
                  <button type="button" onClick={() => setStep('SELECT_METHOD')} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#DB0011] hover:underline">
                    <ArrowLeft className="w-3.5 h-3.5" /> Back
                  </button>
                  <h1 className="text-lg font-semibold text-[#252525]">Security device code</h1>
                  <p className="text-xs text-[#767676]">Enter the temporary 8-digit code generated by your security device.</p>
                  <FormInput
                    label="Security code"
                    name="securityCode"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={8}
                    required
                    requiredMark
                    autoFocus
                    value={secCode}
                    onChange={(e) => setSecCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
                    error={authError}
                  />
                  <Button type="submit" fullWidth size="lg" loading={loading}>
                    Log on
                  </Button>
                </form>
              )}

              {/* STEP 3D: BIOMETRICS / PASSKEY */}
              {step === 'PASSKEY' && (
                <div className="space-y-4">
                  <button type="button" onClick={() => setStep('SELECT_METHOD')} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#DB0011] hover:underline">
                    <ArrowLeft className="w-3.5 h-3.5" /> Back
                  </button>
                  <h1 className="text-lg font-semibold text-[#252525]">Biometric logon</h1>
                  <p className="text-xs text-[#555555] leading-relaxed">
                    Verify your identity with your registered device biometrics / passkey.
                  </p>
                  {authError && <div role="alert" className="p-3 bg-[#FDF2F2] border-l-4 border-[#DB0011] text-xs text-[#B0000D]">{authError}</div>}
                  <Button onClick={handlePasskeyAuth} loading={loading} fullWidth size="lg">
                    <Fingerprint className="w-4 h-4" /> Verify with Biometrics
                  </Button>
                  <Button variant="outline" onClick={() => setStep('PIN')} fullWidth>
                    Use Mobile Security PIN instead
                  </Button>
                </div>
              )}

              {/* STEP 3E: MOBILE PUSH APPROVAL */}
              {step === 'MOBILE_PUSH' && pushApproval && (
                <div className="space-y-4">
                  <button type="button" onClick={() => setStep('SELECT_METHOD')} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#DB0011] hover:underline">
                    <ArrowLeft className="w-3.5 h-3.5" /> Cancel
                  </button>
                  <h1 className="text-lg font-semibold text-[#252525]">Approve logon request</h1>
                  <p className="text-xs text-[#555555]">Check your registered device and match the number below:</p>
                  <div className="p-6 bg-[#F4F4F4] border border-[#D7D8D6] text-center">
                    <div className="text-3xl font-bold text-[#252525] tabular-nums">{pushApproval.challengeCode}</div>
                  </div>
                  <Button variant="outline" fullWidth onClick={() => setStep('PIN')}>
                    Use Mobile Security PIN instead
                  </Button>
                </div>
              )}

              {/* STEP 4: LOGON CONFIRMATION */}
              {step === 'SUCCESS' && verifiedSession && (
                <div className="space-y-5 py-2">
                  <div className="flex items-center gap-2.5 text-[#008A52] font-semibold text-base">
                    <CheckCircle2 className="w-6 h-6" />
                    <span>Logon successful</span>
                  </div>
                  <p className="text-xs text-[#555555]">
                    Authenticated as <strong>{verifiedSession.user.full_name}</strong> ({verifiedSession.user.organisationName}).
                  </p>
                  <Button fullWidth size="lg" onClick={() => completeLogin(verifiedSession.accessToken, verifiedSession.user)}>
                    Go to Accounts
                  </Button>
                </div>
              )}

              {/* FAILED OR LOCKED */}
              {(step === 'FAILED' || step === 'LOCKED_ACCOUNT') && (
                <div className="space-y-4 py-2">
                  <div className="flex items-center gap-2 text-[#DB0011] font-semibold text-base">
                    <ShieldAlert className="w-6 h-6" />
                    <span>{step === 'LOCKED_ACCOUNT' ? 'Profile locked' : 'Logon unsuccessful'}</span>
                  </div>
                  <p className="text-xs text-[#555555] leading-relaxed">{authError}</p>
                  <Button fullWidth variant="outline" onClick={() => { setAuthError(''); setStep('WELCOME'); }}>
                    Return to Welcome
                  </Button>
                </div>
              )}

              {/* WELCOME -> GENERATE SECURITY CODE FLOW (Step 1: Username, Step 2: PIN, Step 3: Code) */}
              {step === 'GENERATE_CODE_USERNAME' && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    setAuthError('');
                    if (genUsername.trim().length < 3) {
                      setAuthError('Enter your username.');
                      return;
                    }
                    setStep('GENERATE_CODE_VERIFY');
                  }}
                  className="space-y-4"
                >
                  <button type="button" onClick={() => setStep('WELCOME')} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#DB0011] hover:underline">
                    <ArrowLeft className="w-3.5 h-3.5" /> Back
                  </button>
                  <h1 className="text-lg font-semibold text-[#252525]">Generate a security code</h1>
                  <p className="text-xs text-[#555555]">Enter your username to generate a code for desktop logon.</p>
                  <FormInput
                    label="Username"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    required
                    autoFocus
                    value={genUsername}
                    onChange={(e) => setGenUsername(e.target.value)}
                    error={authError}
                  />
                  <Button type="submit" fullWidth size="lg">Continue</Button>
                </form>
              )}

              {step === 'GENERATE_CODE_VERIFY' && (
                <form onSubmit={handleGenerateCodeFlow} className="space-y-4">
                  <button type="button" onClick={() => setStep('GENERATE_CODE_USERNAME')} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#DB0011] hover:underline">
                    <ArrowLeft className="w-3.5 h-3.5" /> Back
                  </button>
                  <h1 className="text-lg font-semibold text-[#252525]">Verify your identity</h1>
                  <p className="text-xs text-[#555555]">Enter your 6-digit Mobile Security PIN for <strong>{genUsername}</strong>.</p>
                  <FormInput
                    label="Mobile Security PIN"
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    required
                    autoFocus
                    value={genPin}
                    onChange={(e) => setGenPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    error={authError}
                  />
                  <Button type="submit" fullWidth size="lg" loading={loading}>Generate code</Button>
                </form>
              )}

              {step === 'GENERATE_CODE_RESULT' && generatedCode && (
                <div className="space-y-4">
                  <h1 className="text-lg font-semibold text-[#252525]">Your security code</h1>
                  <p className="text-xs text-[#555555]">Enter this code on your desktop browser within 2 minutes:</p>
                  <div className="p-5 bg-[#252525] text-white text-center rounded-[2px]">
                    <div className="text-3xl font-mono font-bold tracking-[0.25em] tabular-nums">{generatedCode.code}</div>
                  </div>
                  <Button fullWidth variant="outline" onClick={() => { setGeneratedCode(null); setStep('WELCOME'); }}>
                    Done
                  </Button>
                </div>
              )}

              {/* WELCOME -> TRADE TRANSACTION TRACKER */}
              {step === 'TRADE_TRACKER_PUBLIC' && (
                <div className="space-y-4">
                  <button type="button" onClick={() => setStep('WELCOME')} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#DB0011] hover:underline">
                    <ArrowLeft className="w-3.5 h-3.5" /> Back
                  </button>
                  <h1 className="text-lg font-semibold text-[#252525]">Trade transaction tracker</h1>
                  <p className="text-xs text-[#555555] leading-relaxed">
                    Log on with your corporate username to track import documentary credits, amendments, and bills under the Track tab.
                  </p>
                  <Button fullWidth onClick={() => setStep('WELCOME')}>Log on</Button>
                </div>
              )}
            </div>
          </div>

          {/* Authentic HSBCnet Mobile Welcome Bottom Action Rows */}
          {step === 'WELCOME' && (
            <div className="border-t border-[#D7D8D6] divide-y divide-[#D7D8D6]">
              <button
                type="button"
                onClick={() => {
                  setGenUsername(username);
                  setGenPin('');
                  setAuthError('');
                  setStep('GENERATE_CODE_USERNAME');
                }}
                className="w-full px-5 sm:px-7 py-4 flex items-center justify-between hover:bg-[#F4F4F4] text-left"
              >
                <span className="flex items-center gap-3 text-sm font-medium text-[#252525]">
                  <KeyRound className="w-4 h-4 text-[#DB0011]" aria-hidden="true" />
                  <span>Generate a security code</span>
                </span>
                <ChevronRight className="w-4 h-4 text-[#767676]" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setStep('TRADE_TRACKER_PUBLIC')}
                className="w-full px-5 sm:px-7 py-4 flex items-center justify-between hover:bg-[#F4F4F4] text-left"
              >
                <span className="flex items-center gap-3 text-sm font-medium text-[#252525]">
                  <Ship className="w-4 h-4 text-[#252525]" aria-hidden="true" />
                  <span>Trade transaction tracker</span>
                </span>
                <ChevronRight className="w-4 h-4 text-[#767676]" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setHelpOpen(true)}
                className="w-full px-5 sm:px-7 py-4 flex items-center justify-between hover:bg-[#F4F4F4] text-left"
              >
                <span className="flex items-center gap-3 text-sm font-medium text-[#252525]">
                  <HelpCircle className="w-4 h-4 text-[#252525]" aria-hidden="true" />
                  <span>Logon help &amp; support</span>
                </span>
                <ChevronRight className="w-4 h-4 text-[#767676]" aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Help Modal */}
      <NativeDialog open={helpOpen} onClose={() => setHelpOpen(false)} title="HSBC Cnet Logon Help">
        <div className="space-y-3 text-xs text-[#555555] leading-relaxed">
          <p>Enter your corporate username and press Continue to choose your authentication method (Biometrics, Mobile Security PIN, Password, or Security Code).</p>
          <p><strong>Test Profiles (Sandbox):</strong></p>
          <ul className="list-disc pl-5 space-y-1">
            <li><code>premier_user</code> / <code>Password@123</code> (Org Admin)</li>
            <li><code>corp_initiator</code> / <code>CorpPass@2026</code> (Initiator)</li>
            <li><code>corp_authoriser</code> / <code>CorpPass@2026</code> (Authoriser)</li>
            <li><code>corp_viewer</code> / <code>CorpPass@2026</code> (Viewer)</li>
            <li>Default 6-digit Mobile Security PIN: <code>123456</code></li>
          </ul>
        </div>
      </NativeDialog>

      {/* Security Info Modal */}
      <NativeDialog open={securityInfoOpen} onClose={() => setSecurityInfoOpen(false)} title="Security Information">
        <div className="space-y-3 text-xs text-[#555555] leading-relaxed">
          <p>Always keep your Mobile Security PIN and security codes confidential. Never authorise payments without checking beneficiary details and exact amounts.</p>
        </div>
      </NativeDialog>
    </main>
  );
};
