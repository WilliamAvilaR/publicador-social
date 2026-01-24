import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { LoginRequest, LoginResponse, UserData, RegisterRequest, RegisterResponse, RefreshResponse, ApiError, ChangePasswordRequest, ChangePasswordResponse, UpdateProfileRequest, UpdateProfileResponse, UserProfileData } from '../models/auth.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  // Usar ruta relativa para que el proxy la maneje
  private apiUrl = '/api/Token';
  private readonly TOKEN_KEY = 'auth_token';
  private readonly USER_KEY = 'user_data';

  constructor(private http: HttpClient) {}

  register(userData: RegisterRequest): Observable<RegisterResponse> {
    return this.http.post<RegisterResponse>(`${this.apiUrl}/register`, userData);
  }

  login(credentials: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, credentials);
  }

  /**
   * Renueva el token JWT del usuario autenticado sin requerir credenciales.
   * El token actual debe estar presente en el header Authorization.
   */
  refreshToken(): Observable<RefreshResponse> {
    return this.http.post<RefreshResponse>(`${this.apiUrl}/refresh`, {});
  }

  /**
   * Cambia la contraseña del usuario autenticado actual.
   * Requiere validar la contraseña actual antes de establecer una nueva.
   */
  changePassword(request: ChangePasswordRequest): Observable<ChangePasswordResponse> {
    return this.http.post<ChangePasswordResponse>('/api/Account/change-password', request);
  }

  /**
   * Actualiza el perfil del usuario autenticado actual.
   * Permite actualizar: nombres, apellidos, email, teléfono y fecha de nacimiento.
   */
  updateProfile(request: UpdateProfileRequest): Observable<UpdateProfileResponse> {
    return this.http.put<UpdateProfileResponse>('/api/me', request);
  }

  // Guardar token y datos de usuario en localStorage
  setAuthData(token: string, user: UserData): void {
    if (!token || !user) {
      console.error('Token o usuario inválido');
      return;
    }
    localStorage.setItem(this.TOKEN_KEY, token);
    // Guardar solo los datos del usuario (sin el token)
    const userData: Omit<UserData, 'token'> = {
      idUsuario: user.idUsuario,
      email: user.email,
      rol: user.rol,
      fullName: user.fullName
    };
    localStorage.setItem(this.USER_KEY, JSON.stringify(userData));
  }

  // Actualizar datos del usuario en localStorage (después de actualizar perfil)
  updateUserData(user: UserProfileData): void {
    if (!user) {
      console.error('Usuario inválido');
      return;
    }
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
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

  // Cerrar sesión
  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
  }
}
