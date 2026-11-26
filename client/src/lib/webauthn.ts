/**
 * Real Browser WebAuthn / Passkey Helper
 * Follows modern-web-guidance: feature-detects getClientCapabilities, uses server-provided rpId,
 * never fabricates biometric success, and gracefully falls back when unsupported.
 */

export interface PasskeySupportStatus {
  webauthnSupported: boolean;
  platformAuthenticatorAvailable: boolean;
  conditionalMediationSupported: boolean;
}

export async function detectPasskeySupport(): Promise<PasskeySupportStatus> {
  if (typeof window === 'undefined' || !window.PublicKeyCredential) {
    return { webauthnSupported: false, platformAuthenticatorAvailable: false, conditionalMediationSupported: false };
  }

  try {
    const pkc = window.PublicKeyCredential as any;
    if (typeof pkc.getClientCapabilities === 'function') {
      const caps = await pkc.getClientCapabilities();
      return {
        webauthnSupported: true,
        platformAuthenticatorAvailable: !!caps.passkeyPlatformAuthenticator,
        conditionalMediationSupported: !!caps.conditionalGet,
      };
    }

    const platformAvail =
      typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function'
        ? await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
        : false;
    return {
      webauthnSupported: true,
      platformAuthenticatorAvailable: platformAvail,
      conditionalMediationSupported: false,
    };
  } catch {
    return { webauthnSupported: false, platformAuthenticatorAvailable: false, conditionalMediationSupported: false };
  }
}

function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function arrayBufferToBase64Url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function parseCreationOptions(json: any): PublicKeyCredentialCreationOptions {
  const pkc = window.PublicKeyCredential as any;
  if (typeof pkc.parseCreationOptionsFromJSON === 'function') {
    return pkc.parseCreationOptionsFromJSON(json);
  }
  return {
    ...json,
    challenge: base64UrlToUint8Array(json.challenge),
    user: {
      ...json.user,
      id: base64UrlToUint8Array(json.user.id),
    },
    excludeCredentials: (json.excludeCredentials || []).map((c: any) => ({
      ...c,
      id: base64UrlToUint8Array(c.id),
    })),
  };
}

export function parseRequestOptions(json: any): PublicKeyCredentialRequestOptions {
  const pkc = window.PublicKeyCredential as any;
  if (typeof pkc.parseRequestOptionsFromJSON === 'function') {
    return pkc.parseRequestOptionsFromJSON(json);
  }
  return {
    ...json,
    challenge: base64UrlToUint8Array(json.challenge),
    allowCredentials: (json.allowCredentials || []).map((c: any) => ({
      ...c,
      id: base64UrlToUint8Array(c.id),
    })),
  };
}

export function serializeCredential(cred: PublicKeyCredential): any {
  const anyCred = cred as any;
  if (typeof anyCred.toJSON === 'function') {
    return anyCred.toJSON();
  }
  const resp = cred.response as any;
  return {
    id: cred.id,
    rawId: arrayBufferToBase64Url(cred.rawId),
    type: cred.type,
    response: {
      clientDataJSON: arrayBufferToBase64Url(resp.clientDataJSON),
      ...(resp.attestationObject ? { attestationObject: arrayBufferToBase64Url(resp.attestationObject) } : {}),
      ...(resp.authenticatorData ? { authenticatorData: arrayBufferToBase64Url(resp.authenticatorData) } : {}),
      ...(resp.signature ? { signature: arrayBufferToBase64Url(resp.signature) } : {}),
      ...(resp.userHandle ? { userHandle: arrayBufferToBase64Url(resp.userHandle) } : {}),
      ...(typeof resp.getTransports === 'function' ? { transports: resp.getTransports() } : {}),
    },
  };
}

export async function signalUnknownCredentialIfSupported(rpId: string, credentialId: string) {
  const pkc = window.PublicKeyCredential as any;
  if (typeof pkc?.signalUnknownCredential === 'function' && rpId && credentialId) {
    try {
      await pkc.signalUnknownCredential({ rpId, credentialId });
    } catch {
      // Progressive optimization only
    }
  }
}
