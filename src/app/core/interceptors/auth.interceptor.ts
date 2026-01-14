import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

/**
 * Interceptor HTTP que:
 * 1. Agrega automáticamente el token de autenticación a las peticiones protegidas
 * 2. Maneja errores 401 (no autorizado) redirigiendo al login
 * 
 * Excluye las rutas públicas como /api/Token/login y /api/Token/register
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Rutas públicas que no requieren token
  const publicRoutes = [
    '/api/Token/login',
    '/api/Token/register'
  ];

  // Verificar si la ruta es pública
  const isPublicRoute = publicRoutes.some(route => req.url.includes(route));

  // Si es una ruta pública, no agregar el token
  if (isPublicRoute) {
    return next(req);
  }

  // Solo agregar token a peticiones que van a /api/
  if (req.url.startsWith('/api/')) {
    const token = authService.getToken();

    if (token) {
      // Clonar la petición y agregar el header de autorización
      const clonedRequest = req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      // Interceptar la respuesta para manejar errores 401
      return next(clonedRequest).pipe(
        catchError((error: HttpErrorResponse) => {
          if (error.status === 401) {
            // Token inválido o expirado - limpiar sesión y redirigir al login
            authService.logout();
            
            // Solo redirigir si no estamos ya en la página de login
            if (!router.url.includes('/login')) {
              router.navigate(['/login'], {
                queryParams: { returnUrl: router.url }
              });
            }
          }
          return throwError(() => error);
        })
      );
    } else {
      // Si no hay token y es una ruta protegida, redirigir al login
      // Solo redirigir si no estamos ya en la página de login
      if (!router.url.includes('/login')) {
        router.navigate(['/login'], {
          queryParams: { returnUrl: router.url }
        });
      }
    }
  }

  return next(req);
};
