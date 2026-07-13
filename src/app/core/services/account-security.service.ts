import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, tap } from 'rxjs';
import {
  AuthenticationMethodDto,
  AuthenticationMethodsResponse,
  EmailChangeRequest,
  EmailChangeRequestResponse,
  EmailConfirmRequest,
  EmailConfirmResponse,
  LinkCompleteRequest,
  LinkConfirmRequest,
  LinkConfirmResponse,
  LinkContextRequest,
  LinkContextResponse,
  OAuthFlowResolveRequest,
  OAuthFlowResolveResponse,
  OAuthFlowType,
  PasswordCapabilitiesDto,
  PasswordMutationResponse,
  SessionsListResponse,
  SetPasswordRequest,
  StepUpPasswordRequest,
  StepUpPasswordResponse,
  UpdatePasswordRequest,
  UserSessionDto
} from '../models/account-security.model';
import { ExternalAuthProvider, ExternalAuthStartApiResponse, ExternalAuthStartRequest, ExternalAuthStartResponse } from '../models/auth.model';
import { AuthService } from './auth.service';
import {
  extractAuthorizationUrl,
  isValidExternalAuthorizationUrl,
  OAUTH_CALLBACK_PATH
} from '../../shared/utils/external-auth.utils';

@Injectable({ providedIn: 'root' })
export class AccountSecurityService {
  private readonly accountUrl = '/api/account';
  private readonly externalAuthUrl = '/api/auth/external';

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  getAuthenticationMethods(): Observable<AuthenticationMethodsResponse> {
    return this.http
      .get<AuthenticationMethodsResponse>(`${this.accountUrl}/authentication-methods`)
      .pipe(map(response => this.normalizeAuthenticationMethods(response)));
  }

  private normalizeAuthenticationMethods(response: AuthenticationMethodsResponse): AuthenticationMethodsResponse {
    const rawMethods = response.data?.methods ?? [];
    const methods = rawMethods
      .map(method => this.normalizeAuthenticationMethod(method as AuthenticationMethodDto & Record<string, unknown>))
      .filter((method): method is AuthenticationMethodDto => method !== null);

    const hasLocalPassword =
      typeof response.data?.hasLocalPassword === 'boolean'
        ? response.data.hasLocalPassword
        : methods.some(method => method.type === 'local' && method.linked);

    const requiresStepUp = response.data?.requiresStepUp === true;
    const password = this.normalizePasswordCapabilities(
      response.data?.password,
      hasLocalPassword,
      requiresStepUp
    );

    return {
      ...response,
      data: {
        ...response.data,
        methods,
        hasLocalPassword,
        requiresStepUp,
        password
      }
    };
  }

  private normalizePasswordCapabilities(
    raw: PasswordCapabilitiesDto | undefined,
    hasLocalPassword: boolean,
    globalRequiresStepUp: boolean
  ): PasswordCapabilitiesDto {
    if (raw && typeof raw.configured === 'boolean') {
      const requiresStepUp = raw.requiresStepUp === true;
      return {
        configured: raw.configured,
        canSet: raw.canSet === true,
        canChange: raw.canChange === true,
        requiresStepUp,
        requiresCurrentPasswordOnChange:
          typeof raw.requiresCurrentPasswordOnChange === 'boolean'
            ? raw.requiresCurrentPasswordOnChange
            : requiresStepUp || !raw.canChange
              ? null
              : true
      };
    }

    const configured = hasLocalPassword;
    return {
      configured,
      canSet: !configured,
      canChange: configured,
      requiresStepUp: globalRequiresStepUp,
      requiresCurrentPasswordOnChange: configured && !globalRequiresStepUp ? true : null
    };
  }

  private normalizeAuthenticationMethod(
    raw: AuthenticationMethodDto & Record<string, unknown>
  ): AuthenticationMethodDto | null {
    const rawType = String(raw.type ?? '').toLowerCase();
    const provider = typeof raw['provider'] === 'string' ? raw['provider'].toLowerCase() : '';

    let type: AuthenticationMethodDto['type'] | null = null;
    if (rawType === 'local' || rawType === 'password' || rawType === 'pwd') {
      type = 'local';
    } else if (rawType === 'google' || (rawType === 'external' && provider === 'google')) {
      type = 'google';
    } else if (rawType === 'microsoft' || (rawType === 'external' && provider === 'microsoft')) {
      type = 'microsoft';
    }

    if (!type) {
      return null;
    }

    const linked =
      typeof raw.linked === 'boolean'
        ? raw.linked
        : typeof raw['isLinked'] === 'boolean'
          ? raw['isLinked']
          : typeof raw['configured'] === 'boolean'
            ? raw['configured']
            : false;

    const emailSnapshot =
      typeof raw.emailSnapshot === 'string'
        ? raw.emailSnapshot
        : typeof raw['email'] === 'string'
          ? raw['email']
          : null;

    const lastUpdatedAt =
      typeof raw.lastUpdatedAt === 'string'
        ? raw.lastUpdatedAt
        : typeof raw['updatedAt'] === 'string'
          ? raw['updatedAt']
          : typeof raw['configuredAt'] === 'string'
            ? raw['configuredAt']
            : null;

    return {
      type,
      linked,
      emailSnapshot,
      canLink: raw.canLink === true,
      canUnlink: raw.canUnlink === true,
      canConfigure: raw.canConfigure === true,
      lastUpdatedAt
    };
  }

  stepUpWithPassword(request: StepUpPasswordRequest): Observable<StepUpPasswordResponse> {
    return this.http
      .post<StepUpPasswordResponse | { data: StepUpPasswordResponse['data'] }>(
        `${this.accountUrl}/step-up/password`,
        request
      )
      .pipe(
        map(response => this.normalizeStepUpPasswordResponse(response)),
        tap(res => {
          if (!res.data?.token) {
            throw new Error('step_up_token_missing');
          }
          this.authService.replaceTokenFromAuthData(res.data);
        })
      );
  }

  private normalizeStepUpPasswordResponse(
    raw: StepUpPasswordResponse | { data: StepUpPasswordResponse['data'] }
  ): StepUpPasswordResponse {
    if ('data' in raw && raw.data && typeof raw.data === 'object' && 'token' in raw.data) {
      return { data: raw.data };
    }
    return raw as StepUpPasswordResponse;
  }

  setPassword(request: SetPasswordRequest): Observable<PasswordMutationResponse> {
    return this.http.post<PasswordMutationResponse>(`${this.accountUrl}/password`, request).pipe(
      tap(res => this.authService.replaceTokenFromAuthData(res.data))
    );
  }

  updatePassword(request: UpdatePasswordRequest): Observable<PasswordMutationResponse> {
    return this.http.put<PasswordMutationResponse>(`${this.accountUrl}/password`, request).pipe(
      tap(res => this.authService.replaceTokenFromAuthData(res.data))
    );
  }

  getSessions(): Observable<SessionsListResponse> {
    return this.http
      .get<SessionsListResponse | { data: UserSessionDto[] }>(`${this.accountUrl}/sessions`)
      .pipe(map(response => this.normalizeSessionsResponse(response)));
  }

  private normalizeSessionsResponse(
    response: SessionsListResponse | { data: UserSessionDto[] | { sessions?: UserSessionDto[] } }
  ): SessionsListResponse {
    const rawData = response.data;
    const rawSessions = Array.isArray(rawData)
      ? rawData
      : Array.isArray(rawData?.sessions)
        ? rawData.sessions
        : [];

    const sessions = rawSessions.map(session =>
      this.normalizeSession(session as UserSessionDto & Record<string, unknown>)
    );

    return {
      ...response,
      data: { sessions }
    };
  }

  private normalizeSession(raw: UserSessionDto & Record<string, unknown>): UserSessionDto {
    const sessionAmr =
      typeof raw.sessionAmr === 'string'
        ? raw.sessionAmr
        : typeof raw['session_amr'] === 'string'
          ? raw['session_amr']
          : undefined;

    const createdAt =
      typeof raw.createdAt === 'string'
        ? raw.createdAt
        : typeof raw['authenticatedAt'] === 'string'
          ? raw['authenticatedAt']
          : typeof raw.lastSeenAt === 'string'
            ? raw.lastSeenAt
            : new Date().toISOString();

    const deviceLabel =
      typeof raw.deviceLabel === 'string' && raw.deviceLabel.trim()
        ? raw.deviceLabel
        : this.sessionAmrLabel(sessionAmr);

    return {
      sessionId: String(raw.sessionId ?? raw['session_id'] ?? ''),
      deviceLabel,
      ipAddress: typeof raw.ipAddress === 'string' ? raw.ipAddress : undefined,
      lastSeenAt: typeof raw.lastSeenAt === 'string' ? raw.lastSeenAt : createdAt,
      createdAt,
      isCurrent: raw.isCurrent === true,
      sessionAmr
    };
  }

  private sessionAmrLabel(sessionAmr: string | undefined): string {
    switch (sessionAmr) {
      case 'google':
        return 'Google';
      case 'microsoft':
        return 'Microsoft';
      case 'pwd':
        return 'Correo y contraseña';
      default:
        return 'Dispositivo desconocido';
    }
  }

  revokeCurrentSession(): Observable<void> {
    return this.http.delete<void>(`${this.accountUrl}/sessions/current`);
  }

  revokeOtherSessions(): Observable<void> {
    return this.http.post<void>(`${this.accountUrl}/sessions/revoke-others`, {});
  }

  revokeAllSessions(): Observable<void> {
    return this.http.post<void>(`${this.accountUrl}/sessions/revoke-all`, {});
  }

  requestEmailChange(request: EmailChangeRequest): Observable<EmailChangeRequestResponse> {
    return this.http.post<EmailChangeRequestResponse>(`${this.accountUrl}/email/change-request`, request);
  }

  confirmEmailChange(request: EmailConfirmRequest): Observable<EmailConfirmResponse> {
    return this.http.post<EmailConfirmResponse>(`${this.accountUrl}/email/confirm`, request);
  }

  startOAuthLogin(provider: ExternalAuthProvider, body?: ExternalAuthStartRequest): Observable<ExternalAuthStartResponse> {
    return this.http
      .post<ExternalAuthStartApiResponse>(
        `${this.externalAuthUrl}/${provider}/start`,
        this.withOAuthCallbackReturnUrl(body)
      )
      .pipe(map(response => this.normalizeAuthorizationUrl(response)));
  }

  startOAuthLink(provider: ExternalAuthProvider): Observable<ExternalAuthStartResponse> {
    return this.http
      .post<ExternalAuthStartApiResponse>(
        `${this.externalAuthUrl}/${provider}/link/start`,
        this.withOAuthCallbackReturnUrl()
      )
      .pipe(map(response => this.normalizeAuthorizationUrl(response)));
  }

  startOAuthStepUp(provider: ExternalAuthProvider): Observable<ExternalAuthStartResponse> {
    return this.http
      .post<ExternalAuthStartApiResponse>(
        `${this.externalAuthUrl}/${provider}/step-up/start`,
        this.withOAuthCallbackReturnUrl()
      )
      .pipe(map(response => this.normalizeAuthorizationUrl(response)));
  }

  /** returnUrl estándar V2 §5.5: el backend debe redirigir a /auth/callback con flowCode. */
  private withOAuthCallbackReturnUrl(body?: ExternalAuthStartRequest): ExternalAuthStartRequest {
    return {
      ...body,
      returnUrl: body?.returnUrl ?? OAUTH_CALLBACK_PATH
    };
  }

  resolveOAuthFlow(flowCode: string): Observable<OAuthFlowResolveResponse> {
    const body: OAuthFlowResolveRequest = { flowCode };
    return this.http
      .post<OAuthFlowResolveResponse | { data: Record<string, unknown> }>(
        `${this.externalAuthUrl}/flow/resolve`,
        body
      )
      .pipe(map(response => this.normalizeOAuthFlowResolveResponse(response)));
  }

  /** Normaliza envelope `{ data: { flow, ... } }` o respuesta plana V2. */
  private normalizeOAuthFlowResolveResponse(raw: unknown): OAuthFlowResolveResponse {
    if (!raw || typeof raw !== 'object') {
      return { flow: 'error', message: 'invalid_response' };
    }

    const root = raw as Record<string, unknown>;
    const inner = root['data'];

    if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
      const innerRecord = inner as Record<string, unknown>;
      if (typeof innerRecord['flow'] === 'string') {
        return this.buildOAuthFlowResolveResponse(innerRecord, root);
      }
    }

    if (typeof root['flow'] === 'string') {
      const nested = root['data'];
      const merged =
        nested && typeof nested === 'object' && !Array.isArray(nested)
          ? { ...root, ...(nested as Record<string, unknown>) }
          : root;
      return this.buildOAuthFlowResolveResponse(merged as Record<string, unknown>, root);
    }

    return { flow: 'error', message: 'invalid_response' };
  }

  private buildOAuthFlowResolveResponse(
    fields: Record<string, unknown>,
    envelope?: Record<string, unknown>
  ): OAuthFlowResolveResponse {
    const rawFlow = fields['flow'];
    const flow = (
      typeof rawFlow === 'string' ? rawFlow.toLowerCase() : 'error'
    ) as OAuthFlowType;
    const code =
      typeof fields['code'] === 'string'
        ? fields['code']
        : typeof fields['errorCode'] === 'string'
          ? fields['errorCode']
          : typeof envelope?.['code'] === 'string'
            ? envelope['code']
            : typeof envelope?.['errorCode'] === 'string'
              ? envelope['errorCode']
              : undefined;
    const message =
      typeof fields['message'] === 'string'
        ? fields['message']
        : typeof fields['detail'] === 'string'
          ? fields['detail']
          : typeof envelope?.['message'] === 'string'
            ? envelope['message']
            : typeof envelope?.['detail'] === 'string'
              ? envelope['detail']
              : undefined;

    return {
      flow,
      code,
      message,
      data: {
        token: typeof fields['token'] === 'string' ? fields['token'] : undefined,
        pendingLinkToken:
          typeof fields['pendingLinkToken'] === 'string' ? fields['pendingLinkToken'] : undefined,
        provider: fields['provider'] as ExternalAuthProvider | undefined,
        providerEmail:
          typeof fields['providerEmail'] === 'string' ? fields['providerEmail'] : undefined,
        accountEmail:
          typeof fields['accountEmail'] === 'string' ? fields['accountEmail'] : undefined,
        flowCode: typeof fields['flowCode'] === 'string' ? fields['flowCode'] : undefined
      }
    };
  }

  completeOAuthLink(request: LinkCompleteRequest): Observable<void> {
    return this.http.post<void>(`${this.externalAuthUrl}/link/complete`, request);
  }

  cancelOAuthLink(request: LinkCompleteRequest): Observable<void> {
    return this.http.post<void>(`${this.externalAuthUrl}/link/cancel`, request);
  }

  unlinkProvider(provider: ExternalAuthProvider): Observable<void> {
    return this.http.delete<void>(`${this.externalAuthUrl}/${provider}`);
  }

  getLinkContext(request: LinkContextRequest): Observable<LinkContextResponse> {
    return this.http.post<LinkContextResponse>(`${this.externalAuthUrl}/link/context`, request);
  }

  confirmLinkWithPassword(request: LinkConfirmRequest): Observable<LinkConfirmResponse> {
    return this.http.post<LinkConfirmResponse>(`${this.externalAuthUrl}/link/confirm`, request);
  }

  redirectToAuthorizationUrl(response: ExternalAuthStartResponse): void {
    window.location.href = response.authorizationUrl;
  }

  private normalizeAuthorizationUrl(response: ExternalAuthStartApiResponse): ExternalAuthStartResponse {
    const authorizationUrl = extractAuthorizationUrl(response);
    if (!authorizationUrl || !isValidExternalAuthorizationUrl(authorizationUrl)) {
      throw new Error('authorization_url_missing');
    }
    return { authorizationUrl };
  }
}
