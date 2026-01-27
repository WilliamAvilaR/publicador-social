import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
  AddGroupRequest,
  AddGroupResponse,
  GetGroupsResponse,
  GroupSnapshotResponse,
  GroupMetricsResponse,
  GroupChartMetricsResponse,
  UpdateGroupStatusRequest,
  UpdateGroupStatusResponse
} from '../models/facebook.model';

/**
 * Servicio para interactuar con los endpoints de Grupos de Facebook.
 * 
 * Este servicio proporciona métodos para:
 * - Agregar un grupo de Facebook a partir de una URL
 * - Obtener todos los grupos de Facebook del usuario autenticado
 * - Obtener métricas de un grupo para un rango de fechas
 * - Obtener el snapshot más reciente de un grupo
 * - Obtener métricas optimizadas para gráficos
 * - Actualizar el estado (isActive) de un grupo
 * 
 * Todos los métodos requieren autenticación JWT, que es agregada
 * automáticamente por el interceptor HTTP.
 */
@Injectable({
  providedIn: 'root'
})
export class FacebookGroupsService {
  private readonly apiUrl = '/api/Facebook/groups';

  constructor(private http: HttpClient) {}

  /**
   * Agrega un grupo de Facebook a partir de una URL.
   * 
   * El grupo se obtiene desde Facebook Graph API y se guarda en la base de datos.
   * 
   * El interceptor HTTP agregará automáticamente el token de autenticación.
   * 
   * @param groupUrl URL del grupo de Facebook (ej: https://www.facebook.com/groups/123456789)
   * @returns Observable con el grupo agregado
   * 
   * @example
   * ```typescript
   * this.groupsService.addGroup('https://www.facebook.com/groups/123456789')
   *   .subscribe({
   *     next: (response) => {
   *       console.log('Grupo agregado:', response.data.name);
   *       console.log('ID:', response.data.facebookGroupId);
   *     },
   *     error: (error) => {
   *       console.error('Error al agregar grupo:', error.message);
   *     }
   *   });
   * ```
   */
  addGroup(groupUrl: string): Observable<AddGroupResponse> {
    const request: AddGroupRequest = { groupUrl };
    return this.http.post<AddGroupResponse>(
      `${this.apiUrl}/add`,
      request
    ).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Obtiene todos los grupos de Facebook del usuario autenticado.
   * 
   * El interceptor HTTP agregará automáticamente el token de autenticación.
   * 
   * @returns Observable con la lista de grupos y metadatos de paginación
   * 
   * @example
   * ```typescript
   * this.groupsService.getGroups().subscribe({
   *   next: (response) => {
   *     console.log('Grupos:', response.data);
   *     console.log('Total:', response.meta.totalCount);
   *     response.data.forEach(group => {
   *       console.log(`${group.name} - ${group.isActive ? 'Activo' : 'Inactivo'}`);
   *     });
   *   },
   *   error: (error) => {
   *     console.error('Error al obtener grupos:', error.message);
   *   }
   * });
   * ```
   */
  getGroups(): Observable<GetGroupsResponse> {
    return this.http.get<GetGroupsResponse>(
      this.apiUrl
    ).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Obtiene métricas de un grupo de Facebook para un rango de fechas.
   * 
   * Incluye métricas como número de miembros y publicaciones diarias.
   * Las métricas se pueden filtrar por claves específicas.
   * 
   * El interceptor HTTP agregará automáticamente el token de autenticación.
   * 
   * @param facebookGroupId ID del grupo en Facebook
   * @param fromDate Fecha de inicio en formato yyyy-MM-dd
   * @param toDate Fecha de fin en formato yyyy-MM-dd
   * @param metricKeys Opcional: Claves de métricas específicas separadas por coma.
   *                   Ejemplo: "member_count,post_count"
   * @returns Observable con las métricas del grupo
   * 
   * @example
   * ```typescript
   * // Obtener todas las métricas
   * this.groupsService.getGroupMetrics('123456789', '2024-01-01', '2024-01-31')
   *   .subscribe({
   *     next: (response) => {
   *       console.log('Métricas:', response.data.metrics);
   *       response.data.metrics.forEach(metric => {
   *         console.log(`${metric.metricKey}: Total=${metric.total}, Promedio=${metric.average}`);
   *       });
   *     },
   *     error: (error) => console.error('Error:', error)
   *   });
   * 
   * // Obtener métricas específicas
   * this.groupsService.getGroupMetrics(
   *   '123456789',
   *   '2024-01-01',
   *   '2024-01-31',
   *   'member_count,post_count'
   * ).subscribe(...);
   * ```
   */
  getGroupMetrics(
    facebookGroupId: string,
    fromDate: string,
    toDate: string,
    metricKeys?: string
  ): Observable<GroupMetricsResponse> {
    let params = new HttpParams()
      .set('fromDate', fromDate)
      .set('toDate', toDate);

    if (metricKeys) {
      params = params.set('metricKeys', metricKeys);
    }

    return this.http.get<GroupMetricsResponse>(
      `${this.apiUrl}/${facebookGroupId}/metrics`,
      { params }
    ).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Obtiene el snapshot más reciente de un grupo de Facebook.
   * 
   * El snapshot incluye información básica del grupo y métricas más recientes,
   * como número de miembros y publicaciones. Es útil para mostrar información
   * actualizada sin necesidad de cargar métricas detalladas.
   * 
   * El interceptor HTTP agregará automáticamente el token de autenticación.
   * 
   * @param facebookGroupId ID del grupo en Facebook
   * @returns Observable con el snapshot del grupo
   * 
   * @example
   * ```typescript
   * this.groupsService.getGroupSnapshot('123456789')
   *   .subscribe({
   *     next: (response) => {
   *       console.log('Miembros:', response.data.memberCount);
   *       console.log('Publicaciones:', response.data.postCount);
   *       console.log('Última sincronización:', response.data.lastSyncedAt);
   *     },
   *     error: (error) => {
   *       if (error.message.includes('404')) {
   *         console.log('No hay snapshot disponible');
   *       }
   *     }
   *   });
   * ```
   */
  getGroupSnapshot(facebookGroupId: string): Observable<GroupSnapshotResponse> {
    return this.http.get<GroupSnapshotResponse>(
      `${this.apiUrl}/${facebookGroupId}/snapshot`
    ).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Obtiene métricas de un grupo de Facebook en formato optimizado para gráficos.
   * 
   * Este endpoint devuelve los datos en un formato listo para usar en gráficos,
   * con labels y values alineados, colores sugeridos y estadísticas. Es más
   * eficiente que el endpoint /metrics para visualización.
   * 
   * El interceptor HTTP agregará automáticamente el token de autenticación.
   * 
   * @param facebookGroupId ID del grupo en Facebook
   * @param fromDate Fecha de inicio en formato yyyy-MM-dd
   * @param toDate Fecha de fin en formato yyyy-MM-dd
   * @param metricKeys Opcional: Claves de métricas específicas separadas por coma.
   *                   Si no se envía, devuelve todas las métricas disponibles.
   *                   Ejemplo: "member_count,post_count"
   * @returns Observable con las métricas optimizadas para gráficos
   * 
   * @example
   * ```typescript
   * // Obtener todas las métricas
   * this.groupsService.getGroupChartMetrics('123456789', '2024-01-01', '2024-01-31')
   *   .subscribe(response => {
   *     console.log('Labels:', response.data.labels);
   *     response.data.series.forEach(series => {
   *       console.log(`${series.label}:`, series.values);
   *     });
   *   });
   * 
   * // Obtener métricas específicas
   * this.groupsService.getGroupChartMetrics(
   *   '123456789',
   *   '2024-01-01',
   *   '2024-01-31',
   *   'member_count,post_count'
   * ).subscribe(...);
   * ```
   */
  getGroupChartMetrics(
    facebookGroupId: string,
    fromDate: string,
    toDate: string,
    metricKeys?: string
  ): Observable<GroupChartMetricsResponse> {
    let params = new HttpParams()
      .set('fromDate', fromDate)
      .set('toDate', toDate);

    if (metricKeys) {
      params = params.set('metricKeys', metricKeys);
    }

    return this.http.get<GroupChartMetricsResponse>(
      `${this.apiUrl}/${facebookGroupId}/chart`,
      { params }
    ).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Actualiza el estado (isActive) de un grupo de Facebook.
   * 
   * Activar permite que el grupo sea monitoreado por el servicio externo,
   * desactivar lo ignora. Los grupos activos se sincronizan automáticamente
   * para obtener métricas actualizadas.
   * 
   * El interceptor HTTP agregará automáticamente el token de autenticación.
   * 
   * @param facebookGroupId ID del grupo en Facebook
   * @param isActive Nuevo estado del grupo (true = activo, false = inactivo)
   * @returns Observable con el grupo actualizado
   * 
   * @example
   * ```typescript
   * // Activar un grupo
   * this.groupsService.updateGroupStatus('123456789', true)
   *   .subscribe({
   *     next: (response) => {
   *       console.log('Grupo activado:', response.data.name);
   *       console.log('Estado:', response.data.isActive ? 'Activo' : 'Inactivo');
   *     },
   *     error: (error) => console.error('Error:', error)
   *   });
   * 
   * // Desactivar un grupo
   * this.groupsService.updateGroupStatus('123456789', false)
   *   .subscribe(...);
   * ```
   */
  updateGroupStatus(
    facebookGroupId: string,
    isActive: boolean
  ): Observable<UpdateGroupStatusResponse> {
    const request: UpdateGroupStatusRequest = { isActive };
    return this.http.patch<UpdateGroupStatusResponse>(
      `${this.apiUrl}/${facebookGroupId}/status`,
      request
    ).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Maneja errores HTTP de manera consistente.
   * 
   * @param error Error HTTP recibido
   * @returns Observable que emite un error con mensaje descriptivo
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
          errorMessage = error.error?.detail || error.error?.message || 'Grupo no encontrado.';
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
