import { HttpErrorResponse } from '@angular/common/http';

/** Cooldown tras un reenvío exitoso (mínimo entre dos solicitudes seguidas). */
export const RESEND_SUCCESS_COOLDOWN_SECONDS = 60;

/** Mensaje 200 genérico para reenvío de verificación (no revela si el email existe). */
export const RESEND_VERIFICATION_SUCCESS_MESSAGE =
  'Si el correo existe, se enviará un nuevo enlace.';

/** Mensaje 200 genérico para recuperación de contraseña. */
export const FORGOT_PASSWORD_SUCCESS_MESSAGE =
  'Si el correo existe en nuestro sistema, recibirás instrucciones para restablecer tu contraseña.';

/**
 * Lee el header Retry-After de una respuesta 429 (segundos).
 * Si no viene o es inválido, usa el cooldown por defecto.
 */
export function getRetryAfterSeconds(
  error: HttpErrorResponse,
  fallbackSeconds = RESEND_SUCCESS_COOLDOWN_SECONDS
): number {
  const header = error.headers?.get('Retry-After');
  if (!header) {
    return fallbackSeconds;
  }

  const seconds = parseInt(header, 10);
  if (Number.isFinite(seconds) && seconds > 0) {
    return seconds;
  }

  return fallbackSeconds;
}

/**
 * Temporizador local para deshabilitar botones tras éxito o rate limit.
 */
export class ActionCooldown {
  secondsRemaining = 0;
  private intervalId: ReturnType<typeof setInterval> | null = null;

  get isActive(): boolean {
    return this.secondsRemaining > 0;
  }

  start(seconds: number, onTick?: () => void): void {
    this.clear();
    this.secondsRemaining = Math.max(1, Math.ceil(seconds));
    onTick?.();

    this.intervalId = setInterval(() => {
      this.secondsRemaining--;
      onTick?.();
      if (this.secondsRemaining <= 0) {
        this.clear();
        onTick?.();
      }
    }, 1000);
  }

  clear(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.secondsRemaining = 0;
  }
}
