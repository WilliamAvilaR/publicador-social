import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { UserSettingsResponse, UpdateUserSettingsRequest } from '../models/user-settings.model';

@Injectable({
  providedIn: 'root'
})
export class UserSettingsService {
  private readonly apiUrl = '/api/UserSettings';

  constructor(private http: HttpClient) {}

  /**
   * Obtiene las preferencias del usuario autenticado actual.
   * Devuelve valores por defecto si el usuario no ha configurado sus preferencias.
   */
  getUserSettings(): Observable<UserSettingsResponse> {
    return this.http.get<UserSettingsResponse>(this.apiUrl).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Actualiza las preferencias del usuario autenticado actual.
   * Solo se actualizan los campos proporcionados (los campos null se ignoran).
   */
  updateUserSettings(request: UpdateUserSettingsRequest): Observable<UserSettingsResponse> {
    return this.http.put<UserSettingsResponse>(this.apiUrl, request).pipe(
      catchError(this.handleError)
    );
  }

  private handleError = (error: HttpErrorResponse) => {
    let errorMessage = 'Ocurrió un error al procesar la solicitud';
    
    if (error.error instanceof ErrorEvent) {
      // Error del lado del cliente
      errorMessage = `Error: ${error.error.message}`;
    } else {
      // Error del lado del servidor
      if (error.error?.detail) {
        errorMessage = error.error.detail;
      } else if (error.error?.title) {
        errorMessage = error.error.title;
      } else if (error.message) {
        errorMessage = error.message;
      }
    }
    
    return throwError(() => new Error(errorMessage));
  };
}
