import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { AccountSecurityService } from '../../../core/services/account-security.service';
import { OAuthFlowStateService } from '../../../core/services/oauth-flow-state.service';
import { StepUpService } from '../../../core/services/step-up.service';
import { OAuthFlowResolveResponse } from '../../../core/models/account-security.model';
import { ExternalAuthProvider } from '../../../core/models/auth.model';
import {
  getExchangeErrorMessage,
  getExternalAuthErrorMessage,
  getProviderDisplayName,
  parseOAuthCallbackQuery
} from '../../../shared/utils/external-auth.utils';
import {
  getAccountSecurityErrorMessage,
  LinkSecurityErrorPresentation,
  resolveFlowResolveHttpError,
  resolveOAuthLinkFlowError
} from '../../../shared/utils/account-security.errors';
import { navigateToAccountSecurity } from '../../../shared/utils/account-security.navigation';
import { extractApiErrorCode } from '../../../shared/utils/error.utils';

/**
 * Página receptora del redirect post-OAuth del backend.
 * V1: ?exchangeCode=...
 * V2: ?flowCode=... → POST flow/resolve
 */
@Component({
  selector: 'app-auth-callback',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './auth-callback.component.html',
  styleUrl: './auth-callback.component.scss'
})
export class AuthCallbackComponent implements OnInit, OnDestroy {
  processing = true;
  errorMessage = '';
  providerName = '';
  isAccountFlow = false;

  private subscriptions = new Subscription();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService,
    private accountSecurity: AccountSecurityService,
    private flowState: OAuthFlowStateService,
    private stepUpService: StepUpService
  ) {}

  ngOnInit(): void {
    const oauth = parseOAuthCallbackQuery(this.route.snapshot.queryParamMap);
    this.isAccountFlow = !!oauth.flowCode;

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {},
      replaceUrl: true
    });

    this.providerName = getProviderDisplayName(oauth.provider);

    if (oauth.exchangeCode) {
      this.exchange(oauth.exchangeCode);
      return;
    }

    if (oauth.flowCode) {
      if (this.authService.isAuthenticated()) {
        this.resolveFlow(oauth.flowCode);
      } else {
        this.startV21LinkChallenge(oauth.flowCode);
      }
      return;
    }

    if (oauth.error) {
      const message = getExternalAuthErrorMessage(
        oauth.error,
        oauth.provider,
        oauth.existingProvider
      );
      if (this.authService.isAuthenticated()) {
        this.redirectAccountFlowError(message);
        return;
      }
      this.finishWithError(message);
      return;
    }

    this.finishWithError('No pudimos completar el inicio de sesión. Inténtalo más tarde.');
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  get isAuthenticated(): boolean {
    return this.authService.isAuthenticated();
  }

  private exchange(exchangeCode: string): void {
    const sub = this.authService.exchangeExternalAuth(exchangeCode).subscribe({
      next: (response) => {
        this.authService.handleAuthSuccess(response, { source: 'oauth' });
      },
      error: (error: HttpErrorResponse) => {
        const code =
          typeof error.error?.detail === 'string'
            ? error.error.detail
            : typeof error.error?.message === 'string'
              ? error.error.message
              : null;
        this.finishWithError(getExchangeErrorMessage(code));
      }
    });
    this.subscriptions.add(sub);
  }

  private resolveFlow(flowCode: string): void {
    const sub = this.accountSecurity.resolveOAuthFlow(flowCode).subscribe({
      next: (response) => this.handleFlowResponse(response, flowCode),
      error: (error: HttpErrorResponse) => {
        this.redirectAccountFlowError(
          resolveFlowResolveHttpError(error, this.inferPendingLinkProvider())
        );
      }
    });
    this.subscriptions.add(sub);
  }

  private handleFlowResponse(response: OAuthFlowResolveResponse, flowCode: string): void {
    switch (response.flow) {
      case 'step_up_completed':
        if (response.data?.token) {
          this.authService.replaceTokenFromAuthData({ token: response.data.token });
        }
        this.stepUpService.onStepUpCompletedFromCallback();
        this.continuePendingOperation();
        break;

      case 'link_pending_review':
        if (response.data?.pendingLinkToken) {
          this.flowState.setPendingLinkReview(
            response.data.pendingLinkToken,
            response.data.provider,
            response.data.providerEmail,
            response.data.accountEmail
          );
          this.flowState.setPendingOperation('link_complete');
        }
        this.processing = false;
        navigateToAccountSecurity(this.router, { linkReview: true });
        break;

      case 'link_completed':
        this.flowState.clearLinkReview();
        this.flowState.setPendingOperation(null);
        this.processing = false;
        navigateToAccountSecurity(this.router, { linked: true });
        break;

      case 'link_challenge':
        this.redirectAccountFlowError(
          'No pudimos continuar la vinculación. Cierra sesión e inicia con el proveedor que quieres vincular.'
        );
        break;

      case 'error':
        this.redirectAccountFlowError(
          resolveOAuthLinkFlowError(
            response.code ?? response.message,
            {
              provider: response.data?.provider ?? this.inferPendingLinkProvider(),
              providerEmail: response.data?.providerEmail,
              accountEmail: response.data?.accountEmail
            },
            response.message
          )
        );
        break;

      default:
        this.redirectAccountFlowError('No pudimos completar la operación. Inténtalo más tarde.');
    }
  }

  private startV21LinkChallenge(flowCode: string): void {
    const sub = this.accountSecurity.getLinkContext({ flowCode }).subscribe({
      next: (context) => {
        this.flowState.setLinkChallenge(flowCode, context.data.challengeToken, {
          provider: context.data.provider,
          maskedEmail: context.data.maskedEmail,
          verificationMethods: context.data.verificationMethods,
          existingAuthMethod: context.data.existingAuthMethod
        });
        this.processing = false;
        this.router.navigate(['/account/security/link-challenge']);
      },
      error: (error: HttpErrorResponse) => {
        this.finishWithError(getAccountSecurityErrorMessage(extractApiErrorCode(error)));
      }
    });
    this.subscriptions.add(sub);
  }

  private continuePendingOperation(): void {
    const op = this.flowState.pendingOperation;
    this.processing = false;

    if (!op) {
      if (this.authService.isAuthenticated()) {
        navigateToAccountSecurity(this.router);
      } else {
        this.router.navigate(['/login']);
      }
      return;
    }

    switch (op) {
      case 'link_complete':
        navigateToAccountSecurity(this.router, { linkReview: true });
        break;
      case 'change_password':
      case 'set_password':
      case 'unlink_google':
      case 'unlink_microsoft':
      case 'link_google':
      case 'link_microsoft':
      case 'revoke_other_sessions':
      case 'revoke_all_sessions':
      case 'email_change':
        navigateToAccountSecurity(this.router);
        break;
      default:
        this.router.navigate(['/dashboard']);
    }
  }

  private redirectAccountFlowError(error: string | LinkSecurityErrorPresentation): void {
    this.flowState.setPendingSecurityError(error);
    this.flowState.clearLinkReview();
    this.flowState.setPendingOperation(null);
    this.processing = false;
    navigateToAccountSecurity(this.router);
  }

  private inferPendingLinkProvider(): ExternalAuthProvider | null {
    switch (this.flowState.pendingOperation) {
      case 'link_google':
        return 'google';
      case 'link_microsoft':
        return 'microsoft';
      default:
        return this.flowState.pendingLinkProvider;
    }
  }

  private finishWithError(message: string): void {
    this.processing = false;
    this.errorMessage = message;
  }
}
