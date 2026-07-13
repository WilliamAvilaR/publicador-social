import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { switchMap, tap } from 'rxjs/operators';
import { AccountSecurityService } from '../../../../core/services/account-security.service';
import { AuthService } from '../../../../core/services/auth.service';
import { StepUpService } from '../../../../core/services/step-up.service';
import { UserSessionDto } from '../../../../core/models/account-security.model';
import { extractApiErrorCode } from '../../../../shared/utils/error.utils';
import { getAccountSecurityErrorMessage } from '../../../../shared/utils/account-security.errors';
import { SecurityToastService } from '../../services/security-toast.service';

@Component({
  selector: 'app-connected-sessions',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './connected-sessions.component.html',
  styleUrl: './connected-sessions.component.scss'
})
export class ConnectedSessionsComponent implements OnInit, OnDestroy {
  sessions: UserSessionDto[] = [];
  loading = true;
  sessionsListOpen = false;
  actionLoading: string | null = null;

  private subscriptions = new Subscription();

  constructor(
    private accountSecurity: AccountSecurityService,
    private authService: AuthService,
    private stepUpService: StepUpService,
    private router: Router,
    private securityToast: SecurityToastService
  ) {}

  ngOnInit(): void {
    this.loadSessions();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  get sessionCount(): number {
    return this.sessions?.length ?? 0;
  }

  get deviceCount(): number {
    return new Set((this.sessions ?? []).map(session => session.deviceLabel)).size;
  }

  get sessionSummary(): string {
    if (this.loading) {
      return 'Cargando sesiones activas...';
    }
    if (this.sessionCount === 0) {
      return 'No tienes sesiones activas';
    }
    return `Tienes ${this.sessionCount} sesiones activas en ${this.deviceCount} dispositivos`;
  }

  loadSessions(): void {
    this.loading = true;
    const sub = this.accountSecurity.getSessions().subscribe({
      next: (res) => {
        this.sessions = res.data?.sessions ?? [];
        this.loading = false;
      },
      error: (error: HttpErrorResponse) => {
        this.loading = false;
        this.securityToast.showError(getAccountSecurityErrorMessage(extractApiErrorCode(error)));
      }
    });
    this.subscriptions.add(sub);
  }

  toggleSessionsList(): void {
    this.sessionsListOpen = !this.sessionsListOpen;
  }

  revokeCurrent(session: UserSessionDto): void {
    if (!session.isCurrent) {
      return;
    }
    this.actionLoading = 'current';
    const sub = this.accountSecurity.revokeCurrentSession().subscribe({
      next: () => {
        this.authService.logout();
        this.router.navigate(['/login']);
      },
      error: (error: HttpErrorResponse) => {
        this.actionLoading = null;
        this.securityToast.showError(getAccountSecurityErrorMessage(extractApiErrorCode(error)));
      }
    });
    this.subscriptions.add(sub);
  }

  revokeOthers(): void {
    this.runProtected('revoke_other_sessions', () => this.accountSecurity.revokeOtherSessions());
  }

  revokeAll(): void {
    this.runProtected('revoke_all_sessions', () =>
      this.accountSecurity.revokeAllSessions().pipe(
        tap(() => {
          this.authService.logout();
          this.router.navigate(['/login']);
        })
      )
    );
  }

  private runProtected(
    operation: 'revoke_other_sessions' | 'revoke_all_sessions',
    action: () => import('rxjs').Observable<unknown>
  ): void {
    this.actionLoading = operation;
    this.securityToast.clear();
    const sub = this.stepUpService.requireStepUp(operation, { force: true }).pipe(
      switchMap(() => action())
    ).subscribe({
      next: () => {
        this.actionLoading = null;
        if (operation === 'revoke_other_sessions') {
          this.securityToast.showSuccess('Se cerraron las demás sesiones.');
          this.loadSessions();
        }
      },
      error: (error: HttpErrorResponse) => {
        this.actionLoading = null;
        this.securityToast.showError(getAccountSecurityErrorMessage(extractApiErrorCode(error)));
      }
    });
    this.subscriptions.add(sub);
  }
}
