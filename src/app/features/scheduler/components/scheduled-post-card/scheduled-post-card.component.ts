import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-scheduled-post-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './scheduled-post-card.component.html',
  styleUrls: ['./scheduled-post-card.component.scss']
})
export class ScheduledPostCardComponent {
  @Input() event: any;

  getPreviewText(): string {
    if (!this.event?.extendedProps?.content) {
      return this.event?.title || '';
    }
    const content = this.event.extendedProps.content;
    return content.length > 50 ? content.substring(0, 50) + '...' : content;
  }

  getFormattedTime(): string {
    if (!this.event?.start) return '';
    const date = new Date(this.event.start);
    return date.toLocaleTimeString('es-ES', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }

  getSocialIcon(): string {
    const network = this.event?.extendedProps?.socialNetwork || 'facebook';
    const icons: Record<string, string> = {
      facebook: '📘',
      instagram: '📷',
      twitter: '🐦'
    };
    return icons[network] || '📱';
  }

  getSocialNetworkName(): string {
    const network = this.event?.extendedProps?.socialNetwork || 'facebook';
    const names: Record<string, string> = {
      facebook: 'Facebook',
      instagram: 'Instagram',
      twitter: 'Twitter'
    };
    return names[network] || 'Red Social';
  }

  getStatusClass(): string {
    const status = this.event?.extendedProps?.status || 'scheduled';
    return `status-${status}`;
  }

  getStatusLabel(): string {
    const status = this.event?.extendedProps?.status || 'scheduled';
    const labels: Record<string, string> = {
      scheduled: 'Programada',
      published: 'Publicada',
      failed: 'Fallida'
    };
    return labels[status] || 'Desconocido';
  }

  getAccountName(): string {
    return this.event?.extendedProps?.accountName || 
           this.event?.extendedProps?.pageName || 
           'Cuenta';
  }
}
