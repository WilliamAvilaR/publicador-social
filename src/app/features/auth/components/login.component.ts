import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { take } from 'rxjs/operators';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../../core/services/auth.service';
import { LoginRequest } from '../../../core/models/auth.model';
import { markFormGroupTouched, isFieldInvalid } from '../../../shared/utils/form.utils';
import { extractErrorMessage, extractApiErrorCode } from '../../../shared/utils/error.utils';
import { getFieldError } from '../../../shared/utils/validation.utils';
import { getRetryAfterSeconds } from '../../../shared/utils/rate-limit.utils';
import { sanitizeReturnPath } from '../../../shared/utils/external-auth.utils';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent implements OnInit, OnDestroy {
  loginForm: FormGroup;
  showPassword = false;
  showSuccessMessage = false;
  showResendHint = false;
  showOAuthOnlyHint = false;
  isLoading = false;
  socialLoadingProvider: 'google' | 'microsoft' | null = null;
  errorMessage = '';
  private subscriptions = new Subscription();

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router
  ) {
    // Inicializar el formulario en el constructor para evitar errores de undefined
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]]
    });
  }

  ngOnInit() {
    // Si el usuario ya está autenticado, redirigir según su estado de onboarding
    if (this.authService.isAuthenticated()) {
      if (this.authService.requiresTenantSetup()) {
        this.router.navigate(['/onboarding']);
      } else {
        this.router.navigate(['/dashboard']);
      }
      return;
    }

    this.route.queryParams.pipe(take(1)).subscribe(params => {
      if (params['verified'] === '1') {
        this.showSuccessMessage = true;
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: {},
          replaceUrl: true
        });
      }
    });
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  initForm() {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]]
    });
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  closeSuccessMessage() {
    this.showSuccessMessage = false;
  }

  loginWithGoogle(): void {
    this.startExternalAuth('google');
  }

  loginWithMicrosoft(): void {
    this.startExternalAuth('microsoft');
  }

  private startExternalAuth(provider: 'google' | 'microsoft'): void {
    if (this.isLoading || this.socialLoadingProvider) {
      return;
    }

    this.errorMessage = '';
    this.socialLoadingProvider = provider;

    const sub = this.authService.redirectToExternalAuth(provider).subscribe({
        error: (error: HttpErrorResponse | Error) => {
          this.socialLoadingProvider = null;
          if (error instanceof Error && error.message === 'authorization_url_missing') {
            this.errorMessage =
              'No se recibió una URL de autorización válida. Inténtalo nuevamente.';
            return;
          }
          const httpError = error as HttpErrorResponse;
          if (httpError.status === 429) {
            const seconds = getRetryAfterSeconds(httpError);
            this.errorMessage = `Demasiados intentos. Vuelve a intentarlo en ${seconds} segundos.`;
            return;
          }
          this.errorMessage = extractErrorMessage(
            httpError,
            'No se pudo iniciar el flujo con el proveedor. Inténtalo nuevamente.'
          );
        }
      });
    this.subscriptions.add(sub);
  }

  goToResendVerification(): void {
    const email = this.loginForm.value.email?.trim();
    if (email) {
      this.router.navigate(['/register/check-email'], { queryParams: { email } });
      return;
    }
    this.router.navigate(['/register']);
  }

  onSubmit() {
    if (this.loginForm.invalid) {
      markFormGroupTouched(this.loginForm);
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.showResendHint = false;

    const credentials: LoginRequest = {
      email: this.loginForm.value.email,
      password: this.loginForm.value.password
    };

    const loginSubscription = this.authService.login(credentials).subscribe({
      next: (response) => {
        this.isLoading = false;

        // Guarda el JWT y navega a /onboarding o returnUrl/dashboard
        // según requiresTenantSetup (o el claim setupStatus del token).
        this.authService.handleAuthSuccess(response, {
          returnUrl: this.getSafeReturnUrl(),
          source: 'password'
        });

        // Obtener perfil completo del servidor para tener todos los datos (incluyendo avatarUrl)
        const profileSubscription = this.authService.getProfile().subscribe({
          next: (profileResponse) => {
            // Actualizar datos del usuario con el perfil completo
            this.authService.updateUserData(profileResponse.data);
          },
          error: (error) => {
            // Si falla obtener el perfil, continuar con los datos básicos del login
            console.warn('No se pudo obtener el perfil completo después del login:', error);
          }
        });
        this.subscriptions.add(profileSubscription);
      },
      error: (error: HttpErrorResponse) => {
        this.isLoading = false;
        const code = extractApiErrorCode(error);

        if (code === 'email_not_verified') {
          this.errorMessage = 'Debes verificar tu correo electrónico antes de iniciar sesión.';
          this.showResendHint = true;
          return;
        }
        if (code === 'password_login_not_available') {
          this.showOAuthOnlyHint = true;
          this.errorMessage = '';
          return;
        }
        if (code === 'tenant_setup_required') {
          this.router.navigate(['/onboarding'], { queryParams: { source: 'password' } });
          return;
        }
        this.errorMessage = extractErrorMessage(
          error,
          'Error al iniciar sesión. Por favor, intenta nuevamente.'
        );
      }
    });

    this.subscriptions.add(loginSubscription);
  }

  getFieldError(fieldName: string): string {
    if (!this.loginForm) {
      return '';
    }
    return getFieldError(this.loginForm, fieldName);
  }

  isFieldInvalid(fieldName: string): boolean {
    if (!this.loginForm) {
      return false;
    }
    return isFieldInvalid(this.loginForm, fieldName);
  }

  private getSafeReturnUrl(): string {
    const raw = this.route.snapshot.queryParams['returnUrl'];
    if (typeof raw === 'string') {
      const sanitized = sanitizeReturnPath(raw);
      if (sanitized) {
        return sanitized;
      }
    }

    return '/dashboard';
  }
}
