import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../../core/services/auth.service';
import { RegisterRequest } from '../../../core/models/auth.model';
import { markFormGroupTouched, isFieldInvalid } from '../../../shared/utils/form.utils';
import { extractErrorMessage } from '../../../shared/utils/error.utils';
import { getFieldError } from '../../../shared/utils/validation.utils';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss'
})
export class RegisterComponent implements OnInit, OnDestroy {
  registerForm!: FormGroup;
  showPassword = false;
  showConfirmPassword = false;
  isLoading = false;
  errorMessage = '';
  currentStep = 1;
  totalSteps = 2;
  private readonly DEFAULT_ROLE = 'usuario';
  private subscriptions = new Subscription();

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    this.initForm();
  }

  initForm() {
    this.registerForm = this.fb.group({
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]],
      telephone: ['', [Validators.required]]
    }, {
      validators: this.passwordMatchValidator
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
    return ['firstName', 'lastName', 'email', 'telephone'];
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

  onSubmit() {
    if (this.registerForm.invalid) {
      markFormGroupTouched(this.registerForm);
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    const formValue = this.registerForm.value;
    const registerData: RegisterRequest = {
      firstName: formValue.firstName,
      lastName: formValue.lastName,
      email: formValue.email,
      password: formValue.password,
      telephone: formValue.telephone,
      rol: this.DEFAULT_ROLE
    };

    const registerSubscription = this.authService.register(registerData).subscribe({
      next: (response) => {
        this.isLoading = false;
        // Redirigir al login después de registro exitoso
        this.router.navigate(['/login'], {
          queryParams: { registered: 'true' }
        });
      },
      error: (error: HttpErrorResponse) => {
        this.isLoading = false;
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

  isFieldInvalid(fieldName: string): boolean {
    return isFieldInvalid(this.registerForm, fieldName);
  }
}
