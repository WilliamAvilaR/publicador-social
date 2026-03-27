import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { InvitationService } from '../../../core/services/invitation.service';
import { AuthService } from '../../../core/services/auth.service';
import { TenantReauthService } from '../../../core/services/tenant-reauth.service';
import {
  AcceptInvitationRequest,
  AcceptInvitationResponse,
  ValidateInvitationResponse
} from '../../../core/models/auth.model';
import { markFormGroupTouched, isFieldInvalid } from '../../../shared/utils/form.utils';
import { getFieldError } from '../../../shared/utils/validation.utils';
import { extractErrorMessage } from '../../../shared/utils/error.utils';

@Component({
  selector: 'app-accept-invitation',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './accept-invitation.component.html',
  styleUrl: './accept-invitation.component.scss'
})
export class AcceptInvitationComponent implements OnInit, OnDestroy {
  token: string | null = null;
  validation: ValidateInvitationResponse['data'] | null = null;
  loadingValidation = false;
  validationError: string | null = null;

  form!: FormGroup;
  submitting = false;
  submitError: string | null = null;

  private subscriptions = new Subscription();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private invitationService: InvitationService,
    private authService: AuthService,
    private tenantReauth: TenantReauthService
  ) {}

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token');
    if (!this.token) {
      this.validationError = 'El enlace de invitación no es válido.';
      return;
    }

    this.initForm();
    this.validateToken(this.token);
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  private initForm(): void {
    this.form = this.fb.group({
      firstName: [''],
      lastName: [''],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]]
    });
  }

  private validateToken(token: string): void {
    this.loadingValidation = true;
    this.validationError = null;

    const sub = this.invitationService.validateInvitationToken(token).subscribe({
      next: (response: ValidateInvitationResponse) => {
        this.loadingValidation = false;
        this.validation = response.data;

        if (!this.validation.valid) {
          this.validationError = this.validation.errorMessage || 'El enlace de invitación no es válido o ha expirado.';
          return;
        }

        // Prefill opcional de nombre si viene en la invitación
        this.form.patchValue({
          firstName: this.validation.firstName || '',
          lastName: this.validation.lastName || ''
        });
      },
      error: (error: HttpErrorResponse) => {
        console.error('Error al validar invitación:', error);
        this.loadingValidation = false;
        this.validationError = extractErrorMessage(error, 'No se pudo validar la invitación.');
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

  onSubmit(): void {
    if (!this.token) {
      this.submitError = 'El token de invitación es requerido.';
      return;
    }

    if (this.form.invalid) {
      markFormGroupTouched(this.form);
      return;
    }

    const { password, confirmPassword, firstName, lastName } = this.form.value;

    if (password !== confirmPassword) {
      this.submitError = 'Las contraseñas no coinciden.';
      return;
    }

    this.submitting = true;
    this.submitError = null;

    const payload: AcceptInvitationRequest = {
      token: this.token,
      password,
      confirmPassword,
      firstName: firstName || undefined,
      lastName: lastName || undefined
    };

    const sub = this.invitationService.acceptInvitation(payload).subscribe({
      next: (response: AcceptInvitationResponse) => {
        this.submitting = false;
        const userData = response.data;

        // Reutilizar el flujo de login: guardar token + datos de usuario
        this.authService.setAuthData(userData.token, {
          token: userData.token,
          idUsuario: userData.idUsuario,
          email: userData.email,
          rol: userData.rol,
          fullName: userData.fullName
        });

        this.tenantReauth.rehydrateTenantsAfterNewSession().subscribe({
          next: () => this.router.navigate(['/dashboard']),
          error: () => this.router.navigate(['/dashboard'])
        });
      },
      error: (error: HttpErrorResponse) => {
        console.error('Error al aceptar invitación:', error);
        this.submitting = false;
        this.submitError = extractErrorMessage(error);
      }
    });

    this.subscriptions.add(sub);
  }
}

