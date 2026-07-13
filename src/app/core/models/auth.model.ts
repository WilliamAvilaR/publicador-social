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
  requiresTenantSetup?: boolean;
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
  requiresTenantSetup?: boolean;
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
  tenantName?: string;
}

export interface RegisterResponse {
  data: {
    idUsuario: number;
    email: string;
    fullName: string;
    rol: string;
  };
  requiresReauth?: boolean;
  meta?: {
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

export interface VerifyEmailRequest {
  token: string;
}

export interface VerifyEmailResponse {
  message: string;
}

export interface ResendVerificationRequest {
  email: string;
}

export interface ResendVerificationResponse {
  message: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ForgotPasswordResponse {
  message: string;
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
    hasLocalPassword?: boolean;
    authTime?: number | null;
    requiresStepUp?: boolean;
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

// ===== Login externo (OAuth Google / Microsoft) =====

export type ExternalAuthProvider = 'google' | 'microsoft';

/** Respuesta cruda del backend: POST /api/auth/external/{provider}/start */
export interface ExternalAuthStartApiResponse {
  data: {
    authorizationUrl: string;
  };
}

/** Cuerpo V2 para POST /api/auth/external/{provider}/start */
export interface ExternalAuthStartRequest {
  returnUrl?: string;
  intent?: 'auto' | 'login' | 'register';
  invitationToken?: string;
}

/** Respuesta normalizada tras extraer y validar la URL de autorización. */
export interface ExternalAuthStartResponse {
  authorizationUrl: string;
}

export interface ExternalAuthExchangeRequest {
  exchangeCode: string;
}

/**
 * Respuesta de POST /api/auth/external/exchange.
 * `data` tiene el mismo formato que el login password;
 * `requiresTenantSetup` viene en la raíz de la respuesta.
 */
export interface ExternalAuthExchangeResponse {
  data: {
    token: string;
    idUsuario: number;
    email: string;
    rol: string;
    fullName: string;
  };
  requiresTenantSetup: boolean;
}

export interface CompleteRegistrationRequest {
  tenantName: string;
}

/** Respuesta de complete-registration / complete-workspace-setup: nuevo JWT completo. */
export interface CompleteRegistrationResponse {
  data: {
    token: string;
    idUsuario: number;
    email: string;
    rol: string;
    fullName: string;
  };
  requiresTenantSetup?: boolean;
}

export type CompleteWorkspaceSetupRequest = CompleteRegistrationRequest;
export type CompleteWorkspaceSetupResponse = CompleteRegistrationResponse;

/** Hint informativo del redirect post-OAuth (no usar para routing definitivo). */
export type ExternalAuthAction = 'login' | 'pending_setup' | 'invitation_accepted';

