import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
  SyncAnalyticsRequest,
  SyncAnalyticsResponse,
  PageSnapshotResponse,
  PageMetricsResponse,
  PageChartMetricsResponse,
  SyncLogsResponse
} from '../models/facebook.model';

/**
 * Servicio para interactuar con los endpoints de Analytics de Facebook.
 * 
 * Este servicio proporciona métodos para:
 * - Sincronizar métricas desde Facebook Graph API
 * - Obtener snapshots de páginas
 * - Consultar métricas detalladas por rango de fechas
 * - Obtener logs de sincronización
 * 
 * Todos los métodos requieren autenticación JWT, que es agregada
 * automáticamente por el interceptor HTTP.
 */
@Injectable({
  providedIn: 'root'
})
export class FacebookAnalyticsService {
  private readonly apiUrl = '/api/Facebook/analytics';

  constructor(private http: HttpClient) {}

  /**
   * Sincroniza métricas de páginas de Facebook desde Facebook Graph API.
   * 
   * Este proceso puede tardar varios segundos o minutos dependiendo de la
   * cantidad de páginas. Se recomienda mostrar un indicador de progreso
   * mientras se ejecuta.
   * 
   * El interceptor HTTP agregará automáticamente el token de autenticación.
   * 
   * @param request Parámetros opcionales de sincronización
   * @returns Observable con el resultado de la sincronización
   * 
   * @example
   * ```typescript
   * // Sincronizar todas las páginas activas
   * this.analyticsService.syncAnalytics().subscribe({
   *   next: (response) => console.log('Sincronización completada:', response.data),
   *   error: (error) => console.error('Error:', error)
   * });
   * 
   * // Sincronizar páginas específicas
   * this.analyticsService.syncAnalytics({ 
   *   pageIds: ['page1', 'page2'],
   *   onlyActive: true 
   * }).subscribe(...);
   * ```
   */
  syncAnalytics(request?: SyncAnalyticsRequest): Observable<SyncAnalyticsResponse> {
    const body = request || {};
    return this.http.post<SyncAnalyticsResponse>(
      `${this.apiUrl}/sync`,
      body
    ).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Obtiene el snapshot más reciente de datos básicos de una página.
   * 
   * El snapshot incluye información como nombre, foto, cantidad de fans
   * y seguidores. Es útil para mostrar información actualizada sin necesidad
   * de cargar métricas detalladas.
   * 
   * El interceptor HTTP agregará automáticamente el token de autenticación.
   * 
   * @param facebookPageId ID de la página en Facebook (clave natural)
   * @returns Observable con el snapshot de la página
   * 
   * @example
   * ```typescript
   * this.analyticsService.getPageSnapshot('123456789')
   *   .subscribe({
   *     next: (response) => {
   *       console.log('Fans:', response.data.fanCount);
   *       console.log('Seguidores:', response.data.followersCount);
   *     },
   *     error: (error) => {
   *       if (error.message.includes('404')) {
   *         console.log('No hay snapshot disponible');
   *       }
   *     }
   *   });
   * ```
   */
  getPageSnapshot(facebookPageId: string): Observable<PageSnapshotResponse> {
    return this.http.get<PageSnapshotResponse>(
      `${this.apiUrl}/pages/${facebookPageId}/snapshot`
    ).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Obtiene métricas detalladas de una página para un rango de fechas específico.
   * 
   * Las métricas incluyen reach, impressions, engagements, etc. Cada métrica
   * incluye valores totales, promedios, máximos, mínimos y valores diarios
   * para crear gráficos.
   * 
   * El interceptor HTTP agregará automáticamente el token de autenticación.
   * 
   * @param facebookPageId ID de la página en Facebook (clave natural)
   * @param fromDate Fecha de inicio en formato yyyy-MM-dd
   * @param toDate Fecha de fin en formato yyyy-MM-dd
   * @param metricKeys Opcional: Claves de métricas específicas separadas por coma.
   *                   Si no se envía, devuelve todas las métricas disponibles.
   *                   Ejemplo: 'page_fans,page_reach,page_impressions'
   * @returns Observable con las métricas de la página
   * 
   * @example
   * ```typescript
   * // Obtener todas las métricas
   * this.analyticsService.getPageMetrics('123456789', '2024-01-01', '2024-01-31')
   *   .subscribe(response => {
   *     response.data.metrics.forEach(metric => {
   *       console.log(`${metric.metricKey}: ${metric.total}`);
   *     });
   *   });
   * 
   * // Obtener métricas específicas
   * this.analyticsService.getPageMetrics(
   *   '123456789',
   *   '2024-01-01',
   *   '2024-01-31',
   *   'page_fans,page_reach'
   * ).subscribe(...);
   * ```
   */
  getPageMetrics(
    facebookPageId: string,
    fromDate: string,
    toDate: string,
    metricKeys?: string
  ): Observable<PageMetricsResponse> {
    let params = new HttpParams()
      .set('fromDate', fromDate)
      .set('toDate', toDate);

    if (metricKeys) {
      params = params.set('metricKeys', metricKeys);
    }

    return this.http.get<PageMetricsResponse>(
      `${this.apiUrl}/pages/${facebookPageId}/metrics`,
      { params }
    ).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Obtiene métricas optimizadas para gráficos de una página.
   * 
   * Este endpoint devuelve los datos en un formato listo para usar en gráficos,
   * con labels y values alineados, colores sugeridos y estadísticas. Es más
   * eficiente que el endpoint /metrics para visualización.
   * 
   * El interceptor HTTP agregará automáticamente el token de autenticación.
   * 
   * @param facebookPageId ID de la página en Facebook (clave natural)
   * @param fromDate Fecha de inicio en formato yyyy-MM-dd
   * @param toDate Fecha de fin en formato yyyy-MM-dd
   * @param metricKeys Opcional: Claves de métricas específicas separadas por coma.
   *                   Si no se envía, devuelve todas las métricas disponibles.
   *                   Ejemplo: 'page_fans,page_reach,page_impressions'
   * @returns Observable con las métricas optimizadas para gráficos
   * 
   * @example
   * ```typescript
   * // Obtener todas las métricas
   * this.analyticsService.getPageChartMetrics('123456789', '2024-01-01', '2024-01-31')
   *   .subscribe(response => {
   *     console.log('Labels:', response.data.labels);
   *     response.data.series.forEach(series => {
   *       console.log(`${series.label}:`, series.values);
   *     });
   *   });
   * 
   * // Obtener métricas específicas
   * this.analyticsService.getPageChartMetrics(
   *   '123456789',
   *   '2024-01-01',
   *   '2024-01-31',
   *   'page_fans,page_reach'
   * ).subscribe(...);
   * ```
   */
  getPageChartMetrics(
    facebookPageId: string,
    fromDate: string,
    toDate: string,
    metricKeys?: string
  ): Observable<PageChartMetricsResponse> {
    let params = new HttpParams()
      .set('fromDate', fromDate)
      .set('toDate', toDate);

    if (metricKeys) {
      params = params.set('metricKeys', metricKeys);
    }

    const url = `${this.apiUrl}/pages/${facebookPageId}/chart`;
    console.log('Llamando al endpoint:', url);
    console.log('Parámetros:', { fromDate, toDate, metricKeys });

    return this.http.get<PageChartMetricsResponse>(url, { params }).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Obtiene el historial de sincronizaciones ejecutadas por el usuario.
   * 
   * Útil para mostrar el estado de las últimas sincronizaciones, detectar
   * problemas y mostrar información como "Última sincronización: hace X horas".
   * 
   * El interceptor HTTP agregará automáticamente el token de autenticación.
   * 
   * @param limit Cantidad de logs a obtener (por defecto: 10, máximo: 100)
   * @returns Observable con los logs de sincronización
   * 
   * @example
   * ```typescript
   * // Obtener los últimos 10 logs (por defecto)
   * this.analyticsService.getSyncLogs().subscribe(response => {
   *   const lastSync = response.data[0];
   *   console.log('Última sincronización:', lastSync.status);
   * });
   * 
   * // Obtener los últimos 5 logs
   * this.analyticsService.getSyncLogs(5).subscribe(...);
   * ```
   */
  getSyncLogs(limit?: number): Observable<SyncLogsResponse> {
    let params = new HttpParams();
    if (limit !== undefined) {
      // Validar que el límite esté dentro del rango permitido
      const validLimit = Math.min(Math.max(1, limit), 100);
      params = params.set('limit', validLimit.toString());
    }

    return this.http.get<SyncLogsResponse>(
      `${this.apiUrl}/sync-logs`,
      { params }
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
          errorMessage = 'No se encontraron datos para la página solicitada.';
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
