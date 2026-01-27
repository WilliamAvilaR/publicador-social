import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

/**
 * Respuesta genérica de AG Grid
 */
export interface AgGridResponse<T> {
  data: T[];
  meta: {
    totalCount: number;
    pageSize: number;
    currentPage: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviusPage: boolean;
    nextPageUrl: string | null;
    previusPageUrl: string | null;
  };
}

@Injectable({
  providedIn: 'root'
})
export class AgGridService {
  private readonly apiUrl = '/api/ag-grid';

  constructor(private http: HttpClient) {}

  /**
   * Maneja errores HTTP
   */
  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'Error desconocido';
    
    if (error.error instanceof ErrorEvent) {
      errorMessage = `Error: ${error.error.message}`;
    } else {
      errorMessage = error.error?.detail || error.error?.message || `Error ${error.status}: ${error.statusText}`;
    }
    
    return throwError(() => new Error(errorMessage));
  }

  /**
   * Obtiene páginas en formato plano para AG Grid
   */
  getPages(): Observable<AgGridResponse<any>> {
    return this.http.get<AgGridResponse<any>>(`${this.apiUrl}/pages`).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Obtiene resumen de páginas en formato plano para AG Grid.
   * Muestra una fila por página con información básica y métricas más recientes.
   */
  getPageSummaries(): Observable<AgGridResponse<any>> {
    return this.http.get<AgGridResponse<any>>(`${this.apiUrl}/page-summaries`).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Obtiene grupos en formato plano para AG Grid
   */
  getGroups(): Observable<AgGridResponse<any>> {
    return this.http.get<AgGridResponse<any>>(`${this.apiUrl}/groups`).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Obtiene resumen de grupos en formato plano para AG Grid.
   * Muestra una fila por grupo con información básica y métricas más recientes.
   */
  getGroupSummaries(): Observable<AgGridResponse<any>> {
    return this.http.get<AgGridResponse<any>>(`${this.apiUrl}/group-summaries`).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Obtiene conversaciones en formato plano para AG Grid
   */
  getConversations(
    facebookPageId?: string,
    isArchived?: boolean
  ): Observable<AgGridResponse<any>> {
    let params = new HttpParams();
    
    if (facebookPageId) {
      params = params.set('facebookPageId', facebookPageId);
    }
    if (isArchived !== undefined) {
      params = params.set('isArchived', isArchived.toString());
    }

    return this.http.get<AgGridResponse<any>>(`${this.apiUrl}/conversations`, { params }).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Obtiene mensajes en formato plano para AG Grid
   */
  getMessages(
    conversationId?: number,
    facebookPageId?: string
  ): Observable<AgGridResponse<any>> {
    let params = new HttpParams();
    
    if (conversationId !== undefined) {
      params = params.set('conversationId', conversationId.toString());
    }
    if (facebookPageId) {
      params = params.set('facebookPageId', facebookPageId);
    }

    return this.http.get<AgGridResponse<any>>(`${this.apiUrl}/messages`, { params }).pipe(
      catchError(this.handleError)
    );
  }
}
