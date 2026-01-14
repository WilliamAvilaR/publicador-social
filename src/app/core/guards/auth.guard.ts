import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { AuthService } from '../../features/auth/services/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  // Guardar la URL de destino para redirigir después del login
  const returnUrl = state.url;
  router.navigate(['/login'], {
    queryParams: { returnUrl: returnUrl }
  });
  return false;
};
