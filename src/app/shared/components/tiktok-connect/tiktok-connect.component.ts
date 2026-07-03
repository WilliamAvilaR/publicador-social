import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TikTokConnectService } from '../../../core/services/tiktok-connect.service';
import {
  getSocialTikTokConnectionErrorMessage,
  isSocialApiError
} from '../../../shared/utils/social-api.error';

@Component({
  selector: 'app-tiktok-connect',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tiktok-connect.component.html',
  styleUrl: './tiktok-connect.component.scss'
})
export class TikTokConnectComponent {
  @Input() label = 'Conectar';
  @Input() oauthMode?: 'add' | 'reauth';
  @Input() connectionId?: number;
  @Input() maxConnectionsPerTenant?: number;
  @Input() maxTikTokAccounts?: number;

  @Output() connectionSuccess = new EventEmitter<void>();
  @Output() connectionError = new EventEmitter<string>();

  loading = false;
  errorMessage: string | null = null;

  constructor(private tiktokConnect: TikTokConnectService) {}

  onConnect(): void {
    if (this.loading) {
      return;
    }

    this.loading = true;
    this.errorMessage = null;

    const options = this.buildConnectOptions();

    this.tiktokConnect.connectTikTokWithRedirect(options).subscribe({
      error: (err: unknown) => {
        this.loading = false;
        const msg = this.resolveErrorMessage(err);
        this.errorMessage = msg;
        this.connectionError.emit(msg);
      }
    });
  }

  private buildConnectOptions() {
    if (this.oauthMode || this.connectionId != null) {
      return {
        mode: this.oauthMode ?? (this.connectionId != null ? ('reauth' as const) : ('add' as const)),
        connectionId: this.connectionId
      };
    }
    return { mode: 'add' as const };
  }

  private resolveErrorMessage(err: unknown): string {
    if (isSocialApiError(err)) {
      return getSocialTikTokConnectionErrorMessage(err.code, {
        maxConnectionsPerTenant: this.maxConnectionsPerTenant,
        maxTikTokAccounts: this.maxTikTokAccounts
      });
    }
    if (err instanceof Error) {
      return err.message;
    }
    return 'Error al conectar TikTok.';
  }
}
