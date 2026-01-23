export interface FacebookConnectResponse {
  data: {
    authorizationUrl: string;
  };
}

export interface FacebookCallbackResponse {
  data: {
    pagesImported: number;
    errors: number;
    message: string;
    pages?: FacebookPage[];
  };
}

export interface FacebookPage {
  facebookPageId: string;
  name: string;
  pictureUrl: string;
  isActive: boolean;
  tasks: string[];
  canPublish: boolean;
  canOnlyAnalyze: boolean;
  tokenStatus: number;
  lastValidatedAt: string;
}

export interface FacebookPagesMeta {
  totalCount: number;
  pageSize: number;
  currentPage: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviusPage: boolean;
  nextPageUrl: string;
  previusPageUrl: string;
}

export interface FacebookPagesResponse {
  data: FacebookPage[];
  meta: FacebookPagesMeta;
}

export interface UpdatePageStatusRequest {
  isActive: boolean;
}

export interface UpdatePageStatusResponse {
  data: FacebookPage;
  meta: FacebookPagesMeta;
}

// ============================================
// Analytics Models
// ============================================

/**
 * Request para sincronizar métricas de analytics
 */
export interface SyncAnalyticsRequest {
  pageIds?: string[];
  onlyActive?: boolean;
}

/**
 * Response de sincronización de métricas
 */
export interface SyncAnalyticsResponse {
  data: {
    syncRunId: string;
    pagesOk: number;
    pagesFailed: number;
    message: string;
    startedAt: string;
    endedAt: string;
  };
}

/**
 * Snapshot de datos básicos de una página de Facebook
 */
export interface PageSnapshot {
  id: number;
  facebookPageId: string;
  name: string;
  pictureUrl: string;
  fanCount: number;
  followersCount: number;
  snapshotAt: string;
}

/**
 * Response del snapshot de una página
 */
export interface PageSnapshotResponse {
  data: PageSnapshot;
}

/**
 * Valor diario de una métrica
 */
export interface MetricDailyValue {
  date: string; // yyyy-MM-dd
  value: number;
}

/**
 * Métrica de una página con valores agregados y diarios
 */
export interface PageMetric {
  metricKey: string;
  total: number;
  average: number;
  max: number;
  min: number;
  dailyValues: MetricDailyValue[];
}

/**
 * Response de métricas de una página para un rango de fechas
 */
export interface PageMetricsResponse {
  data: {
    facebookPageId: string;
    pageName: string;
    fromDate: string;
    toDate: string;
    metrics: PageMetric[];
  };
}

/**
 * Serie de métrica optimizada para gráficos (endpoint /chart)
 */
export interface ChartMetricSeries {
  metricKey: string;
  label: string;
  values: (number | null)[];
  color: string;
  statistics: {
    total: number;
    average: number;
    max: number;
    min: number;
  };
}

/**
 * Response optimizado para gráficos (endpoint /chart)
 */
export interface PageChartMetricsResponse {
  data: {
    facebookPageId: string;
    pageName: string;
    fromDate: string;
    toDate: string;
    labels: string[]; // Fechas en formato yyyy-MM-dd
    series: ChartMetricSeries[];
  };
}

/**
 * Estado de una sincronización
 */
export type SyncStatus = 'Running' | 'Completed' | 'Failed' | 'Cancelled';

/**
 * Log de una sincronización ejecutada
 */
export interface SyncLog {
  id: number;
  syncRunId: string;
  userId: number;
  startedAt: string;
  endedAt: string | null;
  pagesOk: number;
  pagesFailed: number;
  lastError: string | null;
  status: SyncStatus;
  durationSeconds: number | null;
}

/**
 * Response de logs de sincronización
 */
export interface SyncLogsResponse {
  data: SyncLog[];
}
