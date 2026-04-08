// Modelos relacionados con tenants (organizaciones/workspaces del usuario)

// 1. GET /api/tenants
export interface TenantSummary {
  tenantId: number;
  name: string;
  slug: string;
  description: string | null;
  planCode: string | null;
  role: string; // Rol del usuario en el tenant (Owner, Admin, Member, etc.)
  joinedAt: string; // ISO date
  isActive: boolean;
}

export interface GetTenantsResponse {
  data: {
    tenants: TenantSummary[];
    count: number;
  };
  // Algunos endpoints pueden devolver también un flag de éxito,
  // pero no es obligatorio según la implementación actual del backend.
  success?: boolean;
}

/** POST /api/tenants/personal — cuerpo opcional (CreatePersonalTenantDto) */
export interface CreatePersonalTenantDto {
  tenantName?: string;
}

/** data tras crear organización propia (JWT nuevo incluye claims del tenant) */
export interface PersonalTenantCreatedData {
  tenantId: number;
  tenantName: string;
  slug: string;
  token: string;
  idUsuario: number;
  email: string;
  rol: string;
  fullName: string;
}

export interface CreatePersonalTenantResponse {
  data: PersonalTenantCreatedData;
  meta?: unknown;
  requiresReauth?: boolean;
}

// 2. GET /api/tenants/current
export interface CurrentTenantContext {
  message: string;
  tenantId: number | null;
  roleInTenant: string | null;
  isSet: boolean;
}

export interface GetCurrentTenantResponse {
  data: CurrentTenantContext;
  success?: boolean;
}

// 3. GET /api/tenants/{tenantId}/info
export interface TenantActiveSubscription {
  subscriptionId: number;
  planCode: string;
  status: string;
  startDate: string;
  endDate: string | null;
}

export interface TenantInfo {
  tenantId: number;
  name: string;
  slug: string;
  description: string | null;
  planCode: string | null;
  isActive: boolean;
  suspendedAt: string | null;
  createdAt: string;
  updatedAt: string;
  userRole: string;
  activeSubscription: TenantActiveSubscription | null;
}

export interface GetTenantInfoResponse {
  data: TenantInfo;
  success?: boolean;
}

// 4. GET /api/tenants/{tenantId}/workspace
export interface TenantWorkspace {
  message: string;
  // Aquí se pueden agregar más campos en el futuro
  [key: string]: unknown;
}

export interface TenantWorkspaceResponse {
  data: {
    tenantId: number;
    tenantName: string;
    tenantSlug: string;
    userRole: string;
    workspace: TenantWorkspace;
  };
  success?: boolean;
}

// 5. GET /api/tenants/{tenantId}/entitlements
export interface TenantEntitlementsResponse {
  data: {
    tenantId: number;
    tenantName?: string;
    planCode: string;
    planName: string;
    planDescription: string;
    features: Record<string, boolean>;
    // `null` suele significar "ilimitado".
    limits: Record<string, number | null>;
    currentUsage: {
      users: number;
      facebookPages: number;
      facebookGroups: number;
      collections: number;
      postsThisMonth: number;
      [key: string]: number;
    };
    planInfo: {
      isPaid: boolean;
      price: number | null;
      isActive: boolean;
      [key: string]: string | number | boolean | null;
    };
    // Metadata opcional de resolución de límites.
    resolutionInfo?: Record<string, unknown>;
  };
  success?: boolean;
  requiresReauth?: boolean;
}

// Modelo simplificado de tenant seleccionado que se guarda en el contexto
export interface SelectedTenant {
  tenantId: number;
  name: string;
  slug: string;
  role: string;
  planCode?: string | null;
}

// 6. GET /api/tenants/{tenantId}/users
//    Lista los usuarios que pertenecen a un tenant.
export interface TenantUser {
  userId: number;
  email: string;
  fullName: string;
  roleInTenant: string;
  isActive: boolean;
  joinedAt: string; // ISO date
}

export interface GetTenantUsersResponse {
  data: {
    users: TenantUser[];
    count: number;
  };
  success?: boolean;
}

// 7. POST /api/tenants/{tenantId}/users
//    Crear o vincular un usuario al tenant (gestión de equipo).
export interface CreateTenantUserDto {
  email: string;
  firstName: string;
  lastName: string;
  telephone: string;
  roleInTenant: string;
}

export interface CreateTenantUserResponse {
  data: TenantUser;
  success?: boolean;
  requiresReauth?: boolean;
}

// 8. PATCH /api/tenants/{tenantId}/users/{userId}/role
//    Cambiar el rol de un usuario dentro de ese tenant.
export interface UpdateTenantUserRoleDto {
  roleInTenant: string;
}

export interface UpdateTenantUserRoleResponse {
  data: {
    tenantId: number;
    userId: number;
    roleInTenant: string;
    updatedAt: string;
  };
  success?: boolean;
  requiresReauth?: boolean;
}

// 9. PATCH /api/tenants/{tenantId}/users/{userId}/status
//    Activar/desactivar la relación usuario–tenant.
export interface UpdateTenantUserStatusDto {
  isActive: boolean;
}

export interface UpdateTenantUserStatusResponse {
  data: {
    tenantId: number;
    userId: number;
    isActive: boolean;
    updatedAt: string;
  };
  success?: boolean;
  /** Si el backend indica renovación de sesión (JWT / claims desactualizados). */
  requiresReauth?: boolean;
}

/** GET /api/tenants/roles — catálogo de roles para invitaciones y edición. */
export interface TenantRole {
  code: string;
  name: string;
  description: string;
  isAdmin: boolean;
  isDefaultForNewUsers: boolean;
}

export interface GetTenantRolesResponse {
  data: {
    roles: TenantRole[];
    count: number;
  };
  success?: boolean;
}

/** POST /api/tenants/{tenantId}/transfer-ownership */
export interface TransferTenantOwnershipDto {
  newOwnerUserId: number;
}

export interface TransferTenantOwnershipResponse {
  data: {
    tenantId: number;
    previousOwnerUserId: number;
    newOwnerUserId: number;
    message: string;
  };
  success?: boolean;
  requiresReauth?: boolean;
}

