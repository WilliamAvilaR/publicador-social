import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../services/auth.service';
import { RegisterRequest } from '../models/register.model';

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
      this.markFormGroupTouched(this.registerForm);
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
        this.errorMessage = this.extractErrorMessage(error);
      }
    });

    this.subscriptions.add(registerSubscription);
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  private extractErrorMessage(error: HttpErrorResponse): string {
    if (!error.error) {
      return error.message || 'Error al registrar usuario. Por favor, intenta nuevamente.';
    }

    // Si errors es un array de objetos con detail
    if (Array.isArray(error.error.errors) && error.error.errors.length > 0) {
      const firstError = error.error.errors[0];
      if (firstError.detail) {
        return firstError.detail;
      }
      if (firstError.title) {
        return firstError.title;
      }
    }

    // Si errors es un objeto con campos (validación por campo)
    if (error.error.errors && typeof error.error.errors === 'object' && !Array.isArray(error.error.errors)) {
      const errorFields = Object.keys(error.error.errors);
      if (errorFields.length > 0) {
        const firstField = errorFields[0];
        const firstError = error.error.errors[firstField];
        if (Array.isArray(firstError) && firstError.length > 0) {
          return firstError[0];
        }
        if (typeof firstError === 'string') {
          return firstError;
        }
      }
    }

    // Si hay detail directo en error.error
    if (error.error.detail) {
      return error.error.detail;
    }

    // Si hay title directo en error.error
    if (error.error.title) {
      return error.error.title;
    }

    // Si hay un mensaje de error general
    if (error.error.message) {
      return error.error.message;
    }

    // Último recurso: mensaje genérico
    return 'Error al registrar usuario. Por favor, intenta nuevamente.';
  }

  markFormGroupTouched(formGroup: FormGroup) {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();
    });
  }

  getFieldError(fieldName: string): string {
    const field = this.registerForm.get(fieldName);

    if (field?.hasError('required')) {
      return 'Este campo es obligatorio';
    }
    if (field?.hasError('email')) {
      return 'Email inválido';
    }
    if (field?.hasError('minlength')) {
      const minLength = field.errors?.['minlength']?.requiredLength;
      return `Mínimo ${minLength} caracteres`;
    }
    if (field?.hasError('passwordMismatch')) {
      return 'Las contraseñas no coinciden';
    }

    return '';
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.registerForm.get(fieldName);
    return !!(field && field.invalid && field.touched);
  }
}
