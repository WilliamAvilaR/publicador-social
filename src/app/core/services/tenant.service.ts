import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  GetCurrentTenantResponse,
  GetTenantInfoResponse,
  GetTenantsResponse,
  GetTenantRolesResponse,
  TenantEntitlementsResponse,
  TenantWorkspaceResponse,
  SelectedTenant,
  TenantSummary
} from '../models/tenant.model';
import { TenantContextService } from './tenant-context.service';

/**
 * Servicio de API para consumir los endpoints de /api/tenants
 * (solo operaciones de lectura para el usuario final, sin acciones de administrador).
 */
@Injectable({
  providedIn: 'root'
})
export class TenantService {

  private readonly baseUrl = '/api/tenants';

  constructor(
    private http: HttpClient,
    private tenantContext: TenantContextService
  ) {}

  /**
   * GET /api/tenants
   * Devuelve todos los tenants a los que pertenece el usuario autenticado.
   */
  getUserTenants(): Observable<GetTenantsResponse> {
    return this.http.get<GetTenantsResponse>(this.baseUrl);
  }

  /**
   * GET /api/tenants/roles
   * Catálogo global de roles (sin exigir TenantMember sobre un tenant concreto).
   */
  getTenantRoles(): Observable<GetTenantRolesResponse> {
    return this.http.get<GetTenantRolesResponse>(`${this.baseUrl}/roles`);
  }

  /**
   * Normaliza la lista de tenants ante respuestas camelCase o PascalCase.
   */
  getTenantsListFromResponse(response: GetTenantsResponse): TenantSummary[] {
    const data = response.data as unknown as {
      Tenants?: TenantSummary[];
      tenants?: TenantSummary[];
    };
    return data.tenants ?? data.Tenants ?? [];
  }

  /**
   * Actualiza el tenant seleccionado según la lista reciente (rol, nombre, etc.).
   * Usado tras refresh / reauth: siempre elige un tenant si la lista no está vacía.
   */
  reconcileContextWithTenantList(tenants: TenantSummary[]): void {
    if (tenants.length === 0) {
      this.tenantContext.clearCurrentTenant();
      return;
    }
    const current = this.tenantContext.getCurrentTenant();
    if (!current) {
      this.setCurrentTenantFromSummary(tenants[0]);
      return;
    }
    const match = tenants.find(t => t.tenantId === current.tenantId);
    if (match) {
      this.setCurrentTenantFromSummary(match);
    } else {
      this.setCurrentTenantFromSummary(tenants[0]);
    }
  }

  /**
   * Primera carga del shell del dashboard: con varios workspaces exige elección explícita
   * si no hay un tenant guardado válido (localStorage). Con uno solo se fija automáticamente.
   */
  reconcileContextForDashboardLoad(tenants: TenantSummary[]): { needsWorkspaceChoice: boolean } {
    if (tenants.length === 0) {
      this.tenantContext.clearCurrentTenant();
      return { needsWorkspaceChoice: false };
    }
    if (tenants.length === 1) {
      this.setCurrentTenantFromSummary(tenants[0]);
      return { needsWorkspaceChoice: false };
    }
    const current = this.tenantContext.getCurrentTenant();
    const match = current ? tenants.find(t => t.tenantId === current.tenantId) : undefined;
    if (match) {
      this.setCurrentTenantFromSummary(match);
      return { needsWorkspaceChoice: false };
    }
    this.tenantContext.clearCurrentTenant();
    return { needsWorkspaceChoice: true };
  }

  /**
   * GET /api/tenants/current
   * Devuelve el tenant actual usando el TenantContext del backend.
   * Requiere que el header X-Tenant-Id esté establecido.
   */
  getCurrentTenant(): Observable<GetCurrentTenantResponse> {
    return this.http.get<GetCurrentTenantResponse>(`${this.baseUrl}/current`);
  }

  /**
   * GET /api/tenants/{tenantId}/info
   * Devuelve información detallada de un tenant (si el usuario tiene acceso).
   */
  getTenantInfo(tenantId: number): Observable<GetTenantInfoResponse> {
    return this.http.get<GetTenantInfoResponse>(`${this.baseUrl}/${tenantId}/info`);
  }

  /**
   * GET /api/tenants/{tenantId}/workspace
   * Devuelve información del workspace del tenant.
   */
  getTenantWorkspace(tenantId: number): Observable<TenantWorkspaceResponse> {
    return this.http.get<TenantWorkspaceResponse>(`${this.baseUrl}/${tenantId}/workspace`);
  }

  /**
   * GET /api/tenants/{tenantId}/entitlements
   * Devuelve los entitlements del tenant (features, límites y uso actual).
   */
  getTenantEntitlements(tenantId: number): Observable<TenantEntitlementsResponse> {
    return this.http.get<TenantEntitlementsResponse>(`${this.baseUrl}/${tenantId}/entitlements`);
  }

  /**
   * Helper para convertir un TenantSummary en SelectedTenant
   * y establecerlo en el contexto.
   */
  setCurrentTenantFromSummary(tenant: TenantSummary): void {
    const selected: SelectedTenant = {
      tenantId: tenant.tenantId,
      name: tenant.name,
      slug: tenant.slug,
      role: tenant.role,
      planCode: tenant.planCode
    };
    this.tenantContext.setCurrentTenant(selected);
  }
}

