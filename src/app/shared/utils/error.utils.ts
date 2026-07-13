import { HttpErrorResponse } from '@angular/common/http';

/**
 * Extrae un mensaje de error legible de una HttpErrorResponse.
 * Maneja diferentes formatos de respuesta de error del servidor.
 * 
 * @param error - La HttpErrorResponse del servidor
 * @param defaultMessage - Mensaje por defecto si no se puede extraer un mensaje específico
 * @returns Un mensaje de error legible para el usuario
 */
export function extractErrorMessage(
  error: HttpErrorResponse | Error,
  defaultMessage: string = 'Ha ocurrido un error. Por favor, intenta nuevamente.'
): string {
  // Si es un Error simple (no HttpErrorResponse), usar su mensaje directamente
  // HttpErrorResponse tiene la propiedad 'error', Error simple no
  if (error instanceof Error && !('error' in error)) {
    return error.message || defaultMessage;
  }
  
  // Si es HttpErrorResponse
  const httpError = error as HttpErrorResponse;
  
  // Si no tiene error.error, usar el mensaje del error HTTP
  if (!httpError.error) {
    return httpError.message || defaultMessage;
  }

  // Si errors es un array de objetos con detail
  if (Array.isArray(httpError.error.errors) && httpError.error.errors.length > 0) {
    const firstError = httpError.error.errors[0];
    if (firstError.detail) {
      return firstError.detail;
    }
    if (firstError.title) {
      return firstError.title;
    }
  }

  // Si errors es un objeto con campos (validación por campo)
  // Esto es común en validaciones de formularios del backend
  if (httpError.error.errors && typeof httpError.error.errors === 'object' && !Array.isArray(httpError.error.errors)) {
    const errorFields = Object.keys(httpError.error.errors);
    if (errorFields.length > 0) {
      const firstField = errorFields[0];
      const firstError = httpError.error.errors[firstField];
      if (Array.isArray(firstError) && firstError.length > 0) {
        return firstError[0];
      }
      if (typeof firstError === 'string') {
        return firstError;
      }
    }
  }

  // Si hay detail directo en error.error
  if (httpError.error.detail) {
    return httpError.error.detail;
  }

  // Si hay title directo en error.error
  if (httpError.error.title) {
    return httpError.error.title;
  }

  // Si hay un mensaje de error general
  if (httpError.error.message) {
    return httpError.error.message;
  }

  // Último recurso: mensaje genérico
  return defaultMessage;
}

function pickStringField(record: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

function looksLikeStableErrorCode(value: string): boolean {
  const normalized = value.trim().toLowerCase().replace(/-/g, '_');
  return /^[a-z][a-z0-9_]+$/.test(normalized) && normalized.includes('_');
}

export interface ApiErrorPayload {
  code?: string;
  message?: string;
  provider?: string;
  providerEmail?: string;
  accountEmail?: string;
}

/**
 * Extrae código/mensaje de cuerpos API heterogéneos:
 * - `{ data: { flow: "error", code, message } }` (flow/resolve)
 * - `{ errors: [{ code, detail }] }`
 * - `{ code, detail, message }` en raíz
 */
export function extractApiErrorPayload(body: unknown): ApiErrorPayload {
  if (!body || typeof body !== 'object') {
    return {};
  }

  const record = body as Record<string, unknown>;
  const data = record['data'];
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const dataRecord = data as Record<string, unknown>;
    const flow = typeof dataRecord['flow'] === 'string' ? dataRecord['flow'].toLowerCase() : undefined;
    const code = pickStringField(dataRecord, 'code', 'errorCode', 'error');
    const message = pickStringField(dataRecord, 'message', 'detail', 'title');
    const provider = pickStringField(dataRecord, 'provider');
    const providerEmail = pickStringField(dataRecord, 'providerEmail');
    const accountEmail = pickStringField(dataRecord, 'accountEmail');

    if (flow === 'error' || code) {
      return { code, message, provider, providerEmail, accountEmail };
    }
  }

  if (Array.isArray(record['errors']) && record['errors'].length > 0) {
    const first = record['errors'][0];
    if (first && typeof first === 'object') {
      const errorRecord = first as Record<string, unknown>;
      return {
        code: pickStringField(errorRecord, 'code', 'errorCode'),
        message: pickStringField(errorRecord, 'detail', 'title', 'message')
      };
    }
  }

  const rootCode = pickStringField(record, 'code', 'errorCode', 'error');
  const rootDetail = pickStringField(record, 'detail', 'message', 'title');
  const rootMessage = looksLikeStableErrorCode(rootDetail ?? '') ? undefined : rootDetail;

  return {
    code: rootCode ?? (looksLikeStableErrorCode(rootDetail ?? '') ? rootDetail : undefined),
    message: rootMessage,
    provider: pickStringField(record, 'provider')
  };
}

/**
 * Extrae el código de error estable de una respuesta API.
 * Soporta `{ errors: [{ code, detail }] }`, envelope `data` y formatos legacy en raíz.
 */
export function extractApiErrorCode(error: HttpErrorResponse): string | undefined {
  const payload = extractApiErrorPayload(error.error);
  return payload.code;
}
