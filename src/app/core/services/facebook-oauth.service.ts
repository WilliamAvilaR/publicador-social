import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { FacebookConnectResponse, FacebookPage, FacebookPagesResponse } from '../../features/facebook/models/facebook.model';

@Injectable({
  providedIn: 'root'
})
export class FacebookOAuthService {
  private readonly apiUrl = '/api/Facebook';

  constructor(private http: HttpClient) {}

  /**
   * Inicia el flujo de conexión con Facebook.
   * Redirige al usuario a Facebook para autorización.
   * El interceptor HTTP agregará automáticamente el token de autenticación.
   */
  connectFacebook(): void {
    this.http.get<FacebookConnectResponse>(
      `${this.apiUrl}/connect`
    ).pipe(
      catchError(this.handleError)
    ).subscribe({
      next: (response) => {
        window.location.href = response.data.authorizationUrl;
      },
      error: (error) => {
        console.error('Error al conectar Facebook:', error);
      }
    });
  }

  /**
   * Obtiene las páginas de Facebook conectadas del usuario.
   * El interceptor HTTP agregará automáticamente el token de autenticación.
   */
  getConnectedPages(): Observable<FacebookPage[]> {
    return this.http.get<FacebookPagesResponse>(
      `${this.apiUrl}/pages`
    ).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  /**
   * Obtiene las páginas de Facebook conectadas del usuario con metadatos de paginación.
   * El interceptor HTTP agregará automáticamente el token de autenticación.
   */
  getConnectedPagesWithMeta(): Observable<FacebookPagesResponse> {
    return this.http.get<FacebookPagesResponse>(
      `${this.apiUrl}/pages`
    ).pipe(
      catchError(this.handleError)
    );
  }

  private handleError = (error: HttpErrorResponse) => {
    let errorMessage = 'Error desconocido';

    if (error.error instanceof ErrorEvent) {
      errorMessage = `Error: ${error.error.message}`;
    } else {
      switch (error.status) {
        case 401:
          errorMessage = 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.';
          break;
        case 400:
          errorMessage = error.error?.message || 'Solicitud inválida.';
          break;
        case 500:
          errorMessage = 'Error del servidor. Por favor, intenta más tarde.';
          break;
        default:
          errorMessage = `Error ${error.status}: ${error.message}`;
      }
    }

    return throwError(() => new Error(errorMessage));
  };
}
