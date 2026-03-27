import { HttpEvent, HttpHandlerFn, HttpInterceptorFn, HttpRequest, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { TenantReauthService } from '../services/tenant-reauth.service';

function shouldInspectReauth(req: HttpRequest<unknown>, event: HttpEvent<unknown>): event is HttpResponse<unknown> {
  if (!(event instanceof HttpResponse)) {
    return false;
  }
  if (event.status < 200 || event.status >= 300) {
    return false;
  }
  if (!req.url.startsWith('/api/')) {
    return false;
  }
  if (req.url.includes('/api/Token/')) {
    return false;
  }
  if (req.url.includes('/api/invitations/')) {
    return false;
  }
  return true;
}

/**
 * Detecta `requiresReauth` en el cuerpo o la cabecera `X-Requires-Reauth` y
 * dispara refresh + rehidratación de tenants (ver guía frontend tenants/roles).
 */
export const requiresReauthInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
): Observable<HttpEvent<unknown>> => {
  const tenantReauth = inject(TenantReauthService);

  return next(req).pipe(
    tap((event) => {
      if (!shouldInspectReauth(req, event)) {
        return;
      }
      const body = event.body;
      if (body === null || typeof body !== 'object' || Array.isArray(body)) {
        return;
      }
      const record = body as Record<string, unknown>;
      const flag = record['requiresReauth'] === true;
      const headerVal = event.headers.get('X-Requires-Reauth');
      const headerTrue = headerVal !== null && headerVal.toLowerCase() === 'true';
      if (flag || headerTrue) {
        tenantReauth.handleRequiresReauthSignal();
      }
    })
  );
};
