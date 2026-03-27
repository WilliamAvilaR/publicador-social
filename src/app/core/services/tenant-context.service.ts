import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { SelectedTenant } from '../models/tenant.model';

/**
 * Servicio sencillo para manejar el tenant actual en el frontend.
 * - Guarda el tenant seleccionado en localStorage
 * - Expone un observable para reaccionar a cambios
 * - Proporciona el tenantId actual para el interceptor (X-Tenant-Id)
 */
@Injectable({
  providedIn: 'root'
})
export class TenantContextService {
  private readonly STORAGE_KEY = 'current_tenant';

  private currentTenantSubject: BehaviorSubject<SelectedTenant | null>;
  currentTenant$;

  constructor() {
    const initialTenant = this.loadFromStorage();
    this.currentTenantSubject = new BehaviorSubject<SelectedTenant | null>(initialTenant);
    this.currentTenant$ = this.currentTenantSubject.asObservable();
  }

  /**
   * Devuelve el tenant actual (o null si no hay ninguno seleccionado)
   */
  getCurrentTenant(): SelectedTenant | null {
    return this.currentTenantSubject.value;
  }

  /**
   * Devuelve el tenantId actual (o null si no hay)
   */
  getCurrentTenantId(): number | null {
    const tenant = this.currentTenantSubject.value;
    return tenant ? tenant.tenantId : null;
  }

  /**
   * Establece el tenant actual y lo persiste en localStorage
   */
  setCurrentTenant(tenant: SelectedTenant): void {
    if (!tenant || typeof tenant.tenantId !== 'number') {
      console.error('Tenant inválido al intentar establecer el contexto:', tenant);
      return;
    }

    this.currentTenantSubject.next(tenant);
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(tenant));
    } catch (error) {
      console.error('Error al guardar tenant en localStorage:', error);
    }
  }

  /**
   * Limpia el tenant actual (por ejemplo, al cerrar sesión)
   */
  clearCurrentTenant(): void {
    this.currentTenantSubject.next(null);
    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch (error) {
      console.error('Error al limpiar tenant en localStorage:', error);
    }
  }

  /**
   * Carga el tenant desde localStorage (si existe y es válido)
   */
  private loadFromStorage(): SelectedTenant | null {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) {
        return null;
      }

      const parsed = JSON.parse(stored);
      if (!parsed || typeof parsed !== 'object' || typeof parsed.tenantId !== 'number') {
        return null;
      }

      return parsed as SelectedTenant;
    } catch (error) {
      console.error('Error al cargar tenant desde localStorage:', error);
      return null;
    }
  }
}

