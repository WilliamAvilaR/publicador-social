import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  CreateTenantUserDto,
  CreateTenantUserResponse,
  GetTenantUsersResponse,
  TransferTenantOwnershipDto,
  TransferTenantOwnershipResponse,
  UpdateTenantUserRoleDto,
  UpdateTenantUserRoleResponse,
  UpdateTenantUserStatusDto,
  UpdateTenantUserStatusResponse
} from '../models/tenant.model';
import { TenantContextService } from './tenant-context.service';

/**
 * Servicio de API para gestionar los usuarios de un tenant (equipo/workspace).
 *
 * Envuelve los endpoints:
 * - GET /api/tenants/{tenantId}/users
 * - POST /api/tenants/{tenantId}/users
 * - DELETE /api/tenants/{tenantId}/users/{userId}
 * - PATCH /api/tenants/{tenantId}/users/{userId}/role
 * - PATCH /api/tenants/{tenantId}/users/{userId}/status
 * - POST /api/tenants/{tenantId}/transfer-ownership
 *
 * El token JWT y el header X-Tenant-Id se agregan automáticamente
 * mediante los interceptores HTTP existentes.
 */
@Injectable({
  providedIn: 'root'
})
export class TenantUsersService {
  private readonly baseUrl = '/api/tenants';

  constructor(
    private http: HttpClient,
    private tenantContext: TenantContextService
  ) {}

  /**
   * Devuelve el tenantId actual o lanza un error si no hay ninguno seleccionado.
   * Útil para las operaciones que trabajan siempre sobre el workspace activo.
   */
  private getCurrentTenantIdOrThrow(): number {
    const tenantId = this.tenantContext.getCurrentTenantId();
    if (tenantId == null) {
      throw new Error('No hay un workspace/tenant seleccionado actualmente.');
    }
    return tenantId;
  }

  /**
   * GET /api/tenants/{tenantId}/users
   * Lista los usuarios que pertenecen al tenant indicado.
   */
  getTenantUsers(tenantId: number): Observable<GetTenantUsersResponse> {
    return this.http.get<GetTenantUsersResponse>(`${this.baseUrl}/${tenantId}/users`);
  }

  /**
   * Variante que usa el tenant actual del contexto.
   */
  getCurrentTenantUsers(): Observable<GetTenantUsersResponse> {
    const tenantId = this.getCurrentTenantIdOrThrow();
    return this.getTenantUsers(tenantId);
  }

  /**
   * POST /api/tenants/{tenantId}/users
   * Crea o vincula un usuario al tenant (gestión de equipo).
   */
  createTenantUser(tenantId: number, payload: CreateTenantUserDto): Observable<CreateTenantUserResponse> {
    return this.http.post<CreateTenantUserResponse>(`${this.baseUrl}/${tenantId}/users`, payload);
  }

  /**
   * Variante que usa el tenant actual del contexto.
   */
  createUserInCurrentTenant(payload: CreateTenantUserDto): Observable<CreateTenantUserResponse> {
    const tenantId = this.getCurrentTenantIdOrThrow();
    return this.createTenantUser(tenantId, payload);
  }

  /**
   * DELETE /api/tenants/{tenantId}/users/{userId}
   * Desasigna (elimina) un usuario del tenant.
   */
  deleteTenantUser(
    tenantId: number,
    userId: number
  ): Observable<{ data?: unknown; requiresReauth?: boolean }> {
    return this.http.delete<{ data?: unknown; requiresReauth?: boolean }>(
      `${this.baseUrl}/${tenantId}/users/${userId}`
    );
  }

  /**
   * Variante que usa el tenant actual del contexto.
   */
  deleteCurrentTenantUser(userId: number): Observable<{ data?: unknown; requiresReauth?: boolean }> {
    const tenantId = this.getCurrentTenantIdOrThrow();
    return this.deleteTenantUser(tenantId, userId);
  }

  /**
   * PATCH /api/tenants/{tenantId}/users/{userId}/role
   * Cambia el rol de un usuario dentro de ese tenant.
   */
  updateTenantUserRole(
    tenantId: number,
    userId: number,
    payload: UpdateTenantUserRoleDto
  ): Observable<UpdateTenantUserRoleResponse> {
    return this.http.patch<UpdateTenantUserRoleResponse>(
      `${this.baseUrl}/${tenantId}/users/${userId}/role`,
      payload
    );
  }

  /**
   * Variante que usa el tenant actual del contexto.
   */
  updateCurrentTenantUserRole(
    userId: number,
    payload: UpdateTenantUserRoleDto
  ): Observable<UpdateTenantUserRoleResponse> {
    const tenantId = this.getCurrentTenantIdOrThrow();
    return this.updateTenantUserRole(tenantId, userId, payload);
  }

  /**
   * PATCH /api/tenants/{tenantId}/users/{userId}/status
   * Activa/desactiva la relación usuario–tenant (sacar del equipo sin borrar el usuario global).
   */
  updateTenantUserStatus(
    tenantId: number,
    userId: number,
    payload: UpdateTenantUserStatusDto
  ): Observable<UpdateTenantUserStatusResponse> {
    return this.http.patch<UpdateTenantUserStatusResponse>(
      `${this.baseUrl}/${tenantId}/users/${userId}/status`,
      payload
    );
  }

  /**
   * Variante que usa el tenant actual del contexto.
   */
  updateCurrentTenantUserStatus(
    userId: number,
    payload: UpdateTenantUserStatusDto
  ): Observable<UpdateTenantUserStatusResponse> {
    const tenantId = this.getCurrentTenantIdOrThrow();
    return this.updateTenantUserStatus(tenantId, userId, payload);
  }

  /**
   * POST /api/tenants/{tenantId}/transfer-ownership
   */
  transferOwnership(
    tenantId: number,
    payload: TransferTenantOwnershipDto
  ): Observable<TransferTenantOwnershipResponse> {
    return this.http.post<TransferTenantOwnershipResponse>(
      `${this.baseUrl}/${tenantId}/transfer-ownership`,
      payload
    );
  }

  transferOwnershipInCurrentTenant(
    payload: TransferTenantOwnershipDto
  ): Observable<TransferTenantOwnershipResponse> {
    const tenantId = this.getCurrentTenantIdOrThrow();
    return this.transferOwnership(tenantId, payload);
  }
}

