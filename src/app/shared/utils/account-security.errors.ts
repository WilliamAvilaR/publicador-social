import { HttpErrorResponse } from '@angular/common/http';
import { extractApiErrorCode, extractApiErrorPayload, extractErrorMessage } from './error.utils';
import { getProviderDisplayName } from './external-auth.utils';

export interface LinkSecurityErrorPresentation {
  title: string;
  message: string;
  provider?: string | null;
  providerEmail?: string | null;
}

export interface OAuthLinkErrorContext {
  provider?: string | null;
  providerEmail?: string | null;
  accountEmail?: string | null;
}

const PROVIDER_LINKED_TO_OTHER_USER_CODES = new Set([
  'external_auth_provider_linked_to_other_user',
  'external_auth_identity_already_linked',
  'external_auth_provider_linked_to_another_account',
  'external_auth_provider_already_linked_to_other_user'
]);

const ACCOUNT_SECURITY_ERROR_CODES = new Set([
  'recent_authentication_required',
  'primary_email_change_required',
  'password_login_not_available',
  'password_not_set',
  'password_already_set',
  'current_password_required',
  'current_password_incorrect',
  'new_password_same_as_current',
  'external_auth_provider_already_linked',
  'external_auth_provider_linked_to_other_user',
  'external_auth_identity_already_linked',
  'external_auth_provider_linked_to_another_account',
  'external_auth_provider_already_linked_to_other_user',
  'external_auth_primary_email_owned_by_another_user',
  'external_auth_email_already_exists',
  'external_auth_last_auth_method',
  'external_auth_link_email_mismatch',
  'external_auth_link_pending_invalid',
  'external_auth_link_pending_user_mismatch',
  'external_auth_link_pending_session_mismatch',
  'external_auth_link_step_up_wrong_provider',
  'external_auth_link_challenge_invalid',
  'external_auth_link_verify_invalid',
  'external_auth_provider_not_linked',
  'external_auth_flow_invalid',
  'session_revoked',
  'session_revoked_provider_unlinked'
]);

export function normalizeAccountSecurityErrorCode(code: string | null | undefined): string | null {
  if (!code) {
    return null;
  }
  return code.trim().toLowerCase().replace(/-/g, '_');
}

/** Mensaje cuando el sub OAuth ya está en otra cuenta, en flujo de vinculación logueado. */
export function getLinkEmailAlreadyExistsMessage(provider?: string | null): string {
  const providerName = getProviderDisplayName(provider);
  return `Esa cuenta de ${providerName} ya está vinculada a otra cuenta. Inicia sesión con esa cuenta y desvincúlala, o elige otra cuenta de ${providerName}.`;
}

/** Título + cuerpo para errores de vinculación OAuth en Seguridad (flow/resolve). */
export function resolveOAuthLinkFlowError(
  code: string | null | undefined,
  context?: OAuthLinkErrorContext,
  fallbackMessage?: string | null
): LinkSecurityErrorPresentation {
  const normalized = normalizeAccountSecurityErrorCode(code);
  const providerName = getProviderDisplayName(context?.provider);
  const providerEmail = context?.providerEmail?.trim() || null;
  const accountEmail = context?.accountEmail?.trim() || null;

  if (normalized === 'external_auth_email_already_exists') {
    const title =
      providerEmail && accountEmail
        ? `No se pudo añadir ${providerName} — ${providerEmail} a tu cuenta ${accountEmail}.`
        : `No se pudo añadir ${providerName}`;
    return {
      title,
      message: getLinkEmailAlreadyExistsMessage(context?.provider),
      provider: context?.provider,
      providerEmail
    };
  }

  if (normalized === 'external_auth_primary_email_owned_by_another_user') {
    const message = providerEmail
      ? `${providerEmail} ya es el correo principal de otra cuenta activa. No puedes vincularla aquí; usa otra cuenta de ${providerName} o inicia sesión con esa cuenta.`
      : `Este correo ya pertenece a otra cuenta activa. No puedes vincularla aquí; usa otra cuenta de ${providerName} o inicia sesión con esa cuenta.`;
    return {
      title: 'No se pudo vincular',
      message,
      provider: context?.provider,
      providerEmail
    };
  }

  return {
    title: 'No se pudo vincular',
    message: resolveOAuthFlowErrorMessage(code, context?.provider, fallbackMessage),
    provider: context?.provider,
    providerEmail
  };
}

/** Mensaje para errores de `flow/resolve` con contexto de proveedor. */
export function resolveOAuthFlowErrorMessage(
  code: string | null | undefined,
  provider?: string | null,
  fallbackMessage?: string | null
): string {
  const normalized = normalizeAccountSecurityErrorCode(code);
  const providerName = getProviderDisplayName(provider);

  if (normalized === 'external_auth_email_already_exists') {
    return getLinkEmailAlreadyExistsMessage(provider);
  }

  if (normalized && PROVIDER_LINKED_TO_OTHER_USER_CODES.has(normalized)) {
    return `Esta cuenta de ${providerName} ya está vinculada a otro usuario. Inicia sesión con esa cuenta o usa otra identidad.`;
  }

  if (normalized === 'external_auth_provider_already_linked') {
    return `Ya tienes ${providerName} vinculado a tu cuenta.`;
  }

  if (normalized && ACCOUNT_SECURITY_ERROR_CODES.has(normalized)) {
    return getAccountSecurityErrorMessage(normalized, provider);
  }

  if (fallbackMessage?.trim()) {
    return fallbackMessage.trim();
  }

  return getAccountSecurityErrorMessage(normalized ?? code, provider);
}

/** Mensajes sugeridos para códigos V2 (guía §7). */
export function getAccountSecurityErrorMessage(
  code: string | null | undefined,
  provider?: string | null
): string {
  const normalized = normalizeAccountSecurityErrorCode(code);
  const providerName = getProviderDisplayName(provider);

  switch (normalized) {
    case 'recent_authentication_required':
      return 'Por seguridad, confirma tu identidad antes de continuar.';
    case 'primary_email_change_required':
      return 'Para cambiar el correo principal usa la verificación por email en Seguridad de la cuenta.';
    case 'password_login_not_available':
      return 'Esta cuenta usa inicio de sesión externo. Continúa con tu proveedor o configura una contraseña.';
    case 'password_not_set':
      return 'Aún no tienes contraseña. Establécela desde Seguridad de la cuenta.';
    case 'password_already_set':
      return 'Ya tienes contraseña. Usa cambiar contraseña.';
    case 'current_password_required':
      return 'Confirma tu contraseña actual.';
    case 'current_password_incorrect':
      return 'La contraseña actual es incorrecta.';
    case 'new_password_same_as_current':
      return 'La nueva contraseña debe ser diferente a la contraseña actual.';
    case 'external_auth_provider_already_linked':
      return `Ya tienes ${providerName} vinculado a tu cuenta.`;
    case 'external_auth_provider_linked_to_other_user':
    case 'external_auth_identity_already_linked':
    case 'external_auth_provider_linked_to_another_account':
    case 'external_auth_provider_already_linked_to_other_user':
      return `Esta cuenta de ${providerName} ya está vinculada a otro usuario. Inicia sesión con esa cuenta o usa otra identidad.`;
    case 'external_auth_email_already_exists':
      return getLinkEmailAlreadyExistsMessage(provider);
    case 'external_auth_primary_email_owned_by_another_user':
      return `Este correo ya pertenece a otra cuenta activa. No puedes vincularla aquí; usa otra cuenta de ${providerName} o inicia sesión con esa cuenta.`;
    case 'external_auth_last_auth_method':
      return 'No puedes quitar el único método de acceso. Configura otro primero.';
    case 'external_auth_link_email_mismatch':
      return 'El correo del proveedor no coincide con el de tu cuenta.';
    case 'external_auth_link_pending_invalid':
      return 'La solicitud expiró. Vuelve a iniciar la vinculación.';
    case 'external_auth_link_pending_user_mismatch':
      return 'Esta vinculación pertenece a otra cuenta. Inicia sesión con la cuenta correcta.';
    case 'external_auth_link_pending_session_mismatch':
      return 'Debes completar la vinculación en el mismo dispositivo y sesión donde la iniciaste.';
    case 'external_auth_link_step_up_wrong_provider':
      return 'Confirma tu identidad con otro método ya configurado.';
    case 'external_auth_link_challenge_invalid':
      return 'La solicitud de vinculación expiró. Vuelve a intentarlo.';
    case 'external_auth_link_verify_invalid':
      return 'El enlace o código de confirmación expiró o ya fue utilizado.';
    case 'external_auth_provider_not_linked':
      return 'No tienes ese proveedor vinculado a tu cuenta.';
    case 'external_auth_flow_invalid':
      return 'El enlace expiró. Vuelve a intentarlo.';
    case 'session_revoked':
      return 'Tu sesión ya no es válida. Inicia sesión de nuevo.';
    case 'session_revoked_provider_unlinked':
      return 'Desvinculaste este método; inicia sesión con otro.';
    default:
      return 'No pudimos completar la operación. Inténtalo más tarde.';
  }
}

/**
 * Resuelve mensaje de error de seguridad/cuenta: código estable si existe,
 * si no el `detail` del cuerpo (p. ej. `{ errors: [{ detail }] }` sin `code`).
 */
export function resolveAccountSecurityErrorMessage(
  error: HttpErrorResponse,
  fallback = 'No pudimos completar la operación. Inténtalo más tarde.',
  provider?: string | null
): string {
  const payload = extractApiErrorPayload(error.error);
  const code = normalizeAccountSecurityErrorCode(payload.code ?? extractApiErrorCode(error));
  if (code && ACCOUNT_SECURITY_ERROR_CODES.has(code)) {
    return getAccountSecurityErrorMessage(code, payload.provider ?? provider);
  }
  if (payload.message?.trim()) {
    return payload.message.trim();
  }
  return extractErrorMessage(error, fallback);
}

/** Mensaje para fallos HTTP de `POST /api/auth/external/flow/resolve`. */
export function resolveFlowResolveHttpError(
  error: HttpErrorResponse,
  provider?: string | null
): LinkSecurityErrorPresentation {
  const payload = extractApiErrorPayload(error.error);
  return resolveOAuthLinkFlowError(
    payload.code ?? extractApiErrorCode(error),
    {
      provider: payload.provider ?? provider,
      providerEmail: payload.providerEmail,
      accountEmail: payload.accountEmail
    },
    payload.message ?? extractErrorMessage(error)
  );
}
