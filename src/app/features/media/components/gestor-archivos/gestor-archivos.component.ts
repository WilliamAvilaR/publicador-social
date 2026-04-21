import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import {
  ComposerMediaService,
  MediaLibraryItemDto,
  BulkOperationResultItem
} from '../../../scheduler/services/composer-media.service';
import { extractErrorMessage } from '../../../../shared/utils/error.utils';
import { MediaSelectionService } from '../../services/media-selection.service';

type SortMode = 'smart' | 'recently_used' | 'most_used' | 'recently_uploaded';
type Provider = 'google-drive' | 'onedrive' | 'canva';

interface MediaAsset {
  mediaId: number;
  name: string;
  mimeType: string;
  thumbnailUrl?: string;
  publicUrl?: string;
  createdAt?: string;
  lastUsedAt?: string;
  usageCount?: number;
  source?: string;
  status?: 'active' | 'archived';
  isInUse?: boolean;
  tags?: string[];
}

@Component({
  selector: 'app-gestor-archivos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './gestor-archivos.component.html',
  styleUrl: './gestor-archivos.component.scss'
})
export class GestorArchivosComponent implements OnInit, OnDestroy {
  q = '';
  sortMode: SortMode = 'smart';
  page = 1;
  pageSize = 24;
  totalPages = 1;
  totalCount = 0;

  assets: MediaAsset[] = [];
  loading = false;
  errorMessage = '';

  // Modo selección (viene del compositor)
  selectionMode = false;

  // Upload
  uploading = false;
  uploadError = '';
  statusFilter: 'active' | 'archived' = 'active';

  // URL import / preview
  urlDraft = '';
  urlName = '';
  urlTagsDraft = '';
  urlPreviewLoading = false;
  urlPreviewError = '';
  urlPreviewImageSrc: string | null = null;
  urlPreviewIsVideo = false;
  importingUrl = false;
  importUrlError = '';

  // Detalle
  detailLoading = false;
  detailError = '';
  detailAsset: MediaAsset | null = null;
  showDetail = false;

  // Batch UI
  selectedIds = new Set<number>();
  batchMessage = '';
  bulkResultItems: BulkOperationResultItem[] = [];

  // Quota
  storageLoading = false;
  usedBytes = 0;
  limitBytes: number | null = null;
  isUnlimited = false;

  // Integrations
  integrationProvider: Provider = 'google-drive';
  integrationStartError = '';
  integrationImportUrl = '';
  integrationImportName = '';
  integrationImportTags = '';
  integrationImportError = '';
  importingExternal = false;
  callbackProcessed = false;

  // Inline editors
  showEditModal = false;
  editingAsset: MediaAsset | null = null;
  editNameDraft = '';
  editTagsDraft = '';
  editSaving = false;
  editError = '';

  showBatchTagModal = false;
  batchTagsDraft = '';
  batchTagSaving = false;
  batchTagError = '';

  private readonly subscriptions = new Subscription();

  constructor(
    private readonly mediaApi: ComposerMediaService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly mediaSelection: MediaSelectionService
  ) {}

  ngOnInit(): void {
    const sub = this.route.queryParamMap.subscribe((params) => {
      this.selectionMode = params.get('mode') === 'select';
      const qpPage = Number(params.get('page') || '1');
      const qp = params.get('q');
      this.page = Number.isFinite(qpPage) && qpPage > 0 ? qpPage : 1;
      this.q = qp ?? '';
      const status = params.get('status');
      this.statusFilter = status === 'archived' ? 'archived' : 'active';
      this.loadAssets();
      this.loadStorageSummary();
    });
    this.subscriptions.add(sub);

    const paramsSub = this.route.paramMap.subscribe((pathParams) => {
      this.tryProcessOAuthCallback(pathParams);
    });
    this.subscriptions.add(paramsSub);
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  loadAssets(): void {
    this.loading = true;
    this.errorMessage = '';
    const sub = this.mediaApi
      .listMedia({
        page: this.page,
        pageSize: this.pageSize,
        q: this.q,
        status: this.statusFilter,
        sort: this.sortMode === 'smart' ? undefined : this.sortMode
      })
      .subscribe({
      next: (res) => {
        const list = Array.isArray(res.data) ? res.data : [];
        this.assets = this.applySort(list.map((it) => this.normalizeAsset(it)));
        this.totalCount = res.meta?.totalCount ?? this.assets.length;
        this.totalPages = Math.max(1, res.meta?.totalPages ?? 1);
        this.loading = false;
        this.selectedIds.clear();
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = extractErrorMessage(err, 'No se pudo cargar el gestor de archivos.');
      }
    });
    this.subscriptions.add(sub);
  }

  private normalizeAsset(it: MediaLibraryItemDto): MediaAsset {
    const anyIt = it as unknown as Record<string, unknown>;
    const mediaId =
      (typeof anyIt['mediaId'] === 'number' ? anyIt['mediaId'] : undefined) ??
      (typeof anyIt['id'] === 'number' ? anyIt['id'] : 0);
    return {
      mediaId,
      name: String(anyIt['name'] ?? `Media #${mediaId}`),
      mimeType: String(anyIt['mimeType'] ?? 'application/octet-stream'),
      thumbnailUrl: typeof anyIt['thumbnailUrl'] === 'string' ? anyIt['thumbnailUrl'] : undefined,
      publicUrl: typeof anyIt['publicUrl'] === 'string' ? anyIt['publicUrl'] : undefined,
      createdAt: typeof anyIt['createdAt'] === 'string' ? anyIt['createdAt'] : undefined,
      lastUsedAt: typeof anyIt['lastUsedAt'] === 'string' ? anyIt['lastUsedAt'] : undefined,
      usageCount: typeof anyIt['usageCount'] === 'number' ? anyIt['usageCount'] : undefined,
      source: typeof anyIt['source'] === 'string' ? anyIt['source'] : undefined,
      status: (anyIt['status'] as MediaAsset['status']) ?? 'active',
      isInUse: typeof anyIt['isInUse'] === 'boolean' ? anyIt['isInUse'] : false,
      tags: Array.isArray(anyIt['tags']) ? (anyIt['tags'] as string[]) : []
    };
  }

  private applySort(items: MediaAsset[]): MediaAsset[] {
    const time = (v?: string): number => (v ? new Date(v).getTime() || 0 : 0);
    const usage = (v?: number): number => (typeof v === 'number' ? v : 0);

    return [...items].sort((a, b) => {
      if (this.sortMode === 'recently_used') {
        return time(b.lastUsedAt) - time(a.lastUsedAt);
      }
      if (this.sortMode === 'most_used') {
        return usage(b.usageCount) - usage(a.usageCount);
      }
      if (this.sortMode === 'recently_uploaded') {
        return time(b.createdAt) - time(a.createdAt);
      }
      // Smart: lastUsedAt -> usageCount -> createdAt
      const lastUsed = time(b.lastUsedAt) - time(a.lastUsedAt);
      if (lastUsed !== 0) return lastUsed;
      const byUse = usage(b.usageCount) - usage(a.usageCount);
      if (byUse !== 0) return byUse;
      return time(b.createdAt) - time(a.createdAt);
    });
  }

  onSearch(): void {
    this.page = 1;
    this.loadAssets();
  }

  onChangeStatus(): void {
    this.page = 1;
    this.loadAssets();
  }

  onChangeSort(): void {
    this.assets = this.applySort(this.assets);
  }

  prevPage(): void {
    if (this.page <= 1) return;
    this.page--;
    this.loadAssets();
  }

  nextPage(): void {
    if (this.page >= this.totalPages) return;
    this.page++;
    this.loadAssets();
  }

  onUploadInput(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.uploadFile(file);
    input.value = '';
  }

  private uploadFile(file: File): void {
    this.uploading = true;
    this.uploadError = '';
    const sub = this.mediaApi.uploadMedia(file).subscribe({
      next: () => {
        this.uploading = false;
        this.loadAssets();
        this.loadStorageSummary();
      },
      error: (err) => {
        this.uploading = false;
        this.uploadError = extractErrorMessage(err, 'No se pudo subir el archivo.');
      }
    });
    this.subscriptions.add(sub);
  }

  openDetail(asset: MediaAsset): void {
    this.showDetail = true;
    this.detailError = '';
    this.detailLoading = true;
    const sub = this.mediaApi.getMedia(asset.mediaId).subscribe({
      next: (res) => {
        this.detailLoading = false;
        this.detailAsset = this.normalizeAsset(res.data);
      },
      error: (err) => {
        this.detailLoading = false;
        this.detailError = extractErrorMessage(err, 'No se pudo cargar el detalle.');
      }
    });
    this.subscriptions.add(sub);
  }

  closeDetail(): void {
    this.showDetail = false;
    this.detailAsset = null;
  }

  useInComposer(asset: MediaAsset): void {
    this.mediaSelection.setPendingSelection({
      mediaId: asset.mediaId,
      publicUrl: asset.publicUrl,
      thumbnailUrl: asset.thumbnailUrl,
      mimeType: asset.mimeType,
      name: asset.name
    });
    this.router.navigate(['/dashboard/programador']);
  }

  toggleSelected(mediaId: number): void {
    if (this.selectedIds.has(mediaId)) {
      this.selectedIds.delete(mediaId);
    } else {
      this.selectedIds.add(mediaId);
    }
  }

  toggleSelectAllCurrentPage(): void {
    if (this.selectedIds.size === this.assets.length) {
      this.selectedIds.clear();
      return;
    }
    this.selectedIds = new Set(this.assets.map((a) => a.mediaId));
  }

  runBatchDelete(): void {
    if (!this.selectedIds.size) return;
    this.batchMessage = '';
    this.bulkResultItems = [];
    const sub = this.mediaApi.bulkDelete({ mediaIds: Array.from(this.selectedIds) }).subscribe({
      next: (res) => {
        const data = res.data;
        this.bulkResultItems = data.results || [];
        this.batchMessage = `Batch delete: ${data.processed} procesados, ${data.failed} fallidos.`;
        this.loadAssets();
        this.loadStorageSummary();
      },
      error: (err) => {
        this.batchMessage = extractErrorMessage(err, 'No se pudo ejecutar la eliminación por lote.');
      }
    });
    this.subscriptions.add(sub);
  }

  runBatchTag(): void {
    if (!this.selectedIds.size) return;
    this.batchMessage = '';
    this.bulkResultItems = [];
    this.batchTagsDraft = '';
    this.batchTagError = '';
    this.showBatchTagModal = true;
  }

  closeBatchTagModal(): void {
    this.showBatchTagModal = false;
    this.batchTagError = '';
    this.batchTagsDraft = '';
  }

  applyBatchTag(): void {
    const tagList = this.batchTagsDraft
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    if (!tagList.length) {
      this.batchTagError = 'Ingresa al menos una tag.';
      return;
    }
    this.batchTagSaving = true;
    const sub = this.mediaApi.bulkTag({ mediaIds: Array.from(this.selectedIds), tags: tagList }).subscribe({
      next: (res) => {
        this.batchTagSaving = false;
        const data = res.data;
        this.bulkResultItems = data.results || [];
        this.batchMessage = `Batch tag: ${data.processed} procesados, ${data.failed} fallidos.`;
        this.closeBatchTagModal();
        this.loadAssets();
      },
      error: (err) => {
        this.batchTagSaving = false;
        this.batchTagError = extractErrorMessage(err, 'No se pudo ejecutar el etiquetado por lote.');
      }
    });
    this.subscriptions.add(sub);
  }

  previewUrl(): void {
    this.urlPreviewError = '';
    this.urlPreviewImageSrc = null;
    this.urlPreviewIsVideo = false;
    const url = this.urlDraft.trim();
    if (!url) {
      this.urlPreviewError = 'Pega una URL.';
      return;
    }
    this.urlPreviewLoading = true;
    const sub = this.mediaApi.previewUrl({ url }).subscribe({
      next: (res) => {
        this.urlPreviewLoading = false;
        const data = res.data;
        this.urlPreviewIsVideo = data.type === 'video';
        this.urlPreviewImageSrc = data.thumbnailUrl || data.canonicalUrl || url;
      },
      error: () => {
        this.urlPreviewLoading = false;
        this.urlPreviewError = 'No se pudo validar por servidor; se muestra preview de navegador.';
        this.urlPreviewImageSrc = url;
      }
    });
    this.subscriptions.add(sub);
  }

  importUrlToLibrary(): void {
    const url = this.urlDraft.trim();
    if (!url) {
      this.importUrlError = 'Pega una URL válida.';
      return;
    }
    const tags = this.urlTagsDraft
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    this.importingUrl = true;
    this.importUrlError = '';
    const sub = this.mediaApi
      .importUrl({
        url,
        name: this.urlName.trim() || undefined,
        tags: tags.length ? tags : undefined
      })
      .subscribe({
        next: () => {
          this.importingUrl = false;
          this.urlDraft = '';
          this.urlName = '';
          this.urlTagsDraft = '';
          this.urlPreviewImageSrc = null;
          this.urlPreviewError = '';
          this.loadAssets();
          this.loadStorageSummary();
        },
        error: (err) => {
          this.importingUrl = false;
          this.importUrlError = extractErrorMessage(err, 'No se pudo importar la URL a la biblioteca.');
        }
      });
    this.subscriptions.add(sub);
  }

  useUrlInComposer(): void {
    const url = this.urlDraft.trim();
    if (!url) {
      this.urlPreviewError = 'Pega una URL antes de continuar.';
      return;
    }
    this.mediaSelection.setPendingSelection({
      mediaId: null,
      publicUrl: url,
      thumbnailUrl: this.urlPreviewImageSrc || undefined,
      mimeType: this.urlPreviewIsVideo ? 'video/*' : 'image/*',
      name: 'Importado por URL'
    });
    this.router.navigate(['/dashboard/programador']);
  }

  archiveAsset(asset: MediaAsset): void {
    const sub = this.mediaApi.archiveMedia(asset.mediaId).subscribe({
      next: () => {
        this.loadAssets();
      },
      error: (err) => {
        this.batchMessage = extractErrorMessage(err, 'No se pudo archivar el activo.');
      }
    });
    this.subscriptions.add(sub);
  }

  deleteAsset(asset: MediaAsset): void {
    if (!confirm(`Eliminar "${asset.name}"?`)) return;
    const sub = this.mediaApi.deleteMedia(asset.mediaId).subscribe({
      next: () => {
        this.loadAssets();
        this.loadStorageSummary();
      },
      error: (err) => {
        this.batchMessage = extractErrorMessage(err, 'No se pudo eliminar el activo.');
      }
    });
    this.subscriptions.add(sub);
  }

  editAsset(asset: MediaAsset): void {
    this.editingAsset = asset;
    this.editNameDraft = asset.name;
    this.editTagsDraft = (asset.tags || []).join(', ');
    this.editError = '';
    this.showEditModal = true;
  }

  closeEditModal(): void {
    this.showEditModal = false;
    this.editingAsset = null;
    this.editError = '';
  }

  saveEditAsset(): void {
    if (!this.editingAsset) return;
    const name = this.editNameDraft.trim();
    if (!name) {
      this.editError = 'El nombre es obligatorio.';
      return;
    }
    const tags = this.editTagsDraft
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    this.editSaving = true;
    const sub = this.mediaApi.updateMedia(this.editingAsset.mediaId, { name, tags }).subscribe({
      next: () => {
        this.editSaving = false;
        this.closeEditModal();
        this.loadAssets();
      },
      error: (err) => {
        this.editSaving = false;
        this.editError = extractErrorMessage(err, 'No se pudo actualizar el activo.');
      }
    });
    this.subscriptions.add(sub);
  }

  loadStorageSummary(): void {
    this.storageLoading = true;
    const sub = this.mediaApi.getStorageSummary().subscribe({
      next: (res) => {
        const d = res.data;
        this.usedBytes = d.usedBytes ?? 0;
        this.limitBytes = d.limitBytes ?? null;
        this.isUnlimited = !!d.isUnlimited;
        this.storageLoading = false;
      },
      error: () => {
        this.storageLoading = false;
      }
    });
    this.subscriptions.add(sub);
  }

  startOAuth(): void {
    this.integrationStartError = '';
    const sub = this.mediaApi.startOAuth(this.integrationProvider).subscribe({
      next: (res) => {
        const url = res.data.authorizationUrl;
        if (!url) {
          this.integrationStartError = 'El backend no devolvió authorizationUrl.';
          return;
        }
        window.open(url, '_self');
      },
      error: (err) => {
        this.integrationStartError = extractErrorMessage(err, 'No se pudo iniciar OAuth del proveedor.');
      }
    });
    this.subscriptions.add(sub);
  }

  private tryProcessOAuthCallback(pathParams: ParamMap): void {
    if (this.callbackProcessed) return;
    const code = this.route.snapshot.queryParamMap.get('code');
    const state = this.route.snapshot.queryParamMap.get('state');
    const provider = pathParams.get('provider') ?? this.route.snapshot.queryParamMap.get('provider');
    if (!code || !state || !provider) return;
    this.callbackProcessed = true;
    const sub = this.mediaApi.oauthCallback(provider, code, state).subscribe({
      next: () => {
        this.batchMessage = `Conexión con ${provider} completada.`;
        this.router.navigate(['/dashboard/archivos'], {
          replaceUrl: true,
          queryParams: {
            mode: this.selectionMode ? 'select' : null,
            status: this.statusFilter
          },
          queryParamsHandling: 'merge'
        });
      },
      error: (err) => {
        this.batchMessage = extractErrorMessage(err, `No se pudo completar callback OAuth de ${provider}.`);
      }
    });
    this.subscriptions.add(sub);
  }

  importFromProvider(): void {
    const downloadUrl = this.integrationImportUrl.trim();
    if (!downloadUrl) {
      this.integrationImportError = 'Ingresa una URL de descarga.';
      return;
    }
    this.importingExternal = true;
    this.integrationImportError = '';
    const tags = this.integrationImportTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    const sub = this.mediaApi
      .importFromProvider(this.integrationProvider, {
        downloadUrl,
        name: this.integrationImportName.trim() || undefined,
        tags: tags.length ? tags : undefined
      })
      .subscribe({
        next: () => {
          this.importingExternal = false;
          this.integrationImportUrl = '';
          this.integrationImportName = '';
          this.integrationImportTags = '';
          this.loadAssets();
          this.loadStorageSummary();
        },
        error: (err) => {
          this.importingExternal = false;
          this.integrationImportError = extractErrorMessage(err, 'No se pudo importar desde integración.');
        }
      });
    this.subscriptions.add(sub);
  }

  usedPercent(): number {
    if (this.isUnlimited || !this.limitBytes || this.limitBytes <= 0) return 0;
    return Math.min(100, Math.round((this.usedBytes / this.limitBytes) * 100));
  }

  formatBytes(v: number | null): string {
    if (v == null) return 'Ilimitado';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let n = v;
    let i = 0;
    while (n >= 1024 && i < units.length - 1) {
      n /= 1024;
      i++;
    }
    return `${n.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
  }

  isImage(asset: MediaAsset): boolean {
    return asset.mimeType.startsWith('image/');
  }

  isVideo(asset: MediaAsset): boolean {
    return asset.mimeType.startsWith('video/');
  }
}
