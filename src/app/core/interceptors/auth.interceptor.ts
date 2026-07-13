import { HttpInterceptorFn, HttpErrorResponse, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, catchError, filter, switchMap, take, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { StepUpService } from '../services/step-up.service';
import { sanitizeReturnPath } from '../../shared/utils/external-auth.utils';
import { extractApiErrorCode } from '../../shared/utils/error.utils';

function getLoginReturnUrl(router: Router): string {
  return sanitizeReturnPath(router.url) ?? '/dashboard';
}

let isRefreshing = false;
const refreshTokenSubject = new BehaviorSubject<string | null>(null);

const PUBLIC_API_ROUTES = [
  '/api/Token/login',
  '/api/Token/register',
  '/api/Account/verify-email',
  '/api/Account/resend-verification',
  '/api/Account/forgot-password',
  '/api/Account/reset-password',
  '/api/invitations/',
  '/api/account/email/confirm'
];

const EXTERNAL_AUTH_PUBLIC_PATTERNS = [
  '/api/auth/external/exchange',
  '/api/auth/external/link/context',
  '/api/auth/external/link/confirm'
];

function isOAuthStartUrl(url: string): boolean {
  return /\/api\/auth\/external\/(google|microsoft)\/start$/.test(url.split('?')[0]);
}

function isExternalAuthPublicRoute(url: string): boolean {
  if (!url.includes('/api/auth/external/')) {
    return false;
  }
  if (EXTERNAL_AUTH_PUBLIC_PATTERNS.some(pattern => url.includes(pattern))) {
    return true;
  }
  return isOAuthStartUrl(url);
}

function isOptionalAuthRoute(url: string): boolean {
  return url.includes('/api/auth/external/flow/resolve');
}

function cloneWithToken(req: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
  const isFormData = req.body instanceof FormData;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`
  };
  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }
  return req.clone({ setHeaders: headers });
}

function handleSessionRevoked(authService: AuthService, router: Router): void {
  authService.logout();
  if (!router.url.includes('/login')) {
    router.navigate(['/login'], {
      queryParams: { returnUrl: getLoginReturnUrl(router) }
    });
  }
}

/** 401 de negocio: no disparar refresh ni cerrar sesión; propagar al componente. */
const PASS_THROUGH_401_CODES = new Set([
  'current_password_incorrect',
  'external_auth_flow_invalid',
  'external_auth_link_pending_invalid',
  'external_auth_link_pending_user_mismatch',
  'external_auth_link_pending_session_mismatch',
  'external_auth_link_step_up_wrong_provider',
  'external_auth_link_challenge_invalid',
  'external_auth_link_verify_invalid'
]);

function isFlowResolveRequest(url: string): boolean {
  return url.includes('/api/auth/external/flow/resolve');
}

function isPassThrough401(error: HttpErrorResponse, errorCode: string | undefined, url: string): boolean {
  if (error.status !== 401) {
    return false;
  }
  if (errorCode && PASS_THROUGH_401_CODES.has(errorCode)) {
    return true;
  }
  // flow/resolve: errores de negocio OAuth no deben disparar refresh/logout.
  if (isFlowResolveRequest(url) && errorCode?.startsWith('external_auth_')) {
    return true;
  }
  return false;
}

/**
 * Interceptor HTTP: JWT, refresh, step-up V2 y sesiones revocadas.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const stepUpService = inject(StepUpService);
  const router = inject(Router);

  const isPublicRoute =
    PUBLIC_API_ROUTES.some(route => req.url.includes(route)) || isExternalAuthPublicRoute(req.url);

  if (isPublicRoute) {
    return next(req);
  }

  if (!req.url.startsWith('/api/')) {
    return next(req);
  }

  const token = authService.getToken();
  const optionalAuth = isOptionalAuthRoute(req.url);

  if (!token) {
    if (optionalAuth) {
      return next(req);
    }
    if (!router.url.includes('/login')) {
      router.navigate(['/login'], {
        queryParams: { returnUrl: getLoginReturnUrl(router) }
      });
    }
    return next(req);
  }

  const authedRequest = cloneWithToken(req, token);

  return next(authedRequest).pipe(
    catchError((error: HttpErrorResponse) => {
      if (
        error.status === 403 &&
        (error.error?.detail === 'tenant_setup_required' ||
          error.error?.message === 'tenant_setup_required')
      ) {
        authService.setTenantSetupRequired(true);
        if (!router.url.startsWith('/onboarding')) {
          router.navigate(['/onboarding']);
        }
        return throwError(() => error);
      }

      const errorCode = extractApiErrorCode(error);

      if (error.status === 403 && errorCode === 'recent_authentication_required') {
        if (
          stepUpService.isModalOpen() ||
          req.url.includes('/api/account/authentication-methods')
        ) {
          return throwError(() => error);
        }
        return stepUpService.requireStepUp(undefined, { force: true }).pipe(
          switchMap(() => {
            const freshToken = authService.getToken();
            if (!freshToken) {
              return throwError(() => error);
            }
            return next(cloneWithToken(req, freshToken));
          })
        );
      }

      if (
        error.status === 401 &&
        (errorCode === 'session_revoked' || errorCode === 'session_revoked_provider_unlinked')
      ) {
        handleSessionRevoked(authService, router);
        return throwError(() => error);
      }

      if (isPassThrough401(error, errorCode, req.url)) {
        return throwError(() => error);
      }

      if (error.status === 401 && req.url.includes('/api/account/step-up/password')) {
        return throwError(() => error);
      }

      if (error.status === 401) {
        if (req.url.includes('/api/Token/refresh')) {
          handleSessionRevoked(authService, router);
          return throwError(() => error);
        }

        if (!isRefreshing) {
          isRefreshing = true;
          refreshTokenSubject.next(null);

          return authService.refreshToken().pipe(
            switchMap((response) => {
              isRefreshing = false;
              authService.setAuthData(response.data.token, response.data);
              const newToken = response.data.token;
              refreshTokenSubject.next(newToken);
              return next(cloneWithToken(req, newToken));
            }),
            catchError((refreshError) => {
              isRefreshing = false;
              refreshTokenSubject.next(null);
              handleSessionRevoked(authService, router);
              return throwError(() => refreshError);
            })
          );
        }

        return refreshTokenSubject.pipe(
          filter(retryToken => retryToken !== null),
          take(1),
          switchMap((newToken) => next(cloneWithToken(req, newToken as string)))
        );
      }

      return throwError(() => error);
    })
  );
};
