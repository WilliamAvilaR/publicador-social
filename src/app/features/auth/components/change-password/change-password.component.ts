import { Component, OnInit, OnDestroy, Output, EventEmitter, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../../../core/services/auth.service';
import { ChangePasswordRequest } from '../../../../core/models/auth.model';
import { markFormGroupTouched, isFieldInvalid } from '../../../../shared/utils/form.utils';
import { extractErrorMessage } from '../../../../shared/utils/error.utils';
import { getFieldError } from '../../../../shared/utils/validation.utils';

@Component({
  selector: 'app-change-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './change-password.component.html',
  styleUrl: './change-password.component.scss'
})
export class ChangePasswordComponent implements OnInit, OnDestroy {
  @Input() embedded: boolean = false; // Si está embebido en configuración
  @Output() passwordChanged = new EventEmitter<void>();
  
  changePasswordForm!: FormGroup;
  showCurrentPassword = false;
  showNewPassword = false;
  showConfirmPassword = false;
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
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  initForm() {
    this.changePasswordForm = this.fb.group({
      currentPassword: ['', [Validators.required]],
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmNewPassword: ['', [Validators.required]]
    }, {
      validators: this.passwordMatchValidator
    });
  }

  passwordMatchValidator(form: FormGroup) {
    const newPassword = form.get('newPassword');
    const confirmNewPassword = form.get('confirmNewPassword');

    if (!newPassword || !confirmNewPassword) {
      return null;
    }

    if (newPassword.value !== confirmNewPassword.value) {
      confirmNewPassword.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    }

    // Si las contraseñas coinciden, limpiar el error
    if (confirmNewPassword.hasError('passwordMismatch')) {
      const errors = { ...confirmNewPassword.errors };
      delete errors['passwordMismatch'];
      const hasErrors = Object.keys(errors).length > 0;
      confirmNewPassword.setErrors(hasErrors ? errors : null);
    }

    return null;
  }

  toggleCurrentPassword() {
    this.showCurrentPassword = !this.showCurrentPassword;
  }

  toggleNewPassword() {
    this.showNewPassword = !this.showNewPassword;
  }

  toggleConfirmPassword() {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  isFieldInvalid(fieldName: string): boolean {
    return isFieldInvalid(this.changePasswordForm, fieldName);
  }

  getFieldError(fieldName: string): string {
    return getFieldError(this.changePasswordForm, fieldName);
  }

  onSubmit() {
    if (this.changePasswordForm.invalid) {
      markFormGroupTouched(this.changePasswordForm);
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    const formValue = this.changePasswordForm.value;
    const request: ChangePasswordRequest = {
      currentPassword: formValue.currentPassword,
      newPassword: formValue.newPassword,
      confirmNewPassword: formValue.confirmNewPassword
    };

    const changePasswordSubscription = this.authService.changePassword(request).subscribe({
      next: (response) => {
        this.isLoading = false;
        this.successMessage = response.data || 'Contraseña cambiada exitosamente';
        
        // Limpiar el formulario
        this.changePasswordForm.reset();
        
        // Emitir evento para el componente padre
        this.passwordChanged.emit();
        
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

    this.subscriptions.add(changePasswordSubscription);
  }

  onCancel() {
    if (!this.embedded) {
      this.router.navigate(['/dashboard']);
    } else {
      this.changePasswordForm.reset();
      this.errorMessage = '';
      this.successMessage = '';
    }
  }
}
