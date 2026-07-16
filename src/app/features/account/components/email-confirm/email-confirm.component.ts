import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { take } from 'rxjs/operators';
import { AccountSecurityService } from '../../../../core/services/account-security.service';
import { AuthService } from '../../../../core/services/auth.service';
import { EmailConfirmPreview, EmailConfirmPreviewStatus } from '../../../../core/models/account-security.model';
import { extractApiErrorCode } from '../../../../shared/utils/error.utils';
import {
  getAccountSecurityErrorMessage,
  normalizeAccountSecurityErrorCode
} from '../../../../shared/utils/account-security.errors';
import { navigateToAccountSecurity } from '../../../../shared/utils/account-security.navigation';

type EmailConfirmView =
  | 'loading'
  | 'ready'
  | 'confirming'
  | 'success'
  | 'expired'
  | 'used'
  | 'cancelled'
  | 'conflict'
  | 'invalid';

@Component({
  selector: 'app-email-confirm',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './email-confirm.component.html',
  styleUrl: './email-confirm.component.scss'
})
export class EmailConfirmComponent implements OnInit, OnDestroy {
  view: EmailConfirmView = 'loading';
  preview: EmailConfirmPreview | null = null;
  successEmail = '';
  conflictEmail = '';
  message = '';
  token = '';

  private subscriptions = new Subscription();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private accountSecurity: AccountSecurityService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    const sub = this.route.queryParams.pipe(take(1)).subscribe(params => {
      this.token = typeof params['token'] === 'string' ? params['token'].trim() : '';
      if (!this.token) {
        this.view = 'invalid';
        this.message = 'El enlace no es válido o ha expirado.';
        return;
      }
      this.loadPreview(this.token);
    });
    this.subscriptions.add(sub);
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  confirm(): void {
    if (!this.token || this.view !== 'ready') {
      return;
    }

    this.view = 'confirming';
    const sub = this.accountSecurity.confirmEmailChange({ token: this.token }).subscribe({
      next: (res) => {
        const newEmail =
          res.data?.newEmail ??
          res.data?.email ??
          res.newEmail ??
          this.preview?.pendingNewEmail ??
          this.preview?.newEmail ??
          '';
        this.successEmail = newEmail;
        this.message = res.message || 'Correo principal actualizado correctamente.';
        this.view = 'success';

        const token = res.data?.token;
        if (token) {
          this.authService.replaceTokenFromAuthData({
            token,
            idUsuario: res.data?.idUsuario,
            email: res.data?.email ?? newEmail,
            rol: res.data?.rol,
            fullName: res.data?.fullName
          });
          return;
        }

        if (this.authService.isAuthenticated()) {
          this.authService.logout();
        }
      },
      error: (error: HttpErrorResponse) => {
        this.applyErrorView(error);
      }
    });
    this.subscriptions.add(sub);
  }

  goToSecurity(): void {
    if (this.authService.isAuthenticated()) {
      navigateToAccountSecurity(this.router, { emailUpdated: true });
      return;
    }
    this.router.navigate(['/login']);
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
  }

  useAnotherEmail(): void {
    if (this.authService.isAuthenticated()) {
      navigateToAccountSecurity(this.router);
      return;
    }
    this.router.navigate(['/login']);
  }

  private loadPreview(token: string): void {
    const sub = this.accountSecurity.previewEmailChangeConfirm(token).subscribe({
      next: (preview) => {
        this.preview = preview;
        this.view = this.mapPreviewToView(preview.status);
        this.conflictEmail = preview.pendingNewEmail ?? preview.newEmail ?? '';
        this.message = preview.message ?? this.defaultMessageForView(this.view);
      },
      error: (error: HttpErrorResponse) => {
        this.applyErrorView(error);
      }
    });
    this.subscriptions.add(sub);
  }

  private mapPreviewToView(status: EmailConfirmPreviewStatus): EmailConfirmView {
    switch (status) {
      case 'ready':
        return 'ready';
      case 'expired':
        return 'expired';
      case 'used':
        return 'used';
      case 'revoked':
      case 'cancelled':
        return 'cancelled';
      case 'conflict':
        return 'conflict';
      default:
        return 'invalid';
    }
  }

  private applyErrorView(error: HttpErrorResponse): void {
    const code = normalizeAccountSecurityErrorCode(extractApiErrorCode(error));
    this.message = getAccountSecurityErrorMessage(code);

    switch (code) {
      case 'token_expired':
        this.view = 'expired';
        return;
      case 'token_used':
        this.view = 'used';
        return;
      case 'token_revoked':
      case 'primary_email_change_no_pending':
        this.view = 'cancelled';
        return;
      case 'primary_email_already_registered':
      case 'email_already_registered':
      case 'email_already_exists':
      case 'primary_email_already_exists':
        this.view = 'conflict';
        this.conflictEmail = this.preview?.pendingNewEmail ?? this.conflictEmail;
        return;
      default:
        this.view = 'invalid';
    }
  }

  private defaultMessageForView(view: EmailConfirmView): string {
    switch (view) {
      case 'ready':
        return 'Confirma el cambio de correo principal de tu cuenta.';
      case 'expired':
        return 'Solicita un nuevo enlace desde la configuración de seguridad de tu cuenta.';
      case 'used':
        return 'Tu correo ya fue verificado o la solicitud dejó de estar activa.';
      case 'cancelled':
        return 'No se realizó ningún cambio en tu cuenta.';
      case 'conflict':
        return 'Ese correo ya pertenece a otra cuenta de Social Automate.';
      default:
        return 'El enlace no es válido o ha expirado.';
    }
  }
}
