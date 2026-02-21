import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import {
  CreateSegmentRequest,
  CreateSegmentResponse,
  CreateCollectionApiResponse,
  SegmentListItem,
  ListCollectionsApiResponse,
  SegmentDetail,
  GetCollectionDetailApiResponse,
  UpdateSegmentRequest,
  ArchiveSegmentRequest,
  AddItemsToSegmentRequest,
  AddItemsToSegmentResponse,
  AddItemsToSegmentApiResponse,
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
    return this.http.post<CreateCollectionApiResponse>(this.collectionsApiUrl, request).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  /**
   * Lista todas las colecciones del usuario
   * @param archived Si es true, incluye colecciones archivadas. Si es false o undefined, solo activas (default: false)
   * @param includeCounts Si es true, incluye conteos de páginas/grupos (default: true)
   * @returns Observable con la lista de colecciones
   */
  listSegments(archived?: boolean, includeCounts?: boolean): Observable<SegmentListItem[]> {
    let params = new HttpParams();

    // Enviar archived explícitamente si se proporciona (default del backend es false)
    if (archived !== undefined) {
      params = params.set('archived', archived.toString());
    }

    // Enviar includeCounts explícitamente si se proporciona (default del backend es true)
    if (includeCounts !== undefined) {
      params = params.set('includeCounts', includeCounts.toString());
    }

    return this.http.get<ListCollectionsApiResponse>(this.collectionsApiUrl, { params }).pipe(
      map(response => {
        // La API siempre devuelve updatedAt según la especificación, pero por seguridad
        // aseguramos un valor por defecto si no viene
        return response.data.map(item => ({
          ...item,
          updatedAt: item.updatedAt || new Date().toISOString()
        }));
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Obtiene el detalle completo de una colección
   * @param collectionId ID de la colección
   * @param items Si es true, incluye la lista de activos de la colección (default: true)
   * @returns Observable con el detalle de la colección
   */
  getSegmentDetail(collectionId: number, items?: boolean): Observable<SegmentDetail> {
    let params = new HttpParams();

    // Enviar items explícitamente si se proporciona (default del backend es true)
    if (items !== undefined) {
      params = params.set('items', items.toString());
    }

    return this.http.get<GetCollectionDetailApiResponse>(`${this.collectionsApiUrl}/${collectionId}`, { params }).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  /**
   * Actualiza una colección
   * @param collectionId ID de la colección
   * @param request Datos a actualizar (name, description, isArchived - todos opcionales)
   * @returns Observable que completa cuando la actualización es exitosa
   */
  updateSegment(collectionId: number, request: UpdateSegmentRequest): Observable<void> {
    return this.http.put<void>(`${this.collectionsApiUrl}/${collectionId}`, request).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Archiva o desarchiva una colección
   * @param collectionId ID de la colección
   * @param request Datos de archivado ({ isArchived: boolean })
   * @returns Observable que completa cuando la operación es exitosa
   */
  archiveSegment(collectionId: number, request: ArchiveSegmentRequest): Observable<void> {
    return this.http.patch<void>(`${this.collectionsApiUrl}/${collectionId}/archive`, request).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Elimina una colección (hard delete)
   * @param collectionId ID de la colección
   * @returns Observable que completa cuando la eliminación es exitosa
   */
  deleteSegment(collectionId: number): Observable<void> {
    return this.http.delete<void>(`${this.collectionsApiUrl}/${collectionId}`).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Agrega items a una colección (bulk)
   *
   * Este método permite agregar múltiples páginas y grupos de Facebook a una colección
   * en una sola operación.
   *
   * Los IDs deben corresponder a páginas o grupos existentes que pertenezcan al usuario
   * autenticado. Si un activo ya está en la colección, se omite automáticamente (no se duplica).
   *
   * @param collectionId ID de la colección a la que se agregarán los items
   * @param request IDs de páginas y grupos a agregar (deben ser mayores que 0)
   * @returns Observable con el resultado de la operación (collectionId, added, skippedDuplicates)
   */
  addItemsToSegment(collectionId: number, request: AddItemsToSegmentRequest): Observable<AddItemsToSegmentResponse> {
    // Validar y filtrar IDs de páginas (deben ser mayores que 0)
    const validPageIds = (request.pageIds || []).filter(id => id > 0);

    // Validar y filtrar IDs de grupos (deben ser mayores que 0)
    const validGroupIds = (request.groupIds || []).filter(id => id > 0);

    // Verificar que al menos haya un ID válido
    if (validPageIds.length === 0 && validGroupIds.length === 0) {
      return throwError(() => new Error('Debe proporcionar al menos un ID de página o grupo válido (mayor que 0)'));
    }

    // Construir el request con solo los IDs válidos
    const validRequest: AddItemsToSegmentRequest = {};

    if (validPageIds.length > 0) {
      validRequest.pageIds = validPageIds;
    }

    if (validGroupIds.length > 0) {
      validRequest.groupIds = validGroupIds;
    }

    return this.http.post<AddItemsToSegmentApiResponse>(
      `${this.collectionsApiUrl}/${collectionId}/items`,
      validRequest
    ).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  /**
   * Elimina un item de una colección
   * @param collectionId ID de la colección
   * @param socialAssetId ID del activo social a eliminar
   * @returns Observable que completa cuando la eliminación es exitosa
   */
  removeItemFromSegment(collectionId: number, socialAssetId: number): Observable<void> {
    return this.http.delete<void>(
      `${this.collectionsApiUrl}/${collectionId}/items/${socialAssetId}`
    ).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Reemplaza todos los items de una colección
   * @param collectionId ID de la colección
   * @param request IDs de los nuevos activos sociales ({ socialAssetIds: number[] })
   * @returns Observable que completa cuando la operación es exitosa
   */
  replaceSegmentItems(collectionId: number, request: ReplaceSegmentItemsRequest): Observable<void> {
    return this.http.put<void>(
      `${this.collectionsApiUrl}/${collectionId}/items`,
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
