import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

export interface ApiResponse<T> {
  data: T;
  meta?: {
    totalCount?: number;
    pageSize?: number;
    currentPage?: number;
    totalPages?: number;
    [key: string]: unknown;
  };
}

/** Respuesta sugerida para POST /api/media/upload (ver docs/composer-media-api-contract.md). */
export interface MediaUploadResponseBody {
  mediaId: number;
  publicUrl?: string;
  mimeType: string;
  width?: number;
  height?: number;
}

/** Ítem de biblioteca (GET /api/media). */
export interface MediaLibraryItemDto {
  id: number;
  thumbnailUrl?: string;
  publicUrl?: string;
  mimeType: string;
  createdAt: string;
  name?: string;
  source?: string;
  status?: 'active' | 'archived';
  isInUse?: boolean;
  usageCount?: number;
  lastUsedAt?: string;
  tags?: string[];
  sizeBytes?: number;
}

export interface MediaLibraryListQuery {
  page?: number;
  pageSize?: number;
  q?: string;
  status?: 'active' | 'archived';
  sort?: 'smart' | 'recently_used' | 'most_used' | 'recently_uploaded';
}

export interface MediaUpdateRequest {
  name?: string;
  status?: 'active' | 'archived';
  tags?: string[];
}

/** POST /api/media/preview-url */
export interface MediaPreviewUrlRequest {
  url: string;
}

export interface MediaPreviewUrlResponseBody {
  ok: boolean;
  type: 'image' | 'video' | 'unknown';
  canonicalUrl: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
}

export interface MediaImportUrlRequest {
  url: string;
  name?: string;
  tags?: string[];
}

export interface BulkOperationResultItem {
  mediaId: number;
  ok: boolean;
  status?: number;
  code?: string;
  message?: string;
}

export interface BulkOperationResultDto {
  totalRequested: number;
  processed: number;
  failed: number;
  results: BulkOperationResultItem[];
}

export interface BulkDeleteRequest {
  mediaIds: number[];
}

export interface BulkTagRequest {
  mediaIds: number[];
  tags: string[];
}

export interface StorageSummaryDto {
  usedBytes: number;
  limitBytes: number | null;
  availableBytes: number | null;
  isUnlimited: boolean;
}

export interface IntegrationOAuthStartResponseDto {
  provider: string;
  authorizationUrl: string;
  state?: string;
}

export interface ExternalImportRequestDto {
  fileId: string;
  name?: string;
  tags?: string[];
}

export interface IntegrationStatusResponseDto {
  provider: string;
  connected: boolean;
  connectedAt?: string | null;
  accountEmail?: string | null;
}

export interface IntegrationFileItemDto {
  fileId: string;
  name: string;
  mimeType?: string;
  thumbnailUrl?: string;
  modifiedTime?: string;
  sizeBytes?: number;
}

export interface IntegrationFilesQuery {
  q?: string;
  page?: number;
  pageSize?: number;
}

export interface IntegrationPickerTokenDto {
  oauthToken: string;
  apiKey?: string;
  appId?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ComposerMediaService {
  private readonly base = '/api/media';

  constructor(private http: HttpClient) {}

  uploadMedia(file: File): Observable<ApiResponse<MediaUploadResponseBody>> {
    const formData = new FormData();
    formData.append('file', file, file.name);
    return this.http.post<ApiResponse<MediaUploadResponseBody>>(`${this.base}/upload`, formData).pipe(
      catchError((err) =>
        throwError(() => err)
      )
    );
  }

  listMedia(query: MediaLibraryListQuery = {}): Observable<ApiResponse<MediaLibraryItemDto[]>> {
    let params = new HttpParams()
      .set('page', String(query.page ?? 1))
      .set('pageSize', String(query.pageSize ?? 24));
    if (query.q?.trim()) {
      params = params.set('q', query.q.trim());
    }
    if (query.status) {
      params = params.set('status', query.status);
    }
    if (query.sort) {
      params = params.set('sort', query.sort);
    }
    return this.http.get<ApiResponse<MediaLibraryItemDto[]>>(this.base, { params }).pipe(
      catchError((err) => throwError(() => err))
    );
  }

  getMedia(id: number): Observable<ApiResponse<MediaLibraryItemDto>> {
    return this.http.get<ApiResponse<MediaLibraryItemDto>>(`${this.base}/${id}`).pipe(
      catchError((err) => throwError(() => err))
    );
  }

  previewUrl(body: MediaPreviewUrlRequest): Observable<ApiResponse<MediaPreviewUrlResponseBody>> {
    return this.http.post<ApiResponse<MediaPreviewUrlResponseBody>>(`${this.base}/preview-url`, body).pipe(
      catchError((err) => throwError(() => err))
    );
  }

  importUrl(body: MediaImportUrlRequest): Observable<ApiResponse<MediaUploadResponseBody>> {
    return this.http.post<ApiResponse<MediaUploadResponseBody>>(`${this.base}/import-url`, body).pipe(
      catchError((err) => throwError(() => err))
    );
  }

  archiveMedia(id: number): Observable<ApiResponse<MediaLibraryItemDto>> {
    return this.http.post<ApiResponse<MediaLibraryItemDto>>(`${this.base}/${id}/archive`, {}).pipe(
      catchError((err) => throwError(() => err))
    );
  }

  deleteMedia(id: number): Observable<ApiResponse<{ deleted: boolean }>> {
    return this.http.delete<ApiResponse<{ deleted: boolean }>>(`${this.base}/${id}`).pipe(
      catchError((err) => throwError(() => err))
    );
  }

  updateMedia(id: number, body: MediaUpdateRequest): Observable<ApiResponse<MediaLibraryItemDto>> {
    return this.http.patch<ApiResponse<MediaLibraryItemDto>>(`${this.base}/${id}`, body).pipe(
      catchError((err) => throwError(() => err))
    );
  }

  bulkDelete(body: BulkDeleteRequest): Observable<ApiResponse<BulkOperationResultDto>> {
    return this.http.post<ApiResponse<BulkOperationResultDto>>(`${this.base}/bulk-delete`, body).pipe(
      catchError((err) => throwError(() => err))
    );
  }

  bulkTag(body: BulkTagRequest): Observable<ApiResponse<BulkOperationResultDto>> {
    return this.http.post<ApiResponse<BulkOperationResultDto>>(`${this.base}/bulk-tag`, body).pipe(
      catchError((err) => throwError(() => err))
    );
  }

  getStorageSummary(): Observable<ApiResponse<StorageSummaryDto>> {
    return this.http.get<ApiResponse<StorageSummaryDto>>(`${this.base}/storage-summary`).pipe(
      catchError((err) => throwError(() => err))
    );
  }

  startOAuth(provider: string): Observable<ApiResponse<IntegrationOAuthStartResponseDto>> {
    return this.http
      .get<ApiResponse<IntegrationOAuthStartResponseDto>>(`/api/integrations/${encodeURIComponent(provider)}/oauth/start`)
      .pipe(catchError((err) => throwError(() => err)));
  }

  importFromProvider(
    provider: string,
    body: ExternalImportRequestDto
  ): Observable<ApiResponse<MediaUploadResponseBody>> {
    return this.http
      .post<ApiResponse<MediaUploadResponseBody>>(`/api/integrations/${encodeURIComponent(provider)}/import`, body)
      .pipe(catchError((err) => throwError(() => err)));
  }

  getIntegrationStatus(provider: string): Observable<ApiResponse<IntegrationStatusResponseDto>> {
    return this.http
      .get<ApiResponse<IntegrationStatusResponseDto>>(`/api/integrations/${encodeURIComponent(provider)}/status`)
      .pipe(catchError((err) => throwError(() => err)));
  }

  disconnectIntegration(provider: string): Observable<ApiResponse<{ disconnected?: boolean }>> {
    return this.http
      .post<ApiResponse<{ disconnected?: boolean }>>(`/api/integrations/${encodeURIComponent(provider)}/disconnect`, {})
      .pipe(catchError((err) => throwError(() => err)));
  }

  listIntegrationFiles(
    provider: string,
    query: IntegrationFilesQuery = {}
  ): Observable<ApiResponse<IntegrationFileItemDto[]>> {
    let params = new HttpParams()
      .set('page', String(query.page ?? 1))
      .set('pageSize', String(query.pageSize ?? 24));
    if (query.q?.trim()) {
      params = params.set('q', query.q.trim());
    }
    return this.http
      .get<ApiResponse<IntegrationFileItemDto[]>>(`/api/integrations/${encodeURIComponent(provider)}/files`, { params })
      .pipe(catchError((err) => throwError(() => err)));
  }

  getIntegrationPickerToken(provider: string): Observable<ApiResponse<IntegrationPickerTokenDto>> {
    return this.http
      .get<ApiResponse<IntegrationPickerTokenDto>>(`/api/integrations/${encodeURIComponent(provider)}/picker-token`)
      .pipe(catchError((err) => throwError(() => err)));
  }
}
