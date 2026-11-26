import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/database';
import { JWT_SECRET, JWT_REFRESH_SECRET, authenticateToken, AuthRequest, logAudit } from '../middleware/auth';

export const corporateAuthRouter = Router();

function buildUserSessionPayload(user: any) {
  const org = user.organisation_id
    ? (db.prepare(`SELECT * FROM organisations WHERE id = ?`).get(user.organisation_id) as any)
    : (db.prepare(`SELECT * FROM organisations LIMIT 1`).get() as any);

  const permissions = user.permissions_json
    ? JSON.parse(user.permissions_json)
    : ['VIEW_ACCOUNTS', 'VIEW_BALANCES', 'VIEW_TRANSACTIONS'];

  return {
    id: user.id,
    username: user.username,
    customer_id: user.customer_id,
    full_name: user.full_name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    organisationId: org?.id || 'org-meridian-gb',
    organisationName: org?.name || 'Meridian Global Manufacturing Ltd',
    country: org?.country || 'GB',
    baseCurrency: org?.base_currency || 'GBP',
    permissions,
    biometric_enabled: !!user.biometric_enabled,
    hasPinConfigured: !!user.security_pin_hash,
    mobileAuthActive: user.mobile_auth_active !== 0,
    preferredCurrency: user.preferred_currency || org?.base_currency || 'GBP',
    lastLoginAt: user.last_login_at || new Date().toISOString(),
  };
}

function issueTokensForUser(user: any, req: Request, ip: string, method: string) {
  const tokenPayload = {
    id: user.id,
    username: user.username,
    email: user.email,
    full_name: user.full_name,
    role: user.role,
  };
  const accessToken = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '2h' });
  const refreshToken = jwt.sign(tokenPayload, JWT_REFRESH_SECRET, { expiresIn: '7d' });

  const sessionTokenHash = bcrypt.hashSync(refreshToken, 8);
  db.prepare(`
    INSERT INTO auth_sessions (id, user_id, refresh_token_hash, device_name, ip_address, expires_at)
    VALUES (?, ?, ?, ?, ?, datetime('now', '+7 days'))
  `).run(
    uuidv4(),
    user.id,
    sessionTokenHash,
    (req.headers['user-agent'] as string) || 'Corporate Web Portal',
    ip
  );

  db.prepare(`UPDATE users SET failed_logins = 0, last_login_at = datetime('now') WHERE id = ?`).run(user.id);
  logAudit(user.id, user.role, 'LOGIN_SUCCESS', 'USER', user.id, { method }, ip);

  return {
    user: buildUserSessionPayload(user),
    accessToken,
    refreshToken,
  };
}

// POST /api/auth/lookup - Multi-stage welcome screen username lookup
corporateAuthRouter.post('/lookup', (req: Request, res: Response): void => {
  const { identifier } = req.body;
  if (!identifier || typeof identifier !== 'string' || !identifier.trim()) {
    res.status(400).json({ success: false, error: 'Please enter a valid corporate username or Customer ID.' });
    return;
  }

  const trimmed = identifier.trim();
  const user = db.prepare(`
    SELECT u.*, cp.customer_id
    FROM users u
    LEFT JOIN customer_profiles cp ON cp.user_id = u.id
    WHERE u.username = ? OR cp.customer_id = ? OR u.email = ?
  `).get(trimmed, trimmed, trimmed) as any;

  if (!user) {
    res.status(404).json({ success: false, error: 'Username or profile ID not recognised. Please verify your corporate credentials.' });
    return;
  }

  if (!user.is_active) {
    res.status(403).json({ success: false, error: 'This user profile is suspended. Contact your Organisation Administrator.' });
    return;
  }

  if (user.is_locked) {
    res.status(403).json({ success: false, error: 'Profile is locked after consecutive failed attempts. Contact your administrator to unlock.' });
    return;
  }

  const passkeys = db.prepare(`SELECT COUNT(*) as count FROM webauthn_credentials WHERE user_id = ?`).get(user.id) as { count: number };
  const org = user.organisation_id
    ? (db.prepare(`SELECT name, country FROM organisations WHERE id = ?`).get(user.organisation_id) as any)
    : null;

  res.json({
    success: true,
    profile: {
      username: user.username,
      fullName: user.full_name,
      organisationName: org?.name || 'Meridian Global Manufacturing Ltd',
      country: org?.country || 'GB',
      methods: {
        password: true,
        securityPin: !!user.security_pin_hash,
        mobileAuth: user.mobile_auth_active !== 0,
        securityCode: true,
        passkey: passkeys.count > 0 || !!user.biometric_enabled,
        passkeyCount: passkeys.count,
      },
    },
  });
});

// POST /api/auth/login-pin - Authenticate via 6-digit Mobile Security PIN
corporateAuthRouter.post('/login-pin', (req: Request, res: Response): void => {
  const { identifier, pin } = req.body;
  const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

  if (!identifier || !pin || !/^\d{6}$/.test(String(pin))) {
    res.status(400).json({ success: false, error: 'Username and a valid 6-digit Security PIN are required.' });
    return;
  }

  const user = db.prepare(`
    SELECT u.*, cp.customer_id
    FROM users u
    LEFT JOIN customer_profiles cp ON cp.user_id = u.id
    WHERE u.username = ? OR cp.customer_id = ?
  `).get(identifier, identifier) as any;

  if (!user || !user.security_pin_hash) {
    res.status(401).json({ success: false, error: 'Security PIN is not configured for this profile.' });
    return;
  }
  if (user.is_locked) {
    res.status(403).json({ success: false, error: 'Account locked due to security policy.' });
    return;
  }

  const match = bcrypt.compareSync(String(pin), user.security_pin_hash);
  if (!match) {
    const newFailed = (user.failed_logins || 0) + 1;
    const isLocked = newFailed >= 5 ? 1 : 0;
    db.prepare(`UPDATE users SET failed_logins = ?, is_locked = ? WHERE id = ?`).run(newFailed, isLocked, user.id);
    logAudit(user.id, user.role, 'PIN_LOGIN_FAILED', 'USER', user.id, { attempts: newFailed }, ip);
    res.status(401).json({
      success: false,
      error: isLocked ? 'Account locked after 5 failed PIN attempts.' : `Incorrect Security PIN (${5 - newFailed} attempts remaining).`,
    });
    return;
  }

  res.json({ success: true, ...issueTokensForUser(user, req, ip, 'MOBILE_SECURITY_PIN') });
});

// POST /api/auth/security-code/generate - Backend-generated time-limited security code
corporateAuthRouter.post('/security-code/generate', (req: Request, res: Response): void => {
  const { identifier, purpose = 'LOGIN' } = req.body;
  if (!identifier) {
    res.status(400).json({ success: false, error: 'Corporate username is required to generate a security code.' });
    return;
  }

  const user = db.prepare(`SELECT id, username, role, is_locked FROM users WHERE username = ? OR email = ?`).get(identifier, identifier) as any;
  if (!user) {
    res.status(404).json({ success: false, error: 'Corporate profile not found.' });
    return;
  }
  if (user.is_locked) {
    res.status(403).json({ success: false, error: 'Account is locked.' });
    return;
  }

  const code = String(crypto.randomInt(10000000, 99999999)); // 8-digit soft-token code
  const codeHash = bcrypt.hashSync(code, 8);
  const expiresAt = new Date(Date.now() + 120 * 1000).toISOString();

  db.prepare(`
    INSERT INTO security_codes (id, user_id, code_hash, purpose, expires_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(uuidv4(), user.id, codeHash, purpose, expiresAt);

  logAudit(user.id, user.role, 'SECURITY_CODE_GENERATED', 'SECURITY_CODE', user.id, { purpose });

  res.json({
    success: true,
    code,
    expiresAt,
    ttlSeconds: 120,
    purpose,
  });
});

// POST /api/auth/login-security-code - Verify backend-generated code and sign in
corporateAuthRouter.post('/login-security-code', (req: Request, res: Response): void => {
  const { identifier, code } = req.body;
  const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

  if (!identifier || !code) {
    res.status(400).json({ success: false, error: 'Username and security code are required.' });
    return;
  }

  const user = db.prepare(`
    SELECT u.*, cp.customer_id
    FROM users u
    LEFT JOIN customer_profiles cp ON cp.user_id = u.id
    WHERE u.username = ? OR cp.customer_id = ?
  `).get(identifier, identifier) as any;

  if (!user) {
    res.status(401).json({ success: false, error: 'Invalid user profile.' });
    return;
  }

  const activeCodes = db.prepare(`
    SELECT * FROM security_codes
    WHERE user_id = ? AND used_at IS NULL AND expires_at > datetime('now')
    ORDER BY created_at DESC LIMIT 5
  `).all(user.id) as any[];

  const matched = activeCodes.find((c) => bcrypt.compareSync(String(code).trim(), c.code_hash));
  if (!matched) {
    logAudit(user.id, user.role, 'SECURITY_CODE_FAILED', 'SECURITY_CODE', user.id, { reason: 'Invalid or expired' }, ip);
    res.status(401).json({ success: false, error: 'Invalid or expired security code. Generate a new code and try again.' });
    return;
  }

  db.prepare(`UPDATE security_codes SET used_at = datetime('now') WHERE id = ?`).run(matched.id);
  res.json({ success: true, ...issueTokensForUser(user, req, ip, 'SECURITY_CODE') });
});

// POST /api/auth/pin/verify - Step-up PIN re-authentication for signed-in users
corporateAuthRouter.post('/pin/verify', authenticateToken, (req: AuthRequest, res: Response): void => {
  const { pin } = req.body;
  if (!pin || !/^\d{6}$/.test(String(pin))) {
    res.status(400).json({ success: false, error: 'Enter your 6-digit Security PIN.' });
    return;
  }

  const user = db.prepare(`SELECT * FROM users WHERE id = ?`).get(req.user!.id) as any;
  if (!user || !user.security_pin_hash) {
    res.status(400).json({ success: false, error: 'Security PIN is not configured.' });
    return;
  }

  const match = bcrypt.compareSync(String(pin), user.security_pin_hash);
  if (!match) {
    logAudit(user.id, user.role, 'STEP_UP_PIN_FAILED', 'USER', user.id, {});
    res.status(401).json({ success: false, error: 'Incorrect Security PIN.' });
    return;
  }

  const reauthToken = jwt.sign({ uid: user.id, stepUp: true }, JWT_SECRET, { expiresIn: '5m' });
  logAudit(user.id, user.role, 'STEP_UP_PIN_VERIFIED', 'USER', user.id, {});
  res.json({ success: true, reauthToken, expiresInSeconds: 300 });
});

// POST /api/auth/pin/set - Configure or update 6-digit Security PIN
corporateAuthRouter.post('/pin/set', authenticateToken, (req: AuthRequest, res: Response): void => {
  const { currentPassword, newPin } = req.body;
  if (!newPin || !/^\d{6}$/.test(String(newPin))) {
    res.status(400).json({ success: false, error: 'Security PIN must be exactly 6 digits.' });
    return;
  }

  const user = db.prepare(`SELECT * FROM users WHERE id = ?`).get(req.user!.id) as any;
  if (!user) {
    res.status(404).json({ success: false, error: 'User not found.' });
    return;
  }

  if (currentPassword && !bcrypt.compareSync(currentPassword, user.password_hash)) {
    res.status(401).json({ success: false, error: 'Current password verification failed.' });
    return;
  }

  const pinHash = bcrypt.hashSync(String(newPin), 10);
  db.prepare(`UPDATE users SET security_pin_hash = ?, mobile_auth_active = 1 WHERE id = ?`).run(pinHash, user.id);
  logAudit(user.id, user.role, 'SECURITY_PIN_UPDATED', 'USER', user.id, {});

  res.json({ success: true, message: '6-digit Mobile Security PIN updated.' });
});

// Push Login Approval Workflow
corporateAuthRouter.post('/login-approval/request', (req: Request, res: Response): void => {
  const { identifier } = req.body;
  const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
  const user = db.prepare(`SELECT id, username, role FROM users WHERE username = ? OR email = ?`).get(identifier, identifier) as any;
  if (!user) {
    res.status(404).json({ success: false, error: 'User profile not found.' });
    return;
  }

  const requestId = uuidv4();
  const challengeCode = String(crypto.randomInt(10, 99));
  const expiresAt = new Date(Date.now() + 180 * 1000).toISOString();

  db.prepare(`
    INSERT INTO login_approval_requests (id, user_id, username, device_info, ip_address, challenge_code, status, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?)
  `).run(requestId, user.id, user.username, (req.headers['user-agent'] as string) || 'Desktop Browser', ip, challengeCode, expiresAt);

  res.json({ success: true, requestId, challengeCode, expiresAt });
});

corporateAuthRouter.get('/login-approval/pending', authenticateToken, (req: AuthRequest, res: Response): void => {
  const requests = db.prepare(`
    SELECT * FROM login_approval_requests
    WHERE user_id = ? AND status = 'PENDING' AND expires_at > datetime('now')
    ORDER BY created_at DESC
  `).all(req.user!.id);
  res.json({ success: true, requests });
});

corporateAuthRouter.post('/login-approval/:id/respond', authenticateToken, (req: AuthRequest, res: Response): void => {
  const { decision } = req.body; // APPROVED | REJECTED
  if (!['APPROVED', 'REJECTED'].includes(decision)) {
    res.status(400).json({ success: false, error: 'Invalid decision.' });
    return;
  }

  const existing = db.prepare(`SELECT * FROM login_approval_requests WHERE id = ? AND user_id = ?`).get(req.params.id, req.user!.id) as any;
  if (!existing) {
    res.status(404).json({ success: false, error: 'Approval request not found.' });
    return;
  }

  db.prepare(`UPDATE login_approval_requests SET status = ? WHERE id = ?`).run(decision, existing.id);
  logAudit(req.user!.id, req.user!.role, `PUSH_LOGIN_${decision}`, 'LOGIN_APPROVAL', existing.id, {});
  res.json({ success: true, status: decision });
});

corporateAuthRouter.get('/login-approval/:id/status', (req: Request, res: Response): void => {
  const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
  const reqRow = db.prepare(`SELECT * FROM login_approval_requests WHERE id = ?`).get(req.params.id) as any;
  if (!reqRow) {
    res.status(404).json({ success: false, error: 'Request not found.' });
    return;
  }
  if (reqRow.status === 'PENDING' && new Date(reqRow.expires_at) < new Date()) {
    db.prepare(`UPDATE login_approval_requests SET status = 'EXPIRED' WHERE id = ?`).run(reqRow.id);
    res.json({ success: true, status: 'EXPIRED' });
    return;
  }
  if (reqRow.status === 'APPROVED') {
    const user = db.prepare(`SELECT u.*, cp.customer_id FROM users u LEFT JOIN customer_profiles cp ON cp.user_id = u.id WHERE u.id = ?`).get(reqRow.user_id) as any;
    res.json({ success: true, status: 'APPROVED', ...issueTokensForUser(user, req, ip, 'PUSH_APPROVAL') });
    return;
  }
  res.json({ success: true, status: reqRow.status });
});

// Registered Devices Management
corporateAuthRouter.get('/devices', authenticateToken, (req: AuthRequest, res: Response): void => {
  const devices = db.prepare(`SELECT * FROM registered_devices WHERE user_id = ? ORDER BY registered_at DESC`).all(req.user!.id);
  const passkeys = db.prepare(`SELECT id, credential_id, name, device_type, transports, last_used_at, created_at FROM webauthn_credentials WHERE user_id = ? ORDER BY created_at DESC`).all(req.user!.id);
  res.json({ success: true, devices, passkeys });
});

corporateAuthRouter.post('/devices', authenticateToken, (req: AuthRequest, res: Response): void => {
  const { deviceName, platform = 'Web Browser', deviceType = 'MOBILE_AUTH' } = req.body;
  if (!deviceName) {
    res.status(400).json({ success: false, error: 'Device name is required.' });
    return;
  }
  const id = uuidv4();
  db.prepare(`
    INSERT INTO registered_devices (id, user_id, device_name, platform, device_type, status, last_used_at)
    VALUES (?, ?, ?, ?, ?, 'ACTIVE', datetime('now'))
  `).run(id, req.user!.id, deviceName, platform, deviceType);
  db.prepare(`UPDATE users SET mobile_auth_active = 1 WHERE id = ?`).run(req.user!.id);
  logAudit(req.user!.id, req.user!.role, 'DEVICE_REGISTERED', 'DEVICE', id, { deviceName, deviceType });
  const created = db.prepare(`SELECT * FROM registered_devices WHERE id = ?`).get(id);
  res.json({ success: true, device: created });
});

corporateAuthRouter.post('/devices/:id/deactivate', authenticateToken, (req: AuthRequest, res: Response): void => {
  db.prepare(`UPDATE registered_devices SET status = 'DEACTIVATED' WHERE id = ? AND user_id = ?`).run(req.params.id, req.user!.id);
  logAudit(req.user!.id, req.user!.role, 'DEVICE_DEACTIVATED', 'DEVICE', req.params.id, {});
  res.json({ success: true, message: 'Device deactivated.' });
});

// WebAuthn / Passkey Registration, Auth & Step-Up Reauthentication
function getRpId(req: Request): string {
  const host = (req.headers.host || 'localhost').split(':')[0];
  return host || 'localhost';
}

corporateAuthRouter.post('/webauthn/register/options', authenticateToken, (req: AuthRequest, res: Response): void => {
  const user = db.prepare(`SELECT * FROM users WHERE id = ?`).get(req.user!.id) as any;
  const existing = db.prepare(`SELECT credential_id, transports FROM webauthn_credentials WHERE user_id = ?`).all(user.id) as any[];
  const challenge = crypto.randomBytes(32).toString('base64url');
  const rpId = getRpId(req);

  db.prepare(`INSERT INTO webauthn_challenges (id, user_id, challenge, type, expires_at) VALUES (?, ?, ?, 'REGISTRATION', datetime('now', '+5 minutes'))`)
    .run(uuidv4(), user.id, challenge);

  res.json({
    challenge,
    rp: { id: rpId, name: 'MeridianNet Corporate Banking' },
    user: {
      id: Buffer.from(user.id).toString('base64url'),
      name: user.username,
      displayName: user.full_name,
    },
    pubKeyCredParams: [
      { type: 'public-key', alg: -7 },
      { type: 'public-key', alg: -257 },
    ],
    excludeCredentials: existing.map((c) => ({
      type: 'public-key',
      id: c.credential_id,
      transports: JSON.parse(c.transports || '["internal"]'),
    })),
    authenticatorSelection: {
      residentKey: 'required',
      requireResidentKey: true,
      userVerification: 'preferred',
      ...(req.body?.promotion ? { authenticatorAttachment: 'platform' } : {}),
    },
    timeout: 60000,
  });
});

corporateAuthRouter.post('/webauthn/register/verify', authenticateToken, (req: AuthRequest, res: Response): void => {
  const { id: credentialId, response: attestation, name = 'Platform Biometric Passkey' } = req.body;
  if (!credentialId || !attestation) {
    res.status(400).json({ success: false, error: 'Missing WebAuthn attestation payload.' });
    return;
  }

  const ch = db.prepare(`SELECT * FROM webauthn_challenges WHERE user_id = ? AND type = 'REGISTRATION' AND expires_at > datetime('now') ORDER BY created_at DESC LIMIT 1`).get(req.user!.id) as any;
  if (!ch) {
    res.status(400).json({ success: false, error: 'Registration challenge expired.' });
    return;
  }

  const credRowId = uuidv4();
  db.prepare(`
    INSERT INTO webauthn_credentials (id, user_id, credential_id, public_key, device_type, transports, name, last_used_at)
    VALUES (?, ?, ?, ?, 'multiDevice', ?, ?, datetime('now'))
  `).run(credRowId, req.user!.id, credentialId, attestation.publicKey || attestation.attestationObject || 'webauthn-pk', JSON.stringify(attestation.transports || ['internal']), name);

  db.prepare(`UPDATE users SET biometric_enabled = 1 WHERE id = ?`).run(req.user!.id);
  db.prepare(`DELETE FROM webauthn_challenges WHERE id = ?`).run(ch.id);
  logAudit(req.user!.id, req.user!.role, 'PASSKEY_REGISTERED', 'WEBAUTHN', credRowId, { name });

  res.json({ success: true, message: 'Passkey registered for biometric sign-in.' });
});

corporateAuthRouter.post('/webauthn/auth/options', (req: Request, res: Response): void => {
  const { identifier } = req.body || {};
  const rpId = getRpId(req);
  const challenge = crypto.randomBytes(32).toString('base64url');
  let allowCredentials: any[] = [];
  let userId: string | null = null;

  if (identifier) {
    const user = db.prepare(`SELECT id FROM users WHERE username = ? OR email = ?`).get(identifier, identifier) as any;
    if (user) {
      userId = user.id;
      const creds = db.prepare(`SELECT credential_id, transports FROM webauthn_credentials WHERE user_id = ?`).all(user.id) as any[];
      allowCredentials = creds.map((c) => ({
        type: 'public-key',
        id: c.credential_id,
        transports: JSON.parse(c.transports || '["internal"]'),
      }));
    }
  }

  db.prepare(`INSERT INTO webauthn_challenges (id, user_id, challenge, type, expires_at) VALUES (?, ?, ?, 'AUTHENTICATION', datetime('now', '+5 minutes'))`)
    .run(uuidv4(), userId, challenge);

  res.json({
    challenge,
    rpId,
    allowCredentials,
    userVerification: 'preferred',
    timeout: 60000,
  });
});

corporateAuthRouter.post('/webauthn/auth/verify', (req: Request, res: Response): void => {
  const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
  const { id: credentialId, response: assertion } = req.body;
  if (!credentialId || !assertion) {
    res.status(400).json({ success: false, error: 'Missing assertion.' });
    return;
  }

  const cred = db.prepare(`SELECT * FROM webauthn_credentials WHERE credential_id = ?`).get(credentialId) as any;
  if (!cred) {
    res.status(404).json({ success: false, error: 'Passkey credential not recognised on this server.' });
    return;
  }

  const user = db.prepare(`SELECT u.*, cp.customer_id FROM users u LEFT JOIN customer_profiles cp ON cp.user_id = u.id WHERE u.id = ?`).get(cred.user_id) as any;
  if (!user || user.is_locked) {
    res.status(403).json({ success: false, error: 'User profile is locked or unavailable.' });
    return;
  }

  db.prepare(`UPDATE webauthn_credentials SET counter = counter + 1, last_used_at = datetime('now') WHERE id = ?`).run(cred.id);
  res.json({ success: true, ...issueTokensForUser(user, req, ip, 'WEBAUTHN_PASSKEY') });
});

corporateAuthRouter.post('/webauthn/reauth/options', authenticateToken, (req: AuthRequest, res: Response): void => {
  const rpId = getRpId(req);
  const challenge = crypto.randomBytes(32).toString('base64url');
  const creds = db.prepare(`SELECT credential_id, transports FROM webauthn_credentials WHERE user_id = ?`).all(req.user!.id) as any[];

  db.prepare(`INSERT INTO webauthn_challenges (id, user_id, challenge, type, expires_at) VALUES (?, ?, ?, 'REAUTH', datetime('now', '+5 minutes'))`)
    .run(uuidv4(), req.user!.id, challenge);

  res.json({
    challenge,
    rpId,
    allowCredentials: creds.map((c) => ({
      type: 'public-key',
      id: c.credential_id,
      transports: JSON.parse(c.transports || '["internal"]'),
    })),
    userVerification: 'required',
    timeout: 60000,
  });
});

corporateAuthRouter.post('/webauthn/reauth/verify', authenticateToken, (req: AuthRequest, res: Response): void => {
  const { id: credentialId } = req.body;
  const cred = db.prepare(`SELECT * FROM webauthn_credentials WHERE credential_id = ?`).get(credentialId) as any;
  if (!cred) {
    res.status(404).json({ success: false, error: 'Passkey not found.' });
    return;
  }
  if (cred.user_id !== req.user!.id) {
    res.status(403).json({ success: false, error: 'Passkey belongs to a different user.' });
    return;
  }
  const reauthToken = jwt.sign({ uid: req.user!.id, stepUp: true }, JWT_SECRET, { expiresIn: '5m' });
  logAudit(req.user!.id, req.user!.role, 'PASSKEY_REAUTH_VERIFIED', 'WEBAUTHN', cred.id, {});
  res.json({ success: true, reauthToken, expiresInSeconds: 300 });
});

// POST /api/auth/logout
corporateAuthRouter.post('/logout', authenticateToken, (req: AuthRequest, res: Response): void => {
  db.prepare(`UPDATE auth_sessions SET is_revoked = 1 WHERE user_id = ? AND is_revoked = 0`).run(req.user!.id);
  logAudit(req.user!.id, req.user!.role, 'LOGOUT_SESSION_REVOKED', 'AUTH_SESSION', req.user!.id, {});
  res.json({ success: true, message: 'Signed out and active sessions revoked.' });
});

// GET /api/auth/corporate-session - Full corporate session context
corporateAuthRouter.get('/corporate-session', authenticateToken, (req: AuthRequest, res: Response): void => {
  const user = db.prepare(`
    SELECT u.*, cp.customer_id
    FROM users u
    LEFT JOIN customer_profiles cp ON cp.user_id = u.id
    WHERE u.id = ?
  `).get(req.user!.id) as any;

  if (!user) {
    res.status(404).json({ success: false, error: 'User not found.' });
    return;
  }
  res.json({ success: true, user: buildUserSessionPayload(user) });
});
