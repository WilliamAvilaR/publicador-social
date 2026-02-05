import { Component, OnInit, OnDestroy, Output, EventEmitter, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../../../core/services/auth.service';
import { UpdateProfileRequest, UserProfileData } from '../../../../core/models/auth.model';
import { markFormGroupTouched, isFieldInvalid } from '../../../../shared/utils/form.utils';
import { extractErrorMessage } from '../../../../shared/utils/error.utils';
import { getFieldError, validateAvatarUrl } from '../../../../shared/utils/validation.utils';
import { ImageCroppedEvent, ImageCropperComponent } from 'ngx-image-cropper';

@Component({
  selector: 'app-edit-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ImageCropperComponent],
  templateUrl: './edit-profile.component.html',
  styleUrl: './edit-profile.component.scss'
})
export class EditProfileComponent implements OnInit, OnDestroy {
  @Input() embedded: boolean = false; // Si está embebido en configuración
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
  showCropModal = false;
  imageChangedEvent: any = '';
  imageFileForCropper: File | undefined = undefined;
  croppedImage: string | null = null;
  private readonly MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  private readonly ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  private subscriptions = new Subscription();

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    // Solo verificar autenticación si no está embebido (el padre ya lo hace)
    if (!this.embedded && !this.authService.isAuthenticated()) {
      this.router.navigate(['/login']);
      return;
    }

    this.initForm();
    this.loadUserData();
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  initForm() {
    this.profileForm = this.fb.group({
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      telephone: ['', [Validators.required]],
      dateBird: ['']
    });
  }

  loadUserData() {
    // Cargar desde localStorage primero para mostrar datos rápidamente
    const user = this.authService.getUser();
    if (user) {
      const userProfile = user as UserProfileData;
      this.profileForm.patchValue({
        firstName: userProfile.firstName || '',
        lastName: userProfile.lastName || '',
        email: userProfile.email || '',
        telephone: userProfile.telephone || '',
        dateBird: userProfile.dateBird || ''
      });
      // Validar avatarUrl antes de asignarlo
      this.avatarUrl = validateAvatarUrl(userProfile.avatarUrl);
    }

    // Obtener datos frescos del servidor
    const profileSubscription = this.authService.getProfile().subscribe({
      next: (response) => {
        const profileData = response.data;
        this.profileForm.patchValue({
          firstName: profileData.firstName || '',
          lastName: profileData.lastName || '',
          email: profileData.email || '',
          telephone: profileData.telephone || '',
          dateBird: profileData.dateBird || ''
        });

        // Validar avatarUrl antes de asignarlo
        this.avatarUrl = validateAvatarUrl(profileData.avatarUrl);

        // Actualizar localStorage con datos validados
        this.authService.updateUserData(profileData);
      },
      error: (error: HttpErrorResponse) => {
        console.error('Error al cargar perfil:', error);
        // Si falla, mantener datos de localStorage (ya cargados arriba)
      }
    });

    this.subscriptions.add(profileSubscription);
  }

  isFieldInvalid(fieldName: string): boolean {
    return isFieldInvalid(this.profileForm, fieldName);
  }

  getFieldError(fieldName: string): string {
    return getFieldError(this.profileForm, fieldName);
  }

  onSubmit() {
    if (this.profileForm.invalid) {
      markFormGroupTouched(this.profileForm);
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    const formValue = this.profileForm.value;
    const request: UpdateProfileRequest = {
      firstName: formValue.firstName,
      lastName: formValue.lastName,
      email: formValue.email,
      telephone: formValue.telephone,
      dateBird: formValue.dateBird || ''
    };

    const updateProfileSubscription = this.authService.updateProfile(request).subscribe({
      next: (response) => {
        this.isLoading = false;
        this.successMessage = 'Perfil actualizado exitosamente';

        // Validar avatarUrl antes de actualizar
        const validatedData = {
          ...response.data,
          avatarUrl: validateAvatarUrl(response.data.avatarUrl) || undefined
        };

        // Actualizar los datos del usuario en localStorage
        this.authService.updateUserData(validatedData);

        // Actualizar avatarUrl en el componente si existe
        if (validatedData.avatarUrl) {
          this.avatarUrl = validatedData.avatarUrl;
        }

        // Emitir evento para el componente padre
        this.profileUpdated.emit();

        // Si no está embebido, redirigir después de 2 segundos
        if (!this.embedded) {
          setTimeout(() => {
            this.router.navigate(['/dashboard']);
          }, 2000);
        } else {
          // Si está embebido, limpiar el mensaje después de 5 segundos
          setTimeout(() => {
            this.successMessage = '';
          }, 5000);
        }
      },
      error: (error: HttpErrorResponse) => {
        this.isLoading = false;
        this.errorMessage = extractErrorMessage(error);
      }
    });

    this.subscriptions.add(updateProfileSubscription);
  }

  onCancel() {
    if (!this.embedded) {
      this.router.navigate(['/dashboard']);
    } else {
      this.loadUserData(); // Recargar datos originales
      this.errorMessage = '';
      this.successMessage = '';
      this.cancelAvatarSelection();
    }
  }

  // ========== Funcionalidad de Avatar ==========

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];

      // Validar antes de mostrar crop
      if (!this.ALLOWED_TYPES.includes(file.type)) {
        this.avatarError = 'Formato no válido. Solo se permiten: JPG, PNG, GIF, WEBP';
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
      this.showCropModal = false;
      this.imageChangedEvent = null;
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

  uploadAvatar(): void {
    if (!this.selectedFile) {
      return;
    }

    this.uploadingAvatar = true;
    this.avatarError = '';

    const uploadSubscription = this.authService.uploadAvatar(this.selectedFile).subscribe({
      next: (response) => {
        this.uploadingAvatar = false;
        this.successMessage = 'Avatar actualizado exitosamente';

        // Limpiar selección primero para que la imagen se refresque
        this.selectedFile = null;
        this.avatarPreview = null;

        // Limpiar temporalmente avatarUrl para forzar la actualización
        this.avatarUrl = null;

        // Siempre obtener el perfil completo del servidor para asegurar que tenemos la URL correcta
        const profileSubscription = this.authService.getProfile().subscribe({
          next: (profileResponse) => {
            const profileData = profileResponse.data;
            const validatedUrl = validateAvatarUrl(profileData.avatarUrl);
            if (validatedUrl) {
              // Guardar URL sin cache buster (getCurrentAvatarUrl() lo agregará cada vez)
              this.avatarUrl = validatedUrl;

              const user = this.authService.getUser();
              if (user) {
                const userProfile = user as UserProfileData;
                userProfile.avatarUrl = validatedUrl;
                this.authService.updateUserData(userProfile);
              }
            }
          },
          error: (error) => {
            console.error('Error al obtener perfil después de subir avatar:', error);
            // Si falla, intentar usar la respuesta directa como fallback
            const newAvatarUrl = validateAvatarUrl(response.data);
            if (newAvatarUrl) {
              this.avatarUrl = newAvatarUrl;
            }
          }
        });
        this.subscriptions.add(profileSubscription);

        // Emitir evento para el componente padre
        this.profileUpdated.emit();

        // Limpiar mensaje después de 1 segundo
        setTimeout(() => {
          this.successMessage = '';
        }, 1000);
      },
      error: (error: HttpErrorResponse) => {
        this.uploadingAvatar = false;
        this.avatarError = extractErrorMessage(error);
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

  deleteAvatar(): void {
    if (!this.avatarUrl && !this.avatarPreview) {
      return;
    }

    this.deletingAvatar = true;
    this.avatarError = '';

    const deleteSubscription = this.authService.deleteAvatar().subscribe({
      next: (response) => {
        this.deletingAvatar = false;

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

        // Emitir evento para el componente padre
        this.profileUpdated.emit();
      },
      error: (error: HttpErrorResponse) => {
        this.deletingAvatar = false;
        this.avatarError = extractErrorMessage(error);
      }
    });

    this.subscriptions.add(deleteSubscription);
  }

  cancelAvatarSelection(): void {
    this.selectedFile = null;
    this.avatarPreview = null;
    this.avatarError = '';
    this.showCropModal = false;
    this.croppedImage = null;
    this.imageChangedEvent = null;
    this.imageFileForCropper = undefined;
  }

  getCurrentAvatarUrl(): string | null {
    // Validar preview primero (preview es data URL, no necesita cache buster)
    if (this.avatarPreview) {
      return validateAvatarUrl(this.avatarPreview);
    }

    // Validar avatarUrl y agregar cache buster si es necesario
    const url = validateAvatarUrl(this.avatarUrl);
    if (url) {
      // Si la URL ya tiene cache buster (contiene ?t=), devolverla tal cual
      // Si no, agregar cache buster para forzar recarga
      if (url.includes('?t=')) {
        return url;
      }
      return this.addCacheBuster(url);
    }

    return null;
  }

  hasAvatar(): boolean {
    return !!(this.avatarUrl || this.avatarPreview);
  }

  hasSavedAvatar(): boolean {
    // Solo retorna true si hay un avatar guardado (avatarUrl), no si solo hay preview
    return !!this.avatarUrl;
  }
}
