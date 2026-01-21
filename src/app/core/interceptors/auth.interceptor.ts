import { HttpInterceptorFn, HttpErrorResponse, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, catchError, filter, switchMap, take, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

// Variables para manejar la renovación de token
let isRefreshing = false;
const refreshTokenSubject = new BehaviorSubject<string | null>(null);

/**
 * Interceptor HTTP que:
 * 1. Agrega automáticamente el token de autenticación a las peticiones protegidas
 * 2. Maneja errores 401 (no autorizado) intentando renovar el token automáticamente
 * 3. Si la renovación falla, redirige al login
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
          // Si es un error 401 y no estamos en una ruta pública
          if (error.status === 401 && !isPublicRoute) {
            // Si la petición que falló es el refresh token, no intentar renovar de nuevo
            if (req.url.includes('/api/Token/refresh')) {
              // El refresh token también falló, cerrar sesión y redirigir
              authService.logout();
              if (!router.url.includes('/login')) {
                router.navigate(['/login'], {
                  queryParams: { returnUrl: router.url }
                });
              }
              return throwError(() => error);
            }

            // Si no estamos renovando, intentar renovar el token
            if (!isRefreshing) {
              isRefreshing = true;
              refreshTokenSubject.next(null);

              return authService.refreshToken().pipe(
                switchMap((response) => {
                  // Token renovado exitosamente
                  isRefreshing = false;
                  
                  // Guardar el nuevo token y datos de usuario
                  authService.setAuthData(response.data.token, response.data);
                  
                  // Notificar a las peticiones en espera que el token está listo
                  const newToken = response.data.token;
                  refreshTokenSubject.next(newToken);
                  
                  // Reintentar la petición original con el nuevo token
                  const retryRequest = req.clone({
                    setHeaders: {
                      Authorization: `Bearer ${newToken}`,
                      'Content-Type': 'application/json'
                    }
                  });
                  return next(retryRequest);
                }),
                catchError((refreshError) => {
                  // Error al renovar el token, cerrar sesión y redirigir
                  isRefreshing = false;
                  refreshTokenSubject.next(null);
                  authService.logout();
                  
                  if (!router.url.includes('/login')) {
                    router.navigate(['/login'], {
                      queryParams: { returnUrl: router.url }
                    });
                  }
                  
                  return throwError(() => refreshError);
                })
              );
            } else {
              // Ya estamos renovando, esperar a que el nuevo token esté disponible
              return refreshTokenSubject.pipe(
                filter(token => token !== null),
                take(1),
                switchMap((newToken) => {
                  // Reintentar la petición original con el nuevo token
                  const retryRequest = req.clone({
                    setHeaders: {
                      Authorization: `Bearer ${newToken}`,
                      'Content-Type': 'application/json'
                    }
                  });
                  return next(retryRequest);
                })
              );
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
