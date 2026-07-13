import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { TenantReauthService } from '../../../core/services/tenant-reauth.service';
import { CompleteRegistrationResponse } from '../../../core/models/auth.model';
import { markFormGroupTouched, isFieldInvalid } from '../../../shared/utils/form.utils';
import { getFieldError } from '../../../shared/utils/validation.utils';
import { extractErrorMessage } from '../../../shared/utils/error.utils';
import { getRetryAfterSeconds } from '../../../shared/utils/rate-limit.utils';

type OnboardingSource = 'oauth' | 'password';

/**
 * Pantalla única de onboarding de workspace (nombre de organización).
 * Reutilizada por ambos orígenes; solo cambia el endpoint:
 * - OAuth nuevo:            POST /api/auth/external/complete-registration
 * - Registro password:      POST /api/account/complete-workspace-setup
 */
@Component({
  selector: 'app-onboarding',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './onboarding.component.html',
  styleUrl: './onboarding.component.scss'
})
export class OnboardingComponent implements OnInit, OnDestroy {
  form!: FormGroup;
  submitting = false;
  errorMessage = '';
  userEmail = '';
  userName = '';

  private source: OnboardingSource = 'oauth';
  private subscriptions = new Subscription();

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService,
    private tenantReauth: TenantReauthService
  ) {}

  ngOnInit(): void {
    this.source = this.route.snapshot.queryParamMap.get('source') === 'password'
      ? 'password'
      : 'oauth';

    this.form = this.fb.group({
      tenantName: ['', [Validators.required, Validators.maxLength(200)]]
    });

    const user = this.authService.getUser();
    this.userEmail = user?.email ?? '';
    this.userName = user?.fullName ?? '';

    // GET /api/me está permitido con JWT restringido; refresca nombre/email.
    const sub = this.authService.getProfile().subscribe({
      next: (response) => {
        this.userEmail = response.data.email;
        this.userName = response.data.fullName;
      },
      error: () => {
        // Mantener datos locales si /api/me falla; no bloquear el onboarding.
      }
    });
    this.subscriptions.add(sub);
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  isFieldInvalid(fieldName: string): boolean {
    return isFieldInvalid(this.form, fieldName);
  }

  getFieldError(fieldName: string): string {
    return getFieldError(this.form, fieldName);
  }

  onSubmit(): void {
    if (this.form.invalid) {
      markFormGroupTouched(this.form);
      return;
    }

    const tenantName = (this.form.value.tenantName as string).trim();
    if (!tenantName) {
      this.form.get('tenantName')?.setErrors({ required: true });
      markFormGroupTouched(this.form);
      return;
    }

    this.submitting = true;
    this.errorMessage = '';

    const request$ = this.source === 'password'
      ? this.authService.completeWorkspaceSetup(tenantName)
      : this.authService.completeExternalRegistration(tenantName);

    const sub = request$.subscribe({
      next: (response: CompleteRegistrationResponse) => {
        // Reemplazar el JWT restringido por el completo (con claims de tenant)
        this.authService.setAuthData(response.data.token, response.data);
        this.authService.clearTenantSetupRequired();

        this.tenantReauth.rehydrateTenantsAfterNewSession().subscribe({
          next: () => this.router.navigate(['/dashboard']),
          error: () => this.router.navigate(['/dashboard'])
        });
      },
      error: (error: HttpErrorResponse) => {
        this.submitting = false;
        this.errorMessage = this.mapError(error);

        // Si el backend indica que ya no aplica el onboarding, salir al dashboard
        const code = this.getErrorCode(error);
        if (code === 'tenant_setup_not_required' || code === 'tenant_already_exists') {
          this.authService.clearTenantSetupRequired();
          this.router.navigate(['/dashboard']);
        }
      }
    });

    this.subscriptions.add(sub);
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  private getErrorCode(error: HttpErrorResponse): string | null {
    const detail = error.error?.detail ?? error.error?.message;
    return typeof detail === 'string' ? detail : null;
  }

  private mapError(error: HttpErrorResponse): string {
    if (error.status === 429) {
      const seconds = getRetryAfterSeconds(error);
      return `Demasiados intentos. Vuelve a intentarlo en ${seconds} segundos.`;
    }

    switch (this.getErrorCode(error)) {
      case 'invalid_tenant_name':
        return 'El nombre de la organización no es válido. Escríbelo e inténtalo de nuevo.';
      case 'tenant_setup_not_required':
        return 'Tu cuenta ya no necesita completar este paso.';
      case 'tenant_already_exists':
        return 'Ya tienes una organización creada.';
      case 'tenant_setup_not_allowed':
        return 'No es posible crear la organización en este momento. Contacta al administrador.';
      default:
        return extractErrorMessage(
          error,
          'No se pudo crear la organización. Inténtalo nuevamente.'
        );
    }
  }
}
