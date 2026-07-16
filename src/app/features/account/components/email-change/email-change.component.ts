import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators
} from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { AccountSecurityService } from '../../../../core/services/account-security.service';
import { AuthService } from '../../../../core/services/auth.service';
import { EmailChangePendingDto } from '../../../../core/models/account-security.model';
import {
  EMAIL_CHANGE_PASSWORD_REQUIRED_MESSAGE,
  StepUpService
} from '../../../../core/services/step-up.service';
import { resolveEmailChangeErrorMessage } from '../../../../shared/utils/account-security.errors';
import { markFormGroupTouched, isFieldInvalid } from '../../../../shared/utils/form.utils';
import { getFieldError } from '../../../../shared/utils/validation.utils';
import { ActionCooldown, getRetryAfterSeconds } from '../../../../shared/utils/rate-limit.utils';
import { SecurityToastService } from '../../services/security-toast.service';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';

const EMAIL_MAX_LENGTH = 254;

function noWhitespaceValidator(control: AbstractControl): ValidationErrors | null {
  const value = control.value;
  if (typeof value === 'string' && /\s/.test(value)) {
    return { whitespace: true };
  }
  return null;
}

function differentFromCurrentEmailValidator(currentEmail: string): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = typeof control.value === 'string' ? control.value.trim().toLowerCase() : '';
    const current = currentEmail.trim().toLowerCase();
    if (value && current && value === current) {
      return { sameAsCurrentEmail: true };
    }
    return null;
  };
}

@Component({
  selector: 'app-email-change',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ModalComponent],
  templateUrl: './email-change.component.html',
  styleUrl: './email-change.component.scss'
})
export class EmailChangeComponent implements OnInit, OnChanges, OnDestroy {
  @Input() ready = false;
  @Input() canChangeEmail = false;
  @Input() canConfigurePassword = false;
  @Output() emailChangeRequested = new EventEmitter<void>();
  @Output() configurePasswordRequested = new EventEmitter<void>();

  form: FormGroup;
  currentEmail = '';
  pending: EmailChangePendingDto | null = null;
  pendingLoading = false;
  submitting = false;
  resendLoading = false;
  cancelLoading = false;
  cancelModalOpen = false;

  readonly passwordRequiredMessage = EMAIL_CHANGE_PASSWORD_REQUIRED_MESSAGE;
  readonly resendCooldown = new ActionCooldown();

  private subscriptions = new Subscription();

  constructor(
    private fb: FormBuilder,
    private accountSecurity: AccountSecurityService,
    private stepUpService: StepUpService,
    private authService: AuthService,
    private securityToast: SecurityToastService,
    private cdr: ChangeDetectorRef
  ) {
    this.form = this.fb.group({
      newEmail: ['', [Validators.required, Validators.email, Validators.maxLength(EMAIL_MAX_LENGTH), noWhitespaceValidator]]
    });
  }

  ngOnInit(): void {
    const user = this.authService.getUser();
    this.currentEmail = user?.email ?? '';
    this.applyCurrentEmailValidator();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['ready']?.currentValue === true) {
      const user = this.authService.getUser();
      if (user?.email) {
        this.currentEmail = user.email;
        this.applyCurrentEmailValidator();
      }
      this.loadPending();
    }
  }

  ngOnDestroy(): void {
    this.resendCooldown.clear();
    this.subscriptions.unsubscribe();
  }

  get hasPendingChange(): boolean {
    return !!this.pending;
  }

  get isResendDisabled(): boolean {
    return this.resendLoading || this.resendCooldown.isActive || this.cancelLoading;
  }

  get isSubmitDisabled(): boolean {
    return !this.ready || this.submitting || this.form.invalid;
  }

  onConfigurePassword(): void {
    this.configurePasswordRequested.emit();
  }

  loadPending(): void {
    if (!this.ready && !this.authService.isAuthenticated()) {
      return;
    }

    this.pendingLoading = true;
    const sub = this.accountSecurity.getEmailChangePending().subscribe({
      next: (pending) => {
        this.pendingLoading = false;
        if (!pending) {
          const user = this.authService.getUser();
          if (user?.email) {
            this.currentEmail = user.email;
            this.applyCurrentEmailValidator();
          }
        }
        this.applyPendingState(pending);
      },
      error: () => {
        this.pendingLoading = false;
      }
    });
    this.subscriptions.add(sub);
  }

  onSubmit(): void {
    if (!this.canChangeEmail) {
      this.securityToast.showError(EMAIL_CHANGE_PASSWORD_REQUIRED_MESSAGE);
      return;
    }

    if (this.form.invalid) {
      markFormGroupTouched(this.form);
      return;
    }

    this.submitting = true;
    this.securityToast.clear();
    const newEmail = this.form.value.newEmail.trim();

    const sub = this.stepUpService.requireStepUp('email_change').pipe(
      switchMap(() => this.accountSecurity.requestEmailChange({ newEmail }))
    ).subscribe({
      next: (res) => {
        this.submitting = false;
        this.securityToast.showSuccess(
          res.message || 'Enlace de verificación enviado.',
          5000
        );
        this.form.reset();
        this.applyPendingState(res.pending ?? null);
        this.emailChangeRequested.emit();
      },
      error: (error: unknown) => {
        this.submitting = false;
        if (error instanceof Error && error.message === 'step_up_cancelled') {
          return;
        }
        this.securityToast.showError(
          resolveEmailChangeErrorMessage(error as HttpErrorResponse)
        );
      }
    });
    this.subscriptions.add(sub);
  }

  onResend(): void {
    if (this.isResendDisabled) {
      return;
    }

    this.resendLoading = true;
    const sub = this.accountSecurity.resendEmailChange().subscribe({
      next: (res) => {
        this.resendLoading = false;
        this.securityToast.showSuccess(
          res.message || 'Enviamos un nuevo enlace de verificación.',
          5000
        );
        this.applyPendingState(res.pending ?? null);
      },
      error: (error: HttpErrorResponse) => {
        this.resendLoading = false;
        const seconds = error.status === 429 ? getRetryAfterSeconds(error) : 0;
        if (seconds > 0) {
          this.startResendCooldown(seconds);
        }
        this.securityToast.showError(resolveEmailChangeErrorMessage(error));
      }
    });
    this.subscriptions.add(sub);
  }

  openCancelModal(): void {
    this.cancelModalOpen = true;
  }

  closeCancelModal(): void {
    if (this.cancelLoading) {
      return;
    }
    this.cancelModalOpen = false;
  }

  confirmCancel(): void {
    if (this.cancelLoading) {
      return;
    }

    this.cancelLoading = true;
    const sub = this.accountSecurity.cancelEmailChange().subscribe({
      next: (res) => {
        this.cancelLoading = false;
        this.cancelModalOpen = false;
        this.applyPendingState(null);
        this.securityToast.showSuccess(res.message || 'Solicitud de cambio cancelada.');
        this.emailChangeRequested.emit();
      },
      error: (error: HttpErrorResponse) => {
        this.cancelLoading = false;
        this.securityToast.showError(resolveEmailChangeErrorMessage(error));
      }
    });
    this.subscriptions.add(sub);
  }

  isFieldInvalid(fieldName: string): boolean {
    return isFieldInvalid(this.form, fieldName);
  }

  getFieldError(fieldName: string): string {
    return getFieldError(this.form, fieldName);
  }

  private applyCurrentEmailValidator(): void {
    const control = this.form.get('newEmail');
    if (!control) {
      return;
    }
    control.setValidators([
      Validators.required,
      Validators.email,
      Validators.maxLength(EMAIL_MAX_LENGTH),
      noWhitespaceValidator,
      differentFromCurrentEmailValidator(this.currentEmail)
    ]);
    control.updateValueAndValidity({ emitEvent: false });
  }

  private applyPendingState(pending: EmailChangePendingDto | null): void {
    this.pending = pending;
    if (pending?.currentEmail) {
      this.currentEmail = pending.currentEmail;
      this.applyCurrentEmailValidator();
    }
    this.syncResendCooldown(pending?.resendAvailableInSeconds ?? 0);
    this.cdr.markForCheck();
  }

  private syncResendCooldown(seconds: number): void {
    if (seconds > 0) {
      this.startResendCooldown(seconds);
      return;
    }
    this.resendCooldown.clear();
    this.cdr.markForCheck();
  }

  private startResendCooldown(seconds: number): void {
    this.resendCooldown.start(seconds, () => this.cdr.markForCheck());
  }
}
