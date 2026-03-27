import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  AcceptInvitationRequest,
  AcceptInvitationResponse,
  CreateInvitationRequest,
  CreateInvitationResponse,
  GetTenantInvitationsResponse,
  TenantInvitationDto,
  ValidateInvitationResponse
} from '../models/auth.model';
import { TenantContextService } from './tenant-context.service';

/**
 * Servicio para gestionar el flujo de invitaciones a tenants:
 * - Crear invitaciones (para Owners/Admins de un tenant)
 * - Validar un token de invitación
 * - Aceptar una invitación (crear contraseña y autenticarse)
 *
 * Los endpoints son:
 * - POST /api/tenants/{tenantId}/invitations
 * - GET  /api/tenants/{tenantId}/invitations
 * - GET  /api/invitations/validate?token=...
 * - POST /api/invitations/accept
 */
@Injectable({
  providedIn: 'root'
})
export class InvitationService {

  constructor(
    private http: HttpClient,
    private tenantContext: TenantContextService
  ) {}

  /**
   * Crea una invitación para el tenant actual usando el contexto.
   * Requiere que haya un tenant seleccionado y que el usuario tenga permisos (Owner/Admin).
   */
  createInvitationForCurrentTenant(request: CreateInvitationRequest): Observable<CreateInvitationResponse> {
    const tenantId = this.tenantContext.getCurrentTenantId();
    if (tenantId == null) {
      throw new Error('No hay un workspace/tenant seleccionado para crear la invitación.');
    }

    return this.http.post<CreateInvitationResponse>(
      `/api/tenants/${tenantId}/invitations`,
      request
    );
  }

  /**
   * Lista invitaciones del tenant actual.
   * Permite filtrar por status (Pending, Accepted, Expired, Cancelled) y search.
   */
  getInvitationsForCurrentTenant(filters?: {
    status?: string;
    search?: string;
  }): Observable<GetTenantInvitationsResponse> {
    const tenantId = this.tenantContext.getCurrentTenantId();
    if (tenantId == null) {
      throw new Error('No hay un workspace/tenant seleccionado para consultar invitaciones.');
    }

    let params = new HttpParams();
    const status = filters?.status?.trim();
    const search = filters?.search?.trim();

    if (status && status !== 'All') {
      params = params.set('status', status);
    }

    if (search) {
      params = params.set('search', search);
    }

    return this.http.get<GetTenantInvitationsResponse>(
      `/api/tenants/${tenantId}/invitations`,
      { params }
    );
  }

  /**
   * Cancela una invitación del tenant actual (cambio de estado a Cancelled).
   */
  cancelInvitationForCurrentTenant(
    invitationId: number
  ): Observable<{ data: TenantInvitationDto; requiresReauth?: boolean }> {
    const tenantId = this.tenantContext.getCurrentTenantId();
    if (tenantId == null) {
      throw new Error('No hay un workspace/tenant seleccionado para cancelar invitaciones.');
    }

    return this.http.patch<{ data: TenantInvitationDto; requiresReauth?: boolean }>(
      `/api/tenants/${tenantId}/invitations/${invitationId}/cancel`,
      {}
    );
  }

  /**
   * Valida un token de invitación (público, sin Authorization).
   */
  validateInvitationToken(token: string): Observable<ValidateInvitationResponse> {
    const params = new HttpParams().set('token', token);
    return this.http.get<ValidateInvitationResponse>('/api/invitations/validate', { params });
  }

  /**
   * Acepta una invitación creando contraseña y devolviendo un JWT.
   * Este endpoint es público y no requiere Authorization.
   */
  acceptInvitation(request: AcceptInvitationRequest): Observable<AcceptInvitationResponse> {
    return this.http.post<AcceptInvitationResponse>('/api/invitations/accept', request);
  }
}

