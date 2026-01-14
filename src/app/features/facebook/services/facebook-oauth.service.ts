import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { FacebookConnectResponse, FacebookPage, FacebookPagesResponse } from '../models/facebook.model';
import { AuthService } from '../../auth/services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class FacebookOAuthService {
  private readonly apiUrl = '/api/Facebook';

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  /**
   * Inicia el flujo de conexión con Facebook.
   * Redirige al usuario a Facebook para autorización.
   */
  connectFacebook(): void {
    const headers = this.getAuthHeaders();

    this.http.get<FacebookConnectResponse>(
      `${this.apiUrl}/connect`,
      { headers }
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
   */
  getConnectedPages(): Observable<FacebookPage[]> {
    const headers = this.getAuthHeaders();
    
    return this.http.get<FacebookPagesResponse>(
      `${this.apiUrl}/pages`,
      { headers }
    ).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  /**
   * Obtiene las páginas de Facebook conectadas del usuario con metadatos de paginación.
   */
  getConnectedPagesWithMeta(): Observable<FacebookPagesResponse> {
    const headers = this.getAuthHeaders();
    
    return this.http.get<FacebookPagesResponse>(
      `${this.apiUrl}/pages`,
      { headers }
    ).pipe(
      catchError(this.handleError)
    );
  }

  private getAuthHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    if (!token) {
      throw new Error('No hay token de autenticación disponible');
    }
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
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
