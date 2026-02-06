import { Component, OnInit, OnDestroy, Output, EventEmitter, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../../../core/services/auth.service';
import { UserSettingsService } from '../../../../core/services/user-settings.service';
import { TranslationService } from '../../../../core/services/translation.service';
import { UserSettings, UpdateUserSettingsRequest } from '../../../../core/models/user-settings.model';
import { markFormGroupTouched, isFieldInvalid } from '../../../../shared/utils/form.utils';
import { extractErrorMessage } from '../../../../shared/utils/error.utils';
import { getFieldError } from '../../../../shared/utils/validation.utils';

@Component({
  selector: 'app-edit-preferences',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './edit-preferences.component.html',
  styleUrl: './edit-preferences.component.scss'
})
export class EditPreferencesComponent implements OnInit, OnDestroy {
  @Input() embedded: boolean = false; // Si está embebido en configuración
  @Output() preferencesUpdated = new EventEmitter<void>();
  
  preferencesForm!: FormGroup;
  isLoading = false;
  loadingSettings = false;
  errorMessage = '';
  successMessage = '';
  currentSettings: UserSettings | null = null;
  private subscriptions = new Subscription();

  // Opciones disponibles
  languages = [
    { value: 'es', label: 'Español' },
    { value: 'en', label: 'English' },
    { value: 'pt', label: 'Português' }
  ];

  timezones = [
    { value: 'America/Bogota', label: 'Bogotá (GMT-5)' },
    { value: 'America/Mexico_City', label: 'Ciudad de México (GMT-6)' },
    { value: 'America/New_York', label: 'Nueva York (GMT-5)' },
    { value: 'America/Los_Angeles', label: 'Los Ángeles (GMT-8)' },
    { value: 'America/Santiago', label: 'Santiago (GMT-3)' },
    { value: 'America/Buenos_Aires', label: 'Buenos Aires (GMT-3)' },
    { value: 'Europe/Madrid', label: 'Madrid (GMT+1)' },
    { value: 'UTC', label: 'UTC (GMT+0)' }
  ];

  dateFormats = [
    { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
    { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
    { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
    { value: 'DD-MM-YYYY', label: 'DD-MM-YYYY' }
  ];

  firstDayOfWeekOptions = [
    { value: 0, label: 'Domingo' },
    { value: 1, label: 'Lunes' },
    { value: 2, label: 'Martes' },
    { value: 6, label: 'Sábado' }
  ];

  themes = [
    { value: 'light', label: 'Claro' },
    { value: 'dark', label: 'Oscuro' },
    { value: 'auto', label: 'Automático' }
  ];

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private settingsService: UserSettingsService,
    private translationService: TranslationService,
    private router: Router
  ) {}

  ngOnInit() {
    // Solo verificar autenticación si no está embebido (el padre ya lo hace)
    if (!this.embedded && !this.authService.isAuthenticated()) {
      this.router.navigate(['/login']);
      return;
    }

    this.initForm();
    this.loadUserSettings();
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  initForm() {
    this.preferencesForm = this.fb.group({
      language: [''],
      timezone: [''],
      dateFormat: [''],
      firstDayOfWeek: [0],
      theme: ['']
    });
  }

  loadUserSettings() {
    this.loadingSettings = true;
    this.errorMessage = '';

    const loadSubscription = this.settingsService.getUserSettings().subscribe({
      next: (response) => {
        this.loadingSettings = false;
        this.currentSettings = response.data;
        
        // Prellenar el formulario con las preferencias actuales
        this.preferencesForm.patchValue({
          language: response.data.language || '',
          timezone: response.data.timezone || '',
          dateFormat: response.data.dateFormat || '',
          firstDayOfWeek: response.data.firstDayOfWeek ?? 0,
          theme: response.data.theme || ''
        });
      },
      error: (error: HttpErrorResponse) => {
        this.loadingSettings = false;
        this.errorMessage = extractErrorMessage(error);
      }
    });

    this.subscriptions.add(loadSubscription);
  }

  isFieldInvalid(fieldName: string): boolean {
    return isFieldInvalid(this.preferencesForm, fieldName);
  }

  getFieldError(fieldName: string): string {
    return getFieldError(this.preferencesForm, fieldName);
  }

  onSubmit() {
    if (this.preferencesForm.invalid) {
      markFormGroupTouched(this.preferencesForm);
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    const formValue = this.preferencesForm.value;
    
    // Crear request solo con los campos que han cambiado o tienen valor
    const request: UpdateUserSettingsRequest = {};
    
    if (formValue.language !== (this.currentSettings?.language || '')) {
      request.language = formValue.language || null;
    }
    if (formValue.timezone !== (this.currentSettings?.timezone || '')) {
      request.timezone = formValue.timezone || null;
    }
    if (formValue.dateFormat !== (this.currentSettings?.dateFormat || '')) {
      request.dateFormat = formValue.dateFormat || null;
    }
    if (formValue.firstDayOfWeek !== (this.currentSettings?.firstDayOfWeek ?? 0)) {
      request.firstDayOfWeek = formValue.firstDayOfWeek ?? null;
    }
    if (formValue.theme !== (this.currentSettings?.theme || '')) {
      request.theme = formValue.theme || null;
    }

    // Si no hay cambios, no hacer la petición
    if (Object.keys(request).length === 0) {
      this.isLoading = false;
      this.successMessage = 'No hay cambios para guardar';
      setTimeout(() => {
        this.successMessage = '';
      }, 3000);
      return;
    }

    const updateSubscription = this.settingsService.updateUserSettings(request).subscribe({
      next: (response) => {
        this.isLoading = false;
        this.successMessage = 'Preferencias actualizadas exitosamente';
        this.currentSettings = response.data;
        
        // Si se cambió el idioma, actualizar el servicio de traducción
        if (request.language) {
          this.translationService.changeLanguage(request.language);
        }
        
        // Emitir evento para el componente padre
        this.preferencesUpdated.emit();
        
        // Si no está embebido, redirigir después de 2 segundos
        if (!this.embedded) {
          setTimeout(() => {
            this.router.navigate(['/dashboard']);
          }, 2000);
        } else {
          // Si está embebido, limpiar el mensaje después de 5 segundos
          setTimeout(() => {
            this.successMessage = '';
          }, 5000);
        }
      },
      error: (error: HttpErrorResponse) => {
        this.isLoading = false;
        this.errorMessage = extractErrorMessage(error);
      }
    });

    this.subscriptions.add(updateSubscription);
  }

  onCancel() {
    if (!this.embedded) {
      this.router.navigate(['/dashboard']);
    } else {
      this.loadUserSettings(); // Recargar preferencias originales
      this.errorMessage = '';
      this.successMessage = '';
    }
  }
}
