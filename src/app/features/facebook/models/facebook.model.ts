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

// ============================================
// Facebook Groups Models
// ============================================

/**
 * Grupo de Facebook del usuario
 */
export interface FacebookGroup {
  id: number;
  facebookGroupId: string;
  originalUrl: string;
  name: string;
  pictureUrl: string;
  isActive: boolean;
  lastSyncedAt: string | null;
  facebookCreatedTime?: string; // Fecha de creación en Facebook
  createdAt: string;
}

/**
 * Request para agregar un grupo de Facebook
 */
export interface AddGroupRequest {
  groupUrl: string;
}

/**
 * Response al agregar un grupo de Facebook
 */
export interface AddGroupResponse {
  data: FacebookGroup;
  meta: FacebookPagesMeta;
}

/**
 * Response al obtener todos los grupos de Facebook
 */
export interface GetGroupsResponse {
  data: FacebookGroup[];
  meta: FacebookPagesMeta;
}

/**
 * Snapshot de datos básicos de un grupo de Facebook
 */
export interface GroupSnapshot {
  facebookGroupId: string;
  name: string;
  pictureUrl: string;
  memberCount: number;
  postCount: number;
  facebookCreatedTime: string;
  lastSyncedAt: string | null;
  snapshotAt: string;
}

/**
 * Response del snapshot de un grupo
 */
export interface GroupSnapshotResponse {
  data: GroupSnapshot;
  meta: FacebookPagesMeta;
}

/**
 * Valor diario de una métrica de grupo (con más campos que PageMetric)
 */
export interface GroupMetricDailyValue {
  id: number;
  facebookGroupId: string;
  date: string; // ISO date string
  metricKey: string;
  value: number;
  fetchedAt: string;
}

/**
 * Métrica de un grupo con valores agregados y diarios
 */
export interface GroupMetric {
  metricKey: string;
  total: number;
  average: number;
  max: number;
  min: number;
  dailyValues: GroupMetricDailyValue[];
}

/**
 * Response de métricas de un grupo para un rango de fechas
 */
export interface GroupMetricsResponse {
  data: {
    facebookGroupId: string;
    groupName: string;
    fromDate: string;
    toDate: string;
    metrics: GroupMetric[];
  };
  meta: FacebookPagesMeta;
}

/**
 * Response optimizado para gráficos de grupos (endpoint /chart)
 * Nota: El backend retorna "facebookPageId" y "pageName" pero se refiere a grupos
 */
export interface GroupChartMetricsResponse {
  data: {
    facebookPageId: string; // Nota: El backend usa este nombre aunque sea un grupo
    pageName: string; // Nota: El backend usa este nombre aunque sea un grupo
    fromDate: string;
    toDate: string;
    labels: string[]; // Fechas en formato yyyy-MM-dd
    series: ChartMetricSeries[];
  };
  meta: FacebookPagesMeta;
}

/**
 * Request para actualizar el estado de un grupo
 */
export interface UpdateGroupStatusRequest {
  isActive: boolean;
}

/**
 * Response al actualizar el estado de un grupo
 */
export interface UpdateGroupStatusResponse {
  data: FacebookGroup & {
    facebookCreatedTime?: string;
  };
  meta: FacebookPagesMeta;
}