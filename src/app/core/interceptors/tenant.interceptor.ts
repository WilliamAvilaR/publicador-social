import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { TenantContextService } from '../services/tenant-context.service';

/**
 * Interceptor que agrega el header X-Tenant-Id a las peticiones HTTP
 * cuando hay un tenant seleccionado en el frontend.
 *
 * Solo aplica a rutas que comienzan con /api/ y NO toca las rutas públicas
 * de autenticación. El backend también puede obtener el tenantId desde
 * la ruta o querystring, pero este header simplifica el uso de /api/tenants/current.
 */
export const tenantInterceptor: HttpInterceptorFn = (req, next) => {
  // Solo modificar peticiones a la API propia
  if (!req.url.startsWith('/api/')) {
    return next(req);
  }

  const tenantContext = inject(TenantContextService);

  // No agregar header en rutas de auth
  const isAuthRoute =
    req.url.includes('/api/Token/login') ||
    req.url.includes('/api/Token/register') ||
    req.url.includes('/api/Token/refresh');

  if (isAuthRoute) {
    return next(req);
  }

  if (req.url.includes('/api/invitations/')) {
    return next(req);
  }

  // Si ya viene X-Tenant-Id explícito, respetarlo
  if (req.headers.has('X-Tenant-Id')) {
    return next(req);
  }

  const tenantId = tenantContext.getCurrentTenantId();

  if (tenantId == null) {
    // No hay tenant seleccionado todavía, dejamos pasar la petición tal cual
    return next(req);
  }

  const cloned = req.clone({
    setHeaders: {
      'X-Tenant-Id': tenantId.toString()
    }
  });

  return next(cloned);
};

