import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
  CreateSegmentRequest,
  CreateSegmentResponse,
  SegmentListItem,
  SegmentDetail,
  UpdateSegmentRequest,
  ArchiveSegmentRequest,
  AddItemsToSegmentRequest,
  AddItemsToSegmentResponse,
  ReplaceSegmentItemsRequest,
  ResolveTargetsRequest,
  ResolveTargetsResponse
} from '../models/segment.model';

/**
 * Servicio para interactuar con los endpoints de Segmentos.
 * 
 * Este servicio proporciona métodos para:
 * - Crear segmentos
 * - Listar segmentos
 * - Obtener detalle de un segmento
 * - Actualizar segmentos
 * - Archivar/desarchivar segmentos
 * - Eliminar segmentos
 * - Gestionar items de segmentos (agregar, quitar, reemplazar)
 * - Resolver targets por segmentos
 * 
 * Todos los métodos requieren autenticación JWT, que es agregada
 * automáticamente por el interceptor HTTP.
 */
@Injectable({
  providedIn: 'root'
})
export class SegmentsService {
  private readonly segmentsApiUrl = '/api/segments';
  private readonly targetsApiUrl = '/api/targets';

  constructor(private http: HttpClient) {}

  /**
   * Crea un nuevo segmento
   * @param request Datos del segmento a crear
   * @returns Observable con el segmento creado
   */
  createSegment(request: CreateSegmentRequest): Observable<CreateSegmentResponse> {
    return this.http.post<CreateSegmentResponse>(this.segmentsApiUrl, request).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Lista todos los segmentos del usuario
   * @param archived Si es true, incluye segmentos archivados. Si es false, solo activos
   * @param includeCounts Si es true, incluye conteos de páginas/grupos
   * @returns Observable con la lista de segmentos
   */
  listSegments(archived?: boolean, includeCounts?: boolean): Observable<SegmentListItem[]> {
    let params = new HttpParams();
    
    if (archived !== undefined) {
      params = params.set('archived', archived.toString());
    }
    if (includeCounts !== undefined) {
      params = params.set('includeCounts', includeCounts.toString());
    }

    return this.http.get<SegmentListItem[]>(this.segmentsApiUrl, { params }).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Obtiene el detalle completo de un segmento
   * @param segmentId ID del segmento
   * @param items Si es true, incluye la lista de activos del segmento
   * @returns Observable con el detalle del segmento
   */
  getSegmentDetail(segmentId: number, items?: boolean): Observable<SegmentDetail> {
    let params = new HttpParams();
    
    if (items !== undefined) {
      params = params.set('items', items.toString());
    }

    return this.http.get<SegmentDetail>(`${this.segmentsApiUrl}/${segmentId}`, { params }).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Actualiza un segmento
   * @param segmentId ID del segmento
   * @param request Datos a actualizar
   * @returns Observable con la respuesta
   */
  updateSegment(segmentId: number, request: UpdateSegmentRequest): Observable<void> {
    return this.http.put<void>(`${this.segmentsApiUrl}/${segmentId}`, request).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Archiva o desarchiva un segmento
   * @param segmentId ID del segmento
   * @param request Datos de archivado
   * @returns Observable con la respuesta
   */
  archiveSegment(segmentId: number, request: ArchiveSegmentRequest): Observable<void> {
    return this.http.patch<void>(`${this.segmentsApiUrl}/${segmentId}/archive`, request).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Elimina un segmento
   * @param segmentId ID del segmento
   * @returns Observable con la respuesta
   */
  deleteSegment(segmentId: number): Observable<void> {
    return this.http.delete<void>(`${this.segmentsApiUrl}/${segmentId}`).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Agrega items a un segmento (bulk)
   * @param segmentId ID del segmento
   * @param request IDs de los activos sociales a agregar
   * @returns Observable con el resultado de la operación
   */
  addItemsToSegment(segmentId: number, request: AddItemsToSegmentRequest): Observable<AddItemsToSegmentResponse> {
    return this.http.post<AddItemsToSegmentResponse>(
      `${this.segmentsApiUrl}/${segmentId}/items`,
      request
    ).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Quita un item de un segmento
   * @param segmentId ID del segmento
   * @param socialAssetId ID del activo social a quitar
   * @returns Observable con la respuesta
   */
  removeItemFromSegment(segmentId: number, socialAssetId: number): Observable<void> {
    return this.http.delete<void>(
      `${this.segmentsApiUrl}/${segmentId}/items/${socialAssetId}`
    ).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Reemplaza todos los items de un segmento
   * @param segmentId ID del segmento
   * @param request IDs de los nuevos activos sociales
   * @returns Observable con la respuesta
   */
  replaceSegmentItems(segmentId: number, request: ReplaceSegmentItemsRequest): Observable<void> {
    return this.http.put<void>(
      `${this.segmentsApiUrl}/${segmentId}/items`,
      request
    ).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Resuelve targets por segmentos
   * Útil para Publicaciones/Programador cuando se selecciona "Publicar a Segmento X"
   * @param request IDs de los segmentos y opciones
   * @returns Observable con los targets resueltos
   */
  resolveTargets(request: ResolveTargetsRequest): Observable<ResolveTargetsResponse> {
    return this.http.post<ResolveTargetsResponse>(
      `${this.targetsApiUrl}/resolve`,
      request
    ).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Maneja errores HTTP de manera consistente
   */
  private handleError = (error: HttpErrorResponse) => {
    let errorMessage = 'Error desconocido';

    if (error.error instanceof ErrorEvent) {
      // Error del lado del cliente
      errorMessage = `Error: ${error.error.message}`;
    } else {
      // Error del lado del servidor
      switch (error.status) {
        case 401:
          errorMessage = 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.';
          break;
        case 400:
          errorMessage = error.error?.detail || error.error?.message || 'Solicitud inválida.';
          break;
        case 404:
          errorMessage = error.error?.detail || error.error?.message || 'Segmento no encontrado.';
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
