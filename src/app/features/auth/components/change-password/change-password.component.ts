import { Component, OnInit, OnDestroy, Output, EventEmitter, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Observable, Subscription, of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { switchMap, tap } from 'rxjs/operators';
import { AuthService } from '../../../../core/services/auth.service';
import { AccountSecurityService } from '../../../../core/services/account-security.service';
import { StepUpService } from '../../../../core/services/step-up.service';
import { markFormGroupTouched, isFieldInvalid } from '../../../../shared/utils/form.utils';
import { extractApiErrorCode } from '../../../../shared/utils/error.utils';
import {
  getAccountSecurityErrorMessage,
  resolveAccountSecurityErrorMessage
} from '../../../../shared/utils/account-security.errors';
import { getFieldError } from '../../../../shared/utils/validation.utils';
import { PasswordCapabilitiesDto } from '../../../../core/models/account-security.model';

@Component({
  selector: 'app-change-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './change-password.component.html',
  styleUrl: './change-password.component.scss'
})
export class ChangePasswordComponent implements OnInit, OnDestroy {
  @Input() embedded = false;
  @Input() allowDismiss = false;
  @Input() panelLayout = false;
  @Output() passwordChanged = new EventEmitter<void>();
  @Output() formClosed = new EventEmitter<void>();
  @Output() formDirtyChange = new EventEmitter<boolean>();

  changePasswordForm!: FormGroup;
  showCurrentPassword = false;
  showNewPassword = false;
  showConfirmPassword = false;
  isLoading = false;
  capabilitiesLoading = true;
  errorMessage = '';
  successMessage = '';
  requiresCurrentPassword = false;
  passwordCapabilities: PasswordCapabilitiesDto | null = null;

  private subscriptions = new Subscription();

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private accountSecurity: AccountSecurityService,
    private stepUpService: StepUpService,
    private router: Router
  ) {}

  ngOnInit() {
    if (!this.embedded && !this.authService.isAuthenticated()) {
      this.router.navigate(['/login']);
      return;
    }

    this.initForm();
    this.loadPasswordCapabilities();
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  get isSetPasswordMode(): boolean {
    return this.passwordCapabilities?.canSet === true;
  }

  get isChangePasswordMode(): boolean {
    return this.passwordCapabilities?.canChange === true;
  }

  get submitLabel(): string {
    return this.isSetPasswordMode ? 'Crear contraseña' : 'Cambiar contraseña';
  }

  get panelTitle(): string {
    return this.isSetPasswordMode ? 'Crear contraseña' : 'Cambiar contraseña';
  }

  get loadingMessage(): string {
    return this.isSetPasswordMode && this.passwordCapabilities?.requiresStepUp
      ? 'Verificando identidad...'
      : 'Preparando formulario...';
  }

  /**
   * Cambiar: formulario único con contraseña actual + nueva (step-up implícito al enviar).
   * Establecer primera contraseña: solo tras step-up si password.requiresStepUp.
   */
  get passwordFormReady(): boolean {
    const password = this.passwordCapabilities;
    if (!password || this.capabilitiesLoading) {
      return false;
    }
    if (password.canChange) {
      return true;
    }
    if (password.canSet) {
      return !password.requiresStepUp;
    }
    return false;
  }

  get panelHelpText(): string {
    if (this.capabilitiesLoading) {
      return 'Cargando...';
    }
    if (this.isSetPasswordMode) {
      return 'Crea una contraseña segura para proteger tu cuenta.';
    }
    return 'Introduce tu contraseña actual y crea una nueva contraseña segura.';
  }

  get standaloneSubtitle(): string {
    return this.panelHelpText;
  }

  get newPasswordLabel(): string {
    return this.isSetPasswordMode ? 'Contraseña' : 'Nueva contraseña';
  }

  get confirmPasswordLabel(): string {
    return this.isSetPasswordMode ? 'Confirmar contraseña' : 'Confirmar nueva contraseña';
  }

  get canSubmit(): boolean {
    if (this.isLoading || this.capabilitiesLoading || !this.passwordFormReady) {
      return false;
    }
    return this.changePasswordForm.valid;
  }

  initForm() {
    this.changePasswordForm = this.fb.group({
      currentPassword: [''],
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmNewPassword: ['', [Validators.required]]
    }, {
      validators: [this.passwordMatchValidator, this.newPasswordDifferentValidator]
    });

    const dirtySub = this.changePasswordForm.valueChanges.subscribe(() => {
      this.formDirtyChange.emit(this.hasFormInput());
    });
    this.subscriptions.add(dirtySub);
  }

  hasFormInput(): boolean {
    if (!this.changePasswordForm) {
      return false;
    }
    const values = this.changePasswordForm.value;
    return !!(
      values.currentPassword?.trim() ||
      values.newPassword?.trim() ||
      values.confirmNewPassword?.trim()
    );
  }

  private loadPasswordCapabilities(): void {
    this.capabilitiesLoading = true;
    this.errorMessage = '';
    const sub = this.fetchPasswordCapabilities().subscribe({
      next: () => {
        this.capabilitiesLoading = false;
      },
      error: (error: HttpErrorResponse | Error) => {
        this.capabilitiesLoading = false;
        if (error instanceof Error && error.message === 'step_up_cancelled') {
          if (this.embedded && this.allowDismiss) {
            this.formClosed.emit();
          }
          return;
        }
        this.errorMessage = error instanceof HttpErrorResponse
          ? resolveAccountSecurityErrorMessage(error)
          : 'No se pudieron cargar las opciones de contraseña.';
      }
    });
    this.subscriptions.add(sub);
  }

  private fetchPasswordCapabilities(): Observable<PasswordCapabilitiesDto> {
    return this.accountSecurity.getAuthenticationMethods().pipe(
      switchMap(response => {
        const password = response.data.password;
        if (!password) {
          return throwError(() => new Error('password_capabilities_missing'));
        }
        if (password.canSet && password.requiresStepUp) {
          return this.ensurePasswordStepUp(password);
        }
        return of(password);
      }),
      tap(capabilities => this.applyPasswordCapabilities(capabilities))
    );
  }

  /** Step-up previo al formulario solo para establecer la primera contraseña (POST). */
  private ensurePasswordStepUp(password: PasswordCapabilitiesDto): Observable<PasswordCapabilitiesDto> {
    return this.stepUpService.requireStepUp('set_password', { force: true }).pipe(
      switchMap(() => this.accountSecurity.getAuthenticationMethods()),
      switchMap(response => {
        const refreshed = response.data.password;
        if (!refreshed) {
          return throwError(() => new Error('password_capabilities_missing'));
        }
        if (refreshed.requiresStepUp) {
          return throwError(() => new Error('recent_authentication_required'));
        }
        return of(refreshed);
      })
    );
  }

  private applyPasswordCapabilities(capabilities: PasswordCapabilitiesDto): void {
    this.passwordCapabilities = capabilities;
    this.requiresCurrentPassword = this.shouldRequireCurrentPassword(capabilities);

    const currentControl = this.changePasswordForm?.get('currentPassword');
    if (!currentControl) {
      return;
    }
    if (this.requiresCurrentPassword) {
      currentControl.setValidators([Validators.required]);
    } else {
      currentControl.clearValidators();
      currentControl.setValue('');
    }
    currentControl.updateValueAndValidity({ emitEvent: false });
  }

  /** En cambio de contraseña siempre se pide la actual; el step-up ocurre al enviar el formulario. */
  private shouldRequireCurrentPassword(capabilities: PasswordCapabilitiesDto): boolean {
    return capabilities.canChange;
  }

  passwordMatchValidator(form: FormGroup) {
    const newPassword = form.get('newPassword');
    const confirmNewPassword = form.get('confirmNewPassword');

    if (!newPassword || !confirmNewPassword) {
      return null;
    }

    if (newPassword.value !== confirmNewPassword.value) {
      confirmNewPassword.setErrors({ ...(confirmNewPassword.errors ?? {}), passwordMismatch: true });
      return { passwordMismatch: true };
    }

    if (confirmNewPassword.hasError('passwordMismatch')) {
      const errors = { ...confirmNewPassword.errors };
      delete errors['passwordMismatch'];
      const hasErrors = Object.keys(errors).length > 0;
      confirmNewPassword.setErrors(hasErrors ? errors : null);
    }

    return null;
  }

  private newPasswordDifferentValidator(form: FormGroup) {
    const currentPassword = form.get('currentPassword');
    const newPassword = form.get('newPassword');

    if (!newPassword) {
      return null;
    }

    const current = (currentPassword?.value ?? '').trim();
    const next = (newPassword.value ?? '').trim();

    if (current && next && current === next) {
      newPassword.setErrors({ ...(newPassword.errors ?? {}), sameAsCurrent: true });
      return { sameAsCurrent: true };
    }

    if (newPassword.hasError('sameAsCurrent')) {
      const errors = { ...newPassword.errors };
      delete errors['sameAsCurrent'];
      const hasErrors = Object.keys(errors).length > 0;
      newPassword.setErrors(hasErrors ? errors : null);
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
    if (!this.canSubmit) {
      markFormGroupTouched(this.changePasswordForm);
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    const values = this.changePasswordForm.value;

    const request$ = this.isChangePasswordMode
      ? this.accountSecurity
          .stepUpWithPassword({ password: values.currentPassword })
          .pipe(
            switchMap(() =>
              this.accountSecurity.updatePassword({
                newPassword: values.newPassword,
                currentPassword: values.currentPassword
              })
            )
          )
      : this.fetchPasswordCapabilities().pipe(
          switchMap(() => {
            if (!this.passwordCapabilities?.canSet) {
              return throwError(() => new Error('password_action_not_allowed'));
            }
            return this.accountSecurity.setPassword({ newPassword: values.newPassword });
          })
        );

    const sub = request$.subscribe({
      next: (response) => {
        this.isLoading = false;
        const otherSessionsRevoked =
          response.data?.otherSessionsRevoked ?? response.otherSessionsRevoked;
        const updatedMessage = otherSessionsRevoked
          ? 'Contraseña actualizada. Se cerraron otras sesiones por seguridad.'
          : 'Contraseña actualizada correctamente.';
        this.successMessage = this.isSetPasswordMode
          ? 'Contraseña configurada correctamente.'
          : updatedMessage;
        this.changePasswordForm.reset();
        this.passwordChanged.emit();

        if (!this.embedded) {
          setTimeout(() => this.router.navigate(['/dashboard']), 2000);
        } else if (this.allowDismiss) {
          this.formClosed.emit();
        } else {
          setTimeout(() => {
            this.successMessage = '';
          }, 5000);
        }
      },
      error: (error: HttpErrorResponse | Error) => {
        this.isLoading = false;
        if (error instanceof Error) {
          if (error.message === 'password_action_not_allowed') {
            this.errorMessage = 'No puedes modificar la contraseña en este momento.';
            return;
          }
          if (error.message === 'recent_authentication_required') {
            this.errorMessage = getAccountSecurityErrorMessage('recent_authentication_required');
            return;
          }
          if (error.message === 'step_up_token_missing') {
            this.errorMessage = 'No pudimos verificar tu identidad. Inténtalo de nuevo.';
            return;
          }
        }
        this.errorMessage = error instanceof HttpErrorResponse
          ? resolveAccountSecurityErrorMessage(error)
          : 'No pudimos completar la operación. Inténtalo más tarde.';
      }
    });

    this.subscriptions.add(sub);
  }

  onCancel() {
    if (!this.embedded) {
      this.router.navigate(['/dashboard']);
      return;
    }

    this.changePasswordForm.reset();
    this.errorMessage = '';
    this.successMessage = '';

    if (this.allowDismiss) {
      this.formClosed.emit();
    }
  }
}
