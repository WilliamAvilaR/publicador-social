import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { AccountSecurityService } from '../../../../core/services/account-security.service';
import { OAuthFlowStateService } from '../../../../core/services/oauth-flow-state.service';
import { extractApiErrorCode } from '../../../../shared/utils/error.utils';
import { getAccountSecurityErrorMessage } from '../../../../shared/utils/account-security.errors';
import { navigateToAccountSecurity } from '../../../../shared/utils/account-security.navigation';
import { getProviderDisplayName, isExternalAuthProvider } from '../../../../shared/utils/external-auth.utils';
import { ExternalAuthProvider } from '../../../../core/models/auth.model';

@Component({
  selector: 'app-link-review',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './link-review.component.html',
  styleUrl: './link-review.component.scss'
})
export class LinkReviewComponent implements OnInit, OnDestroy {
  @Input() embedded = false;
  @Input() panelLayout = false;
  @Output() reviewCompleted = new EventEmitter<void>();
  @Output() reviewCancelled = new EventEmitter<void>();

  providerEmail = '';
  accountEmail = '';
  providerName = '';
  pendingLinkProvider: ExternalAuthProvider | null = null;
  hasPendingLink = false;
  loading = false;
  errorMessage = '';
  successMessage = '';

  private subscriptions = new Subscription();

  constructor(
    private accountSecurity: AccountSecurityService,
    private flowState: OAuthFlowStateService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.providerEmail = this.flowState.linkReviewProviderEmail ?? '';
    this.accountEmail = this.flowState.linkReviewAccountEmail ?? '';
    this.providerName = this.flowState.pendingLinkProvider
      ? getProviderDisplayName(this.flowState.pendingLinkProvider)
      : '';
    this.pendingLinkProvider = isExternalAuthProvider(this.flowState.pendingLinkProvider)
      ? this.flowState.pendingLinkProvider
      : null;
    this.hasPendingLink = !!this.flowState.pendingLinkToken;
    if (!this.hasPendingLink) {
      this.errorMessage = 'No hay una vinculación pendiente. Inicia el proceso desde Seguridad.';
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  get emailsAreDifferent(): boolean {
    const provider = this.providerEmail.trim().toLowerCase();
    const account = this.accountEmail.trim().toLowerCase();
    return !!provider && !!account && provider !== account;
  }

  get providerCardTitle(): string {
    return this.providerName
      ? `Cuenta de ${this.providerName} seleccionada`
      : 'Cuenta del proveedor seleccionada';
  }

  get confirmButtonLabel(): string {
    if (this.loading) {
      return 'Vinculando...';
    }
    return this.providerName
      ? `Vincular cuenta de ${this.providerName}`
      : 'Vincular cuenta';
  }

  confirm(): void {
    const token = this.flowState.pendingLinkToken;
    if (!token) {
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    const sub = this.accountSecurity.completeOAuthLink({ pendingLinkToken: token }).subscribe({
      next: () => {
        this.loading = false;
        this.successMessage = 'Proveedor vinculado correctamente.';
        this.flowState.clearLinkReview();
        this.flowState.setPendingOperation(null);
        if (this.embedded) {
          this.reviewCompleted.emit();
        } else {
          navigateToAccountSecurity(this.router, { linked: true });
        }
      },
      error: (error: HttpErrorResponse) => {
        this.loading = false;
        this.errorMessage = getAccountSecurityErrorMessage(extractApiErrorCode(error));
      }
    });
    this.subscriptions.add(sub);
  }

  cancel(): void {
    const token = this.flowState.pendingLinkToken;
    if (!token) {
      this.flowState.clearLinkReview();
      this.finishCancel();
      return;
    }

    const sub = this.accountSecurity.cancelOAuthLink({ pendingLinkToken: token }).subscribe({
      next: () => {
        this.flowState.clearLinkReview();
        this.flowState.setPendingOperation(null);
        this.finishCancel();
      },
      error: () => {
        this.flowState.clearLinkReview();
        this.flowState.setPendingOperation(null);
        this.finishCancel();
      }
    });
    this.subscriptions.add(sub);
  }

  private finishCancel(): void {
    if (this.embedded) {
      this.reviewCancelled.emit();
    } else {
      navigateToAccountSecurity(this.router);
    }
  }
}
