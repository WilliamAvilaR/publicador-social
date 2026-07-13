import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { take } from 'rxjs/operators';
import { AuthService } from '../../../core/services/auth.service';
import { extractApiErrorCode, extractErrorMessage } from '../../../shared/utils/error.utils';
import { getAccountSecurityErrorMessage } from '../../../shared/utils/account-security.errors';
import { markFormGroupTouched } from '../../../shared/utils/form.utils';
import { getFieldError } from '../../../shared/utils/validation.utils';
import { isFieldInvalid } from '../../../shared/utils/form.utils';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.scss'
})
export class ResetPasswordComponent implements OnInit, OnDestroy {
  form!: FormGroup;
  token = '';
  isLoading = false;
  successMessage = '';
  errorMessage = '';
  showPassword = false;
  showConfirm = false;

  private subscriptions = new Subscription();

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]]
    }, { validators: this.passwordMatchValidator });

    const sub = this.route.queryParams.pipe(take(1)).subscribe(params => {
      this.token = typeof params['token'] === 'string' ? params['token'] : '';
      if (!this.token) {
        this.errorMessage = 'El enlace no es válido o ha expirado.';
      }
    });
    this.subscriptions.add(sub);
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  passwordMatchValidator(form: FormGroup) {
    const pwd = form.get('newPassword');
    const confirm = form.get('confirmPassword');
    if (!pwd || !confirm || pwd.value === confirm.value) {
      return null;
    }
    confirm.setErrors({ passwordMismatch: true });
    return { passwordMismatch: true };
  }

  onSubmit(): void {
    if (!this.token || this.form.invalid) {
      markFormGroupTouched(this.form);
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    const sub = this.authService.resetPassword({
      token: this.token,
      newPassword: this.form.value.newPassword
    }).subscribe({
      next: () => {
        this.isLoading = false;
        this.successMessage = 'Contraseña establecida. Ya puedes iniciar sesión.';
      },
      error: (error: HttpErrorResponse) => {
        this.isLoading = false;
        const code = extractApiErrorCode(error);
        this.errorMessage = code
          ? getAccountSecurityErrorMessage(code)
          : extractErrorMessage(error, 'No se pudo restablecer la contraseña.');
      }
    });
    this.subscriptions.add(sub);
  }

  isFieldInvalid(fieldName: string): boolean {
    return isFieldInvalid(this.form, fieldName);
  }

  getFieldError(fieldName: string): string {
    return getFieldError(this.form, fieldName);
  }
}
