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
