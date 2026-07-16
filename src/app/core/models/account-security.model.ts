import { ExternalAuthProvider } from './auth.model';

export type OAuthFlowType =
  | 'link_pending_review'
  | 'link_completed'
  | 'step_up_completed'
  | 'link_challenge'
  | 'error';

export type PendingSecurityOperation =
  | 'change_password'
  | 'set_password'
  | 'unlink_google'
  | 'unlink_microsoft'
  | 'link_google'
  | 'link_microsoft'
  | 'revoke_other_sessions'
  | 'revoke_all_sessions'
  | 'email_change'
  | 'link_complete';

export interface OAuthFlowResolveRequest {
  flowCode: string;
}

export interface OAuthFlowResolveResponse {
  flow: OAuthFlowType;
  code?: string;
  message?: string;
  data?: {
    token?: string;
    pendingLinkToken?: string;
    provider?: ExternalAuthProvider;
    providerEmail?: string;
    accountEmail?: string;
    flowCode?: string;
  };
}

export interface LinkCompleteRequest {
  pendingLinkToken: string;
}

export interface LinkContextRequest {
  flowCode: string;
}

export interface LinkContextResponse {
  data: {
    flow?: 'link_challenge';
    provider: ExternalAuthProvider;
    existingAuthMethod?: string;
    maskedEmail: string;
    verificationMethods: string[];
    linkAvailable?: boolean;
    challengeToken: string;
  };
}

export type LinkVerificationMethod = 'password' | 'email';

export interface LinkConfirmRequest {
  challengeToken: string;
  verificationMethod: LinkVerificationMethod;
  password?: string;
  emailVerificationToken?: string;
}

export interface LinkConfirmResponse {
  data: {
    token: string;
    idUsuario: number;
    email: string;
    rol: string;
    fullName: string;
  };
}

export interface AuthenticationMethodDto {
  type: 'local' | 'google' | 'microsoft';
  linked: boolean;
  emailSnapshot?: string | null;
  canLink: boolean;
  canUnlink: boolean;
  canConfigure: boolean;
  lastUpdatedAt?: string | null;
}

/** Capacidades explícitas de contraseña (GET /authentication-methods → data.password). */
export interface PasswordCapabilitiesDto {
  configured: boolean;
  canSet: boolean;
  canChange: boolean;
  requiresStepUp: boolean;
  requiresCurrentPasswordOnChange: boolean | null;
}

export interface AuthenticationMethodsResponse {
  data: {
    methods: AuthenticationMethodDto[];
    hasLocalPassword: boolean;
    requiresStepUp: boolean;
    authTime?: number | string | null;
    recentAuthMaxAgeMinutes?: number;
    password?: PasswordCapabilitiesDto;
  };
}

export interface StepUpPasswordRequest {
  password: string;
}

export interface StepUpPasswordResponse {
  data: {
    token: string;
    idUsuario: number;
    email: string;
    rol: string;
    fullName: string;
  };
}

export interface SetPasswordRequest {
  newPassword: string;
}

export interface UpdatePasswordRequest {
  newPassword: string;
  currentPassword?: string;
}

export interface PasswordMutationResponse {
  data: {
    token: string;
    idUsuario: number;
    email: string;
    rol: string;
    fullName: string;
    otherSessionsRevoked?: boolean;
  };
  /** @deprecated Preferir data.otherSessionsRevoked (D-V2-23). */
  otherSessionsRevoked?: boolean;
}

export interface UserSessionDto {
  sessionId: string;
  deviceLabel: string;
  ipAddress?: string;
  lastSeenAt: string;
  createdAt: string;
  isCurrent: boolean;
  sessionAmr?: string;
}

export interface SessionsListResponse {
  data: {
    sessions: UserSessionDto[];
  };
}

export interface EmailChangePendingDto {
  currentEmail: string;
  pendingNewEmail: string;
  requestedAt?: string | null;
  expiresAt?: string | null;
  resendAvailableInSeconds: number;
}

export interface EmailChangePendingResponse {
  data?: {
    pending?: EmailChangePendingDto | null;
  };
  pending?: EmailChangePendingDto | null;
}

export interface EmailChangeRequest {
  newEmail: string;
}

export interface EmailChangeMutationResponse {
  message: string;
  data?: {
    pending?: EmailChangePendingDto | null;
  };
  pending?: EmailChangePendingDto | null;
}

export type EmailChangeRequestResponse = EmailChangeMutationResponse;

export type EmailConfirmPreviewStatus =
  | 'ready'
  | 'expired'
  | 'used'
  | 'revoked'
  | 'cancelled'
  | 'conflict'
  | 'invalid';

export interface EmailConfirmPreview {
  status: EmailConfirmPreviewStatus;
  currentEmail?: string | null;
  pendingNewEmail?: string | null;
  newEmail?: string | null;
  message?: string | null;
  code?: string | null;
}

export interface EmailConfirmPreviewResponse {
  data?: EmailConfirmPreview;
  status?: EmailConfirmPreviewStatus;
  currentEmail?: string | null;
  pendingNewEmail?: string | null;
  newEmail?: string | null;
  message?: string | null;
  code?: string | null;
}

export interface EmailConfirmRequest {
  token: string;
}

export interface EmailConfirmResponse {
  message: string;
  data?: {
    token?: string;
    idUsuario?: number;
    email?: string;
    rol?: string;
    fullName?: string;
    newEmail?: string;
  };
  newEmail?: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}
