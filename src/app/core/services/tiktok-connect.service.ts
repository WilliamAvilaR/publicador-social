import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  SocialAccount,
  SocialAccountsQuery,
  SocialConnectStartOptions,
  SocialConnection,
  SocialSyncResponse
} from '../../features/social/models/social.model';
import { SocialService } from './social.service';

@Injectable({
  providedIn: 'root'
})
export class TikTokConnectService {
  constructor(private social: SocialService) {}

  startTikTokConnect(options?: SocialConnectStartOptions): Observable<string> {
    return this.social.startConnect('tiktok', 'tiktok_oauth', options);
  }

  getTikTokConnections(): Observable<SocialConnection[]> {
    return this.social.getConnections({
      providerGroup: 'tiktok',
      connectionType: 'tiktok_oauth',
      isActive: true
    });
  }

  getAccounts(query: Omit<SocialAccountsQuery, 'providerGroup' | 'provider'> = {}): Observable<SocialAccount[]> {
    return this.social.getAccounts({
      providerGroup: 'tiktok',
      provider: 'tiktok',
      ...query
    });
  }

  syncTikTokConnection(connectionId: number): Observable<SocialSyncResponse> {
    return this.social.syncConnection(connectionId);
  }

  disconnectTikTokConnection(connectionId: number): Observable<{ message?: string }> {
    return this.social.disconnectConnection(connectionId);
  }

  connectTikTokWithRedirect(options?: SocialConnectStartOptions): Observable<never> {
    return this.social.startTikTokConnectRedirect(options);
  }

  reauthTikTokConnection(connectionId: number): Observable<never> {
    return this.social.startTikTokConnectRedirect({ mode: 'reauth', connectionId });
  }

  disconnectAll(): Observable<{ message?: string }> {
    return this.social.disconnect('tiktok', 'tiktok_oauth');
  }

  updateAccountStatus(accountId: number, isActive: boolean): Observable<SocialAccount> {
    return this.social.updateAccountStatus(accountId, isActive);
  }
}
