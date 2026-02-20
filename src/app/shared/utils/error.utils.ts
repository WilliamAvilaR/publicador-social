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
