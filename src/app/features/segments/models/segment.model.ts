/**
 * Modelos para la gestión de Colecciones
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
 * Item de activo social dentro de una colección
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
 * Request para crear una colección
 */
export interface CreateSegmentRequest {
  name: string;
  description?: string;
}

/**
 * Response al crear una colección
 */
export interface CreateSegmentResponse {
  segmentId: number;
  name: string;
  description?: string;
  totalItems: number;
  createdAt: string;
}

/**
 * Colección en la lista (sin items detallados)
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
 * Detalle completo de una colección
 */
export interface SegmentDetail {
  segmentId: number;
  name: string;
  description?: string;
  items?: SegmentItem[];
}

/**
 * Request para actualizar una colección
 */
export interface UpdateSegmentRequest {
  name?: string;
  description?: string;
  isArchived?: boolean;
}

/**
 * Request para archivar/desarchivar una colección
 */
export interface ArchiveSegmentRequest {
  isArchived: boolean;
}

/**
 * Request para agregar items a una colección (bulk)
 */
export interface AddItemsToSegmentRequest {
  socialAssetIds: number[];
}

/**
 * Response al agregar items a una colección
 */
export interface AddItemsToSegmentResponse {
  segmentId: number;
  added: number;
  skippedDuplicates: number;
}

/**
 * Request para reemplazar items de una colección
 */
export interface ReplaceSegmentItemsRequest {
  socialAssetIds: number[];
}

/**
 * Request para resolver targets por colecciones
 */
export interface ResolveTargetsRequest {
  collectionIds: number[];
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
