import { Component, OnDestroy, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
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
  selector: 'app-verify-email',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule],
  templateUrl: './verify-email.component.html',
  styleUrl: './verify-email.component.scss'
})
export class VerifyEmailComponent implements OnInit, OnDestroy {
  token: string | null = null;
  errorMessage = '';
  showResendForm = false;
  resendForm!: FormGroup;
  resendLoading = false;
  resendError = '';
  confirming = false;
  readonly resendCooldown = new ActionCooldown();
  private subscriptions = new Subscription();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token');
    this.resendForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });

    if (!this.token) {
      this.errorMessage = 'Enlace inválido';
      this.showResendForm = true;
    }
  }

  ngOnDestroy(): void {
    this.resendCooldown.clear();
    this.subscriptions.unsubscribe();
  }

  get isResendDisabled(): boolean {
    return this.resendLoading || this.resendCooldown.isActive;
  }

  confirm(): void {
    if (!this.token) {
      return;
    }

    this.confirming = true;
    this.errorMessage = '';
    this.showResendForm = false;

    const sub = this.authService.verifyEmail({ token: this.token }).subscribe({
      next: () => {
        this.confirming = false;
        this.router.navigate(['/login'], { queryParams: { verified: '1' } });
      },
      error: (error: HttpErrorResponse) => {
        this.confirming = false;
        this.errorMessage = extractErrorMessage(
          error,
          'Enlace inválido o expirado'
        );
        this.showResendForm = true;
      }
    });

    this.subscriptions.add(sub);
  }

  resendVerification(): void {
    if (this.resendForm.invalid || this.isResendDisabled) {
      if (this.resendForm.invalid) {
        this.resendForm.markAllAsTouched();
      }
      return;
    }

    this.resendLoading = true;
    this.resendError = '';

    const email = this.resendForm.value.email.trim();
    const sub = this.authService.resendVerification({ email }).subscribe({
      next: () => {
        this.resendLoading = false;
        this.resendCooldown.start(RESEND_SUCCESS_COOLDOWN_SECONDS, () => this.cdr.markForCheck());
      },
      error: (error: HttpErrorResponse) => {
        this.resendLoading = false;
        this.resendError = extractErrorMessage(
          error,
          'No se pudo reenviar el correo. Intenta nuevamente.'
        );
        if (error.status === 429) {
          this.resendCooldown.start(getRetryAfterSeconds(error), () => this.cdr.markForCheck());
        }
      }
    });

    this.subscriptions.add(sub);
  }
}
