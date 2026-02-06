import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TranslationService } from './core/services/translation.service';
import { ThemeService } from './core/services/theme.service';
import { UserSettingsService } from './core/services/user-settings.service';
import { take } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  constructor(
    private translationService: TranslationService,
    private themeService: ThemeService,
    private userSettingsService: UserSettingsService
  ) {}

  ngOnInit(): void {
    // Inicializar idioma
    this.translationService.initializeLanguage();
    
    // Inicializar tema
    this.initializeTheme();
    
    // Escuchar cambios en la preferencia del sistema para modo 'auto'
    this.themeService.watchSystemPreference();
  }

  private initializeTheme(): void {
    // Intentar cargar el tema guardado del usuario
    this.userSettingsService.getUserSettings()
      .pipe(take(1))
      .subscribe({
        next: (response) => {
          const savedTheme = response.data?.theme;
          this.themeService.initializeTheme(savedTheme);
        },
        error: () => {
          // Si hay error (usuario no autenticado o error de red), usar tema por defecto
          this.themeService.initializeTheme('light');
        }
      });
  }
}
