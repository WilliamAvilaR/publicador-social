import { Component, EventEmitter, OnDestroy, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { AccountSecurityService } from '../../../../core/services/account-security.service';
import { AuthService } from '../../../../core/services/auth.service';
import { StepUpService } from '../../../../core/services/step-up.service';
import { extractApiErrorCode } from '../../../../shared/utils/error.utils';
import { getAccountSecurityErrorMessage } from '../../../../shared/utils/account-security.errors';
import { markFormGroupTouched } from '../../../../shared/utils/form.utils';
import { SecurityToastService } from '../../services/security-toast.service';

@Component({
  selector: 'app-email-change',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './email-change.component.html',
  styleUrl: './email-change.component.scss'
})
export class EmailChangeComponent implements OnInit, OnDestroy {
  @Output() emailChangeRequested = new EventEmitter<void>();

  form: FormGroup;
  currentEmail = '';
  submitting = false;

  private subscriptions = new Subscription();

  constructor(
    private fb: FormBuilder,
    private accountSecurity: AccountSecurityService,
    private stepUpService: StepUpService,
    private authService: AuthService,
    private securityToast: SecurityToastService
  ) {
    this.form = this.fb.group({
      newEmail: ['', [Validators.required, Validators.email]]
    });
  }

  ngOnInit(): void {
    const user = this.authService.getUser();
    this.currentEmail = user?.email ?? '';
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  onSubmit(): void {
    if (this.form.invalid) {
      markFormGroupTouched(this.form);
      return;
    }

    this.submitting = true;
    this.securityToast.clear();
    const newEmail = this.form.value.newEmail.trim();

    const sub = this.stepUpService.requireStepUp('email_change', { force: true }).pipe(
      switchMap(() => this.accountSecurity.requestEmailChange({ newEmail }))
    ).subscribe({
      next: (res) => {
        this.submitting = false;
        this.securityToast.showSuccess(res.message || 'Revisa tu nuevo correo para confirmar el cambio.');
        this.form.reset();
        this.emailChangeRequested.emit();
      },
      error: (error: HttpErrorResponse) => {
        this.submitting = false;
        this.securityToast.showError(getAccountSecurityErrorMessage(extractApiErrorCode(error)));
      }
    });
    this.subscriptions.add(sub);
  }
}
