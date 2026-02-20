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
 * Servicio para interactuar con los endpoints de Colecciones (Collections).
 *
 * Este servicio proporciona métodos para:
 * - Crear colecciones
 * - Listar colecciones
 * - Obtener detalle de una colección
 * - Actualizar colecciones
 * - Archivar/desarchivar colecciones
 * - Eliminar colecciones
 * - Gestionar items de colecciones (agregar, quitar, reemplazar)
 * - Resolver targets por colecciones
 *
 * Todos los métodos requieren autenticación JWT, que es agregada
 * automáticamente por el interceptor HTTP.
 */
@Injectable({
  providedIn: 'root'
})
export class SegmentsService {
  private readonly collectionsApiUrl = '/api/collections';
  private readonly targetsApiUrl = '/api/targets';

  constructor(private http: HttpClient) {}

  /**
   * Crea una nueva colección
   * @param request Datos de la colección a crear
   * @returns Observable con la colección creada
   */
  createSegment(request: CreateSegmentRequest): Observable<CreateSegmentResponse> {
    return this.http.post<CreateSegmentResponse>(this.collectionsApiUrl, request).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Lista todas las colecciones del usuario
   * @param archived Si es true, incluye colecciones archivadas. Si es false o undefined, solo activas
   * @param includeCounts Si es true, incluye conteos de páginas/grupos
   * @returns Observable con la lista de colecciones
   */
  listSegments(archived?: boolean, includeCounts?: boolean): Observable<SegmentListItem[]> {
    let params = new HttpParams();

    // Solo agregar parámetro archived si es explícitamente true
    // Si es false o undefined, no enviarlo (el backend por defecto devuelve solo activas)
    if (archived === true) {
      params = params.set('archived', 'true');
    }

    // Solo agregar includeCounts si es explícitamente true
    if (includeCounts === true) {
      params = params.set('includeCounts', 'true');
    }

    return this.http.get<SegmentListItem[]>(this.collectionsApiUrl, { params }).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Obtiene el detalle completo de una colección
   * @param segmentId ID de la colección
   * @param items Si es true, incluye la lista de activos de la colección
   * @returns Observable con el detalle de la colección
   */
  getSegmentDetail(segmentId: number, items?: boolean): Observable<SegmentDetail> {
    let params = new HttpParams();

    if (items !== undefined) {
      params = params.set('items', items.toString());
    }

    return this.http.get<SegmentDetail>(`${this.collectionsApiUrl}/${segmentId}`, { params }).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Actualiza una colección
   * @param segmentId ID de la colección
   * @param request Datos a actualizar
   * @returns Observable con la respuesta
   */
  updateSegment(segmentId: number, request: UpdateSegmentRequest): Observable<void> {
    return this.http.put<void>(`${this.collectionsApiUrl}/${segmentId}`, request).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Archiva o desarchiva una colección
   * @param segmentId ID de la colección
   * @param request Datos de archivado
   * @returns Observable con la respuesta
   */
  archiveSegment(segmentId: number, request: ArchiveSegmentRequest): Observable<void> {
    return this.http.patch<void>(`${this.collectionsApiUrl}/${segmentId}/archive`, request).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Elimina una colección
   * @param segmentId ID de la colección
   * @returns Observable con la respuesta
   */
  deleteSegment(segmentId: number): Observable<void> {
    return this.http.delete<void>(`${this.collectionsApiUrl}/${segmentId}`).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Agrega items a una colección (bulk)
   * @param segmentId ID de la colección
   * @param request IDs de los activos sociales a agregar
   * @returns Observable con el resultado de la operación
   */
  addItemsToSegment(segmentId: number, request: AddItemsToSegmentRequest): Observable<AddItemsToSegmentResponse> {
    return this.http.post<AddItemsToSegmentResponse>(
      `${this.collectionsApiUrl}/${segmentId}/items`,
      request
    ).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Quita un item de una colección
   * @param segmentId ID de la colección
   * @param socialAssetId ID del activo social a quitar
   * @returns Observable con la respuesta
   */
  removeItemFromSegment(segmentId: number, socialAssetId: number): Observable<void> {
    return this.http.delete<void>(
      `${this.collectionsApiUrl}/${segmentId}/items/${socialAssetId}`
    ).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Reemplaza todos los items de una colección
   * @param segmentId ID de la colección
   * @param request IDs de los nuevos activos sociales
   * @returns Observable con la respuesta
   */
  replaceSegmentItems(segmentId: number, request: ReplaceSegmentItemsRequest): Observable<void> {
    return this.http.put<void>(
      `${this.collectionsApiUrl}/${segmentId}/items`,
      request
    ).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Resuelve targets por colecciones
   * Útil para Publicaciones/Programador cuando se selecciona "Publicar a Colección X"
   * @param request IDs de las colecciones y opciones
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
          errorMessage = error.error?.detail || error.error?.message || 'Colección no encontrada.';
          break;
        case 500:
          // Intentar obtener más detalles del error del servidor
          const serverError = error.error?.detail || error.error?.message || error.error?.title;
          errorMessage = serverError || 'Error del servidor. Por favor, intenta más tarde.';
          console.error('Error 500 del servidor:', error.error);
          break;
        default:
          errorMessage = error.error?.detail || error.error?.message || `Error ${error.status}: ${error.message}`;
      }
    }

    return throwError(() => new Error(errorMessage));
  };
}
