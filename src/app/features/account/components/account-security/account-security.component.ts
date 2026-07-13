import { Component, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Subscription, EMPTY } from 'rxjs';
import { switchMap, tap } from 'rxjs/operators';
import { AccountSecurityService } from '../../../../core/services/account-security.service';
import { StepUpService, UNLINK_PASSWORD_REQUIRED_MESSAGE } from '../../../../core/services/step-up.service';
import { OAuthFlowStateService } from '../../../../core/services/oauth-flow-state.service';
import { AuthenticationMethodDto, PasswordCapabilitiesDto } from '../../../../core/models/account-security.model';
import { ExternalAuthProvider } from '../../../../core/models/auth.model';
import { extractApiErrorCode } from '../../../../shared/utils/error.utils';
import { getAccountSecurityErrorMessage } from '../../../../shared/utils/account-security.errors';
import { getProviderDisplayName, isExternalAuthProvider } from '../../../../shared/utils/external-auth.utils';
import { ChangePasswordComponent } from '../../../auth/components/change-password/change-password.component';
import { ConnectedSessionsComponent } from '../connected-sessions/connected-sessions.component';
import { EmailChangeComponent } from '../email-change/email-change.component';
import { LinkReviewComponent } from '../link-review/link-review.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { SecurityToastComponent } from '../security-toast/security-toast.component';
import { SecurityToastService } from '../../services/security-toast.service';

function resolveQueryParamRoute(route: ActivatedRoute): ActivatedRoute {
  let current: ActivatedRoute | null = route;
  while (current) {
    if (Object.keys(current.snapshot.queryParams).length > 0) {
      return current;
    }
    current = current.parent;
  }
  return route;
}

@Component({
  selector: 'app-account-security',
  standalone: true,
  imports: [
    CommonModule,
    ChangePasswordComponent,
    ConnectedSessionsComponent,
    EmailChangeComponent,
    LinkReviewComponent,
    ModalComponent,
    SecurityToastComponent
  ],
  templateUrl: './account-security.component.html',
  styleUrl: './account-security.component.scss'
})
export class AccountSecurityComponent implements OnInit, OnDestroy {
  @Input() embedded = false;

  methods: AuthenticationMethodDto[] = [];
  hasLocalPassword = false;
  passwordCapabilities: PasswordCapabilitiesDto | null = null;
  requiresStepUp = false;
  loading = true;
  actionLoading: string | null = null;
  passwordModalOpen = false;
  passwordLastUpdated: string | null = null;
  linkReviewModalOpen = false;
  securityErrorModalOpen = false;
  securityErrorModalTitle = '';
  securityErrorModalMessage = '';
  securityErrorModalProvider: ExternalAuthProvider | null = null;
  securityErrorModalProviderEmail: string | null = null;
  passwordModalDirty = false;

  @ViewChild('linkReviewModal') linkReviewModal?: LinkReviewComponent;

  private subscriptions = new Subscription();

  constructor(
    private accountSecurity: AccountSecurityService,
    private stepUpService: StepUpService,
    private flowState: OAuthFlowStateService,
    private route: ActivatedRoute,
    private router: Router,
    private securityToast: SecurityToastService
  ) {}

  ngOnInit(): void {
    this.loadMethods();
    this.openPendingSecurityErrorModal();
    const queryRoute = resolveQueryParamRoute(this.route);
    const sub = queryRoute.queryParams.subscribe(params => {
      if (params['linked'] === '1') {
        this.securityToast.showSuccess('Proveedor vinculado correctamente.');
        this.linkReviewModalOpen = false;
      }
      if (params['linkReview'] === '1') {
        this.openLinkReviewModal();
      }
    });
    this.subscriptions.add(sub);

    if (queryRoute.snapshot.queryParamMap.get('linkReview') === '1') {
      this.openLinkReviewModal();
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  get passwordMethod(): AuthenticationMethodDto | undefined {
    return this.methods.find(method => method.type === 'local');
  }

  get oauthMethods(): AuthenticationMethodDto[] {
    return this.methods.filter(method => method.type !== 'local');
  }

  loadMethods(): void {
    this.loading = true;
    const sub = this.accountSecurity.getAuthenticationMethods().subscribe({
      next: (res) => {
        this.methods = res.data.methods;
        this.hasLocalPassword = res.data.hasLocalPassword;
        this.passwordCapabilities = res.data.password ?? null;
        this.requiresStepUp = res.data.requiresStepUp;
        this.stepUpService.setAuthMethodsSnapshot(res.data);
        this.passwordLastUpdated = this.passwordMethod?.lastUpdatedAt ?? this.passwordLastUpdated;
        this.loading = false;
      },
      error: (error: HttpErrorResponse) => {
        this.loading = false;
        this.securityToast.showError(getAccountSecurityErrorMessage(extractApiErrorCode(error)));
      }
    });
    this.subscriptions.add(sub);
  }

  methodLabel(method: AuthenticationMethodDto): string {
    switch (method.type) {
      case 'local':
        return 'Contraseña';
      case 'google':
        return 'Google';
      case 'microsoft':
        return 'Microsoft';
      default:
        return method.type;
    }
  }

  formatLastUpdated(value: string | null | undefined): string | null {
    if (!value) {
      return null;
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return null;
    }
    return new Intl.DateTimeFormat('es', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(date);
  }

  get passwordLastUpdatedLabel(): string | null {
    return this.formatLastUpdated(this.passwordLastUpdated ?? this.passwordMethod?.lastUpdatedAt);
  }

  openPasswordModal(): void {
    this.passwordModalDirty = false;
    this.passwordModalOpen = true;
    this.securityToast.clear();
  }

  closePasswordModal(): void {
    this.passwordModalOpen = false;
    this.passwordModalDirty = false;
  }

  onPasswordFormDirtyChange(dirty: boolean): void {
    this.passwordModalDirty = dirty;
  }

  asOAuthProvider(method: AuthenticationMethodDto): ExternalAuthProvider {
    return method.type as ExternalAuthProvider;
  }

  linkProvider(provider: ExternalAuthProvider): void {
    const op = provider === 'google' ? 'link_google' : 'link_microsoft';
    this.runWithStepUp(op, () =>
      this.accountSecurity.startOAuthLink(provider).pipe(
        tap(res => {
          this.flowState.setPendingOperation('link_complete');
          this.accountSecurity.redirectToAuthorizationUrl(res);
        }),
        switchMap(() => EMPTY)
      )
    );
  }

  unlinkProvider(provider: ExternalAuthProvider): void {
    if (!this.hasLocalPassword && !this.passwordCapabilities?.configured) {
      this.securityToast.showError(UNLINK_PASSWORD_REQUIRED_MESSAGE);
      return;
    }

    const op = provider === 'google' ? 'unlink_google' : 'unlink_microsoft';
    this.runWithStepUp(op, () =>
      this.accountSecurity.unlinkProvider(provider).pipe(
        tap(() => {
          this.securityToast.showSuccess('Proveedor desvinculado.');
          this.loadMethods();
        })
      )
    );
  }

  onPasswordChanged(): void {
    const wasConfigured = this.passwordCapabilities?.configured ?? this.hasLocalPassword;
    this.passwordLastUpdated = new Date().toISOString();
    this.securityToast.showSuccess(
      wasConfigured
        ? 'Contraseña actualizada correctamente.'
        : 'Contraseña configurada correctamente.'
    );
    this.passwordModalOpen = false;
    this.loadMethods();
  }

  onLinkReviewCompleted(): void {
    this.linkReviewModalOpen = false;
    this.securityToast.showSuccess('Proveedor vinculado correctamente.');
    this.loadMethods();
  }

  onLinkReviewCancelled(): void {
    this.linkReviewModalOpen = false;
    this.securityToast.clear();
  }

  closeLinkReviewModal(): void {
    this.linkReviewModalOpen = false;
  }

  onLinkReviewModalDismiss(): void {
    if (this.linkReviewModalOpen && this.linkReviewModal) {
      this.linkReviewModal.cancel();
      return;
    }
    this.closeLinkReviewModal();
  }

  closeSecurityErrorModal(): void {
    this.securityErrorModalOpen = false;
    this.securityErrorModalTitle = '';
    this.securityErrorModalMessage = '';
    this.securityErrorModalProvider = null;
    this.securityErrorModalProviderEmail = null;
  }

  securityErrorProviderLabel(): string {
    return getProviderDisplayName(this.securityErrorModalProvider);
  }

  private openPendingSecurityErrorModal(): void {
    const pendingError = this.flowState.consumePendingSecurityError();
    if (!pendingError) {
      return;
    }
    this.securityErrorModalTitle = pendingError.title;
    this.securityErrorModalMessage = pendingError.message;
    this.securityErrorModalProvider = isExternalAuthProvider(pendingError.provider)
      ? pendingError.provider
      : null;
    this.securityErrorModalProviderEmail = pendingError.providerEmail?.trim() || null;
    this.securityErrorModalOpen = true;
    this.linkReviewModalOpen = false;
    this.securityToast.clear();
  }

  private openLinkReviewModal(): void {
    if (this.flowState.pendingLinkToken) {
      this.linkReviewModalOpen = true;
    }
    this.clearLinkReviewQueryParam();
  }

  private clearLinkReviewQueryParam(): void {
    const queryRoute = resolveQueryParamRoute(this.route);
    if (queryRoute.snapshot.queryParamMap.get('linkReview') !== '1') {
      return;
    }
    this.router.navigate([], {
      relativeTo: queryRoute,
      queryParams: { linkReview: null },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  private publishAuthMethodsSnapshot(): void {
    if (this.methods.length === 0 && !this.hasLocalPassword) {
      return;
    }
    this.stepUpService.setAuthMethodsSnapshot({
      methods: this.methods,
      hasLocalPassword: this.hasLocalPassword,
      requiresStepUp: this.requiresStepUp,
      password: this.passwordCapabilities ?? undefined
    });
  }

  private runWithStepUp(
    operation: Parameters<OAuthFlowStateService['setPendingOperation']>[0],
    action: () => import('rxjs').Observable<unknown>
  ): void {
    if (this.actionLoading) {
      return;
    }
    this.securityToast.clear();
    this.publishAuthMethodsSnapshot();
    this.flowState.setPendingOperation(operation);
    const sub = this.stepUpService.requireStepUp(operation ?? undefined, { force: true }).subscribe({
      next: () => {
        this.actionLoading = operation ?? 'action';
        const actionSub = action().subscribe({
          next: () => {
            this.actionLoading = null;
          },
          error: (error: HttpErrorResponse) => {
            this.actionLoading = null;
            this.securityToast.showError(getAccountSecurityErrorMessage(extractApiErrorCode(error)));
          }
        });
        this.subscriptions.add(actionSub);
      },
      error: () => {
        this.actionLoading = null;
      }
    });
    this.subscriptions.add(sub);
  }
}
