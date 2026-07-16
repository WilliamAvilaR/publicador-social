import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject, merge, of, throwError } from 'rxjs';
import { map, switchMap, take } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { OAuthFlowStateService } from './oauth-flow-state.service';
import { AuthenticationMethodsResponse } from '../models/account-security.model';
import { PendingSecurityOperation } from '../models/account-security.model';
import { ExternalAuthProvider } from '../models/auth.model';
import { isStepUpFresh, getSessionAmr } from '../../shared/utils/jwt.utils';

export type AuthMethodsSnapshot = AuthenticationMethodsResponse['data'];

export interface RequireStepUpOptions {
  /** Si true, abre step-up aunque el JWT local parezca vigente (priorizar API). */
  force?: boolean;
}

export interface StepUpModalUiState {
  loadingMethods: boolean;
  canStepUpWithPassword: boolean;
  linkedOAuthProviders: ExternalAuthProvider[];
  errorMessage: string;
  /** Desvincular: solo contraseña, sin OAuth en el modal. */
  passwordOnlyStepUp: boolean;
}

const EMPTY_MODAL_UI: StepUpModalUiState = {
  loadingMethods: false,
  canStepUpWithPassword: true,
  linkedOAuthProviders: [],
  errorMessage: '',
  passwordOnlyStepUp: false
};

export const UNLINK_PASSWORD_REQUIRED_MESSAGE =
  'Para desvincular un proveedor debes configurar una contraseña en tu cuenta.';

export const EMAIL_CHANGE_PASSWORD_REQUIRED_MESSAGE =
  'Para cambiar tu correo principal debes configurar una contraseña en tu cuenta.';

@Injectable({ providedIn: 'root' })
export class StepUpService {
  private readonly modalOpenSubject = new BehaviorSubject(false);
  private readonly stepUpCompleteSubject = new Subject<void>();
  private readonly stepUpFailedSubject = new Subject<string>();
  private readonly modalUiSubject = new BehaviorSubject<StepUpModalUiState>(EMPTY_MODAL_UI);
  private authMethodsSnapshot: AuthMethodsSnapshot | null = null;

  readonly showModal$ = this.modalOpenSubject.asObservable();
  readonly modalUi$ = this.modalUiSubject.asObservable();

  constructor(
    private authService: AuthService,
    private flowState: OAuthFlowStateService
  ) {}

  isFresh(): boolean {
    const maxMinutes = this.authMethodsSnapshot?.recentAuthMaxAgeMinutes ?? 15;
    return isStepUpFresh(this.authService.getToken(), maxMinutes);
  }

  isModalOpen(): boolean {
    return this.modalOpenSubject.value;
  }

  /** Guarda snapshot para el modal; solo actualiza UI si el modal está abierto. */
  setAuthMethodsSnapshot(snapshot: AuthMethodsSnapshot): void {
    this.authMethodsSnapshot = snapshot;
    if (this.isModalOpen()) {
      this.syncModalUiFromSnapshot(snapshot, false);
    }
  }

  getAuthMethodsSnapshot(): AuthMethodsSnapshot | null {
    return this.authMethodsSnapshot;
  }

  static extractPayload(
    response: AuthenticationMethodsResponse | AuthMethodsSnapshot
  ): AuthMethodsSnapshot {
    const candidate = response as AuthMethodsSnapshot;
    if (Array.isArray(candidate.methods)) {
      return candidate;
    }
    return (response as AuthenticationMethodsResponse).data;
  }

  static canUsePasswordStepUp(data: AuthMethodsSnapshot | null | undefined): boolean {
    if (!data) {
      return true;
    }
    const methods = data.methods ?? [];
    const localMethod = methods.find(method => method.type === 'local');
    const localLinked = methods.some(method => method.type === 'local' && method.linked);
    return (
      data.hasLocalPassword === true ||
      data.password?.configured === true ||
      localLinked ||
      !!localMethod
    );
  }

  static linkedOAuthProviders(data: AuthMethodsSnapshot | null | undefined): ExternalAuthProvider[] {
    return (data?.methods ?? [])
      .filter(method => (method.type === 'google' || method.type === 'microsoft') && method.linked)
      .map(method => method.type as ExternalAuthProvider);
  }

  static hasLocalPasswordConfigured(data: AuthMethodsSnapshot | null | undefined): boolean {
    if (!data) {
      return false;
    }
    return data.hasLocalPassword === true || data.password?.configured === true;
  }

  static isPasswordOnlyOperation(
    operation: PendingSecurityOperation | null | undefined
  ): boolean {
    return (
      StepUpService.isUnlinkOperation(operation) ||
      operation === 'email_change'
    );
  }

  static isUnlinkOperation(
    operation: PendingSecurityOperation | null | undefined
  ): operation is 'unlink_google' | 'unlink_microsoft' {
    return operation === 'unlink_google' || operation === 'unlink_microsoft';
  }

  private buildModalUiState(
    data: AuthMethodsSnapshot | null | undefined,
    loadingMethods: boolean
  ): StepUpModalUiState {
    const operation = this.flowState.pendingOperation;
    const passwordOnlyStepUp = StepUpService.isPasswordOnlyOperation(operation);
    const canStepUpWithPassword = StepUpService.hasLocalPasswordConfigured(data);
    const linkedOAuthProviders = passwordOnlyStepUp
      ? []
      : StepUpService.linkedOAuthProviders(data);

    let errorMessage = '';
    if (!loadingMethods) {
      if (passwordOnlyStepUp && !canStepUpWithPassword) {
        errorMessage =
          operation === 'email_change'
            ? EMAIL_CHANGE_PASSWORD_REQUIRED_MESSAGE
            : UNLINK_PASSWORD_REQUIRED_MESSAGE;
      } else if (!canStepUpWithPassword && linkedOAuthProviders.length === 0) {
        errorMessage = 'No hay métodos de verificación disponibles en tu cuenta.';
      }
    }

    return {
      loadingMethods,
      canStepUpWithPassword: passwordOnlyStepUp
        ? !!data && canStepUpWithPassword
        : StepUpService.canUsePasswordStepUp(data) || this.authService.isAuthenticated(),
      linkedOAuthProviders,
      errorMessage,
      passwordOnlyStepUp
    };
  }

  syncModalUiFromSnapshot(data: AuthMethodsSnapshot, loadingMethods: boolean): void {
    this.modalUiSubject.next(this.buildModalUiState(data, loadingMethods));
  }

  applyAuthenticationMethodsResponse(
    response: AuthenticationMethodsResponse | AuthMethodsSnapshot
  ): void {
    const payload = StepUpService.extractPayload(response);
    this.authMethodsSnapshot = payload;
    this.syncModalUiFromSnapshot(payload, false);
  }

  setModalLoading(): void {
    this.modalUiSubject.next(this.buildModalUiState(this.authMethodsSnapshot, true));
  }

  setModalError(message: string): void {
    const state = this.buildModalUiState(this.authMethodsSnapshot, false);
    this.modalUiSubject.next({ ...state, errorMessage: message });
  }

  openModal(): void {
    this.seedSnapshotFromTokenIfMissing();
    this.prepareModalUiBeforeOpen();
    this.modalOpenSubject.next(true);
  }

  closeModal(): void {
    this.modalOpenSubject.next(false);
    this.modalUiSubject.next(EMPTY_MODAL_UI);
  }

  /**
   * Garantiza step-up reciente. Si ya es válido, completa de inmediato.
   * Si no, abre el modal y espera confirmación exitosa o error si el usuario cancela.
   */
  requireStepUp(operation?: PendingSecurityOperation, options?: RequireStepUpOptions): Observable<void> {
    if (!options?.force && this.isFresh()) {
      return of(undefined);
    }
    if (operation) {
      this.flowState.setPendingOperation(operation);
    }
    this.openModal();
    return merge(
      this.stepUpCompleteSubject.pipe(take(1), map(() => undefined)),
      this.stepUpFailedSubject.pipe(
        take(1),
        switchMap(() => throwError(() => new Error('step_up_cancelled')))
      )
    ).pipe(take(1));
  }

  notifySuccess(): void {
    this.closeModal();
    this.stepUpCompleteSubject.next();
  }

  notifyFailure(message?: string): void {
    this.closeModal();
    this.stepUpFailedSubject.next(message ?? 'cancelled');
  }

  onStepUpCompletedFromCallback(): void {
    this.closeModal();
    this.stepUpCompleteSubject.next();
  }

  private prepareModalUiBeforeOpen(): void {
    this.modalUiSubject.next(this.buildModalUiState(this.authMethodsSnapshot, true));
  }

  private seedSnapshotFromTokenIfMissing(): void {
    if (this.authMethodsSnapshot) {
      return;
    }
    if (StepUpService.isPasswordOnlyOperation(this.flowState.pendingOperation)) {
      return;
    }
    const token = this.authService.getToken();
    if (!token) {
      return;
    }
    if (getSessionAmr(token) === 'pwd' || this.authService.isAuthenticated()) {
      this.authMethodsSnapshot = {
        methods: [
          {
            type: 'local',
            linked: true,
            canLink: false,
            canUnlink: false,
            canConfigure: false
          }
        ],
        hasLocalPassword: true,
        requiresStepUp: true,
        password: {
          configured: true,
          canSet: false,
          canChange: true,
          requiresStepUp: false,
          requiresCurrentPasswordOnChange: true
        }
      };
    }
  }
}
