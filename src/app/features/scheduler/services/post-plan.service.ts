import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { CreatePostPlanRequest, CreatePostPlanResponse, PostPlanDetailsResponse, PostPlanListResponse } from '../models/post-plan.model';
import { HttpParams } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class PostPlanService {
  private readonly apiUrl = '/api/PostPlan';

  constructor(private http: HttpClient) {}

  /**
   * Crea un nuevo plan de publicación y genera los targets para las páginas seleccionadas.
   * El interceptor HTTP agregará automáticamente el token de autenticación.
   */
  createPostPlan(request: CreatePostPlanRequest): Observable<CreatePostPlanResponse> {
    return this.http.post<CreatePostPlanResponse>(this.apiUrl, request).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Obtiene el detalle completo de un plan de publicación con sus targets.
   * El interceptor HTTP agregará automáticamente el token de autenticación.
   * @param planId ID del plan de publicación
   */
  getPostPlanDetails(planId: number): Observable<PostPlanDetailsResponse> {
    return this.http.get<PostPlanDetailsResponse>(`${this.apiUrl}/${planId}`).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Obtiene la lista de planes de publicación en un rango de fechas.
   * El interceptor HTTP agregará automáticamente el token de autenticación.
   * @param start Fecha de inicio
   * @param end Fecha de fin
   * @param status Opcional: filtrar por estado (Pending, Published, Failed, Partial, Canceled)
   * @param onlyWithPublishableTargets Opcional: solo planes con targets publicables
   * @param q Opcional: búsqueda por texto
   */
  getPostPlans(
    start: Date, 
    end: Date, 
    status?: string, 
    onlyWithPublishableTargets?: boolean,
    q?: string
  ): Observable<PostPlanListResponse> {
    // Convertir fechas a formato YYYY-MM-DD
    const fromDate = this.formatDateToYYYYMMDD(start);
    const toDate = this.formatDateToYYYYMMDD(end);
    
    let params = new HttpParams()
      .set('from', fromDate)
      .set('to', toDate);
    
    if (status) {
      params = params.set('status', status);
    }
    
    if (onlyWithPublishableTargets !== undefined) {
      params = params.set('onlyWithPublishableTargets', onlyWithPublishableTargets.toString());
    }
    
    if (q) {
      params = params.set('q', q);
    }
    
    return this.http.get<PostPlanListResponse>(this.apiUrl, { params }).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Convierte una fecha a formato YYYY-MM-DD
   */
  private formatDateToYYYYMMDD(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private handleError = (error: HttpErrorResponse) => {
    let errorMessage = 'Error desconocido';

    if (error.error instanceof ErrorEvent) {
      errorMessage = `Error: ${error.error.message}`;
    } else {
      switch (error.status) {
        case 400:
          errorMessage = error.error?.detail || error.error?.message || 'Solicitud inválida. Verifica los datos ingresados.';
          break;
        case 401:
          errorMessage = 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.';
          break;
        case 500:
          errorMessage = 'Error del servidor. Por favor, intenta más tarde.';
          break;
        default:
          errorMessage = error.error?.detail || error.error?.message || `Error ${error.status}: ${error.message}`;
      }
    }

    return throwError(() => new Error(errorMessage));
  };
}
