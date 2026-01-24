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
import { getFieldError } from '../../../../shared/utils/validation.utils';

@Component({
  selector: 'app-edit-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
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
    const user = this.authService.getUser();
    if (user) {
      // Prellenar el formulario con los datos actuales del usuario
      const userProfile = user as UserProfileData;
      this.profileForm.patchValue({
        firstName: userProfile.firstName || '',
        lastName: userProfile.lastName || '',
        email: userProfile.email || '',
        telephone: userProfile.telephone || '',
        dateBird: userProfile.dateBird || ''
      });
      // Cargar avatar actual
      this.avatarUrl = userProfile.avatarUrl || null;
    }
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

        // Actualizar los datos del usuario en localStorage
        this.authService.updateUserData(response.data);

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
      this.validateAndSetFile(file);
    }
  }

  validateAndSetFile(file: File): void {
    this.avatarError = '';
    this.selectedFile = null;
    this.avatarPreview = null;

    // Validar tipo de archivo
    if (!this.ALLOWED_TYPES.includes(file.type)) {
      this.avatarError = 'Formato no válido. Solo se permiten: JPG, PNG, GIF, WEBP';
      return;
    }

    // Validar tamaño
    if (file.size > this.MAX_FILE_SIZE) {
      this.avatarError = `El archivo es demasiado grande. Tamaño máximo: 5MB`;
      return;
    }

    // Si pasa las validaciones, establecer el archivo y crear preview
    this.selectedFile = file;
    const reader = new FileReader();
    reader.onload = (e: ProgressEvent<FileReader>) => {
      this.avatarPreview = e.target?.result as string;
    };
    reader.readAsDataURL(file);
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

        // Actualizar avatarUrl con la respuesta (que contiene la URL del avatar)
        // Asumimos que la respuesta contiene la URL, si no, necesitaríamos obtener el perfil actualizado
        const user = this.authService.getUser();
        if (user) {
          const userProfile = user as UserProfileData;
          // Actualizar el avatarUrl en el usuario
          // La respuesta contiene la URL del avatar subido
          const newAvatarUrl = response.data || undefined;
          if (newAvatarUrl) {
            userProfile.avatarUrl = newAvatarUrl;
            this.authService.updateUserData(userProfile);
            this.avatarUrl = newAvatarUrl;
          } else if (this.avatarPreview) {
            // Si no hay URL en la respuesta, usar el preview temporalmente
            this.avatarUrl = this.avatarPreview;
          }
        }

        // Limpiar selección
        this.selectedFile = null;
        this.avatarPreview = null;

        // Emitir evento para el componente padre
        this.profileUpdated.emit();

        // Limpiar mensaje después de 5 segundos
        setTimeout(() => {
          this.successMessage = '';
        }, 5000);
      },
      error: (error: HttpErrorResponse) => {
        this.uploadingAvatar = false;
        this.avatarError = extractErrorMessage(error);
      }
    });

    this.subscriptions.add(uploadSubscription);
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
        this.successMessage = 'Avatar eliminado exitosamente';

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

        // Limpiar mensaje después de 5 segundos
        setTimeout(() => {
          this.successMessage = '';
        }, 5000);
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
  }

  getCurrentAvatarUrl(): string | null {
    return this.avatarPreview || this.avatarUrl || null;
  }

  hasAvatar(): boolean {
    return !!(this.avatarUrl || this.avatarPreview);
  }
}
