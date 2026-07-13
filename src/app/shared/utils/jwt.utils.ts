/**
 * Decodifica el payload de un JWT sin validar la firma (solo lectura de claims en cliente).
 */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }

  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const json = decodeURIComponent(
      atob(padded)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function readClaim(token: string, key: string): string | null {
  const payload = decodeJwtPayload(token);
  const value = payload?.[key];
  return typeof value === 'string' ? value : null;
}

function readNumericClaim(token: string, key: string): number | null {
  const payload = decodeJwtPayload(token);
  const value = payload?.[key];
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function getJwtSetupStatus(token: string): string | null {
  return readClaim(token, 'setupStatus');
}

export function getJwtSid(token: string): string | null {
  return readClaim(token, 'sid');
}

export function getJwtAuthTime(token: string): number | null {
  return readNumericClaim(token, 'auth_time');
}

export function getSessionAmr(token: string): string | null {
  return readClaim(token, 'session_amr');
}

export function getRecentAmr(token: string): string | null {
  return readClaim(token, 'recent_amr');
}

/** Ventana de step-up por defecto: 15 minutos (guía V2 §5.2). */
export function isStepUpFresh(token: string | null, maxMinutes = 15): boolean {
  if (!token) {
    return false;
  }
  const authTime = getJwtAuthTime(token);
  if (authTime == null) {
    return false;
  }
  const nowSeconds = Math.floor(Date.now() / 1000);
  return nowSeconds - authTime <= maxMinutes * 60;
}
