import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { AccountSecurityService } from '../../../../core/services/account-security.service';
import { StepUpService } from '../../../../core/services/step-up.service';
import { OAuthFlowStateService } from '../../../../core/services/oauth-flow-state.service';
import { ExternalAuthProvider } from '../../../../core/models/auth.model';
import { resolveAccountSecurityErrorMessage } from '../../../../shared/utils/account-security.errors';
import { markFormGroupTouched } from '../../../../shared/utils/form.utils';

@Component({
  selector: 'app-step-up',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './step-up.component.html',
  styleUrl: './step-up.component.scss'
})
export class StepUpComponent implements OnInit, OnDestroy {
  form!: FormGroup;
  submitting = false;
  oauthLoading: ExternalAuthProvider | null = null;
  showPassword = false;

  private subscriptions = new Subscription();

  constructor(
    private fb: FormBuilder,
    private accountSecurity: AccountSecurityService,
    readonly stepUpService: StepUpService,
    private flowState: OAuthFlowStateService
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      password: ['', [Validators.required]]
    });

    const openSub = this.stepUpService.showModal$.subscribe(open => {
      if (!open) {
        this.form.reset();
        this.submitting = false;
        this.oauthLoading = null;
        this.showPassword = false;
        return;
      }
      this.refreshMethods();
    });
    this.subscriptions.add(openSub);

    if (this.stepUpService.isModalOpen()) {
      this.refreshMethods();
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  refreshMethods(): void {
    const snapshot = this.stepUpService.getAuthMethodsSnapshot();
    if (snapshot) {
      this.stepUpService.syncModalUiFromSnapshot(snapshot, true);
    } else {
      this.stepUpService.setModalLoading();
    }

    const sub = this.accountSecurity.getAuthenticationMethods().subscribe({
      next: (response) => {
        this.stepUpService.applyAuthenticationMethodsResponse(response);
      },
      error: (error: HttpErrorResponse) => {
        const cached = this.stepUpService.getAuthMethodsSnapshot();
        if (cached) {
          this.stepUpService.syncModalUiFromSnapshot(cached, false);
          return;
        }
        this.stepUpService.setModalError(
          resolveAccountSecurityErrorMessage(
            error,
            'No se pudieron cargar los métodos de verificación.'
          )
        );
      }
    });
    this.subscriptions.add(sub);
  }

  onSubmitPassword(): void {
    if (this.form.invalid) {
      markFormGroupTouched(this.form);
      return;
    }

    this.submitting = true;
    const sub = this.accountSecurity.stepUpWithPassword({ password: this.form.value.password }).subscribe({
      next: () => {
        this.submitting = false;
        this.stepUpService.notifySuccess();
      },
      error: (error: HttpErrorResponse) => {
        this.submitting = false;
        this.stepUpService.setModalError(
          resolveAccountSecurityErrorMessage(error, 'No se pudo verificar tu contraseña.')
        );
      }
    });
    this.subscriptions.add(sub);
  }

  startOAuthStepUp(provider: ExternalAuthProvider): void {
    if (this.oauthLoading || StepUpService.isUnlinkOperation(this.flowState.pendingOperation)) {
      return;
    }
    this.oauthLoading = provider;
    const sub = this.accountSecurity.startOAuthStepUp(provider).subscribe({
      next: (res) => {
        this.flowState.setPendingOperation(this.flowState.pendingOperation ?? 'change_password');
        this.accountSecurity.redirectToAuthorizationUrl(res);
      },
      error: (error: HttpErrorResponse) => {
        this.oauthLoading = null;
        this.stepUpService.setModalError(resolveAccountSecurityErrorMessage(error));
      }
    });
    this.subscriptions.add(sub);
  }

  onCancel(): void {
    this.stepUpService.notifyFailure();
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  get isLinkStepUp(): boolean {
    const op = this.flowState.pendingOperation;
    return op === 'link_google' || op === 'link_microsoft';
  }

  get linkTargetProvider(): ExternalAuthProvider | null {
    const op = this.flowState.pendingOperation;
    if (op === 'link_google') {
      return 'google';
    }
    if (op === 'link_microsoft') {
      return 'microsoft';
    }
    return null;
  }

  onBackdropClick(event: MouseEvent): void {
    if (!this.allowBackdropClose) {
      return;
    }
    if ((event.target as HTMLElement).classList.contains('step-up-overlay')) {
      this.onCancel();
    }
  }

  get allowBackdropClose(): boolean {
    const password = (this.form?.get('password')?.value ?? '').trim();
    return !password && !this.submitting && !this.oauthLoading;
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscapeKey(event: KeyboardEvent): void {
    if (!this.stepUpService.isModalOpen()) {
      return;
    }
    event.preventDefault();
    this.onCancel();
  }

  providerLabel(provider: ExternalAuthProvider): string {
    return provider === 'google' ? 'Google' : 'Microsoft';
  }

  get passwordOnlySubtitle(): string {
    if (this.flowState.pendingOperation === 'email_change') {
      return 'Por seguridad, introduce tu contraseña antes de solicitar el cambio de correo.';
    }
    return 'Confirma tu contraseña para desvincular el proveedor.';
  }
}
