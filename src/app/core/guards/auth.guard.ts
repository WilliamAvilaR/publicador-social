import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { sanitizeReturnPath } from '../../shared/utils/external-auth.utils';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  const returnUrl = sanitizeReturnPath(state.url) ?? '/dashboard';
  router.navigate(['/login'], {
    queryParams: { returnUrl }
  });
  return false;
};
