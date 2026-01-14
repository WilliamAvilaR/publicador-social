import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { take } from 'rxjs/operators';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../services/auth.service';
import { LoginRequest } from '../models/login.model';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent implements OnInit, OnDestroy {
  loginForm!: FormGroup;
  showPassword = false;
  showSuccessMessage = false;
  isLoading = false;
  errorMessage = '';
  private subscriptions = new Subscription();

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit() {
    // Si el usuario ya está autenticado, redirigir al dashboard
    if (this.authService.isAuthenticated()) {
      this.router.navigate(['/dashboard']);
      return;
    }

    this.initForm();
    
    // Verificar si viene de registro exitoso (solo una vez)
    this.route.queryParams.pipe(take(1)).subscribe(params => {
      if (params['registered'] === 'true') {
        this.showSuccessMessage = true;
        
        // Limpiar el queryParam de la URL
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: {},
          replaceUrl: true
        });
      }
    });
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  initForm() {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]]
    });
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  closeSuccessMessage() {
    this.showSuccessMessage = false;
  }

  onSubmit() {
    if (this.loginForm.invalid) {
      this.markFormGroupTouched(this.loginForm);
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    const credentials: LoginRequest = {
      email: this.loginForm.value.email,
      password: this.loginForm.value.password
    };

    const loginSubscription = this.authService.login(credentials).subscribe({
      next: (response) => {
        this.isLoading = false;
        // Guardar token y datos de usuario desde response.data
        this.authService.setAuthData(response.data.token, response.data);
        
        // Redirigir a la URL de destino o al dashboard por defecto
        const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/dashboard';
        this.router.navigate([returnUrl]);
      },
      error: (error: HttpErrorResponse) => {
        this.isLoading = false;
        this.errorMessage = this.extractErrorMessage(error);
      }
    });

    this.subscriptions.add(loginSubscription);
  }

  private extractErrorMessage(error: HttpErrorResponse): string {
    if (!error.error) {
      return error.message || 'Error al iniciar sesión. Por favor, intenta nuevamente.';
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
    return 'Error al iniciar sesión. Por favor, intenta nuevamente.';
  }

  private markFormGroupTouched(formGroup: FormGroup) {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();
    });
  }

  getFieldError(fieldName: string): string {
    const field = this.loginForm.get(fieldName);

    if (field?.hasError('required')) {
      return 'Este campo es obligatorio';
    }
    if (field?.hasError('email')) {
      return 'Email inválido';
    }

    return '';
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.loginForm.get(fieldName);
    return !!(field && field.invalid && field.touched);
  }
}
