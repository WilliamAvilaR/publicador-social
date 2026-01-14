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
  error: HttpErrorResponse,
  defaultMessage: string = 'Ha ocurrido un error. Por favor, intenta nuevamente.'
): string {
  if (!error.error) {
    return error.message || defaultMessage;
  }

  // Si errors es un array de objetos con detail
  if (Array.isArray(error.error.errors) && error.error.errors.length > 0) {
    const firstError = error.error.errors[0];
    if (firstError.detail) {
      return firstError.detail;
    }
    if (firstError.title) {
      return firstError.title;
    }
  }

  // Si errors es un objeto con campos (validación por campo)
  // Esto es común en validaciones de formularios del backend
  if (error.error.errors && typeof error.error.errors === 'object' && !Array.isArray(error.error.errors)) {
    const errorFields = Object.keys(error.error.errors);
    if (errorFields.length > 0) {
      const firstField = errorFields[0];
      const firstError = error.error.errors[firstField];
      if (Array.isArray(firstError) && firstError.length > 0) {
        return firstError[0];
      }
      if (typeof firstError === 'string') {
        return firstError;
      }
    }
  }

  // Si hay detail directo en error.error
  if (error.error.detail) {
    return error.error.detail;
  }

  // Si hay title directo en error.error
  if (error.error.title) {
    return error.error.title;
  }

  // Si hay un mensaje de error general
  if (error.error.message) {
    return error.error.message;
  }

  // Último recurso: mensaje genérico
  return defaultMessage;
}
