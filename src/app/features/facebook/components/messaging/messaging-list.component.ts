import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { FacebookOAuthService } from '../../../../core/services/facebook-oauth.service';
import { MessagingService } from '../../services/messaging.service';
import { FacebookPage } from '../../models/facebook.model';
import { ConversationDto } from '../../models/messaging.model';

@Component({
  selector: 'app-messaging-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './messaging-list.component.html',
  styleUrl: './messaging-list.component.scss'
})
export class MessagingListComponent implements OnInit {
  pages: FacebookPage[] = [];
  selectedPageId: string | null = null;
  conversations: ConversationDto[] = [];
  loading = false;
  syncing = false;
  error: string | null = null;
  showArchived = false;
  totalCount = 0;

  constructor(
    private facebookService: FacebookOAuthService,
    private messagingService: MessagingService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadConnectedPages();
  }

  loadConnectedPages(): void {
    this.loading = true;
    this.error = null;

    this.facebookService.getConnectedPages().subscribe({
      next: (pages) => {
        this.pages = pages.filter(page => page.isActive);
        this.loading = false;
        
        // Seleccionar la primera página activa automáticamente
        if (this.pages.length > 0 && !this.selectedPageId) {
          this.selectedPageId = this.pages[0].facebookPageId;
          this.loadConversations();
        }
      },
      error: (error) => {
        this.error = error.message || 'Error al cargar las páginas conectadas';
        this.loading = false;
        console.error('Error al cargar páginas:', error);
      }
    });
  }

  onPageChange(pageId: string): void {
    this.selectedPageId = pageId;
    this.conversations = [];
    this.loadConversations();
  }

  loadConversations(): void {
    if (!this.selectedPageId) {
      return;
    }

    this.loading = true;
    this.error = null;

    const params = {
      limit: 50,
      isArchived: this.showArchived ? true : false
    };

    this.messagingService.getConversations(this.selectedPageId, params).subscribe({
      next: (response) => {
        this.conversations = response.data.conversations;
        this.totalCount = response.data.totalCount;
        this.loading = false;
      },
      error: (error) => {
        this.error = error.message || 'Error al cargar las conversaciones';
        this.loading = false;
        console.error('Error al cargar conversaciones:', error);
      }
    });
  }

  syncConversations(): void {
    if (!this.selectedPageId || this.syncing) {
      return;
    }

    this.syncing = true;
    this.error = null;

    this.messagingService.syncConversations(this.selectedPageId).subscribe({
      next: (response) => {
        this.syncing = false;
        // Recargar conversaciones después de sincronizar
        this.loadConversations();
        // Mostrar mensaje de éxito (podrías usar un toast/notificación)
        console.log('Sincronización completada:', response.data.message);
      },
      error: (error) => {
        this.syncing = false;
        this.error = error.message || 'Error al sincronizar conversaciones';
        console.error('Error al sincronizar:', error);
      }
    });
  }

  toggleArchived(): void {
    this.showArchived = !this.showArchived;
    this.loadConversations();
  }

  openConversation(conversation: ConversationDto): void {
    if (!this.selectedPageId) {
      return;
    }
    this.router.navigate(['/dashboard/mensajes', this.selectedPageId, conversation.conversationId]);
  }

  formatDate(dateString: string | null): string {
    if (!dateString) {
      return 'Sin mensajes';
    }

    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) {
      return 'Ahora';
    } else if (diffMins < 60) {
      return `Hace ${diffMins} min`;
    } else if (diffHours < 24) {
      return `Hace ${diffHours} h`;
    } else if (diffDays < 7) {
      return `Hace ${diffDays} d`;
    } else {
      return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
    }
  }

  getSelectedPage(): FacebookPage | undefined {
    return this.pages.find(p => p.facebookPageId === this.selectedPageId);
  }
}
