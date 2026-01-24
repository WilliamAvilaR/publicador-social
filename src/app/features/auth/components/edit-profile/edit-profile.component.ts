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
    }
  }
}
