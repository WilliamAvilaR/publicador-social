import { Component, OnDestroy, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { extractErrorMessage } from '../../../shared/utils/error.utils';
import {
  ActionCooldown,
  getRetryAfterSeconds,
  RESEND_SUCCESS_COOLDOWN_SECONDS
} from '../../../shared/utils/rate-limit.utils';

@Component({
  selector: 'app-register-check-email',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './register-check-email.component.html',
  styleUrl: './register-check-email.component.scss'
})
export class RegisterCheckEmailComponent implements OnInit, OnDestroy {
  email = '';
  resendLoading = false;
  resendError = '';
  readonly cooldown = new ActionCooldown();
  private subscriptions = new Subscription();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const email = this.route.snapshot.queryParamMap.get('email')?.trim();
    if (!email) {
      this.router.navigate(['/register']);
      return;
    }
    this.email = email;
  }

  ngOnDestroy(): void {
    this.cooldown.clear();
    this.subscriptions.unsubscribe();
  }

  get isResendDisabled(): boolean {
    return this.resendLoading || this.cooldown.isActive;
  }

  resendVerification(): void {
    if (this.isResendDisabled) {
      return;
    }

    this.resendLoading = true;
    this.resendError = '';

    const sub = this.authService.resendVerification({ email: this.email }).subscribe({
      next: () => {
        this.resendLoading = false;
        this.cooldown.start(RESEND_SUCCESS_COOLDOWN_SECONDS, () => this.cdr.markForCheck());
      },
      error: (error: HttpErrorResponse) => {
        this.resendLoading = false;
        this.resendError = extractErrorMessage(
          error,
          'No se pudo reenviar el correo. Intenta nuevamente.'
        );
        if (error.status === 429) {
          this.cooldown.start(getRetryAfterSeconds(error), () => this.cdr.markForCheck());
        }
      }
    });

    this.subscriptions.add(sub);
  }
}
