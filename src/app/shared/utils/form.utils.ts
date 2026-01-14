import { FormGroup } from '@angular/forms';

/**
 * Marca todos los campos de un FormGroup como touched.
 * Útil para mostrar errores de validación después de un submit fallido.
 * 
 * @param formGroup - El FormGroup a marcar como touched
 */
export function markFormGroupTouched(formGroup: FormGroup): void {
  Object.keys(formGroup.controls).forEach(key => {
    const control = formGroup.get(key);
    control?.markAsTouched();
  });
}

/**
 * Verifica si un campo específico del formulario es inválido y ha sido touched.
 * 
 * @param formGroup - El FormGroup que contiene el campo
 * @param fieldName - El nombre del campo a verificar
 * @returns true si el campo es inválido y ha sido touched, false en caso contrario
 */
export function isFieldInvalid(formGroup: FormGroup, fieldName: string): boolean {
  const field = formGroup.get(fieldName);
  return !!(field && field.invalid && field.touched);
}
