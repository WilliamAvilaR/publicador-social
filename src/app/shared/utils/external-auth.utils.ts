import { ParamMap } from '@angular/router';
import { ExternalAuthProvider } from '../../core/models/auth.model';

/** Ruta receptora del redirect post-OAuth del backend. */
export const OAUTH_CALLBACK_PATH = '/auth/callback';

const OAUTH_QUERY_KEYS = [
  'exchangeCode',
  'flowCode',
  'provider',
  'authAction',
  'error',
  'existingProvider'
] as const;

export interface OAuthCallbackParams {
  provider: string | null;
  exchangeCode: string | null;
  flowCode: string | null;
  authAction: string | null;
  error: string | null;
  existingProvider: string | null;
}

/**
 * Extrae y normaliza los query params del redirect OAuth.
 * Toma un solo exchangeCode y limpia authAction corrupto (p. ej. pending_setup?provider=google).
 */
export function parseOAuthCallbackQuery(
  source: ParamMap | Record<string, string | string[] | null | undefined>
): OAuthCallbackParams {
  const get = (key: string): string | null => {
    if (source && typeof (source as ParamMap).get === 'function') {
      return (source as ParamMap).get(key);
    }
    const raw = (source as Record<string, string | string[] | null | undefined>)[key];
    if (Array.isArray(raw)) {
      return typeof raw[0] === 'string' ? raw[0] : null;
    }
    return typeof raw === 'string' ? raw : null;
  };

  const sanitizeAuthAction = (value: string | null): string | null => {
    if (!value) {
      return null;
    }
    return value.split('?')[0].split('&')[0] || null;
  };

  return {
    provider: get('provider'),
    exchangeCode: get('exchangeCode'),
    flowCode: get('flowCode'),
    authAction: sanitizeAuthAction(get('authAction')),
    error: get('error'),
    existingProvider: get('existingProvider')
  };
}

/** Indica si la URL/query contiene parámetros del callback OAuth. */
export function hasOAuthCallbackParams(
  source: ParamMap | Record<string, string | string[] | null | undefined>
): boolean {
  const params = parseOAuthCallbackQuery(source);
  return !!(params.exchangeCode || params.flowCode || (params.error && params.provider));
}

export function toOAuthCallbackQuery(params: OAuthCallbackParams): Record<string, string> {
  const query: Record<string, string> = {};
  if (params.provider) {
    query['provider'] = params.provider;
  }
  if (params.exchangeCode) {
    query['exchangeCode'] = params.exchangeCode;
  }
  if (params.flowCode) {
    query['flowCode'] = params.flowCode;
  }
  if (params.authAction) {
    query['authAction'] = params.authAction;
  }
  if (params.error) {
    query['error'] = params.error;
  }
  if (params.existingProvider) {
    query['existingProvider'] = params.existingProvider;
  }
  return query;
}

/**
 * Normaliza returnUrl para login password: solo path, sin query OAuth ni rutas de auth.
 * Evita reutilizar URLs corruptas al volver a pulsar "Continuar con Google".
 */
export function sanitizeReturnPath(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') {
    return null;
  }

  const trimmed = url.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) {
    return null;
  }

  const [pathPart, queryPart] = trimmed.split('?', 2);
  const path = pathPart || '/';

  const blockedPaths = ['/login', '/register', '/auth/callback', '/onboarding'];
  if (blockedPaths.some(blocked => path === blocked || path.startsWith(`${blocked}/`))) {
    return null;
  }

  if (!queryPart) {
    return path;
  }

  const params = new URLSearchParams(queryPart);
  for (const key of OAUTH_QUERY_KEYS) {
    if (params.has(key)) {
      return path;
    }
  }

  return path;
}


/**
 * Extrae authorizationUrl de la respuesta del backend.
 * Soporta el formato estándar `{ data: { authorizationUrl } }` y el legacy en raíz.
 */
export function extractAuthorizationUrl(response: unknown): string | null {
  if (!response || typeof response !== 'object') {
    return null;
  }

  const body = response as Record<string, unknown>;
  const fromData = (body['data'] as Record<string, unknown> | undefined)?.['authorizationUrl'];
  if (typeof fromData === 'string' && fromData.trim()) {
    return fromData.trim();
  }

  const fromRoot = body['authorizationUrl'];
  if (typeof fromRoot === 'string' && fromRoot.trim()) {
    return fromRoot.trim();
  }

  return null;
}

/** Comprueba que la URL de autorización sea absoluta y usable para redirect. */
export function isValidExternalAuthorizationUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

/** Nombre visible del proveedor OAuth. */
export function getProviderDisplayName(provider: string | null | undefined): string {
  switch ((provider || '').toLowerCase()) {
    case 'google':
      return 'Google';
    case 'microsoft':
      return 'Microsoft';
    case 'local':
      return 'email y contraseña';
    default:
      return 'el proveedor';
  }
}

export function isExternalAuthProvider(value: string | null | undefined): value is ExternalAuthProvider {
  return value === 'google' || value === 'microsoft';
}

/**
 * Traduce los códigos de error `EXTERNAL_AUTH_*` recibidos en el redirect
 * post-OAuth (query `error`) a mensajes humanos (sección 8 de la guía).
 */
export function getExternalAuthErrorMessage(
  errorCode: string,
  provider?: string | null,
  existingProvider?: string | null
): string {
  const providerName = getProviderDisplayName(provider);

  switch (errorCode) {
    case 'EXTERNAL_AUTH_EMAIL_ALREADY_EXISTS': {
      if (existingProvider) {
        const existingName = getProviderDisplayName(existingProvider);
        const method =
          existingProvider === 'local'
            ? 'inicia sesión con tu email y contraseña'
            : `inicia sesión con ${existingName}`;
        return `Ya existe una cuenta con este correo. Para continuar, ${method}. Luego podrás vincular ${providerName} desde tu perfil.`;
      }
      return `Ya existe una cuenta con este correo. Inicia sesión con el método que usaste antes. Luego podrás vincular ${providerName} desde tu perfil.`;
    }
    case 'EXTERNAL_AUTH_ACCOUNT_BLOCKED':
      return 'No podemos iniciar sesión con esta cuenta. Contacta al administrador.';
    case 'EXTERNAL_AUTH_EMAIL_NOT_VERIFIED':
      return `Verifica tu correo en ${providerName} e inténtalo de nuevo.`;
    case 'EXTERNAL_AUTH_CANCELLED':
      return `Cancelaste el inicio de sesión con ${providerName}.`;
    case 'EXTERNAL_AUTH_FAILED':
      return 'No pudimos completar el inicio de sesión. Inténtalo más tarde.';
    case 'EXTERNAL_AUTH_MULTIPLE_PENDING_INVITATIONS':
      return 'Tienes varias invitaciones pendientes. Abre el enlace del correo de invitación.';
    case 'EXTERNAL_AUTH_INVITATION_EMAIL_MISMATCH':
      return `El correo de ${providerName} no coincide con el de la invitación. Usa la cuenta invitada o solicita una nueva invitación al administrador.`;
    case 'EXTERNAL_AUTH_INVITATION_INVALID':
      return 'El enlace de invitación no es válido o ha expirado. Contacta al administrador para recibir uno nuevo.';
    case 'EXTERNAL_AUTH_ACCOUNT_NOT_FOUND':
      return `No encontramos una cuenta vinculada con ${providerName}. Regístrate o inicia sesión con email.`;
    case 'EXTERNAL_AUTH_ALREADY_REGISTERED':
      return `Ya tienes cuenta con ${providerName}. Inicia sesión con el mismo botón.`;
    default:
      return 'No pudimos completar el inicio de sesión. Inténtalo más tarde.';
  }
}

/** Errores JSON de POST /api/auth/external/exchange (sección 9 de la guía). */
export function getExchangeErrorMessage(errorCode: string | null | undefined): string {
  switch (errorCode) {
    case 'invalid_exchange_code':
      return 'La sesión expiró. Vuelve a iniciar sesión con Google o Microsoft.';
    case 'account_inactive':
      return 'Tu cuenta está inactiva. Contacta al administrador.';
    default:
      return 'No pudimos completar el inicio de sesión. Inténtalo más tarde.';
  }
}
