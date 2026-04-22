import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import {
  ComposerMediaService,
  MediaLibraryItemDto,
  BulkOperationResultItem,
  IntegrationFileItemDto,
  IntegrationPickerTokenDto
} from '../../../scheduler/services/composer-media.service';
import { extractErrorMessage } from '../../../../shared/utils/error.utils';
import { MediaSelectionService } from '../../services/media-selection.service';
import { GooglePickerService, PickedGoogleFile } from '../../services/google-picker.service';

type SortMode = 'smart' | 'recently_used' | 'most_used' | 'recently_uploaded';
type Provider = 'google-drive' | 'onedrive' | 'canva';
type OAuthUiState = 'disconnected' | 'connecting' | 'verifying_callback' | 'connected' | 'error';
interface DriveFileUiItem {
  fileId: string;
  name: string;
  mimeType?: string;
  thumbnailUrl?: string;
  modifiedTime?: string;
  sizeBytes?: number;
}
type DriveTypeFilter = 'all' | 'image' | 'video' | 'document' | 'other';
type DriveViewMode = 'grid' | 'list';

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
  sizeBytes?: number;
}

type ImportModal =
  | null
  | { kind: 'url' }
  | { kind: 'integration'; provider: Provider };

@Component({
  selector: 'app-gestor-archivos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './gestor-archivos.component.html',
  styleUrl: './gestor-archivos.component.scss'
})
export class GestorArchivosComponent implements OnInit, OnDestroy {
  @ViewChild('importMenuAnchor') importMenuAnchor?: ElementRef<HTMLElement>;

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
  integrationFileId = '';
  integrationImportName = '';
  integrationImportTags = '';
  integrationImportError = '';
  integrationImportSuccess = '';
  importingExternal = false;
  callbackProcessed = false;
  oauthUiState: OAuthUiState = 'disconnected';
  oauthUiMessage = '';
  integrationStatusLoading = false;
  integrationConnectedAt: string | null = null;
  integrationAccountEmail: string | null = null;
  driveFiles: DriveFileUiItem[] = [];
  driveFilesLoading = false;
  driveFilesError = '';
  driveQuery = '';
  drivePage = 1;
  drivePageSize = 12;
  driveTotalPages = 1;
  selectedDriveFile: DriveFileUiItem | null = null;
  driveTypeFilter: DriveTypeFilter = 'all';
  driveViewMode: DriveViewMode = 'grid';
  pickerLoading = false;
  pickerError = '';
  showDriveFallbackList = false;

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

  /** Búsqueda al escribir (sin botón Buscar). */
  private readonly searchInput$ = new Subject<string>();
  private searchDebounceSub?: Subscription;

  importMenuOpen = false;
  importModal: ImportModal = null;
  openCardMenuId: number | null = null;
  batchArchiving = false;

  private readonly subscriptions = new Subscription();

  constructor(
    private readonly mediaApi: ComposerMediaService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly mediaSelection: MediaSelectionService,
    private readonly googlePicker: GooglePickerService
  ) {}

  ngOnInit(): void {
    this.searchDebounceSub = this.searchInput$
      .pipe(debounceTime(350), distinctUntilChanged())
      .subscribe(() => {
        this.page = 1;
        this.loadAssets();
      });

    const sub = this.route.queryParamMap.subscribe((params) => {
      this.selectionMode = params.get('mode') === 'select';
      const qpPage = Number(params.get('page') || '1');
      const qp = params.get('q');
      this.page = Number.isFinite(qpPage) && qpPage > 0 ? qpPage : 1;
      this.q = qp ?? '';
      const status = params.get('status');
      this.statusFilter = status === 'archived' ? 'archived' : 'active';
      const openImport = params.get('openImport');
      if (openImport === 'google-drive' && this.importModal?.kind !== 'integration') {
        this.openImportIntegration('google-drive', false);
        this.router.navigate([], {
          replaceUrl: true,
          queryParams: { openImport: null },
          queryParamsHandling: 'merge'
        });
      }
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
    this.searchDebounceSub?.unsubscribe();
    this.subscriptions.unsubscribe();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(ev: MouseEvent): void {
    const target = ev.target as Node;
    if (this.importMenuOpen && this.importMenuAnchor?.nativeElement?.contains(target)) {
      return;
    }
    this.importMenuOpen = false;
    if (this.openCardMenuId !== null) {
      const t = ev.target as HTMLElement;
      const inside = t?.closest?.(`[data-card-id="${this.openCardMenuId}"]`);
      if (!inside) {
        this.openCardMenuId = null;
      }
    }
  }

  onSearchInput(): void {
    this.searchInput$.next(this.q.trim());
  }

  toggleImportMenu(): void {
    this.importMenuOpen = !this.importMenuOpen;
  }

  openImportFromUrl(): void {
    this.importMenuOpen = false;
    this.resetUrlImportForm();
    this.importModal = { kind: 'url' };
  }

  openImportIntegration(provider: Provider, autoConnectIfDisconnected = true): void {
    this.importMenuOpen = false;
    this.integrationProvider = provider;
    this.integrationFileId = '';
    this.integrationImportName = '';
    this.integrationImportTags = '';
    this.integrationImportError = '';
    this.integrationImportSuccess = '';
    this.integrationStartError = '';
    this.driveFiles = [];
    this.driveFilesError = '';
    this.driveQuery = '';
    this.drivePage = 1;
    this.selectedDriveFile = null;
    this.driveTypeFilter = 'all';
    this.driveViewMode = 'grid';
    this.pickerLoading = false;
    this.pickerError = '';
    this.showDriveFallbackList = false;
    if (this.oauthUiState === 'error') {
      this.oauthUiState = 'disconnected';
      this.oauthUiMessage = '';
    }
    this.importModal = { kind: 'integration', provider };
    this.refreshIntegrationStatus(provider, false, autoConnectIfDisconnected);
  }

  closeImportModal(): void {
    this.importModal = null;
    this.integrationStartError = '';
    this.integrationImportError = '';
    this.integrationImportSuccess = '';
    this.pickerError = '';
  }

  private resetUrlImportForm(): void {
    this.urlDraft = '';
    this.urlName = '';
    this.urlTagsDraft = '';
    this.urlPreviewError = '';
    this.importUrlError = '';
    this.urlPreviewImageSrc = null;
    this.urlPreviewIsVideo = false;
  }

  toggleCardMenu(mediaId: number, ev: Event): void {
    ev.stopPropagation();
    this.openCardMenuId = this.openCardMenuId === mediaId ? null : mediaId;
  }

  closeCardMenu(): void {
    this.openCardMenuId = null;
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
      tags: Array.isArray(anyIt['tags']) ? (anyIt['tags'] as string[]) : [],
      sizeBytes: typeof anyIt['sizeBytes'] === 'number' ? anyIt['sizeBytes'] : undefined
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

  onChangeStatus(): void {
    this.page = 1;
    this.loadAssets();
  }

  onChangeSort(): void {
    this.page = 1;
    this.loadAssets();
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
    this.closeCardMenu();
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
    this.closeCardMenu();
    this.mediaSelection.setPendingSelection({
      mediaId: asset.mediaId,
      publicUrl: asset.publicUrl,
      thumbnailUrl: asset.thumbnailUrl,
      mimeType: asset.mimeType,
      name: asset.name
    });
    this.router.navigate(['/dashboard/programador']);
  }

  useSelectedInComposer(): void {
    const id = Array.from(this.selectedIds)[0];
    if (id == null) return;
    const asset = this.assets.find((a) => a.mediaId === id);
    if (!asset) return;
    this.useInComposer(asset);
  }

  exitSelectionMode(): void {
    this.router.navigate(['/dashboard/archivos'], {
      queryParams: { mode: null, q: this.q || null, page: this.page > 1 ? this.page : null, status: this.statusFilter },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  toggleSelected(mediaId: number): void {
    if (this.selectionMode) {
      if (this.selectedIds.has(mediaId)) {
        this.selectedIds.clear();
      } else {
        this.selectedIds = new Set([mediaId]);
      }
      return;
    }
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

  runBatchArchive(): void {
    if (!this.selectedIds.size) return;
    this.batchMessage = '';
    this.bulkResultItems = [];
    this.batchArchiving = true;
    const ids = Array.from(this.selectedIds);
    let ok = 0;
    let fail = 0;
    let i = 0;
    const step = (): void => {
      if (i >= ids.length) {
        this.batchArchiving = false;
        this.batchMessage = `Archivar: ${ok} correctos${fail ? `, ${fail} fallidos` : ''}.`;
        this.loadAssets();
        return;
      }
      const id = ids[i++];
      this.mediaApi.archiveMedia(id).subscribe({
        next: () => {
          ok++;
          step();
        },
        error: () => {
          fail++;
          step();
        }
      });
    };
    step();
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
          this.closeImportModal();
          this.resetUrlImportForm();
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
    this.closeImportModal();
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
    this.closeCardMenu();
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
    this.closeCardMenu();
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
    this.closeCardMenu();
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
    if (this.oauthUiState === 'connecting' || this.oauthUiState === 'verifying_callback') {
      console.log('[drive] startOAuth bloqueado por estado', this.oauthUiState);
      return;
    }
    console.log('[drive] startOAuth init', { provider: this.integrationProvider });
    this.integrationStartError = '';
    this.integrationImportSuccess = '';
    this.oauthUiState = 'connecting';
    this.oauthUiMessage = 'Conectando con Google...';
    const sub = this.mediaApi.startOAuth(this.integrationProvider).subscribe({
      next: (res) => {
        const url = res.data.authorizationUrl;
        console.log('[drive] startOAuth response', { hasAuthorizationUrl: !!url, state: res.data.state });
        if (!url) {
          this.integrationStartError = 'El backend no devolvió authorizationUrl.';
          this.oauthUiState = 'error';
          this.oauthUiMessage = 'No se pudo completar la conexión. Intenta nuevamente.';
          console.log('[drive] startOAuth error: authorizationUrl faltante');
          return;
        }
        console.log('[drive] redirecting to google auth', { url });
        window.open(url, '_self');
      },
      error: (err) => {
        this.integrationStartError = extractErrorMessage(err, 'No se pudo iniciar OAuth del proveedor.');
        this.oauthUiState = 'error';
        this.oauthUiMessage = 'No se pudo completar la conexión. Intenta nuevamente.';
        console.log('[drive] startOAuth request error', err);
      }
    });
    this.subscriptions.add(sub);
  }

  private tryProcessOAuthCallback(pathParams: ParamMap): void {
    if (this.callbackProcessed) return;
    const provider = pathParams.get('provider') ?? this.route.snapshot.queryParamMap.get('provider');
    const onCallbackRoute = this.router.url.includes('/oauth-callback/');
    console.log('[drive] callback detected', { provider, onCallbackRoute });
    if (!provider || !onCallbackRoute) return;
    this.callbackProcessed = true;
    this.oauthUiState = 'verifying_callback';
    this.oauthUiMessage = 'Validando autorizacion...';
    this.importModal = { kind: 'integration', provider: provider as Provider };
    // Backend-first: callback se resuelve en backend y frontend solo refresca status.
    this.refreshIntegrationStatus(provider as Provider, true);
  }

  importFromProvider(): void {
    const fileId = this.integrationFileId.trim();
    if (!fileId) {
      this.integrationImportError = 'Ingresa el fileId de Google Drive.';
      console.log('[drive] import blocked: fileId vacío');
      return;
    }
    console.log('[drive] import request init', {
      provider: this.integrationProvider,
      fileId,
      hasName: !!this.integrationImportName.trim(),
      tagsCount: this.integrationImportTags.split(',').map((t) => t.trim()).filter(Boolean).length
    });
    this.importingExternal = true;
    this.integrationImportError = '';
    this.integrationImportSuccess = '';
    const tags = this.integrationImportTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    const sub = this.mediaApi
      .importFromProvider(this.integrationProvider, {
        fileId,
        name: this.integrationImportName.trim() || undefined,
        tags: tags.length ? tags : undefined
      })
      .subscribe({
        next: () => {
          console.log('[drive] import request success', { provider: this.integrationProvider });
          this.importingExternal = false;
          this.oauthUiState = 'connected';
          this.oauthUiMessage = 'Google Drive conectado correctamente.';
          this.integrationImportSuccess = 'Archivo importado correctamente.';
          this.integrationFileId = '';
          this.integrationImportName = '';
          this.integrationImportTags = '';
          this.selectedDriveFile = null;
          this.loadDriveFiles(false);
          this.loadAssets();
          this.loadStorageSummary();
        },
        error: (err) => {
          console.log('[drive] import request error', err);
          this.importingExternal = false;
          this.integrationImportSuccess = '';
          this.integrationImportError = extractErrorMessage(err, 'No se pudo importar desde integración.');
          if (this.getHttpStatus(err) === 412) {
            this.oauthUiState = 'disconnected';
            this.oauthUiMessage = 'Integracion no conectada. Conecta Google Drive para continuar.';
          }
        }
      });
    this.subscriptions.add(sub);
  }

  private getHttpStatus(err: unknown): number | null {
    const anyErr = err as { status?: number } | null;
    return typeof anyErr?.status === 'number' ? anyErr.status : null;
  }

  private mapOAuthErrorMessage(err: unknown): string {
    const status = this.getHttpStatus(err);
    if (status === 401) return 'Sesion expirada. Inicia sesion nuevamente.';
    if (status === 403) return 'Sin acceso al tenant activo. Verifica permisos e intenta otra vez.';
    if (status === 400) return 'Autorizacion invalida o expirada. Reinicia la conexion.';
    if (status === 502) return 'Google no respondio correctamente. Reintenta la conexion.';
    return 'No se pudo completar la conexion. Intenta nuevamente.';
  }

  refreshIntegrationStatus(
    provider: Provider = this.integrationProvider,
    fromCallback = false,
    autoConnectIfDisconnected = false
  ): void {
    this.integrationStatusLoading = true;
    const sub = this.mediaApi.getIntegrationStatus(provider).subscribe({
      next: (res) => {
        const data = res.data;
        this.integrationStatusLoading = false;
        this.integrationConnectedAt = data.connectedAt ?? null;
        this.integrationAccountEmail = data.accountEmail ?? null;
        this.oauthUiState = data.connected ? 'connected' : 'disconnected';
        this.oauthUiMessage = data.connected
          ? 'Google Drive conectado correctamente.'
          : 'Aun no hay conexion activa con Google Drive.';
        if (!data.connected && autoConnectIfDisconnected && provider === 'google-drive') {
          this.startOAuth();
        }
        if (data.connected && provider === 'google-drive') {
          this.loadDriveFiles(true);
          this.openGooglePickerAuto();
        } else {
          this.driveFiles = [];
          this.selectedDriveFile = null;
          this.integrationFileId = '';
        }
        if (fromCallback) {
          this.batchMessage = data.connected
            ? `Conexión con ${provider} completada.`
            : `No se confirmó conexión activa con ${provider}.`;
          this.router.navigate(['/dashboard/archivos'], {
            replaceUrl: true,
            queryParams: {
              mode: this.selectionMode ? 'select' : null,
              status: this.statusFilter,
              openImport: provider === 'google-drive' && data.connected ? 'google-drive' : null,
              code: null,
              state: null,
              iss: null,
              scope: null
            },
            queryParamsHandling: 'merge'
          });
        }
      },
      error: (err) => {
        this.integrationStatusLoading = false;
        this.oauthUiState = 'error';
        this.oauthUiMessage = this.mapOAuthErrorMessage(err);
        if (fromCallback) {
          this.batchMessage = extractErrorMessage(err, `No se pudo confirmar estado de ${provider}.`);
          this.callbackProcessed = false;
        }
      }
    });
    this.subscriptions.add(sub);
  }

  disconnectDrive(): void {
    const sub = this.mediaApi.disconnectIntegration(this.integrationProvider).subscribe({
      next: () => {
        this.integrationFileId = '';
        this.integrationImportName = '';
        this.integrationImportTags = '';
        this.integrationImportError = '';
        this.integrationImportSuccess = '';
        this.oauthUiState = 'disconnected';
        this.oauthUiMessage = 'Integracion desconectada.';
        this.integrationConnectedAt = null;
        this.integrationAccountEmail = null;
        this.driveFiles = [];
        this.selectedDriveFile = null;
        this.integrationFileId = '';
      },
      error: (err) => {
        this.integrationImportError = extractErrorMessage(err, 'No se pudo desconectar la integracion.');
      }
    });
    this.subscriptions.add(sub);
  }

  loadDriveFiles(resetPage = false): void {
    if (this.integrationProvider !== 'google-drive') return;
    if (this.oauthUiState !== 'connected') return;
    if (resetPage) {
      this.drivePage = 1;
    }
    this.driveFilesLoading = true;
    this.driveFilesError = '';
    const sub = this.mediaApi
      .listIntegrationFiles('google-drive', {
        q: this.driveQuery,
        page: this.drivePage,
        pageSize: this.drivePageSize
      })
      .subscribe({
        next: (res) => {
          const list = Array.isArray(res.data) ? res.data : [];
          this.driveFiles = list.map((x) => this.mapDriveFile(x));
          this.driveTotalPages = Math.max(1, Number(res.meta?.totalPages ?? 1));
          this.driveFilesLoading = false;
          this.showDriveFallbackList = true;
        },
        error: (err) => {
          this.driveFilesLoading = false;
          if (this.getHttpStatus(err) === 412) {
            this.oauthUiState = 'disconnected';
            this.oauthUiMessage = 'Integracion no conectada. Vuelve a conectar Google Drive.';
          }
          this.driveFilesError = extractErrorMessage(err, 'No se pudo cargar el listado de Google Drive.');
        }
      });
    this.subscriptions.add(sub);
  }

  searchDriveFiles(): void {
    this.loadDriveFiles(true);
  }

  prevDrivePage(): void {
    if (this.drivePage <= 1) return;
    this.drivePage--;
    this.loadDriveFiles(false);
  }

  nextDrivePage(): void {
    if (this.drivePage >= this.driveTotalPages) return;
    this.drivePage++;
    this.loadDriveFiles(false);
  }

  selectDriveFile(file: DriveFileUiItem): void {
    this.selectedDriveFile = file;
    this.integrationFileId = file.fileId;
    this.integrationImportError = '';
    this.integrationImportSuccess = '';
    if (!this.integrationImportName.trim()) {
      this.integrationImportName = file.name;
    }
  }

  onDriveFileDoubleClick(file: DriveFileUiItem): void {
    this.selectDriveFile(file);
    this.importFromProvider();
  }

  openGooglePickerAuto(): void {
    if (this.integrationProvider !== 'google-drive') return;
    if (this.oauthUiState !== 'connected') return;
    if (this.pickerLoading) return;
    this.openGooglePicker(false);
  }

  openGooglePicker(forceFallbackOnError = true): void {
    this.pickerLoading = true;
    this.pickerError = '';
    const sub = this.mediaApi.getIntegrationPickerToken('google-drive').subscribe({
      next: (res) => {
        const token = res.data;
        this.resolvePickerApiKey(token)
          .then((apiKey) =>
            this.googlePicker.openPicker({
              apiKey,
              oauthToken: token.oauthToken,
              appId: token.appId || undefined
            })
          )
          .then((picked) => {
            this.pickerLoading = false;
            if (!picked) return;
            this.applyPickedFileAndImport(picked);
          })
          .catch((err: unknown) => {
            this.pickerLoading = false;
            this.pickerError = extractErrorMessage(err as any, 'No se pudo abrir Google Picker.');
            if (forceFallbackOnError) {
              this.showDriveFallbackList = true;
            }
          });
      },
      error: (err) => {
        this.pickerLoading = false;
        this.pickerError = extractErrorMessage(err, 'No se pudo obtener token para Google Picker.');
        if (forceFallbackOnError) {
          this.showDriveFallbackList = true;
        }
      }
    });
    this.subscriptions.add(sub);
  }

  private resolvePickerApiKey(token: IntegrationPickerTokenDto): Promise<string> {
    if (token.apiKey?.trim()) return Promise.resolve(token.apiKey.trim());
    const fromWindow = (window as unknown as { __GOOGLE_PICKER_API_KEY__?: string }).__GOOGLE_PICKER_API_KEY__;
    if (typeof fromWindow === 'string' && fromWindow.trim()) return Promise.resolve(fromWindow.trim());
    return Promise.reject(new Error('No hay apiKey para Google Picker.'));
  }

  private applyPickedFileAndImport(file: PickedGoogleFile): void {
    if (!file.fileId) return;
    this.integrationFileId = file.fileId;
    if (!this.integrationImportName.trim()) {
      this.integrationImportName = file.name?.trim() || 'Archivo de Google Drive';
    }
    this.importFromProvider();
  }

  setDriveTypeFilter(filter: DriveTypeFilter): void {
    this.driveTypeFilter = filter;
  }

  setDriveViewMode(mode: DriveViewMode): void {
    this.driveViewMode = mode;
  }

  get visibleDriveFiles(): DriveFileUiItem[] {
    return this.driveFiles.filter((f) => this.matchesDriveTypeFilter(f));
  }

  private matchesDriveTypeFilter(file: DriveFileUiItem): boolean {
    if (this.driveTypeFilter === 'all') return true;
    const mime = (file.mimeType || '').toLowerCase();
    if (this.driveTypeFilter === 'image') return mime.startsWith('image/');
    if (this.driveTypeFilter === 'video') return mime.startsWith('video/');
    if (this.driveTypeFilter === 'document') {
      return (
        mime.includes('pdf') ||
        mime.includes('document') ||
        mime.includes('sheet') ||
        mime.includes('presentation') ||
        mime.includes('text/')
      );
    }
    return !mime.startsWith('image/') && !mime.startsWith('video/');
  }

  private mapDriveFile(it: IntegrationFileItemDto): DriveFileUiItem {
    const anyIt = it as unknown as Record<string, unknown>;
    const fileId =
      (typeof anyIt['fileId'] === 'string' ? anyIt['fileId'] : undefined) ??
      (typeof anyIt['id'] === 'string' ? anyIt['id'] : '');
    return {
      fileId,
      name: typeof anyIt['name'] === 'string' ? anyIt['name'] : 'Sin nombre',
      mimeType: typeof anyIt['mimeType'] === 'string' ? anyIt['mimeType'] : undefined,
      thumbnailUrl: typeof anyIt['thumbnailUrl'] === 'string' ? anyIt['thumbnailUrl'] : undefined,
      modifiedTime: typeof anyIt['modifiedTime'] === 'string' ? anyIt['modifiedTime'] : undefined,
      sizeBytes: typeof anyIt['sizeBytes'] === 'number' ? anyIt['sizeBytes'] : undefined
    };
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

  formatMimeShort(mime: string): string {
    if (!mime || mime === 'application/octet-stream') return 'Archivo';
    const [type, sub] = mime.split('/');
    if (!sub) return mime;
    if (type === 'image' || type === 'video') return sub.toUpperCase();
    return sub;
  }

  formatAssetSize(asset: MediaAsset): string {
    if (asset.sizeBytes == null) return '';
    return this.formatBytes(asset.sizeBytes);
  }

  integrationTitle(provider: Provider): string {
    switch (provider) {
      case 'google-drive':
        return 'Google Drive';
      case 'onedrive':
        return 'OneDrive';
      case 'canva':
        return 'Canva';
      default:
        return provider;
    }
  }
}
