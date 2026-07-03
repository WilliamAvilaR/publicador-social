import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { YouTubeConnectService } from '../../../core/services/youtube-connect.service';
import {
  getSocialYouTubeConnectionErrorMessage,
  isSocialApiError
} from '../../../shared/utils/social-api.error';

@Component({
  selector: 'app-youtube-connect',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './youtube-connect.component.html',
  styleUrl: './youtube-connect.component.scss'
})
export class YouTubeConnectComponent {
  @Input() label = 'Conectar';
  @Input() oauthMode?: 'add' | 'reauth';
  @Input() connectionId?: number;
  @Input() maxConnectionsPerTenant?: number;
  @Input() maxYouTubeChannels?: number;

  @Output() connectionSuccess = new EventEmitter<void>();
  @Output() connectionError = new EventEmitter<string>();

  loading = false;
  errorMessage: string | null = null;

  constructor(private youtubeConnect: YouTubeConnectService) {}

  onConnect(): void {
    if (this.loading) {
      return;
    }

    this.loading = true;
    this.errorMessage = null;

    const options = this.buildConnectOptions();

    this.youtubeConnect.connectYouTubeWithRedirect(options).subscribe({
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
      return getSocialYouTubeConnectionErrorMessage(err.code, {
        maxConnectionsPerTenant: this.maxConnectionsPerTenant,
        maxYouTubeChannels: this.maxYouTubeChannels
      });
    }
    if (err instanceof Error) {
      return err.message;
    }
    return 'Error al conectar YouTube.';
  }
}
