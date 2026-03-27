// Modelos de autenticación para uso en core

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  data: {
    token: string;
    idUsuario: number;
    email: string;
    rol: string;
    fullName: string;
  };
  meta: {
    totalCount: number;
    pageSize: number;
    currentPage: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviusPage: boolean;
    nextPageUrl: string;
    previusPageUrl: string;
  };
}

// Tipo auxiliar para los datos del usuario
export type UserData = LoginResponse['data'];

export interface RefreshResponse {
  data: {
    token: string;
    idUsuario: number;
    email: string;
    rol: string;
    fullName: string;
  };
  meta: {
    totalCount: number;
    pageSize: number;
    currentPage: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviusPage: boolean;
    nextPageUrl: string;
    previusPageUrl: string;
  };
}

export interface RegisterRequest {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  telephone: string;
  rol: string;
  tenantName: string;
}

export interface RegisterResponse {
  data: {
    idUsuario: number;
    email: string;
    fullName: string;
    rol: string;
  };
  meta: {
    totalCount: number;
    pageSize: number;
    currentPage: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviusPage: boolean;
    nextPageUrl: string;
    previusPageUrl: string;
  };
}

export interface ApiError {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  [key: string]: string | number;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
}

export interface ChangePasswordResponse {
  data: string;
  meta: {
    totalCount: number;
    pageSize: number;
    currentPage: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviusPage: boolean;
    nextPageUrl: string;
    previusPageUrl: string;
  };
}

export interface UpdateProfileRequest {
  firstName: string;
  lastName: string;
  email: string;
  telephone: string;
  dateBird: string; // Formato: YYYY-MM-DD
}

export interface UpdateProfileResponse {
  data: {
    idUsuario: number;
    email: string;
    rol: string;
    fullName: string;
    firstName: string;
    lastName: string;
    telephone: string;
    dateBird: string;
    isActive: boolean;
    avatarUrl: string;
  };
  meta: {
    totalCount: number;
    pageSize: number;
    currentPage: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviusPage: boolean;
    nextPageUrl: string;
    previusPageUrl: string;
  };
}

// Tipo extendido para UserData con todos los campos del perfil
export interface UserProfileData {
  idUsuario: number;
  email: string;
  rol: string;
  fullName: string;
  firstName?: string;
  lastName?: string;
  telephone?: string;
  dateBird?: string;
  isActive?: boolean;
  avatarUrl?: string;
}

export interface UploadAvatarResponse {
  data: string;
  meta: {
    totalCount: number;
    pageSize: number;
    currentPage: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviusPage: boolean;
    nextPageUrl: string;
    previusPageUrl: string;
  };
}

export interface DeleteAvatarResponse {
  data: string;
  meta: {
    totalCount: number;
    pageSize: number;
    currentPage: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviusPage: boolean;
    nextPageUrl: string;
    previusPageUrl: string;
  };
}

// ===== Invitaciones a tenants =====

export interface CreateInvitationRequest {
  email: string;
  firstName?: string;
  lastName?: string;
  roleInTenant?: string;
}

export interface CreateInvitationResponse {
  data: {
    invitationId: number;
    email: string;
    expiresAt: string;
    acceptLink: string;
    message: string;
  };
}

export type TenantInvitationStatus = 'Pending' | 'Accepted' | 'Expired' | 'Cancelled';

export interface TenantInvitationDto {
  invitationId: number;
  email: string;
  status: TenantInvitationStatus | string;
  roleInTenant: string;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
  invitedByUserId: number;
  firstName: string | null;
  lastName: string | null;
}

export interface TenantInvitationListDto {
  invitations: TenantInvitationDto[];
  count: number;
}

export interface GetTenantInvitationsResponse {
  data: TenantInvitationListDto;
  meta?: unknown;
  requiresReauth?: boolean;
}

export interface ValidateInvitationResponse {
  data: {
    valid: boolean;
    email: string | null;
    tenantName: string | null;
    firstName: string | null;
    lastName: string | null;
    expiresAt: string | null;
    errorMessage: string | null;
  };
}

export interface AcceptInvitationRequest {
  token: string;
  password: string;
  confirmPassword?: string;
  firstName?: string;
  lastName?: string;
}

// La respuesta de aceptar invitación es igual a LoginResponse en la parte de data
export interface AcceptInvitationResponse {
  data: {
    token: string;
    idUsuario: number;
    email: string;
    rol: string;
    fullName: string;
  };
}

