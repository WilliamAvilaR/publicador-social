import { Injectable, Renderer2, RendererFactory2 } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export type Theme = 'light' | 'dark' | 'auto';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private renderer: Renderer2;
  private currentThemeSubject = new BehaviorSubject<Theme>('light');
  public currentTheme$: Observable<Theme> = this.currentThemeSubject.asObservable();

  constructor(private rendererFactory: RendererFactory2) {
    this.renderer = this.rendererFactory.createRenderer(null, null);
  }

  /**
   * Inicializa el tema desde las preferencias del usuario o usa el tema por defecto
   */
  initializeTheme(savedTheme?: string | null): void {
    const theme = this.validateTheme(savedTheme) || 'light';
    this.applyTheme(theme);
  }

  /**
   * Aplica un tema específico
   */
  applyTheme(theme: Theme): void {
    const validatedTheme = this.validateTheme(theme) || 'light';
    this.currentThemeSubject.next(validatedTheme);
    
    const body = document.body;
    const html = document.documentElement;

    // Remover clases anteriores
    this.renderer.removeClass(body, 'light-theme');
    this.renderer.removeClass(body, 'dark-theme');
    this.renderer.removeAttribute(html, 'data-theme');

    // Aplicar el tema efectivo
    const effectiveTheme = this.getEffectiveTheme(validatedTheme);
    
    if (effectiveTheme === 'dark') {
      this.renderer.addClass(body, 'dark-theme');
      this.renderer.setAttribute(html, 'data-theme', 'dark');
    } else {
      this.renderer.addClass(body, 'light-theme');
      this.renderer.setAttribute(html, 'data-theme', 'light');
    }
  }

  /**
   * Obtiene el tema efectivo (resuelve 'auto' a 'light' o 'dark')
   */
  getEffectiveTheme(theme?: Theme): 'light' | 'dark' {
    const themeToCheck = theme || this.currentThemeSubject.value;
    
    if (themeToCheck === 'auto') {
      // Detectar preferencia del sistema
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    
    return themeToCheck === 'dark' ? 'dark' : 'light';
  }

  /**
   * Obtiene el tema actual
   */
  getCurrentTheme(): Theme {
    return this.currentThemeSubject.value;
  }

  /**
   * Valida que el tema sea uno de los valores permitidos
   */
  private validateTheme(theme: string | null | undefined): Theme | null {
    if (!theme) return null;
    const validThemes: Theme[] = ['light', 'dark', 'auto'];
    return validThemes.includes(theme as Theme) ? (theme as Theme) : null;
  }

  /**
   * Escucha cambios en la preferencia del sistema (para modo 'auto')
   */
  watchSystemPreference(): void {
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      
      // Usar addEventListener si está disponible (navegadores modernos)
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', () => {
          if (this.currentThemeSubject.value === 'auto') {
            this.applyTheme('auto');
          }
        });
      } else {
        // Fallback para navegadores antiguos
        mediaQuery.addListener(() => {
          if (this.currentThemeSubject.value === 'auto') {
            this.applyTheme('auto');
          }
        });
      }
    }
  }
}
