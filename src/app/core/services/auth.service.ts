import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, map, tap } from 'rxjs';
import { LoginRequest, LoginResponse, UserData, RegisterRequest, RegisterResponse, RefreshResponse, ApiError, ChangePasswordRequest, ChangePasswordResponse, UpdateProfileRequest, UpdateProfileResponse, UserProfileData, UploadAvatarResponse, DeleteAvatarResponse, VerifyEmailRequest, VerifyEmailResponse, ResendVerificationRequest, ResendVerificationResponse, ForgotPasswordRequest, ForgotPasswordResponse, ExternalAuthProvider, ExternalAuthStartApiResponse, ExternalAuthStartRequest, ExternalAuthStartResponse, ExternalAuthExchangeResponse, CompleteRegistrationRequest, CompleteRegistrationResponse, CompleteWorkspaceSetupResponse } from '../models/auth.model';
import { TenantContextService } from './tenant-context.service';
import { getJwtSetupStatus } from '../../shared/utils/jwt.utils';
import {
  sanitizeReturnPath,
  extractAuthorizationUrl,
  isValidExternalAuthorizationUrl,
  OAUTH_CALLBACK_PATH
} from '../../shared/utils/external-auth.utils';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  // Usar ruta relativa para que el proxy la maneje
  private apiUrl = '/api/Token';
  private externalAuthUrl = '/api/auth/external';
  private readonly TOKEN_KEY = 'auth_token';
  private readonly USER_KEY = 'user_data';
  private readonly TENANT_SETUP_KEY = 'requires_tenant_setup';
  private readonly userSubject = new BehaviorSubject<UserData | UserProfileData | null>(this.getUser());
  readonly user$ = this.userSubject.asObservable();

  constructor(
    private http: HttpClient,
    private router: Router,
    private tenantContext: TenantContextService
  ) {}

  register(userData: RegisterRequest): Observable<RegisterResponse> {
    return this.http.post<RegisterResponse>(`${this.apiUrl}/register`, userData);
  }

  verifyEmail(request: VerifyEmailRequest): Observable<VerifyEmailResponse> {
    return this.http.post<VerifyEmailResponse>('/api/Account/verify-email', request);
  }

  resendVerification(request: ResendVerificationRequest): Observable<ResendVerificationResponse> {
    return this.http.post<ResendVerificationResponse>('/api/Account/resend-verification', request);
  }

  forgotPassword(request: ForgotPasswordRequest): Observable<ForgotPasswordResponse> {
    return this.http.post<ForgotPasswordResponse>('/api/Account/forgot-password', request);
  }

  login(credentials: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, credentials);
  }

  /**
   * Inicia el flujo OAuth externo (V2 POST): pide la authorizationUrl al backend.
   * El llamador debe redirigir el navegador completo a esa URL.
   */
  startExternalAuth(
    provider: ExternalAuthProvider,
    options?: { invitationToken?: string; returnUrl?: string; intent?: 'auto' | 'login' | 'register' }
  ): Observable<ExternalAuthStartResponse> {
    const body: ExternalAuthStartRequest = {
      intent: options?.intent ?? 'auto',
      returnUrl: options?.returnUrl ?? OAUTH_CALLBACK_PATH
    };
    if (options?.invitationToken) {
      body.invitationToken = options.invitationToken;
    }
    return this.http
      .post<ExternalAuthStartApiResponse>(`${this.externalAuthUrl}/${provider}/start`, body)
      .pipe(
        map((response): ExternalAuthStartResponse => {
          const authorizationUrl = extractAuthorizationUrl(response);
          if (!authorizationUrl || !isValidExternalAuthorizationUrl(authorizationUrl)) {
            throw new Error('authorization_url_missing');
          }
          return { authorizationUrl };
        })
      );
  }

  resetPassword(request: { token: string; newPassword: string }): Observable<{ message: string }> {
    return this.http.post<{ message: string }>('/api/Account/reset-password', request);
  }

  /**
   * Inicia OAuth externo y redirige el navegador completo a la URL del proveedor.
   * Centraliza la validación para evitar redirects a URLs vacías o inválidas.
   */
  redirectToExternalAuth(
    provider: ExternalAuthProvider,
    options?: { invitationToken?: string; returnUrl?: string }
  ): Observable<void> {
    return this.startExternalAuth(provider, options).pipe(
      tap(({ authorizationUrl }) => {
        window.location.href = authorizationUrl;
      }),
      map(() => undefined)
    );
  }

  /**
   * Intercambia el exchangeCode recibido en /auth/callback por un JWT.
   * Persiste el flag requiresTenantSetup de la respuesta.
   */
  exchangeExternalAuth(exchangeCode: string): Observable<ExternalAuthExchangeResponse> {
    return this.http
      .post<ExternalAuthExchangeResponse>(`${this.externalAuthUrl}/exchange`, { exchangeCode })
      .pipe(tap(response => this.setTenantSetupRequired(response.requiresTenantSetup === true)));
  }

  /**
   * Completa el onboarding de workspace para usuarios OAuth nuevos.
   * Devuelve un JWT completo con claims de tenant.
   */
  completeExternalRegistration(tenantName: string): Observable<CompleteRegistrationResponse> {
    const body: CompleteRegistrationRequest = { tenantName };
    return this.http
      .post<CompleteRegistrationResponse>(`${this.externalAuthUrl}/complete-registration`, body)
      .pipe(tap(() => this.clearTenantSetupRequired()));
  }

  /**
   * Completa el onboarding de workspace para usuarios de registro password.
   * Misma pantalla de onboarding que OAuth; distinto endpoint.
   */
  completeWorkspaceSetup(tenantName: string): Observable<CompleteWorkspaceSetupResponse> {
    return this.http
      .post<CompleteWorkspaceSetupResponse>('/api/account/complete-workspace-setup', { tenantName })
      .pipe(tap(() => this.clearTenantSetupRequired()));
  }

  /**
   * Renueva el token JWT del usuario autenticado sin requerir credenciales.
   * El token actual debe estar presente en el header Authorization.
   */
  refreshToken(): Observable<RefreshResponse> {
    return this.http.post<RefreshResponse>(`${this.apiUrl}/refresh`, {}).pipe(
      tap(response => {
        if (typeof response.requiresTenantSetup === 'boolean') {
          this.setTenantSetupRequired(response.requiresTenantSetup);
        }
      })
    );
  }

  /**
   * Cambia la contraseña del usuario autenticado actual.
   * Requiere validar la contraseña actual antes de establecer una nueva.
   */
  changePassword(request: ChangePasswordRequest): Observable<ChangePasswordResponse> {
    return this.http.post<ChangePasswordResponse>('/api/Account/change-password', request);
  }

  /**
   * Obtiene el perfil completo del usuario autenticado actual.
   */
  getProfile(): Observable<UpdateProfileResponse> {
    return this.http.get<UpdateProfileResponse>('/api/me');
  }

  /**
   * Actualiza el perfil del usuario autenticado actual.
   * Permite actualizar: nombres, apellidos, email, teléfono y fecha de nacimiento.
   */
  updateProfile(request: UpdateProfileRequest): Observable<UpdateProfileResponse> {
    return this.http.put<UpdateProfileResponse>('/api/me', request);
  }

  /**
   * Sube o actualiza el avatar del usuario autenticado actual.
   * Acepta archivos de imagen (JPG, PNG, GIF, WEBP) con un tamaño máximo de 5MB.
   */
  uploadAvatar(file: File): Observable<UploadAvatarResponse> {
    const formData = new FormData();
    formData.append('file', file);
    
    return this.http.post<UploadAvatarResponse>('/api/me/avatar', formData);
  }

  /**
   * Elimina el avatar del usuario autenticado actual.
   */
  deleteAvatar(): Observable<DeleteAvatarResponse> {
    return this.http.delete<DeleteAvatarResponse>('/api/me/avatar');
  }

  /**
   * Centraliza el post-login (password u OAuth): guarda JWT y navega según
   * requiresTenantSetup (fuente de verdad) o, si no viene, el claim del JWT.
   */
  handleAuthSuccess(
    response: { data: UserData; requiresTenantSetup?: boolean },
    options?: { returnUrl?: string; source?: 'oauth' | 'password' }
  ): void {
    this.setAuthData(response.data.token, response.data);

    const needsSetup =
      typeof response.requiresTenantSetup === 'boolean'
        ? response.requiresTenantSetup
        : getJwtSetupStatus(response.data.token) === 'pending_tenant';
    this.setTenantSetupRequired(needsSetup);

    if (needsSetup) {
      this.router.navigate(['/onboarding'], {
        queryParams: { source: options?.source ?? 'oauth' }
      });
      return;
    }

    const returnUrl = sanitizeReturnPath(options?.returnUrl);
    if (returnUrl) {
      this.router.navigateByUrl(returnUrl);
    } else {
      this.router.navigate(['/dashboard']);
    }
  }

  /** Reemplaza el JWT tras step-up, cambio de contraseña u operaciones V2 similares. */
  replaceTokenFromAuthData(data: {
    token: string;
    idUsuario?: number;
    email?: string;
    rol?: string;
    fullName?: string;
  }): void {
    const currentUser = this.getUser();
    const user: UserData = {
      idUsuario: data.idUsuario ?? currentUser?.idUsuario ?? 0,
      email: data.email ?? currentUser?.email ?? '',
      rol: data.rol ?? currentUser?.rol ?? '',
      fullName: data.fullName ?? currentUser?.fullName ?? '',
      token: data.token
    };
    this.setAuthData(data.token, user);
  }

  // Guardar token y datos de usuario en localStorage
  setAuthData(token: string, user: UserData): void {
    if (!token || !user) {
      console.error('Token o usuario inválido');
      return;
    }
    localStorage.setItem(this.TOKEN_KEY, token);
    // Guardar solo los datos del usuario (sin el token).
    // En refresh, la respuesta trae datos básicos; preservamos campos extendidos
    // del perfil actual, como avatarUrl, cuando corresponde al mismo usuario.
    const userData: Omit<UserData, 'token'> = {
      idUsuario: user.idUsuario,
      email: user.email,
      rol: user.rol,
      fullName: user.fullName
    };

    const currentUser = this.getUser();
    const mergedUser =
      currentUser && currentUser.idUsuario === user.idUsuario
        ? { ...currentUser, ...userData }
        : userData;

    localStorage.setItem(this.USER_KEY, JSON.stringify(mergedUser));
    this.userSubject.next(mergedUser as UserData | UserProfileData);
  }

  // Actualizar datos del usuario en localStorage (después de actualizar perfil)
  updateUserData(user: UserProfileData): void {
    if (!user) {
      console.error('Usuario inválido');
      return;
    }
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    this.userSubject.next(user);
  }

  // Obtener token del localStorage
  getToken(): string | null {
    const token = localStorage.getItem(this.TOKEN_KEY);
    // Validar que el token no sea "undefined" o "null" como string
    if (!token || token === 'undefined' || token === 'null') {
      return null;
    }
    return token;
  }

  // Obtener datos del usuario del localStorage
  getUser(): UserData | UserProfileData | null {
    try {
      const userData = localStorage.getItem(this.USER_KEY);

      // Validar que exista y no sea "undefined" o "null" como string
      if (!userData || userData === 'undefined' || userData === 'null' || userData.trim() === '') {
        // Limpiar datos inválidos
        if (userData === 'undefined' || userData === 'null') {
          localStorage.removeItem(this.USER_KEY);
        }
        return null;
      }

      const parsed = JSON.parse(userData);

      // Validar que el objeto parseado tenga la estructura esperada
      if (!parsed || typeof parsed !== 'object' || !parsed.email) {
        localStorage.removeItem(this.USER_KEY);
        return null;
      }

      return parsed as UserData | UserProfileData;
    } catch (error) {
      console.error('Error al parsear datos de usuario:', error);
      // Limpiar datos corruptos
      localStorage.removeItem(this.USER_KEY);
      return null;
    }
  }

  // Verificar si el usuario está autenticado
  isAuthenticated(): boolean {
    const token = this.getToken();
    const user = this.getUser();
    // Verificar que tanto el token como el usuario sean válidos
    return !!(token && user);
  }

  // ===== Estado de onboarding de workspace (PendingTenantSetup) =====

  /**
   * Indica si el usuario debe completar el onboarding de organización.
   * Fuente principal: flag persistido tras exchange/login/refresh;
   * fallback: claim JWT setupStatus=pending_tenant.
   */
  requiresTenantSetup(): boolean {
    const stored = localStorage.getItem(this.TENANT_SETUP_KEY);
    if (stored !== null) {
      return stored === 'true';
    }
    const token = this.getToken();
    return !!token && getJwtSetupStatus(token) === 'pending_tenant';
  }

  setTenantSetupRequired(required: boolean): void {
    localStorage.setItem(this.TENANT_SETUP_KEY, required ? 'true' : 'false');
  }

  clearTenantSetupRequired(): void {
    localStorage.setItem(this.TENANT_SETUP_KEY, 'false');
  }

  // Cerrar sesión
  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    localStorage.removeItem(this.TENANT_SETUP_KEY);
    this.userSubject.next(null);
    this.tenantContext.clearCurrentTenant();
  }
}
