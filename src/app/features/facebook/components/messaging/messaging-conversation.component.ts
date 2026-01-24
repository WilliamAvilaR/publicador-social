import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { MessagingService } from '../../services/messaging.service';
import { MessageDto, ConversationDto } from '../../models/messaging.model';

@Component({
  selector: 'app-messaging-conversation',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './messaging-conversation.component.html',
  styleUrl: './messaging-conversation.component.scss'
})
export class MessagingConversationComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('messagesContainer') messagesContainer!: ElementRef;
  
  facebookPageId: string = '';
  conversationId: string = '';
  conversation: ConversationDto | null = null;
  messages: MessageDto[] = [];
  newMessage: string = '';
  loading = false;
  sending = false;
  error: string | null = null;
  private destroy$ = new Subject<void>();
  private shouldScrollToBottom = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private messagingService: MessagingService
  ) {}

  ngOnInit(): void {
    this.route.params.pipe(takeUntil(this.destroy$)).subscribe(params => {
      this.facebookPageId = params['pageId'];
      this.conversationId = params['conversationId'];
      this.loadConversation();
      this.loadMessages();
    });
  }

  ngAfterViewChecked(): void {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadConversation(): void {
    // Cargamos todas las conversaciones y filtramos por conversationId
    // Esto es necesario porque no hay un endpoint específico para obtener una conversación individual
    this.messagingService.getConversations(this.facebookPageId, { limit: 100 }).subscribe({
      next: (response) => {
        const found = response.data.conversations.find(
          c => c.conversationId === this.conversationId
        );
        if (found) {
          this.conversation = found;
          // Marcar como leída cuando se abre
          this.markAsRead();
        } else {
          this.error = 'Conversación no encontrada';
        }
      },
      error: (error) => {
        this.error = error.message || 'Error al cargar la conversación';
      }
    });
  }

  loadMessages(): void {
    if (!this.facebookPageId || !this.conversationId) {
      return;
    }

    this.loading = true;
    this.error = null;

    this.messagingService.getMessages(this.facebookPageId, this.conversationId, { limit: 100 }).subscribe({
      next: (response) => {
        // Los mensajes vienen más recientes primero, los invertimos para mostrar más antiguos arriba
        this.messages = response.data.reverse();
        this.shouldScrollToBottom = true;
        this.loading = false;
      },
      error: (error) => {
        this.error = error.message || 'Error al cargar los mensajes';
        this.loading = false;
      }
    });
  }

  sendMessage(): void {
    if (!this.newMessage.trim() || this.sending || !this.facebookPageId || !this.conversationId) {
      return;
    }

    const messageText = this.newMessage.trim();
    this.newMessage = '';
    this.sending = true;
    this.error = null;

    this.messagingService.sendMessage(this.facebookPageId, this.conversationId, {
      message: messageText
    }).subscribe({
      next: (response) => {
        // Agregar el mensaje enviado a la lista
        this.messages.push(response.data);
        this.shouldScrollToBottom = true;
        this.sending = false;
        // Recargar la conversación para actualizar el último mensaje
        this.loadConversation();
      },
      error: (error) => {
        this.error = error.message || 'Error al enviar el mensaje';
        this.sending = false;
        // Restaurar el mensaje si falla
        this.newMessage = messageText;
      }
    });
  }

  markAsRead(): void {
    if (!this.facebookPageId || !this.conversationId) {
      return;
    }

    this.messagingService.markAsRead(this.facebookPageId, this.conversationId).subscribe({
      next: () => {
        // Actualizar el estado local
        if (this.conversation) {
          this.conversation.unreadCount = 0;
        }
        this.messages.forEach(msg => msg.isRead = true);
      },
      error: (error) => {
        console.error('Error al marcar como leída:', error);
      }
    });
  }

  archiveConversation(archive: boolean): void {
    if (!this.facebookPageId || !this.conversationId) {
      return;
    }

    this.messagingService.archiveConversation(this.facebookPageId, this.conversationId, archive).subscribe({
      next: () => {
        // Redirigir a la lista después de archivar/desarchivar
        this.router.navigate(['/dashboard/mensajes']);
      },
      error: (error) => {
        this.error = error.message || 'Error al archivar la conversación';
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/dashboard/mensajes']);
  }

  formatMessageTime(dateString: string): string {
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
      return date.toLocaleDateString('es-ES', { 
        day: 'numeric', 
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  }

  formatMessageDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);

    if (diffDays === 0) {
      return 'Hoy';
    } else if (diffDays === 1) {
      return 'Ayer';
    } else if (diffDays < 7) {
      return date.toLocaleDateString('es-ES', { weekday: 'long' });
    } else {
      return date.toLocaleDateString('es-ES', { 
        day: 'numeric', 
        month: 'long',
        year: 'numeric'
      });
    }
  }

  shouldShowDateSeparator(index: number): boolean {
    if (index === 0) {
      return true;
    }
    const current = new Date(this.messages[index].createdTime);
    const previous = new Date(this.messages[index - 1].createdTime);
    return current.toDateString() !== previous.toDateString();
  }

  private scrollToBottom(): void {
    if (this.messagesContainer) {
      const element = this.messagesContainer.nativeElement;
      element.scrollTop = element.scrollHeight;
    }
  }

  onKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }
}
