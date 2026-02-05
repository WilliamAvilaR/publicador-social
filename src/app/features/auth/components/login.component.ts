import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { take } from 'rxjs/operators';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../../core/services/auth.service';
import { LoginRequest } from '../../../core/models/auth.model';
import { markFormGroupTouched, isFieldInvalid } from '../../../shared/utils/form.utils';
import { extractErrorMessage } from '../../../shared/utils/error.utils';
import { getFieldError } from '../../../shared/utils/validation.utils';

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
      markFormGroupTouched(this.loginForm);
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
        
        // Obtener perfil completo del servidor para tener todos los datos (incluyendo avatarUrl)
        const profileSubscription = this.authService.getProfile().subscribe({
          next: (profileResponse) => {
            // Actualizar datos del usuario con el perfil completo
            this.authService.updateUserData(profileResponse.data);
          },
          error: (error) => {
            // Si falla obtener el perfil, continuar con los datos básicos del login
            console.warn('No se pudo obtener el perfil completo después del login:', error);
          }
        });
        this.subscriptions.add(profileSubscription);
        
        // Redirigir a la URL de destino o al dashboard por defecto
        const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/dashboard';
        this.router.navigate([returnUrl]);
      },
      error: (error: HttpErrorResponse) => {
        this.isLoading = false;
        this.errorMessage = extractErrorMessage(
          error,
          'Error al iniciar sesión. Por favor, intenta nuevamente.'
        );
      }
    });

    this.subscriptions.add(loginSubscription);
  }

  getFieldError(fieldName: string): string {
    return getFieldError(this.loginForm, fieldName);
  }

  isFieldInvalid(fieldName: string): boolean {
    return isFieldInvalid(this.loginForm, fieldName);
  }
}
