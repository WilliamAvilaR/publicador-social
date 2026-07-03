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
export class YouTubeConnectService {
  constructor(private social: SocialService) {}

  startYouTubeConnect(options?: SocialConnectStartOptions): Observable<string> {
    return this.social.startConnect('google', 'youtube_oauth', options);
  }

  getYouTubeConnections(): Observable<SocialConnection[]> {
    return this.social.getConnections({
      providerGroup: 'google',
      connectionType: 'youtube_oauth',
      isActive: true
    });
  }

  getPublishableChannels(
    query: Omit<SocialAccountsQuery, 'providerGroup' | 'provider' | 'forPublishing'> = {}
  ): Observable<SocialAccount[]> {
    return this.social.getAccounts({
      providerGroup: 'google',
      provider: 'youtube',
      forPublishing: true,
      includeBindings: true,
      ...query
    });
  }

  syncYouTubeConnection(connectionId: number): Observable<SocialSyncResponse> {
    return this.social.syncConnection(connectionId);
  }

  disconnectYouTubeConnection(connectionId: number): Observable<{ message?: string }> {
    return this.social.disconnectConnection(connectionId);
  }

  connectYouTubeWithRedirect(options?: SocialConnectStartOptions): Observable<never> {
    return this.social.startYouTubeConnectRedirect(options);
  }

  reauthYouTubeConnection(connectionId: number): Observable<never> {
    return this.social.startYouTubeConnectRedirect({ mode: 'reauth', connectionId });
  }

  disconnectAll(): Observable<{ message?: string }> {
    return this.social.disconnect('google', 'youtube_oauth');
  }
}
