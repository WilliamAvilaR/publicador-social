import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { TenantContextService } from '../../../../core/services/tenant-context.service';
import { TenantUsersService } from '../../../../core/services/tenant-users.service';
import { InvitationService } from '../../../../core/services/invitation.service';
import { TenantService } from '../../../../core/services/tenant.service';
import { TenantEntitlementsService } from '../../../../core/services/tenant-entitlements.service';
import { AuthService } from '../../../../core/services/auth.service';
import {
  CreateInvitationResponse,
  TenantInvitationDto
} from '../../../../core/models/auth.model';
import { TenantEntitlementsResponse, TenantRole, TenantUser } from '../../../../core/models/tenant.model';
import { canUseLimit, getLimitValue } from '../../../../core/utils/entitlements.utils';
import { markFormGroupTouched, isFieldInvalid } from '../../../../shared/utils/form.utils';
import { extractErrorMessage } from '../../../../shared/utils/error.utils';
import { getFieldError } from '../../../../shared/utils/validation.utils';
import {
  isTenantAdminRole,
  isTenantEditorRole,
  isTenantOwnerRole,
  isWorkspaceManagerRole
} from '../../../../core/utils/tenant-role.utils';

@Component({
  selector: 'app-tenant-team',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './tenant-team.component.html',
  styleUrl: './tenant-team.component.scss'
})
export class TenantTeamComponent implements OnInit, OnDestroy {
  team: TenantUser[] = [];
  loading = false;
  loadError: string | null = null;

  tenantRoles: TenantRole[] = [];
  rolesLoading = false;
  rolesError: string | null = null;

  inviteForm!: FormGroup;
  inviteLoading = false;
  inviteError: string | null = null;
  inviteSuccess: string | null = null;

  showInviteModal = false;

  showTransferModal = false;
  transferLoading = false;
  transferError: string | null = null;
  transferSuccess: string | null = null;
  selectedNewOwnerId: number | null = null;

  /** Último error al cambiar rol o estado de membresía (visible en la UI). */
  teamActionError: string | null = null;

  /** Evita doble envío mientras la API procesa el estado. */
  statusPendingUserId: number | null = null;

  /** Evita cambios de rol concurrentes en la misma fila. */
  rolePendingUserId: number | null = null;

  /** Evita eliminaciones concurrentes en la tabla de miembros. */
  deletePendingUserId: number | null = null;

  invitations: TenantInvitationDto[] = [];
  invitationsLoading = false;
  invitationsError: string | null = null;
  invitationActionError: string | null = null;
  cancelPendingInvitationId: number | null = null;

  entitlements: TenantEntitlementsResponse['data'] | null = null;
  entitlementsLoading = false;
  inviteSeatCheckPending = false;

  private subscriptions = new Subscription();

  constructor(
    private fb: FormBuilder,
    private tenantContext: TenantContextService,
    private tenantUsersService: TenantUsersService,
    private invitationService: InvitationService,
    private tenantService: TenantService,
    private tenantEntitlements: TenantEntitlementsService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.initInviteForm('Editor');
    this.loadTenantRoles();
    this.loadTeam();
    this.loadInvitations();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  private initInviteForm(defaultRoleCode: string = ''): void {
    this.inviteForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      firstName: [''],
      lastName: [''],
      telephone: [''],
      roleInTenant: [defaultRoleCode, [Validators.required]]
    });
  }

  private loadTenantRoles(): void {
    this.rolesLoading = true;
    this.rolesError = null;
    const sub = this.tenantService.getTenantRoles().subscribe({
      next: (res) => {
        this.rolesLoading = false;
        this.tenantRoles = res.data?.roles ?? [];
        const defaultCode = this.pickDefaultInviteRoleCode(this.tenantRoles);
        this.inviteForm.patchValue({ roleInTenant: defaultCode });
      },
      error: (err: HttpErrorResponse) => {
        this.rolesLoading = false;
        this.rolesError = extractErrorMessage(err);
      }
    });
    this.subscriptions.add(sub);
  }

  private pickDefaultInviteRoleCode(roles: TenantRole[]): string {
    const inviteable = this.inviteRoleOptions.map(r => r.code);
    if (inviteable.length) return inviteable[0];
    const nonOwner = roles.filter(r => !isTenantOwnerRole(r.code));
    const def = nonOwner.find(r => r.isDefaultForNewUsers);
    if (def) return def.code;
    if (nonOwner.length) return nonOwner[0].code;
    return roles[0]?.code ?? 'Editor';
  }

  /** Roles que se pueden asignar al invitar (nunca propietario; admin de tenant no usa roles isAdmin). */
  get inviteRoleOptions(): TenantRole[] {
    const withoutOwner = this.tenantRoles.filter(r => !isTenantOwnerRole(r.code));
    const myRole = this.tenantContext.getCurrentTenant()?.role;
    const onlyAdmin = isTenantAdminRole(myRole) && !isTenantOwnerRole(myRole);
    if (onlyAdmin) {
      return withoutOwner.filter(r => !r.isAdmin);
    }
    return withoutOwner;
  }

  /** Roles para PATCH de rol (no se asigna propietario por este medio). */
  get assignableRoleOptions(): TenantRole[] {
    return this.tenantRoles.filter(r => !isTenantOwnerRole(r.code));
  }

  get currentUserId(): number | null {
    const u = this.authService.getUser();
    return u?.idUsuario ?? null;
  }

  isWorkspaceManager(): boolean {
    return isWorkspaceManagerRole(this.tenantContext.getCurrentTenant()?.role);
  }

  isCurrentUserTenantOwner(): boolean {
    return isTenantOwnerRole(this.tenantContext.getCurrentTenant()?.role);
  }

  canEditMemberRow(member: TenantUser): boolean {
    if (!this.isWorkspaceManager()) return false;
    if (this.currentUserId !== null && member.userId === this.currentUserId) return false;
    const myRole = this.tenantContext.getCurrentTenant()?.role;
    if (isTenantOwnerRole(member.roleInTenant) && !isTenantOwnerRole(myRole)) {
      return false;
    }
    return true;
  }

  /** Propietarios del tenant no se activan/desactivan desde la UI (solo lectura del estado). */
  isMemberTenantOwner(member: TenantUser): boolean {
    return isTenantOwnerRole(member.roleInTenant);
  }

  canToggleMemberStatus(member: TenantUser): boolean {
    if (this.isMemberTenantOwner(member)) {
      return false;
    }
    return this.canEditMemberRow(member);
  }

  canDeleteMember(member: TenantUser): boolean {
    if (this.isMemberTenantOwner(member)) return false;
    return this.canEditMemberRow(member);
  }

  get transferCandidates(): TenantUser[] {
    const uid = this.currentUserId;
    return this.team.filter(
      m => m.isActive && uid !== null && m.userId !== uid
    );
  }

  clearTeamActionError(): void {
    this.teamActionError = null;
  }

  openInviteModal(): void {
    this.inviteError = null;
    this.inviteSuccess = null;
    this.invitationActionError = null;
    this.teamActionError = null;
    const code = this.pickDefaultInviteRoleCode(this.tenantRoles);
    if (this.inviteForm) {
      this.inviteForm.patchValue({ roleInTenant: code });
    }

    // Gate de cupo para no mostrar el formulario si ya se alcanzó limit.users.
    this.showInviteModal = false;
    const sub = this.tenantEntitlements.refreshCurrentEntitlements().subscribe({
      next: (data) => {
        this.entitlements = data;

        const gate = this.computeInviteSeatGate();
        if (!gate.allowed) {
          // Mostrar mensaje sin abrir el modal (visible arriba en "Miembros del equipo").
          this.teamActionError =
            gate.message || 'No puedes invitar más miembros por tu plan actual.';
          return;
        }

        this.showInviteModal = true;
      },
      error: () => {
        // Si falla la verificación, dejamos que el backend haga el enforcement.
        this.showInviteModal = true;
      }
    });
    this.subscriptions.add(sub);
  }

  closeInviteModal(): void {
    this.showInviteModal = false;
  }

  openTransferModal(): void {
    this.transferError = null;
    this.transferSuccess = null;
    this.selectedNewOwnerId = null;
    this.showTransferModal = true;
  }

  closeTransferModal(): void {
    this.showTransferModal = false;
  }

  onTransferSubmit(): void {
    if (this.selectedNewOwnerId == null) {
      this.transferError = 'Selecciona un miembro como nuevo propietario.';
      return;
    }
    this.transferLoading = true;
    this.transferError = null;
    this.transferSuccess = null;
    const sub = this.tenantUsersService
      .transferOwnershipInCurrentTenant({ newOwnerUserId: this.selectedNewOwnerId })
      .subscribe({
        next: (res) => {
          this.transferLoading = false;
          this.transferSuccess = res.data?.message || 'Propiedad transferida correctamente.';
          this.loadTeam();
          this.loadInvitations();
          this.refreshEntitlements();
          setTimeout(() => {
            this.transferSuccess = null;
            this.closeTransferModal();
          }, 4000);
        },
        error: (error: HttpErrorResponse) => {
          this.transferLoading = false;
          this.transferError = extractErrorMessage(error);
        }
      });
    this.subscriptions.add(sub);
  }

  private loadTeam(): void {
    this.loading = true;
    this.loadError = null;

    const sub = this.tenantUsersService.getCurrentTenantUsers().subscribe({
      next: (response) => {
        const data = response.data;
        this.team = data?.users || [];
        this.loading = false;
      },
      error: (error: HttpErrorResponse) => {
        console.error('Error al cargar equipo del tenant:', error);
        this.loadError = extractErrorMessage(error);
        this.loading = false;
      }
    });

    this.subscriptions.add(sub);
  }

  loadInvitations(): void {
    this.invitationsLoading = true;
    this.invitationsError = null;

    const sub = this.invitationService
      .getInvitationsForCurrentTenant({
        status: 'Pending'
      })
      .subscribe({
        next: (response) => {
          this.invitations = response.data?.invitations || [];
          this.invitationsLoading = false;
        },
        error: (error: HttpErrorResponse) => {
          console.error('Error al cargar invitaciones del tenant:', error);
          this.invitationsError = extractErrorMessage(error);
          this.invitationsLoading = false;
        }
      });

    this.subscriptions.add(sub);
  }

  private refreshEntitlements(): void {
    this.entitlementsLoading = true;
    const sub = this.tenantEntitlements.refreshCurrentEntitlements().subscribe({
      next: (data) => {
        this.entitlements = data;
        this.entitlementsLoading = false;
      },
      error: () => {
        // Si falla la carga, no bloqueamos UX: el enforcement real aplica en backend.
        this.entitlementsLoading = false;
      }
    });
    this.subscriptions.add(sub);
  }

  private computeInviteSeatGate(): { allowed: boolean; message?: string } {
    if (!this.entitlements) {
      // Sin entitlements cargados no bloqueamos: evitamos romper UX.
      return { allowed: true };
    }

    const seatLimit = getLimitValue(this.entitlements.limits, ['limit.users']);
    const seatUsed =
      (this.entitlements.currentUsage?.['limit.users'] as number | undefined) ??
      (this.entitlements.currentUsage?.users ?? 0);

    if (canUseLimit(seatUsed, seatLimit, 1)) {
      return { allowed: true };
    }

    if (seatLimit == null) {
      return { allowed: true };
    }

    return {
      allowed: false,
      message: `Has alcanzado el límite de usuarios para este workspace (${seatUsed}/${seatLimit}). Actualiza tu plan o elimina usuarios/invitaciones pendientes.`
    };
  }

  clearInvitationActionError(): void {
    this.invitationActionError = null;
  }

  onCancelInvitation(invitation: TenantInvitationDto): void {
    if (this.cancelPendingInvitationId !== null) return;
    if (invitation.status !== 'Pending') return;

    const invitee = this.getInvitationDisplayName(invitation);
    const ok = confirm(`¿Cancelar la invitación de ${invitee} (${invitation.email})?`);
    if (!ok) return;

    this.invitationActionError = null;
    this.cancelPendingInvitationId = invitation.invitationId;

    const sub = this.invitationService
      .cancelInvitationForCurrentTenant(invitation.invitationId)
      .subscribe({
        next: () => {
          this.cancelPendingInvitationId = null;
          this.loadInvitations();
          this.refreshEntitlements();
        },
        error: (error: HttpErrorResponse) => {
          this.cancelPendingInvitationId = null;
          this.invitationActionError = extractErrorMessage(
            error,
            'No se pudo cancelar la invitación. Puede que ya no esté pendiente.'
          );
          this.loadInvitations();
        }
      });

    this.subscriptions.add(sub);
  }

  getInvitationStatusLabel(status: string): string {
    if (status === 'Pending') return 'Pendiente';
    if (status === 'Accepted') return 'Aceptada';
    if (status === 'Expired') return 'Expirada';
    if (status === 'Cancelled') return 'Cancelada';
    return status;
  }

  getInvitationStatusClass(status: string): Record<string, boolean> {
    return {
      'invitation-status': true,
      'invitation-status--pending': status === 'Pending',
      'invitation-status--accepted': status === 'Accepted',
      'invitation-status--expired': status === 'Expired',
      'invitation-status--cancelled': status === 'Cancelled'
    };
  }

  getInvitationDisplayName(invitation: TenantInvitationDto): string {
    const first = invitation.firstName?.trim() || '';
    const last = invitation.lastName?.trim() || '';
    const fullName = `${first} ${last}`.trim();
    return fullName || 'Sin nombre';
  }

  isFieldInvalid(fieldName: string): boolean {
    return isFieldInvalid(this.inviteForm, fieldName);
  }

  getFieldError(fieldName: string): string {
    return getFieldError(this.inviteForm, fieldName);
  }

  onInviteSubmit(): void {
    if (this.inviteForm.invalid) {
      markFormGroupTouched(this.inviteForm);
      return;
    }

    this.inviteError = null;
    this.inviteSuccess = null;

    const formValue = this.inviteForm.value;
    const firstName = (formValue.firstName || '').trim();
    const lastName = (formValue.lastName || '').trim();

    // Validación de cupo SIEMPRE antes de crear la invitación (UX + enforcement backend).
    this.inviteSeatCheckPending = true;
    const subCheck = this.tenantEntitlements.refreshCurrentEntitlements().subscribe({
      next: (data) => {
        this.entitlements = data;
        this.inviteSeatCheckPending = false;

        const gate = this.computeInviteSeatGate();
        if (!gate.allowed) {
          this.inviteError = gate.message || 'No puedes invitar más miembros por tu plan actual.';
          return;
        }

        this.inviteLoading = true;
        const subCreate = this.invitationService
          .createInvitationForCurrentTenant({
            email: formValue.email,
            roleInTenant: formValue.roleInTenant,
            ...(firstName ? { firstName } : {}),
            ...(lastName ? { lastName } : {})
          })
          .subscribe({
            next: (response: CreateInvitationResponse) => {
              this.inviteLoading = false;
              const invitation = response.data;
              this.inviteSuccess = `Invitación creada para ${invitation.email}.
Puedes compartir este enlace para que acepte la invitación:\n${invitation.acceptLink}`;

              const defaultRole = this.pickDefaultInviteRoleCode(this.tenantRoles);
              this.inviteForm.reset({
                email: '',
                firstName: '',
                lastName: '',
                telephone: '',
                roleInTenant: defaultRole
              });

              setTimeout(() => {
                this.inviteSuccess = null;
                this.closeInviteModal();
              }, 8000);

              this.loadInvitations();
              this.refreshEntitlements();
            },
            error: (error: HttpErrorResponse) => {
              console.error('Error al invitar usuario al tenant:', error);
              this.inviteLoading = false;
              this.inviteError = extractErrorMessage(error);
            }
          });
        this.subscriptions.add(subCreate);
      },
      error: () => {
        this.inviteSeatCheckPending = false;
        this.inviteError = 'No se pudo verificar el cupo en este momento. Intenta nuevamente.';
      }
    });
    this.subscriptions.add(subCheck);
  }

  /** Nombre visible del rol a partir del código (catálogo cargado o el código). */
  private getRoleDisplayName(roleCode: string): string {
    const r = this.tenantRoles.find(t => t.code === roleCode);
    return r?.name ?? roleCode;
  }

  /**
   * Etiqueta en español para UI (badges / desplegables), alineada con tipos de rol del backend.
   */
  getRoleDisplayLabel(roleCode: string): string {
    if (isTenantOwnerRole(roleCode)) return 'Propietario';
    if (isTenantAdminRole(roleCode)) return 'Administrador';
    if (isTenantEditorRole(roleCode)) return 'Editor';
    return this.getRoleDisplayName(roleCode);
  }

  /** Variante visual del badge: owner | admin | editor | neutral */
  getRoleBadgeModifier(roleCode: string): 'owner' | 'admin' | 'editor' | 'neutral' {
    if (isTenantOwnerRole(roleCode)) return 'owner';
    if (isTenantAdminRole(roleCode)) return 'admin';
    if (isTenantEditorRole(roleCode)) return 'editor';
    return 'neutral';
  }

  roleBadgeClasses(roleCode: string): Record<string, boolean> {
    const m = this.getRoleBadgeModifier(roleCode);
    return {
      'role-badge': true,
      'role-badge--owner': m === 'owner',
      'role-badge--admin': m === 'admin',
      'role-badge--editor': m === 'editor',
      'role-badge--neutral': m === 'neutral'
    };
  }

  onChangeRole(user: TenantUser, newRole: string): void {
    if (!this.canEditMemberRow(user)) return;
    if (!newRole || newRole === user.roleInTenant) {
      return;
    }
    if (this.rolePendingUserId !== null) {
      return;
    }

    const userLabel = user.fullName?.trim() || user.email;
    const fromLabel = this.getRoleDisplayLabel(user.roleInTenant);
    const toLabel = this.getRoleDisplayLabel(newRole);
    const ok = confirm(
      `¿Cambiar el rol de ${userLabel} de «${fromLabel}» a «${toLabel}»?`
    );
    if (!ok) {
      return;
    }

    this.teamActionError = null;
    this.rolePendingUserId = user.userId;

    const sub = this.tenantUsersService
      .updateCurrentTenantUserRole(user.userId, {
        roleInTenant: newRole
      })
      .subscribe({
        next: (response) => {
          this.rolePendingUserId = null;
          const updated = response.data;
          this.team = this.team.map(u =>
            u.userId === updated.userId ? { ...u, roleInTenant: updated.roleInTenant } : u
          );
        },
        error: (error: HttpErrorResponse) => {
          this.rolePendingUserId = null;
          console.error('Error al cambiar rol del usuario en el tenant:', error);
          this.teamActionError = extractErrorMessage(
            error,
            'No se pudo cambiar el rol. Comprueba permisos y reglas del workspace.'
          );
          this.loadTeam();
        }
      });

    this.subscriptions.add(sub);
  }

  /**
   * Evita que el checkbox cambie solo con el clic: el estado lo actualiza la API / `member.isActive`.
   */
  onStatusToggleClick(event: Event, member: TenantUser): void {
    event.preventDefault();
    if (!this.canToggleMemberStatus(member)) {
      return;
    }
    this.onToggleStatus(member);
  }

  /**
   * Activa o desactiva la membresía en el tenant (propietario o admin, según API).
   * Al desactivar, se pide confirmación; un propietario puede desactivar p. ej. a un Editor.
   */
  onToggleStatus(user: TenantUser): void {
    if (!this.canToggleMemberStatus(user)) return;
    if (this.statusPendingUserId !== null) {
      return;
    }

    const newStatus = !user.isActive;

    if (user.isActive && !newStatus) {
      const label = user.fullName?.trim() || user.email;
      const ok = confirm(
        `¿Desactivar a ${label} en este workspace?\n\n` +
          'Perderá acceso hasta que un propietario o administrador reactive su membresía.'
      );
      if (!ok) {
        return;
      }
    }

    this.teamActionError = null;
    this.statusPendingUserId = user.userId;

    const sub = this.tenantUsersService
      .updateCurrentTenantUserStatus(user.userId, {
        isActive: newStatus
      })
      .subscribe({
        next: (response) => {
          this.statusPendingUserId = null;
          const updated = response.data;
          this.team = this.team.map(u =>
            u.userId === updated.userId ? { ...u, isActive: updated.isActive } : u
          );
        },
        error: (error: HttpErrorResponse) => {
          this.statusPendingUserId = null;
          console.error('Error al cambiar estado del usuario en el tenant:', error);
          this.teamActionError = extractErrorMessage(
            error,
            'No se pudo cambiar el estado. Si es un propietario, un administrador no puede desactivarlo; tampoco puedes desactivarte a ti mismo.'
          );
          this.loadTeam();
        }
      });

    this.subscriptions.add(sub);
  }

  onDeleteMember(user: TenantUser): void {
    if (!this.canDeleteMember(user)) return;
    if (this.deletePendingUserId !== null) return;

    const userLabel = user.fullName?.trim() || user.email;
    const ok = confirm(
      `¿Eliminar a ${userLabel} de este workspace?\n\n` +
      'Perderá el acceso inmediatamente. Esta acción no elimina su cuenta global.'
    );
    if (!ok) return;

    this.teamActionError = null;
    this.deletePendingUserId = user.userId;

    const sub = this.tenantUsersService
      .deleteCurrentTenantUser(user.userId)
      .subscribe({
        next: () => {
          this.deletePendingUserId = null;
          this.loadTeam();
          this.refreshEntitlements();
        },
        error: (error: HttpErrorResponse) => {
          this.deletePendingUserId = null;
          this.teamActionError = extractErrorMessage(
            error,
            'No se pudo eliminar el miembro. Comprueba las reglas de propietario/admin del workspace.'
          );
          this.loadTeam();
        }
      });

    this.subscriptions.add(sub);
  }

  get currentTenantName(): string {
    const tenant = this.tenantContext.getCurrentTenant();
    return tenant?.name || '';
  }
}
