import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ValidationErrors,
  Validators,
  ReactiveFormsModule
} from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../../core/services/auth.service';
import { PhoneCatalogService } from '../../../core/services/phone-catalog.service';
import { RegisterRequest } from '../../../core/models/auth.model';
import { markFormGroupTouched, isFieldInvalid } from '../../../shared/utils/form.utils';
import { extractErrorMessage } from '../../../shared/utils/error.utils';
import { getFieldError } from '../../../shared/utils/validation.utils';
import { getRetryAfterSeconds } from '../../../shared/utils/rate-limit.utils';
import {
  buildPhonePayload,
  DEFAULT_PHONE_COUNTRY,
  isPhoneValidForCountry,
  resolveInitialPhoneCountry
} from '../../../shared/utils/phone.utils';
import { PhoneFieldComponent } from '../../../shared/components/phone-field/phone-field.component';

function requiredInternationalPhoneValidator(group: AbstractControl): ValidationErrors | null {
  const national = String(group.get('phoneNational')?.value || '');
  const country = String(group.get('telephoneCountry')?.value || '');
  const digits = national.replace(/[^\d]/g, '');
  if (!digits) {
    return { phoneRequired: true };
  }
  if (!isPhoneValidForCountry(national, country)) {
    return { invalidPhone: true };
  }
  return null;
}

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, TranslateModule, PhoneFieldComponent],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss'
})
export class RegisterComponent implements OnInit, OnDestroy {
  registerForm!: FormGroup;
  showPassword = false;
  showConfirmPassword = false;
  isLoading = false;
  socialLoadingProvider: 'google' | 'microsoft' | null = null;
  errorMessage = '';
  currentStep = 1;
  totalSteps = 2;
  private readonly DEFAULT_ROLE = 'usuario';
  private subscriptions = new Subscription();

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private phoneCatalog: PhoneCatalogService
  ) {}

  ngOnInit() {
    this.initForm();
    this.subscriptions.add(
      this.phoneCatalog.getPhoneCountries().subscribe(countries => {
        const control = this.registerForm.get('telephoneCountry');
        if (control && !control.dirty) {
          control.setValue(resolveInitialPhoneCountry(null, countries), { emitEvent: false });
        }
      })
    );
  }

  initForm() {
    this.registerForm = this.fb.group({
      firstName: ['', [Validators.required, Validators.maxLength(50)]],
      lastName: ['', [Validators.required, Validators.maxLength(50)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]],
      telephoneCountry: [DEFAULT_PHONE_COUNTRY],
      phoneNational: ['', [Validators.required]]
    }, {
      validators: [this.passwordMatchValidator, requiredInternationalPhoneValidator]
    });
  }

  passwordMatchValidator(form: FormGroup) {
    const password = form.get('password');
    const confirmPassword = form.get('confirmPassword');

    if (!password || !confirmPassword) {
      return null;
    }

    if (password.value !== confirmPassword.value) {
      confirmPassword.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    }

    // Si las contraseñas coinciden, limpiar el error
    if (confirmPassword.hasError('passwordMismatch')) {
      const errors = { ...confirmPassword.errors };
      delete errors['passwordMismatch'];
      const hasErrors = Object.keys(errors).length > 0;
      confirmPassword.setErrors(hasErrors ? errors : null);
    }

    return null;
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPassword() {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  getStep1Fields() {
    return ['firstName', 'lastName', 'email', 'phoneNational', 'telephoneCountry'];
  }

  getStep2Fields() {
    return ['password', 'confirmPassword'];
  }

  validateCurrentStep(): boolean {
    const fields = this.currentStep === 1 ? this.getStep1Fields() : this.getStep2Fields();
    let isValid = true;

    fields.forEach(fieldName => {
      const field = this.registerForm.get(fieldName);
      if (field) {
        field.markAsTouched();
        if (field.invalid) {
          isValid = false;
        }
      }
    });

    this.registerForm.updateValueAndValidity();

    if (this.currentStep === 1) {
      if (this.registerForm.hasError('phoneRequired') || this.registerForm.hasError('invalidPhone')) {
        this.registerForm.get('phoneNational')?.markAsTouched();
        isValid = false;
      }
    }

    // Validar match de contraseñas en paso 2
    if (this.currentStep === 2) {
      this.registerForm.updateValueAndValidity();
    }

    return isValid;
  }

  nextStep() {
    if (this.validateCurrentStep()) {
      if (this.currentStep < this.totalSteps) {
        this.currentStep++;
        this.errorMessage = '';
      }
    }
  }

  previousStep() {
    if (this.currentStep > 1) {
      this.currentStep--;
      this.errorMessage = '';
    }
  }

  registerWithGoogle(): void {
    this.startExternalAuth('google');
  }

  registerWithMicrosoft(): void {
    this.startExternalAuth('microsoft');
  }

  private startExternalAuth(provider: 'google' | 'microsoft'): void {
    if (this.isLoading || this.socialLoadingProvider) {
      return;
    }

    this.errorMessage = '';
    this.socialLoadingProvider = provider;

    const sub = this.authService.redirectToExternalAuth(provider).subscribe({
      error: (error: HttpErrorResponse | Error) => {
        this.socialLoadingProvider = null;
        if (error instanceof Error && error.message === 'authorization_url_missing') {
          this.errorMessage =
            'No se recibió una URL de autorización válida. Inténtalo nuevamente.';
          return;
        }
        const httpError = error as HttpErrorResponse;
        if (httpError.status === 429) {
          const seconds = getRetryAfterSeconds(httpError);
          this.errorMessage = `Demasiados intentos. Vuelve a intentarlo en ${seconds} segundos.`;
          return;
        }
        this.errorMessage = extractErrorMessage(
          httpError,
          'No se pudo iniciar el flujo con el proveedor. Inténtalo nuevamente.'
        );
      }
    });
    this.subscriptions.add(sub);
  }

  onSubmit() {
    if (this.registerForm.invalid) {
      markFormGroupTouched(this.registerForm);
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    const formValue = this.registerForm.value;
    const phone = buildPhonePayload(
      formValue.phoneNational,
      formValue.telephoneCountry,
      this.phoneCatalog.getCachedCountries()
    );
    // El nombre de organización se pide después, en /onboarding (complete-workspace-setup)
    const registerData: RegisterRequest = {
      firstName: formValue.firstName.trim(),
      lastName: formValue.lastName.trim(),
      email: formValue.email.trim(),
      password: formValue.password,
      telephone: phone.telephone,
      telephoneCountry: phone.telephoneCountry,
      rol: this.DEFAULT_ROLE
    };

    const registerSubscription = this.authService.register(registerData).subscribe({
      next: (response) => {
        this.isLoading = false;
        this.router.navigate(['/register/check-email'], {
          queryParams: { email: response.data.email }
        });
      },
      error: (error: HttpErrorResponse) => {
        this.isLoading = false;
        if (error.status === 409) {
          this.errorMessage = extractErrorMessage(
            error,
            'Ya existe una cuenta registrada con este correo electrónico.'
          );
          return;
        }
        this.errorMessage = extractErrorMessage(
          error,
          'Error al registrar usuario. Por favor, intenta nuevamente.'
        );
      }
    });

    this.subscriptions.add(registerSubscription);
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  getFieldError(fieldName: string): string {
    return getFieldError(this.registerForm, fieldName);
  }

  isPhoneInvalid(): boolean {
    const touched = !!this.registerForm.get('phoneNational')?.touched;
    return (
      touched &&
      (this.registerForm.hasError('phoneRequired') || this.registerForm.hasError('invalidPhone'))
    );
  }

  isFieldInvalid(fieldName: string): boolean {
    return isFieldInvalid(this.registerForm, fieldName);
  }
}
