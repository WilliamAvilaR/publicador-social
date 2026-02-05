import { FormGroup } from '@angular/forms';

/**
 * Obtiene el mensaje de error para un campo específico del formulario.
 * Soporta múltiples tipos de validaciones: required, email, minlength, passwordMismatch, etc.
 * 
 * @param formGroup - El FormGroup que contiene el campo
 * @param fieldName - El nombre del campo a verificar
 * @returns El mensaje de error correspondiente o una cadena vacía si no hay error
 */
export function getFieldError(formGroup: FormGroup, fieldName: string): string {
  const field = formGroup.get(fieldName);

  if (!field) {
    return '';
  }

  // Validación: campo requerido
  if (field.hasError('required')) {
    return 'Este campo es obligatorio';
  }

  // Validación: formato de email
  if (field.hasError('email')) {
    return 'Email inválido';
  }

  // Validación: longitud mínima
  if (field.hasError('minlength')) {
    const minLength = field.errors?.['minlength']?.requiredLength;
    return `Mínimo ${minLength} caracteres`;
  }

  // Validación: longitud máxima
  if (field.hasError('maxlength')) {
    const maxLength = field.errors?.['maxlength']?.requiredLength;
    return `Máximo ${maxLength} caracteres`;
  }

  // Validación: contraseñas no coinciden
  if (field.hasError('passwordMismatch')) {
    return 'Las contraseñas no coinciden';
  }

  // Validación: patrón (regex)
  if (field.hasError('pattern')) {
    return 'El formato no es válido';
  }

  // Puedes agregar más validaciones aquí según sea necesario
  // Ejemplo: min, max, custom validators, etc.

  return '';
}

/**
 * Valida que un valor sea una URL de avatar válida (string).
 * Maneja casos donde el valor puede ser un objeto por error.
 * 
 * @param value - Valor a validar (puede ser string, object, null, undefined)
 * @returns La URL como string o null si es inválida
 */
export function validateAvatarUrl(value: unknown): string | null {
  if (!value) {
    return null;
  }

  // Si es string, devolverlo directamente
  if (typeof value === 'string' && value.trim().length > 0) {
    return value;
  }

  // Si es objeto (error de serialización), intentar extraer la URL
  if (typeof value === 'object' && value !== null) {
    const obj = value as Record<string, unknown>;
    const url = obj['url'] || obj['avatarUrl'] || obj['data'];
    if (typeof url === 'string' && url.trim().length > 0) {
      return url;
    }
  }

  return null;
}