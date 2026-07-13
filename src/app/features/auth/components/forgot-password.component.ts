import { Component, OnDestroy, ChangeDetectorRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { extractErrorMessage } from '../../../shared/utils/error.utils';
import { getFieldError } from '../../../shared/utils/validation.utils';
import { isFieldInvalid, markFormGroupTouched } from '../../../shared/utils/form.utils';
import {
  ActionCooldown,
  FORGOT_PASSWORD_SUCCESS_MESSAGE,
  getRetryAfterSeconds,
  RESEND_SUCCESS_COOLDOWN_SECONDS
} from '../../../shared/utils/rate-limit.utils';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.scss'
})
export class ForgotPasswordComponent implements OnInit, OnDestroy {
  form: FormGroup;
  isLoading = false;
  successMessage = '';
  errorMessage = '';
  readonly cooldown = new ActionCooldown();
  private subscriptions = new Subscription();

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef
  ) {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });
  }

  ngOnInit(): void {
    const email = this.route.snapshot.queryParamMap.get('email');
    if (email) {
      this.form.patchValue({ email });
    }
  }

  ngOnDestroy(): void {
    this.cooldown.clear();
    this.subscriptions.unsubscribe();
  }

  get isSubmitDisabled(): boolean {
    return this.isLoading || this.cooldown.isActive;
  }

  onSubmit(): void {
    if (this.form.invalid) {
      markFormGroupTouched(this.form);
      return;
    }

    if (this.isSubmitDisabled) {
      return;
    }

    this.isLoading = true;
    this.successMessage = '';
    this.errorMessage = '';

    const email = this.form.value.email.trim();
    const sub = this.authService.forgotPassword({ email }).subscribe({
      next: () => {
        this.isLoading = false;
        this.successMessage = FORGOT_PASSWORD_SUCCESS_MESSAGE;
        this.cooldown.start(RESEND_SUCCESS_COOLDOWN_SECONDS, () => this.cdr.markForCheck());
      },
      error: (error: HttpErrorResponse) => {
        this.isLoading = false;
        this.errorMessage = extractErrorMessage(
          error,
          'No se pudo procesar la solicitud. Intenta nuevamente.'
        );
        if (error.status === 429) {
          this.cooldown.start(getRetryAfterSeconds(error), () => this.cdr.markForCheck());
        }
      }
    });

    this.subscriptions.add(sub);
  }

  getFieldError(fieldName: string): string {
    return getFieldError(this.form, fieldName);
  }

  isFieldInvalid(fieldName: string): boolean {
    return isFieldInvalid(this.form, fieldName);
  }
}
