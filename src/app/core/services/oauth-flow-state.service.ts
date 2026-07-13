import { Injectable } from '@angular/core';
import { PendingSecurityOperation } from '../models/account-security.model';
import { ExternalAuthProvider } from '../models/auth.model';
import { LinkSecurityErrorPresentation } from '../../shared/utils/account-security.errors';

const PENDING_OPERATION_KEY = 'oauth_pending_operation';

/**
 * Estado en memoria de flujos OAuth V2 sensibles.
 * No persistir pendingLinkToken ni challengeToken (guía §8).
 * Solo pendingOperation en sessionStorage para sobrevivir el redirect OAuth.
 */
@Injectable({ providedIn: 'root' })
export class OAuthFlowStateService {
  pendingLinkToken: string | null = null;
  challengeToken: string | null = null;
  linkChallengeFlowCode: string | null = null;
  linkChallengeProvider: ExternalAuthProvider | null = null;
  linkChallengeMaskedEmail: string | null = null;
  linkChallengeVerificationMethods: string[] = [];
  linkChallengeExistingAuthMethod: string | null = null;
  pendingOperation: PendingSecurityOperation | null = this.restorePendingOperation();
  pendingLinkProvider: ExternalAuthProvider | null = null;
  linkReviewProviderEmail: string | null = null;
  linkReviewAccountEmail: string | null = null;
  pendingSecurityError: LinkSecurityErrorPresentation | null = null;

  setPendingSecurityError(error: string | LinkSecurityErrorPresentation): void {
    this.pendingSecurityError =
      typeof error === 'string'
        ? { title: 'No se pudo vincular', message: error }
        : error;
  }

  consumePendingSecurityError(): LinkSecurityErrorPresentation | null {
    const error = this.pendingSecurityError;
    this.pendingSecurityError = null;
    return error;
  }

  setPendingLinkReview(
    pendingLinkToken: string,
    provider?: ExternalAuthProvider,
    providerEmail?: string,
    accountEmail?: string
  ): void {
    this.pendingLinkToken = pendingLinkToken;
    this.pendingLinkProvider = provider ?? null;
    this.linkReviewProviderEmail = providerEmail ?? null;
    this.linkReviewAccountEmail = accountEmail ?? null;
  }

  setLinkChallenge(
    flowCode: string,
    challengeToken: string,
    context?: {
      provider?: ExternalAuthProvider;
      maskedEmail?: string;
      verificationMethods?: string[];
      existingAuthMethod?: string;
    }
  ): void {
    this.linkChallengeFlowCode = flowCode;
    this.challengeToken = challengeToken;
    this.linkChallengeProvider = context?.provider ?? null;
    this.linkChallengeMaskedEmail = context?.maskedEmail ?? null;
    this.linkChallengeVerificationMethods = context?.verificationMethods ?? [];
    this.linkChallengeExistingAuthMethod = context?.existingAuthMethod ?? null;
  }

  hasLinkChallengeContext(): boolean {
    return !!this.challengeToken;
  }

  setPendingOperation(operation: PendingSecurityOperation | null): void {
    this.pendingOperation = operation;
    try {
      if (operation) {
        sessionStorage.setItem(PENDING_OPERATION_KEY, operation);
      } else {
        sessionStorage.removeItem(PENDING_OPERATION_KEY);
      }
    } catch {
      // sessionStorage no disponible
    }
  }

  clearLinkReview(): void {
    this.pendingLinkToken = null;
    this.pendingLinkProvider = null;
    this.linkReviewProviderEmail = null;
    this.linkReviewAccountEmail = null;
  }

  clearLinkChallenge(): void {
    this.challengeToken = null;
    this.linkChallengeFlowCode = null;
    this.linkChallengeProvider = null;
    this.linkChallengeMaskedEmail = null;
    this.linkChallengeVerificationMethods = [];
    this.linkChallengeExistingAuthMethod = null;
  }

  clearAll(): void {
    this.clearLinkReview();
    this.clearLinkChallenge();
    this.setPendingOperation(null);
  }

  private restorePendingOperation(): PendingSecurityOperation | null {
    try {
      const saved = sessionStorage.getItem(PENDING_OPERATION_KEY);
      return saved ? (saved as PendingSecurityOperation) : null;
    } catch {
      return null;
    }
  }
}
