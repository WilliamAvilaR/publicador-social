import { Component, OnInit, OnDestroy, Output, EventEmitter, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ValidationErrors,
  Validators,
  ReactiveFormsModule
} from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../../../core/services/auth.service';
import { UpdateProfileRequest, UserProfileData } from '../../../../core/models/auth.model';
import { TenantEntitlementsResponse } from '../../../../core/models/tenant.model';
import { TenantEntitlementsService } from '../../../../core/services/tenant-entitlements.service';
import { PhoneCatalogService } from '../../../../core/services/phone-catalog.service';
import { canUseLimit, getLimitValue, isFeatureEnabled } from '../../../../core/utils/entitlements.utils';
import { markFormGroupTouched, isFieldInvalid } from '../../../../shared/utils/form.utils';
import { extractErrorMessage } from '../../../../shared/utils/error.utils';
import { navigateToAccountSecurity } from '../../../../shared/utils/account-security.navigation';
import { getFieldError, validateAvatarUrl } from '../../../../shared/utils/validation.utils';
import {
  buildPhonePayload,
  DEFAULT_PHONE_COUNTRY,
  hydrateFromProfile,
  isPhoneValidForCountry
} from '../../../../shared/utils/phone.utils';
import { PhoneFieldComponent } from '../../../../shared/components/phone-field/phone-field.component';
import { ImageCroppedEvent, ImageCropperComponent } from 'ngx-image-cropper';

function optionalInternationalPhoneValidator(group: AbstractControl): ValidationErrors | null {
  const national = String(group.get('phoneNational')?.value || '');
  const country = String(group.get('telephoneCountry')?.value || '');
  const digits = national.replace(/[^\d]/g, '');
  if (!digits) {
    return null;
  }
  if (!isPhoneValidForCountry(national, country)) {
    return { invalidPhone: true };
  }
  return null;
}

@Component({
  selector: 'app-edit-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule, ImageCropperComponent, PhoneFieldComponent],
  templateUrl: './edit-profile.component.html',
  styleUrl: './edit-profile.component.scss'
})
export class EditProfileComponent implements OnInit, OnDestroy {
  @Input() embedded: boolean = false;
  @Output() profileUpdated = new EventEmitter<void>();

  profileForm!: FormGroup;
  isLoading = false;
  errorMessage = '';
  successMessage = '';
  avatarUrl: string | null = null;
  avatarPreview: string | null = null;
  selectedFile: File | null = null;
  uploadingAvatar = false;
  deletingAvatar = false;
  avatarError = '';
  entitlements: TenantEntitlementsResponse['data'] | null = null;
  entitlementsLoading = false;
  canUploadAvatar = true;
  avatarUploadGateError: string | null = null;
  showCropModal = false;
  imageChangedEvent: any = '';
  imageFileForCropper: File | undefined = undefined;
  croppedImage: string | null = null;
  currentAvatarUrl: string | null = null;
  pendingAvatarDelete = false;
  currentEmail = '';
  supportPublicId: string | null = null;
  createdAt: string | null = null;
  supportIdCopied = false;

  private readonly MAX_FILE_SIZE = 5 * 1024 * 1024;
  private readonly ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
  private subscriptions = new Subscription();
  private successToastTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private supportIdCopyTimeoutId: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private tenantEntitlements: TenantEntitlementsService,
    private phoneCatalog: PhoneCatalogService
  ) {}

  ngOnInit() {
    if (!this.embedded && !this.authService.isAuthenticated()) {
      this.router.navigate(['/login']);
      return;
    }

    this.initForm();
    this.loadUserData();
    this.refreshEntitlements();
  }

  ngOnDestroy() {
    this.clearSuccessToastTimeout();
    if (this.supportIdCopyTimeoutId) {
      clearTimeout(this.supportIdCopyTimeoutId);
    }
    this.subscriptions.unsubscribe();
  }

  private refreshEntitlements(): void {
    this.entitlementsLoading = true;
    const sub = this.tenantEntitlements.refreshCurrentEntitlements().subscribe((data) => {
      this.entitlements = data;
      this.entitlementsLoading = false;
      this.updateAvatarUploadGate();
    });
    this.subscriptions.add(sub);
  }

  private updateAvatarUploadGate(): void {
    // Si no hay archivo seleccionado, el gating no aplica.
    if (!this.selectedFile) {
      this.canUploadAvatar = true;
      this.avatarUploadGateError = null;
      return;
    }

    if (!this.entitlements) {
      // Sin entitlements cargados no bloqueamos para no romper flujo.
      this.canUploadAvatar = true;
      this.avatarUploadGateError = null;
      return;
    }

    // Feature opcional: si existe y viene en false, bloqueamos.
    if (!isFeatureEnabled(this.entitlements.features, 'module.storage')) {
      this.canUploadAvatar = false;
      this.avatarUploadGateError = 'Tu plan no permite usar almacenamiento para avatares.';
      return;
    }

    const storageLimitMB = getLimitValue(this.entitlements.limits, ['limit.storageMB']);
    const currentUsageStorageMB = this.entitlements.currentUsage['storageMB'] ?? 0;

    // Conversión a MB (base 1024) + redondeo simple para evitar falsos negativos.
    const fileSizeMB = Math.ceil((this.selectedFile.size / (1024 * 1024)) * 100) / 100;

    if (!canUseLimit(currentUsageStorageMB, storageLimitMB, fileSizeMB)) {
      this.canUploadAvatar = false;
      this.avatarUploadGateError = 'Has alcanzado el límite de almacenamiento. Actualiza tu plan.';
      return;
    }

    this.canUploadAvatar = true;
    this.avatarUploadGateError = null;
  }

  initForm() {
    this.profileForm = this.fb.group(
      {
        firstName: ['', [Validators.required, Validators.minLength(2)]],
        lastName: ['', [Validators.required, Validators.minLength(2)]],
        telephoneCountry: [DEFAULT_PHONE_COUNTRY],
        phoneNational: [''],
        dateBird: ['']
      },
      { validators: optionalInternationalPhoneValidator }
    );
  }

  loadUserData() {
    const countriesSub = this.phoneCatalog.getPhoneCountries().subscribe(countries => {
      const user = this.authService.getUser();
      if (user) {
        const userProfile = user as UserProfileData;
        this.currentEmail = userProfile.email || '';
        this.applyAccountMeta(userProfile);
        this.patchPersonalFields(userProfile, countries);
        this.avatarUrl = validateAvatarUrl(userProfile.avatarUrl);
        this.resetPendingAvatarChanges();
        this.updateCurrentAvatarUrl();
      }

      const profileSub = this.authService.getProfile().subscribe({
        next: (response) => {
          const profileData = response.data;
          this.currentEmail = profileData.email || '';
          this.applyAccountMeta(profileData);
          this.patchPersonalFields(profileData, countries);
          this.avatarUrl = validateAvatarUrl(profileData.avatarUrl);
          this.resetPendingAvatarChanges();
          this.updateCurrentAvatarUrl();
          this.authService.updateUserData(profileData);
        },
        error: (error: HttpErrorResponse) => {
          console.error('Error al cargar perfil:', error);
        }
      });
      this.subscriptions.add(profileSub);
    });
    this.subscriptions.add(countriesSub);
  }

  get currentEmailLabel(): string {
    return this.currentEmail?.trim() || '—';
  }

  get supportPublicIdLabel(): string {
    const publicId = this.supportPublicId?.trim();
    if (!publicId) {
      return '—';
    }

    const visibleLength = 18;
    return publicId.length > visibleLength
      ? `${publicId.slice(0, visibleLength)}…`
      : publicId;
  }

  get createdAtLabel(): string {
    return this.formatCreatedAt(this.createdAt);
  }

  isFieldInvalid(fieldName: string): boolean {
    return isFieldInvalid(this.profileForm, fieldName);
  }

  getFieldError(fieldName: string): string {
    return getFieldError(this.profileForm, fieldName);
  }

  isPhoneInvalid(): boolean {
    return !!this.profileForm?.hasError('invalidPhone') && !!this.profileForm?.get('phoneNational')?.touched;
  }

  get hasPendingChanges(): boolean {
    return !!this.profileForm && (this.profileForm.dirty || !!this.selectedFile || this.pendingAvatarDelete);
  }

  get isSaving(): boolean {
    return this.isLoading || this.uploadingAvatar || this.deletingAvatar;
  }

  clearSuccessToast(): void {
    this.clearSuccessToastTimeout();
    this.successMessage = '';
  }

  goToSecurityEmailChange(): void {
    navigateToAccountSecurity(this.router);
  }

  async copySupportId(): Promise<void> {
    const value = this.supportPublicId?.trim();
    if (!value) {
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      this.supportIdCopied = true;
      if (this.supportIdCopyTimeoutId) {
        clearTimeout(this.supportIdCopyTimeoutId);
      }
      this.supportIdCopyTimeoutId = setTimeout(() => {
        this.supportIdCopied = false;
        this.supportIdCopyTimeoutId = null;
      }, 2000);
    } catch {
      this.errorMessage = 'No se pudo copiar el ID de soporte.';
    }
  }

  private patchPersonalFields(
    profile: {
      firstName?: string;
      lastName?: string;
      telephone?: string;
      telephoneCountry?: string | null;
      dateBird?: string;
    },
    countries = this.phoneCatalog.getCachedCountries()
  ): void {
    const parsed = hydrateFromProfile(profile.telephone, profile.telephoneCountry, countries);
    this.profileForm.patchValue({
      firstName: profile.firstName || '',
      lastName: profile.lastName || '',
      telephoneCountry: parsed.isoCode,
      phoneNational: parsed.nationalDisplay,
      dateBird: profile.dateBird || ''
    });
    this.profileForm.markAsPristine();
  }

  private applyAccountMeta(profile: {
    publicId?: string | null;
    createdAt?: string | null;
    creationDate?: string | null;
    registeredAt?: string | null;
  }): void {
    const rawPublicId = profile.publicId?.trim();
    this.supportPublicId = rawPublicId || null;
    const rawCreatedAt = profile.createdAt || profile.creationDate || profile.registeredAt || null;
    this.createdAt = typeof rawCreatedAt === 'string' && rawCreatedAt.trim() ? rawCreatedAt.trim() : null;
  }

  private formatCreatedAt(value: string | null): string {
    if (!value) {
      return '—';
    }

    const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
    if (dateOnly) {
      const date = new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
      return new Intl.DateTimeFormat('es', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      }).format(date);
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '—';
    }
    return new Intl.DateTimeFormat('es', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(date);
  }

  onSubmit() {
    if (this.profileForm.invalid) {
      markFormGroupTouched(this.profileForm);
      this.profileForm.get('phoneNational')?.markAsTouched();
      return;
    }

    if (!this.hasPendingChanges) {
      return;
    }

    if (this.selectedFile) {
      this.updateAvatarUploadGate();
      if (!this.canUploadAvatar) {
        this.avatarError = this.avatarUploadGateError || 'No puedes subir este avatar con tu plan actual.';
        return;
      }
    }

    const hasProfileChanges = this.profileForm.dirty;
    const selectedAvatar = this.selectedFile;
    const shouldDeleteAvatar = this.pendingAvatarDelete;

    this.isLoading = true;
    this.uploadingAvatar = !!selectedAvatar;
    this.deletingAvatar = shouldDeleteAvatar;
    this.errorMessage = '';
    this.successMessage = '';
    this.avatarError = '';

    const formValue = this.profileForm.value;
    const phone = buildPhonePayload(
      formValue.phoneNational,
      formValue.telephoneCountry,
      this.phoneCatalog.getCachedCountries()
    );
    const request: UpdateProfileRequest = {
      firstName: formValue.firstName,
      lastName: formValue.lastName,
      email: this.currentEmail,
      telephone: phone.telephone,
      telephoneCountry: phone.telephoneCountry,
      dateBird: formValue.dateBird || ''
    };

    const saveAvatarChanges = () => {
      if (selectedAvatar) {
        this.saveSelectedAvatar(selectedAvatar);
        return;
      }

      if (shouldDeleteAvatar) {
        this.saveAvatarDeletion();
        return;
      }

      this.finishProfileSave();
    };

    if (!hasProfileChanges) {
      saveAvatarChanges();
      return;
    }

    const updateProfileSubscription = this.authService.updateProfile(request).subscribe({
      next: (response) => {
        // Validar avatarUrl antes de actualizar
        const validatedData = {
          ...response.data,
          avatarUrl: validateAvatarUrl(response.data.avatarUrl) || undefined
        };

        // Actualizar los datos del usuario en localStorage
        this.authService.updateUserData({
          ...validatedData,
          createdAt: validatedData.createdAt ?? this.createdAt
        });
        this.applyAccountMeta({
          publicId: validatedData.publicId,
          createdAt: validatedData.createdAt ?? this.createdAt
        });
        this.profileForm.markAsPristine();

        // Actualizar avatarUrl solo si no hay una operación de avatar pendiente.
        if (validatedData.avatarUrl && !selectedAvatar && !shouldDeleteAvatar) {
          this.avatarUrl = validatedData.avatarUrl;
          this.updateCurrentAvatarUrl();
        }

        saveAvatarChanges();
      },
      error: (error: HttpErrorResponse) => {
        this.finishProfileSaveError(error);
      }
    });

    this.subscriptions.add(updateProfileSubscription);
  }

  onCancel() {
    if (!this.embedded) {
      this.router.navigate(['/dashboard']);
      return;
    }
    this.loadUserData();
    this.errorMessage = '';
    this.successMessage = '';
    this.cancelAvatarSelection();
  }

  // ========== Funcionalidad de Avatar ==========

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];

      // Validar antes de mostrar crop
      if (!this.ALLOWED_TYPES.includes(file.type)) {
        this.avatarError = 'Formato no válido. Solo se permiten: JPG, PNG o WebP.';
        return;
      }

      if (file.size > this.MAX_FILE_SIZE) {
        this.avatarError = `El archivo es demasiado grande. Tamaño máximo: 5MB`;
        return;
      }

      // Limpiar estado anterior del crop completamente
      this.showCropModal = false;
      this.croppedImage = null;
      this.imageChangedEvent = null;
      this.imageFileForCropper = undefined;
      this.avatarError = '';
      this.pendingAvatarDelete = false;

      // Resetear el input para que pueda detectar el mismo archivo si se selecciona de nuevo
      if (input) {
        input.value = '';
      }

      // Usar setTimeout para asegurar que el modal se cierre completamente antes de abrir uno nuevo
      setTimeout(() => {
        // Crear un nuevo evento para el cropper
        this.imageChangedEvent = event;
        this.imageFileForCropper = file;
        this.selectedFile = file;
        this.croppedImage = null;
        this.showCropModal = true;
        this.updateAvatarUploadGate();
      }, 150);
    }
  }

  imageCropped(event: ImageCroppedEvent) {
    // Este evento se dispara automáticamente con autoCrop=true
    // y también cuando el usuario mueve el cropper
    console.log('imageCropped event:', event);
    if (event.base64) {
      this.croppedImage = event.base64;
      console.log('croppedImage establecido');
    } else {
      console.warn('event.base64 es null o undefined');
    }
  }

  imageLoaded() {
    // Imagen cargada en el cropper
    // Con autoCrop activado, imageCropped se disparará automáticamente
  }

  cropperReady() {
    // Cropper listo y posición inicial establecida
    // Con autoCrop activado, imageCropped ya debería haberse disparado
    // Si por alguna razón no se disparó, forzar el crop inicial
    if (!this.croppedImage) {
      // El evento debería haberse disparado automáticamente
      // pero si no, esperamos un momento para que se procese
      setTimeout(() => {
        if (!this.croppedImage) {
          console.warn('imageCropped no se disparó automáticamente');
        }
      }, 100);
    }
  }

  loadImageFailed() {
    this.avatarError = 'Error al cargar la imagen';
    this.showCropModal = false;
    this.cancelCrop();
  }

  applyCrop() {
    if (this.croppedImage && this.selectedFile) {
      // Convertir base64 a File y establecer preview
      this.avatarPreview = this.croppedImage;
      this.selectedFile = this.base64ToFile(this.croppedImage, this.selectedFile.name);
      this.pendingAvatarDelete = false;
      this.updateCurrentAvatarUrl();
      this.showCropModal = false;
      this.imageChangedEvent = null;
      this.updateAvatarUploadGate();
    }
  }

  cancelCrop() {
    this.showCropModal = false;
    this.croppedImage = null;
    this.imageChangedEvent = null;
    this.imageFileForCropper = undefined;
    this.selectedFile = null;
    this.avatarPreview = null;
    this.avatarError = '';
    this.avatarUploadGateError = null;
    this.canUploadAvatar = true;
    this.updateCurrentAvatarUrl();
  }

  private base64ToFile(base64: string, filename: string): File {
    const arr = base64.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);

    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }

    return new File([u8arr], filename, { type: mime });
  }

  private saveSelectedAvatar(file: File): void {
    const uploadSubscription = this.authService.uploadAvatar(file).subscribe({
      next: (response) => {
        // Limpiar selección primero para que la imagen se refresque
        this.selectedFile = null;
        this.avatarPreview = null;
        this.pendingAvatarDelete = false;

        // Limpiar temporalmente avatarUrl para forzar la actualización
        this.avatarUrl = null;
        this.updateCurrentAvatarUrl();

        // Siempre obtener el perfil completo del servidor para asegurar que tenemos la URL correcta
        const profileSubscription = this.authService.getProfile().subscribe({
          next: (profileResponse) => {
            const profileData = profileResponse.data;
            const validatedUrl = validateAvatarUrl(profileData.avatarUrl);
            if (validatedUrl) {
              // Guardar URL sin cache buster
              this.avatarUrl = validatedUrl;
              this.updateCurrentAvatarUrl();

              const user = this.authService.getUser();
              if (user) {
                const userProfile = user as UserProfileData;
                userProfile.avatarUrl = validatedUrl;
                this.authService.updateUserData(userProfile);
              }
            }
            this.finishProfileSave();
          },
          error: (error) => {
            console.error('Error al obtener perfil después de subir avatar:', error);
            // Si falla, intentar usar la respuesta directa como fallback
            const newAvatarUrl = validateAvatarUrl(response.data);
            if (newAvatarUrl) {
              this.avatarUrl = newAvatarUrl;
              this.updateCurrentAvatarUrl();
            }
            this.finishProfileSave();
          }
        });
        this.subscriptions.add(profileSubscription);

        // El backend puede actualizar el uso de almacenamiento; refrescar entitlements.
        this.refreshEntitlements();
      },
      error: (error: HttpErrorResponse) => {
        this.finishProfileSaveError(error);
      }
    });

    this.subscriptions.add(uploadSubscription);
  }

  /**
   * Agrega un parámetro de cache-busting a la URL para forzar la recarga de la imagen
   */
  private addCacheBuster(url: string): string {
    if (!url) {
      return url;
    }

    // Si ya tiene parámetros, agregar con &
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}t=${Date.now()}`;
  }

  markAvatarForDeletion(): void {
    if (!this.avatarUrl && !this.avatarPreview) {
      return;
    }

    this.avatarError = '';
    this.selectedFile = null;
    this.avatarPreview = null;
    this.pendingAvatarDelete = true;
    this.avatarUploadGateError = null;
    this.canUploadAvatar = true;
    this.updateCurrentAvatarUrl();
  }

  private saveAvatarDeletion(): void {
    const deleteSubscription = this.authService.deleteAvatar().subscribe({
      next: () => {
        // Actualizar avatarUrl a undefined
        const user = this.authService.getUser();
        if (user) {
          const userProfile = user as UserProfileData;
          userProfile.avatarUrl = undefined;
          this.authService.updateUserData(userProfile);
          this.avatarUrl = null;
        }

        // Limpiar selección
        this.selectedFile = null;
        this.avatarPreview = null;
        this.pendingAvatarDelete = false;
        this.updateCurrentAvatarUrl();

        // Refrescar uso de almacenamiento (backend enforcement).
        this.refreshEntitlements();
        this.finishProfileSave();
      },
      error: (error: HttpErrorResponse) => {
        this.finishProfileSaveError(error);
      }
    });

    this.subscriptions.add(deleteSubscription);
  }

  private finishProfileSave(): void {
    this.isLoading = false;
    this.uploadingAvatar = false;
    this.deletingAvatar = false;
    this.showSuccessToast('Cambios guardados correctamente');
    this.profileForm.markAsPristine();

    // Emitir evento para el componente padre
    this.profileUpdated.emit();

    // Si no está embebido, redirigir después de 2 segundos
    if (!this.embedded) {
      setTimeout(() => {
        this.router.navigate(['/dashboard']);
      }, 2000);
    }
  }

  private finishProfileSaveError(error: HttpErrorResponse): void {
    this.isLoading = false;
    this.uploadingAvatar = false;
    this.deletingAvatar = false;
    this.errorMessage = extractErrorMessage(error);
  }

  private showSuccessToast(message: string): void {
    this.successMessage = message;
    this.clearSuccessToastTimeout();
    this.successToastTimeoutId = setTimeout(() => {
      this.successMessage = '';
      this.successToastTimeoutId = null;
    }, 4000);
  }

  private clearSuccessToastTimeout(): void {
    if (this.successToastTimeoutId) {
      clearTimeout(this.successToastTimeoutId);
      this.successToastTimeoutId = null;
    }
  }

  private resetPendingAvatarChanges(): void {
    this.selectedFile = null;
    this.avatarPreview = null;
    this.pendingAvatarDelete = false;
    this.avatarUploadGateError = null;
    this.canUploadAvatar = true;
    this.showCropModal = false;
    this.croppedImage = null;
    this.imageChangedEvent = null;
    this.imageFileForCropper = undefined;
  }

  cancelAvatarSelection(): void {
    this.selectedFile = null;
    this.avatarPreview = null;
    this.pendingAvatarDelete = false;
    this.avatarError = '';
    this.avatarUploadGateError = null;
    this.canUploadAvatar = true;
    this.showCropModal = false;
    this.croppedImage = null;
    this.imageChangedEvent = null;
    this.imageFileForCropper = undefined;
    this.updateCurrentAvatarUrl();
  }

  /**
   * Actualiza la propiedad currentAvatarUrl con el valor correcto.
   * Este método debe llamarse cada vez que cambie avatarUrl o avatarPreview.
   */
  private updateCurrentAvatarUrl(): void {
    if (this.pendingAvatarDelete) {
      this.currentAvatarUrl = null;
      return;
    }

    // Validar preview primero (preview es data URL, no necesita cache buster)
    if (this.avatarPreview) {
      this.currentAvatarUrl = validateAvatarUrl(this.avatarPreview);
      return;
    }

    // Validar avatarUrl y agregar cache buster si es necesario
    const url = validateAvatarUrl(this.avatarUrl);
    if (url) {
      // Si la URL ya tiene cache buster (contiene ?t=), removerlo y agregar uno nuevo
      // para asegurar que siempre tenga el timestamp más reciente
      const urlWithoutParams = url.split('?')[0];
      this.currentAvatarUrl = this.addCacheBuster(urlWithoutParams);
    } else {
      this.currentAvatarUrl = null;
    }
  }

  /**
   * Método público para obtener la URL del avatar actual.
   * Ahora simplemente retorna la propiedad almacenada.
   */
  getCurrentAvatarUrl(): string | null {
    return this.currentAvatarUrl;
  }

  hasAvatar(): boolean {
    return !this.pendingAvatarDelete && !!(this.avatarUrl || this.avatarPreview);
  }

  hasSavedAvatar(): boolean {
    // Solo retorna true si hay un avatar guardado (avatarUrl), no si solo hay preview
    return !this.pendingAvatarDelete && !!this.avatarUrl;
  }
}
