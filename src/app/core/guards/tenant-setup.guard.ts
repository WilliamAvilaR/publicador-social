import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Bloquea las rutas de producto mientras el usuario esté en PendingTenantSetup:
 * lo redirige a /onboarding hasta que complete el nombre de su organización.
 */
export const tenantSetupGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.requiresTenantSetup()) {
    router.navigate(['/onboarding']);
    return false;
  }

  return true;
};

/**
 * Protege /onboarding: requiere sesión y onboarding pendiente.
 * Si el usuario ya tiene organización, lo lleva al dashboard.
 */
export const onboardingGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    router.navigate(['/login']);
    return false;
  }

  if (!authService.requiresTenantSetup()) {
    router.navigate(['/dashboard']);
    return false;
  }

  return true;
};
