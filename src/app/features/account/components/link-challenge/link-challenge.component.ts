import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { AccountSecurityService } from '../../../../core/services/account-security.service';
import { AuthService } from '../../../../core/services/auth.service';
import { OAuthFlowStateService } from '../../../../core/services/oauth-flow-state.service';
import { LinkVerificationMethod } from '../../../../core/models/account-security.model';
import { extractApiErrorCode } from '../../../../shared/utils/error.utils';
import { getAccountSecurityErrorMessage } from '../../../../shared/utils/account-security.errors';
import { getProviderDisplayName } from '../../../../shared/utils/external-auth.utils';
import { markFormGroupTouched } from '../../../../shared/utils/form.utils';

@Component({
  selector: 'app-link-challenge',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './link-challenge.component.html',
  styleUrl: './link-challenge.component.scss'
})
export class LinkChallengeComponent implements OnInit, OnDestroy {
  form!: FormGroup;
  maskedEmail = '';
  providerName = '';
  verificationMethods: string[] = [];
  selectedMethod: LinkVerificationMethod = 'password';
  loadingContext = true;
  submitting = false;
  errorMessage = '';

  private subscriptions = new Subscription();

  constructor(
    private fb: FormBuilder,
    private accountSecurity: AccountSecurityService,
    private authService: AuthService,
    private flowState: OAuthFlowStateService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      password: ['', [Validators.required]],
      emailVerificationToken: ['']
    });

    if (this.flowState.hasLinkChallengeContext()) {
      this.applyContextFromState();
      this.loadingContext = false;
      return;
    }

    const flowCode = this.flowState.linkChallengeFlowCode;
    if (!flowCode) {
      this.loadingContext = false;
      this.errorMessage = 'El enlace expiró. Vuelve a iniciar sesión con tu proveedor.';
      return;
    }

    const sub = this.accountSecurity.getLinkContext({ flowCode }).subscribe({
      next: (res) => {
        this.flowState.setLinkChallenge(flowCode, res.data.challengeToken, {
          provider: res.data.provider,
          maskedEmail: res.data.maskedEmail,
          verificationMethods: res.data.verificationMethods,
          existingAuthMethod: res.data.existingAuthMethod
        });
        this.applyContextFromState();
        this.loadingContext = false;
      },
      error: (error: HttpErrorResponse) => {
        this.loadingContext = false;
        this.errorMessage = getAccountSecurityErrorMessage(extractApiErrorCode(error));
      }
    });
    this.subscriptions.add(sub);
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  get canUsePassword(): boolean {
    return this.verificationMethods.includes('password');
  }

  get canUseEmail(): boolean {
    return this.verificationMethods.includes('email');
  }

  selectMethod(method: LinkVerificationMethod): void {
    this.selectedMethod = method;
    this.errorMessage = '';
    const passwordControl = this.form.get('password');
    const emailTokenControl = this.form.get('emailVerificationToken');
    if (method === 'password') {
      passwordControl?.setValidators([Validators.required]);
      emailTokenControl?.clearValidators();
      emailTokenControl?.setValue('');
    } else {
      emailTokenControl?.setValidators([Validators.required]);
      passwordControl?.clearValidators();
      passwordControl?.setValue('');
    }
    passwordControl?.updateValueAndValidity({ emitEvent: false });
    emailTokenControl?.updateValueAndValidity({ emitEvent: false });
  }

  onSubmit(): void {
    if (this.form.invalid) {
      markFormGroupTouched(this.form);
      return;
    }

    const challengeToken = this.flowState.challengeToken;
    if (!challengeToken) {
      this.errorMessage = 'El enlace expiró. Vuelve a intentarlo.';
      return;
    }

    this.submitting = true;
    this.errorMessage = '';
    const values = this.form.value;
    const sub = this.accountSecurity.confirmLinkWithPassword({
      challengeToken,
      verificationMethod: this.selectedMethod,
      password: this.selectedMethod === 'password' ? values.password : undefined,
      emailVerificationToken:
        this.selectedMethod === 'email' ? values.emailVerificationToken : undefined
    }).subscribe({
      next: (res) => {
        this.flowState.clearLinkChallenge();
        this.authService.handleAuthSuccess({ data: res.data }, { source: 'oauth' });
      },
      error: (error: HttpErrorResponse) => {
        this.submitting = false;
        this.errorMessage = getAccountSecurityErrorMessage(extractApiErrorCode(error));
      }
    });
    this.subscriptions.add(sub);
  }

  private applyContextFromState(): void {
    this.maskedEmail = this.flowState.linkChallengeMaskedEmail ?? '';
    this.verificationMethods = [...this.flowState.linkChallengeVerificationMethods];
    this.providerName = this.flowState.linkChallengeProvider
      ? getProviderDisplayName(this.flowState.linkChallengeProvider)
      : '';

    if (this.canUsePassword) {
      this.selectMethod('password');
    } else if (this.canUseEmail) {
      this.selectMethod('email');
    } else if (this.verificationMethods.length === 0) {
      this.selectMethod('password');
    }
  }
}
