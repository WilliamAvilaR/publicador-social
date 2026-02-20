/**
 * Modelos para la gestión de Segmentos
 */

/**
 * Tipo de activo social
 */
export type AssetType = 'page' | 'group';

/**
 * Proveedor del activo social
 */
export type Provider = 'facebook' | 'instagram' | 'twitter';

/**
 * Item de activo social dentro de un segmento
 */
export interface SegmentItem {
  socialAssetId: number;
  assetType: AssetType;
  provider: Provider;
  providerAssetId: string;
  name: string;
  pictureUrl?: string;
  isConnected: boolean;
}

/**
 * Request para crear un segmento
 */
export interface CreateSegmentRequest {
  name: string;
  description?: string;
}

/**
 * Response al crear un segmento
 */
export interface CreateSegmentResponse {
  segmentId: number;
  name: string;
  description?: string;
  totalItems: number;
  createdAt: string;
}

/**
 * Segmento en la lista (sin items detallados)
 */
export interface SegmentListItem {
  segmentId: number;
  name: string;
  totalItems: number;
  pages?: number;
  groups?: number;
  updatedAt: string;
}

/**
 * Detalle completo de un segmento
 */
export interface SegmentDetail {
  segmentId: number;
  name: string;
  description?: string;
  items?: SegmentItem[];
}

/**
 * Request para actualizar un segmento
 */
export interface UpdateSegmentRequest {
  name?: string;
  description?: string;
  isArchived?: boolean;
}

/**
 * Request para archivar/desarchivar un segmento
 */
export interface ArchiveSegmentRequest {
  isArchived: boolean;
}

/**
 * Request para agregar items a un segmento (bulk)
 */
export interface AddItemsToSegmentRequest {
  socialAssetIds: number[];
}

/**
 * Response al agregar items a un segmento
 */
export interface AddItemsToSegmentResponse {
  segmentId: number;
  added: number;
  skippedDuplicates: number;
}

/**
 * Request para reemplazar items de un segmento
 */
export interface ReplaceSegmentItemsRequest {
  socialAssetIds: number[];
}

/**
 * Request para resolver targets por segmentos
 */
export interface ResolveTargetsRequest {
  segmentIds: number[];
  includeDisconnected?: boolean;
}

/**
 * Target resuelto
 */
export interface ResolvedTarget {
  socialAssetId: number;
  assetType: AssetType;
  provider: Provider;
  providerAssetId: string;
  name: string;
  pictureUrl?: string;
  isConnected: boolean;
}

/**
 * Response al resolver targets
 */
export interface ResolveTargetsResponse {
  total: number;
  pages: number;
  groups: number;
  targets: ResolvedTarget[];
}
