import {
  Component,
  OnInit,
  OnDestroy,
  Input,
  Output,
  EventEmitter,
  ViewChild,
  ElementRef,
  HostListener
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators
} from '@angular/forms';
import { Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { PostPlanService } from '../../services/post-plan.service';
import { CreatePostPlanRequest } from '../../models/post-plan.model';
import { FacebookOAuthService } from '../../../../core/services/facebook-oauth.service';
import { TenantEntitlementsResponse } from '../../../../core/models/tenant.model';
import { TenantEntitlementsService } from '../../../../core/services/tenant-entitlements.service';
import { canUseLimit, getLimitValue, isFeatureEnabled } from '../../../../core/utils/entitlements.utils';
import { FacebookPage } from '../../../facebook/models/facebook.model';
import { markFormGroupTouched, isFieldInvalid } from '../../../../shared/utils/form.utils';
import { extractErrorMessage } from '../../../../shared/utils/error.utils';
import { getFieldError } from '../../../../shared/utils/validation.utils';
import {
  PostComposerMediaPanelComponent,
  MediaAppliedPayload,
  MediaPanelTab
} from './media/post-composer-media-panel.component';
import { MediaSelectionService } from '../../../media/services/media-selection.service';

const DRAFT_STORAGE_KEY = 'publicador.postComposer.draft.v1';

function atLeastOnePageSelected(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const ids = control.value as string[] | null | undefined;
    return ids && ids.length > 0 ? null : { requiredPages: true };
  };
}

export type PreviewNetworkId = 'facebook' | 'instagram' | 'linkedin';

interface ComposerDraftPayload {
  scheduledAt: string;
  timezone: string;
  message: string;
  linkUrl: string;
  imageUrl: string;
  mediaId?: number | null;
  pageIds: string[];
  dedupeKey: string;
  publishMode: 'now' | 'schedule';
  savedAt: string;
}

@Component({
  selector: 'app-post-composer',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, PostComposerMediaPanelComponent],
  templateUrl: './post-composer.component.html',
  styleUrl: './post-composer.component.scss'
})
export class PostComposerComponent implements OnInit, OnDestroy {
  @Input() initialDate?: string;
  @Output() success = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  @ViewChild('messageTextarea') messageTextarea?: ElementRef<HTMLTextAreaElement>;

  postPlanForm!: FormGroup;
  pages: FacebookPage[] = [];
  loadingPages = true;
  isLoading = false;
  errorMessage = '';
  entitlements: TenantEntitlementsResponse['data'] | null = null;
  canCreatePostPlan = true;
  limitGateErrorMessage: string | null = null;
  private subscriptions = new Subscription();

  /** Vista previa: red activa en pestañas */
  previewNetwork: PreviewNetworkId = 'facebook';

  /** Móvil: pestaña del stepper */
  mobileTab: 'accounts' | 'editor' | 'preview' = 'editor';

  /** Modo de publicación (editor); el footer puede forzar con onSubmit */
  publishMode: 'now' | 'schedule' = 'schedule';

  draftSavedHint = false;
  showEmojiPanel = false;

  showMediaPanel = false;
  mediaPanelInitialTab: MediaPanelTab = 'device';
  mediaPanelPendingFile: File | null = null;
  private hasPendingSelection = false;

  readonly charLimitFacebook = 5000;
  readonly placeholderNetworks: { id: PreviewNetworkId; label: string; available: boolean }[] = [
    { id: 'facebook', label: 'Facebook', available: true },
    { id: 'instagram', label: 'Instagram', available: false },
    { id: 'linkedin', label: 'LinkedIn', available: false }
  ];

  readonly quickEmojis = [
    '😀', '😂', '❤️', '👍', '🔥', '✨', '🎉', '💡', '🙌', '👏',
    '😊', '🤔', '😮', '🙏', '💪', '📌', '✅', '⭐', '💬', '📸'
  ];

  timezones = [
    { value: 'America/Bogota', label: 'Bogotá (GMT-5)' },
    { value: 'America/Mexico_City', label: 'Ciudad de México (GMT-6)' },
    { value: 'America/Argentina/Buenos_Aires', label: 'Buenos Aires (GMT-3)' },
    { value: 'America/Santiago', label: 'Santiago (GMT-3)' },
    { value: 'America/Lima', label: 'Lima (GMT-5)' },
    { value: 'America/Caracas', label: 'Caracas (GMT-4)' },
    { value: 'America/New_York', label: 'Nueva York (GMT-5)' },
    { value: 'America/Los_Angeles', label: 'Los Ángeles (GMT-8)' },
    { value: 'Europe/Madrid', label: 'Madrid (GMT+1)' },
    { value: 'UTC', label: 'UTC (GMT+0)' }
  ];

  constructor(
    private fb: FormBuilder,
    private postPlanService: PostPlanService,
    private facebookService: FacebookOAuthService,
    private tenantEntitlements: TenantEntitlementsService,
    private mediaSelection: MediaSelectionService
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.consumePendingMediaSelection();
    // Si el usuario abrió desde una fecha del calendario, no pisar con borrador local.
    if (!this.initialDate && !this.hasPendingSelection) {
      this.tryRestoreDraft();
    }
    this.loadPages();
    this.refreshEntitlements();
    this.setupAutosave();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(ev: MouseEvent): void {
    if (!this.showEmojiPanel) return;
    const t = ev.target as HTMLElement;
    if (t.closest('.emoji-panel-wrap')) return;
    this.showEmojiPanel = false;
  }

  initForm(): void {
    let initialDateTime = '';
    if (this.initialDate) {
      const date = new Date(this.initialDate);
      initialDateTime = this.toDatetimeLocalValue(date);
    } else {
      const now = new Date();
      now.setHours(now.getHours() + 1);
      initialDateTime = this.toDatetimeLocalValue(now);
    }

    this.postPlanForm = this.fb.group({
      scheduledAt: [initialDateTime, [Validators.required]],
      timezone: ['America/Bogota', [Validators.required]],
      message: ['', [Validators.required, Validators.minLength(1), Validators.maxLength(this.charLimitFacebook)]],
      linkUrl: [''],
      imageUrl: [''],
      mediaId: [null as number | null],
      pageIds: [[], [atLeastOnePageSelected()]],
      dedupeKey: ['']
    });
  }

  private toDatetimeLocalValue(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  private setupAutosave(): void {
    const sub = this.postPlanForm.valueChanges
      .pipe(debounceTime(900), distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)))
      .subscribe(() => this.persistDraft());
    this.subscriptions.add(sub);
  }

  private tryRestoreDraft(): void {
    try {
      const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (!raw) return;
      const d = JSON.parse(raw) as ComposerDraftPayload;
      if (!d || typeof d.message !== 'string') return;
      this.postPlanForm.patchValue({
        scheduledAt: d.scheduledAt || this.postPlanForm.get('scheduledAt')?.value,
        timezone: d.timezone || 'America/Bogota',
        message: d.message,
        linkUrl: d.linkUrl || '',
        imageUrl: d.imageUrl || '',
        mediaId: d.mediaId != null ? d.mediaId : null,
        pageIds: Array.isArray(d.pageIds) ? d.pageIds : [],
        dedupeKey: d.dedupeKey || ''
      });
      if (d.publishMode === 'now' || d.publishMode === 'schedule') {
        this.publishMode = d.publishMode;
      }
    } catch {
      /* ignore */
    }
  }

  private consumePendingMediaSelection(): void {
    const pending = this.mediaSelection.consumePendingSelection();
    if (!pending) return;
    this.hasPendingSelection = true;
    this.postPlanForm.patchValue({
      mediaId: pending.mediaId,
      imageUrl: pending.publicUrl ?? ''
    });
  }

  persistDraft(): void {
    if (!this.postPlanForm) return;
    const v = this.postPlanForm.value;
    const payload: ComposerDraftPayload = {
      scheduledAt: v.scheduledAt,
      timezone: v.timezone,
      message: v.message || '',
      linkUrl: v.linkUrl || '',
      imageUrl: v.imageUrl || '',
      mediaId: v.mediaId != null ? v.mediaId : null,
      pageIds: v.pageIds || [],
      dedupeKey: v.dedupeKey || '',
      publishMode: this.publishMode,
      savedAt: new Date().toISOString()
    };
    try {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      /* quota */
    }
  }

  clearDraftStorage(): void {
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch {
      /* */
    }
  }

  onSaveDraftClick(): void {
    this.persistDraft();
    this.draftSavedHint = true;
    setTimeout(() => (this.draftSavedHint = false), 2500);
  }

  loadPages(): void {
    this.loadingPages = true;
    const pagesSubscription = this.facebookService.getConnectedPages().subscribe({
      next: (pages) => {
        this.pages = pages.filter((page) => page.isActive && page.canPublish);
        this.loadingPages = false;
        this.updatePostPlanGate();
      },
      error: () => {
        this.loadingPages = false;
        this.errorMessage = 'Error al cargar las páginas de Facebook. Por favor, intenta nuevamente.';
      }
    });
    this.subscriptions.add(pagesSubscription);
  }

  private refreshEntitlements(): void {
    const sub = this.tenantEntitlements.refreshCurrentEntitlements().subscribe((data) => {
      this.entitlements = data;
      this.updatePostPlanGate();
    });
    this.subscriptions.add(sub);
  }

  private computeSelectedDelta(): number {
    const pageIds: string[] = this.postPlanForm.get('pageIds')?.value || [];
    return pageIds.length;
  }

  private updatePostPlanGate(): void {
    if (!this.entitlements) {
      this.canCreatePostPlan = true;
      this.limitGateErrorMessage = null;
      return;
    }
    if (this.loadingPages) {
      this.canCreatePostPlan = true;
      this.limitGateErrorMessage = null;
      return;
    }

    const schedulerEnabled = isFeatureEnabled(this.entitlements.features, 'module.scheduler');
    if (!schedulerEnabled) {
      this.canCreatePostPlan = false;
      this.limitGateErrorMessage = 'Tu plan no permite programar publicaciones.';
      return;
    }

    const pagesEnabled = isFeatureEnabled(this.entitlements.features, 'network.facebook.pages');
    if (!pagesEnabled) {
      this.canCreatePostPlan = false;
      this.limitGateErrorMessage = 'Tu plan no permite publicar con Facebook Pages.';
      return;
    }

    const postsThisMonth = this.entitlements.currentUsage.postsThisMonth ?? 0;
    const postsPerMonthLimit = getLimitValue(this.entitlements.limits, ['limit.postsPerMonth']);
    const delta = this.computeSelectedDelta();

    if (delta === 0) {
      this.canCreatePostPlan = true;
      this.limitGateErrorMessage = null;
      return;
    }

    if (!canUseLimit(postsThisMonth, postsPerMonthLimit, delta)) {
      if (postsPerMonthLimit == null) {
        this.canCreatePostPlan = true;
        this.limitGateErrorMessage = null;
        return;
      }
      this.canCreatePostPlan = false;
      this.limitGateErrorMessage = 'Has alcanzado el límite mensual de publicaciones. Actualiza tu plan.';
      return;
    }

    this.canCreatePostPlan = true;
    this.limitGateErrorMessage = null;
  }

  setPublishMode(mode: 'now' | 'schedule'): void {
    this.publishMode = mode;
    const schedCtrl = this.postPlanForm.get('scheduledAt');
    if (mode === 'now') {
      schedCtrl?.clearValidators();
    } else {
      schedCtrl?.setValidators([Validators.required]);
    }
    schedCtrl?.updateValueAndValidity();
  }

  selectPreviewNetwork(id: PreviewNetworkId): void {
    const row = this.placeholderNetworks.find((n) => n.id === id);
    if (row && !row.available) return;
    this.previewNetwork = id;
  }

  togglePageSelection(pageId: string): void {
    const pageIdsControl = this.postPlanForm.get('pageIds');
    if (!pageIdsControl) return;
    const currentIds: string[] = pageIdsControl.value || [];
    const index = currentIds.indexOf(pageId);
    if (index > -1) {
      currentIds.splice(index, 1);
    } else {
      currentIds.push(pageId);
    }
    pageIdsControl.setValue([...currentIds]);
    pageIdsControl.markAsTouched();
    this.updatePostPlanGate();
  }

  isPageSelected(pageId: string): boolean {
    const pageIds: string[] = this.postPlanForm.get('pageIds')?.value || [];
    return pageIds.includes(pageId);
  }

  selectAllPages(): void {
    const allPageIds = this.pages.map((page) => page.facebookPageId);
    this.postPlanForm.get('pageIds')?.setValue(allPageIds);
    this.postPlanForm.get('pageIds')?.markAsTouched();
    this.updatePostPlanGate();
  }

  deselectAllPages(): void {
    this.postPlanForm.get('pageIds')?.setValue([]);
    this.postPlanForm.get('pageIds')?.markAsTouched();
    this.updatePostPlanGate();
  }

  get selectedPages(): FacebookPage[] {
    const ids: string[] = this.postPlanForm.get('pageIds')?.value || [];
    return this.pages.filter((p) => ids.includes(p.facebookPageId));
  }

  get primaryPreviewPage(): FacebookPage | null {
    const sel = this.selectedPages;
    return sel.length ? sel[0] : null;
  }

  get messageLength(): number {
    return (this.postPlanForm.get('message')?.value || '').length;
  }

  /** Límite de caracteres mostrado (por red cuando exista API). */
  get charLimitActive(): number {
    return this.charLimitFacebook;
  }

  insertIntoMessage(text: string): void {
    const ctrl = this.postPlanForm.get('message');
    if (!ctrl) return;
    const el = this.messageTextarea?.nativeElement;
    const val = (ctrl.value as string) || '';
    if (el && typeof el.selectionStart === 'number') {
      const start = el.selectionStart;
      const end = el.selectionEnd ?? start;
      const next = val.slice(0, start) + text + val.slice(end);
      ctrl.setValue(next);
      setTimeout(() => {
        el.focus();
        const pos = start + text.length;
        el.setSelectionRange(pos, pos);
      });
    } else {
      ctrl.setValue(val + text);
    }
  }

  insertHashtag(): void {
    this.insertIntoMessage(' #');
  }

  insertMention(): void {
    this.insertIntoMessage(' @');
  }

  toggleEmojiPanel(): void {
    this.showEmojiPanel = !this.showEmojiPanel;
  }

  addEmoji(e: string): void {
    this.insertIntoMessage(e);
    this.showEmojiPanel = false;
  }

  onDragOver(ev: DragEvent): void {
    ev.preventDefault();
    ev.stopPropagation();
  }

  onDrop(ev: DragEvent): void {
    ev.preventDefault();
    ev.stopPropagation();
    const file = ev.dataTransfer?.files?.[0];
    if (file && (file.type.startsWith('image/') || file.type.startsWith('video/'))) {
      this.openMediaPanel('device', file);
    }
  }

  openMediaPanel(tab: MediaPanelTab = 'device', pendingFile: File | null = null): void {
    this.mediaPanelInitialTab = tab;
    this.mediaPanelPendingFile = pendingFile;
    this.showMediaPanel = true;
  }

  onMediaPanelOpenChange(open: boolean): void {
    this.showMediaPanel = open;
    if (!open) {
      this.mediaPanelPendingFile = null;
    }
  }

  onMediaApplied(payload: MediaAppliedPayload): void {
    if (payload.mediaId != null && payload.mediaId !== undefined) {
      this.postPlanForm.patchValue({
        mediaId: payload.mediaId,
        imageUrl: payload.imageUrl?.trim() ?? ''
      });
    } else {
      this.postPlanForm.patchValue({
        mediaId: null,
        imageUrl: payload.imageUrl?.trim() ?? ''
      });
    }
    this.postPlanForm.get('imageUrl')?.markAsTouched();
  }

  previewImageSrc(): string | null {
    const url = (this.postPlanForm.get('imageUrl')?.value || '').trim();
    return url || null;
  }

  onSubmitPublishMode(mode: 'now' | 'schedule'): void {
    this.setPublishMode(mode);
    this.onSubmit();
  }

  onSubmit(): void {
    const sched = this.postPlanForm.get('scheduledAt');
    if (this.publishMode === 'now') {
      sched?.clearValidators();
    } else {
      sched?.setValidators([Validators.required]);
    }
    sched?.updateValueAndValidity();

    if (this.postPlanForm.invalid) {
      markFormGroupTouched(this.postPlanForm);
      this.errorMessage = '';
      return;
    }

    if (!this.canCreatePostPlan) {
      this.errorMessage = this.limitGateErrorMessage || 'No puedes crear este plan con tu plan actual.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    const formValue = this.postPlanForm.value;
    let scheduledAtISO: string;
    if (this.publishMode === 'now') {
      scheduledAtISO = new Date().toISOString();
    } else {
      scheduledAtISO = new Date(formValue.scheduledAt).toISOString();
    }

    const request: CreatePostPlanRequest = {
      scheduledAt: scheduledAtISO,
      timezone: formValue.timezone,
      message: formValue.message.trim()
    };

    if (formValue.linkUrl?.trim()) {
      request.linkUrl = formValue.linkUrl.trim();
    }
    if (formValue.imageUrl?.trim()) {
      request.imageUrl = formValue.imageUrl.trim();
    }
    const mid = formValue.mediaId;
    if (mid != null && typeof mid === 'number') {
      request.mediaId = mid;
    }
    if (formValue.dedupeKey?.trim()) {
      request.dedupeKey = formValue.dedupeKey.trim();
    }
    if (formValue.pageIds && formValue.pageIds.length > 0) {
      request.pageIds = formValue.pageIds;
    }

    const createSubscription = this.postPlanService.createPostPlan(request).subscribe({
      next: () => {
        this.isLoading = false;
        this.clearDraftStorage();
        this.success.emit();
        this.tenantEntitlements.refreshCurrentEntitlements().subscribe(() => this.updatePostPlanGate());
      },
      error: (error) => {
        this.isLoading = false;
        this.errorMessage = extractErrorMessage(
          error,
          'Error al crear el plan de publicación. Por favor, intenta nuevamente.'
        );
      }
    });

    this.subscriptions.add(createSubscription);
  }

  onCancel(): void {
    this.cancel.emit();
  }

  getFieldError(fieldName: string): string {
    return getFieldError(this.postPlanForm, fieldName);
  }

  isFieldInvalid(fieldName: string): boolean {
    return isFieldInvalid(this.postPlanForm, fieldName);
  }

  pagesSelectionError(): boolean {
    const c = this.postPlanForm.get('pageIds');
    return !!(c && c.touched && c.errors?.['requiredPages']);
  }

  ctaDisabled(): boolean {
    return this.isLoading || this.postPlanForm.invalid || !this.canCreatePostPlan;
  }
}
