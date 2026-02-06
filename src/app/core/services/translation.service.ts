import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { UserSettingsService } from './user-settings.service';
import { take } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class TranslationService {
  constructor(
    private translate: TranslateService,
    private userSettingsService: UserSettingsService
  ) {}

  /**
   * Inicializa el servicio de traducción con el idioma del usuario
   */
  initializeLanguage(): void {
    // Idioma por defecto
    const defaultLang = 'es';
    this.translate.setDefaultLang(defaultLang);
    
    // Obtener idioma del usuario desde UserSettings
    this.userSettingsService.getUserSettings()
      .pipe(take(1))
      .subscribe({
        next: (response) => {
          const userLanguage = response.data.language || defaultLang;
          // Validar que el idioma esté soportado
          const supportedLangs = ['es', 'en', 'pt'];
          const langToUse = supportedLangs.includes(userLanguage) ? userLanguage : defaultLang;
          this.translate.use(langToUse);
        },
        error: () => {
          // Si hay error, usar idioma por defecto
          this.translate.use(defaultLang);
        }
      });
  }

  /**
   * Cambia el idioma y actualiza las preferencias del usuario
   */
  changeLanguage(lang: string): void {
    const supportedLangs = ['es', 'en', 'pt'];
    if (!supportedLangs.includes(lang)) {
      console.warn(`Idioma no soportado: ${lang}`);
      return;
    }

    this.translate.use(lang);
    
    // Actualizar preferencias del usuario
    this.userSettingsService.updateUserSettings({ language: lang })
      .pipe(take(1))
      .subscribe({
        error: (error) => {
          console.error('Error al actualizar idioma:', error);
        }
      });
  }

  /**
   * Obtiene el idioma actual
   */
  getCurrentLanguage(): string {
    return this.translate.currentLang || this.translate.defaultLang || 'es';
  }
}
