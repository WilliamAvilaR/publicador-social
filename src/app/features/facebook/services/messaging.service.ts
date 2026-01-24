import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
  ConversationsResponse,
  GetConversationsParams,
  MessagesResponse,
  GetMessagesParams,
  SendMessageRequest,
  SendMessageResponse,
  ArchiveConversationRequest,
  ArchiveConversationResponse,
  MarkAsReadResponse,
  SyncConversationsResponse
} from '../models/messaging.model';

/**
 * Servicio para interactuar con los endpoints de Mensajería de Facebook Messenger.
 * 
 * Este servicio proporciona métodos para:
 * - Listar conversaciones de una página
 * - Obtener mensajes de una conversación
 * - Enviar mensajes
 * - Marcar conversaciones como leídas
 * - Archivar/desarchivar conversaciones
 * - Sincronizar conversaciones desde Facebook
 * 
 * Todos los métodos requieren autenticación JWT, que es agregada
 * automáticamente por el interceptor HTTP.
 */
@Injectable({
  providedIn: 'root'
})
export class MessagingService {
  private readonly apiUrl = '/api/Facebook/messaging';

  constructor(private http: HttpClient) {}

  /**
   * Obtiene la lista de conversaciones de una página de Facebook.
   * 
   * Las conversaciones se ordenan por fecha del último mensaje (más recientes primero).
   * 
   * @param facebookPageId ID de la página en Facebook
   * @param params Parámetros opcionales de paginación y filtrado
   * @returns Observable con la lista de conversaciones
   * 
   * @example
   * ```typescript
   * // Obtener todas las conversaciones (por defecto: 25)
   * this.messagingService.getConversations('123456789').subscribe({
   *   next: (response) => {
   *     console.log('Conversaciones:', response.data.conversations);
   *     console.log('Total:', response.data.totalCount);
   *   }
   * });
   * 
   * // Obtener solo conversaciones archivadas
   * this.messagingService.getConversations('123456789', { isArchived: true })
   *   .subscribe(...);
   * ```
   */
  getConversations(
    facebookPageId: string,
    params?: GetConversationsParams
  ): Observable<ConversationsResponse> {
    let httpParams = new HttpParams();

    if (params?.limit !== undefined) {
      httpParams = httpParams.set('limit', params.limit.toString());
    }
    if (params?.cursor) {
      httpParams = httpParams.set('cursor', params.cursor);
    }
    if (params?.isArchived !== undefined && params.isArchived !== null) {
      httpParams = httpParams.set('isArchived', params.isArchived.toString());
    }

    return this.http.get<ConversationsResponse>(
      `${this.apiUrl}/pages/${facebookPageId}/conversations`,
      { params: httpParams }
    ).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Obtiene los mensajes de una conversación específica.
   * 
   * Los mensajes se ordenan por fecha de creación (más recientes primero).
   * 
   * @param facebookPageId ID de la página en Facebook
   * @param conversationId ID de la conversación en Facebook
   * @param params Parámetros opcionales de paginación
   * @returns Observable con la lista de mensajes
   * 
   * @example
   * ```typescript
   * // Obtener mensajes (por defecto: 50)
   * this.messagingService.getMessages('123456789', 't_987654321').subscribe({
   *   next: (response) => {
   *     console.log('Mensajes:', response.data);
   *   }
   * });
   * ```
   */
  getMessages(
    facebookPageId: string,
    conversationId: string,
    params?: GetMessagesParams
  ): Observable<MessagesResponse> {
    let httpParams = new HttpParams();

    if (params?.limit !== undefined) {
      httpParams = httpParams.set('limit', params.limit.toString());
    }
    if (params?.cursor) {
      httpParams = httpParams.set('cursor', params.cursor);
    }

    return this.http.get<MessagesResponse>(
      `${this.apiUrl}/pages/${facebookPageId}/conversations/${conversationId}/messages`,
      { params: httpParams }
    ).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Envía un mensaje de texto desde la página a un usuario en una conversación.
   * 
   * El mensaje se envía inmediatamente a Facebook Messenger y se guarda en la base de datos local.
   * 
   * ⚠️ Nota: El usuario debe haber iniciado la conversación primero. Solo se pueden enviar
   * mensajes dentro de la ventana de 24 horas después del último mensaje del usuario.
   * 
   * @param facebookPageId ID de la página en Facebook
   * @param conversationId ID de la conversación en Facebook
   * @param request Contenido del mensaje a enviar
   * @returns Observable con el mensaje enviado
   * 
   * @example
   * ```typescript
   * this.messagingService.sendMessage('123456789', 't_987654321', {
   *   message: 'Hola, ¿cómo puedo ayudarte?'
   * }).subscribe({
   *   next: (response) => {
   *     console.log('Mensaje enviado:', response.data.messageId);
   *   },
   *   error: (error) => {
   *     console.error('Error al enviar:', error.message);
   *   }
   * });
   * ```
   */
  sendMessage(
    facebookPageId: string,
    conversationId: string,
    request: SendMessageRequest
  ): Observable<SendMessageResponse> {
    return this.http.post<SendMessageResponse>(
      `${this.apiUrl}/pages/${facebookPageId}/conversations/${conversationId}/send`,
      request
    ).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Marca todos los mensajes de una conversación como leídos.
   * 
   * Actualiza el contador de mensajes no leídos a cero.
   * 
   * @param facebookPageId ID de la página en Facebook
   * @param conversationId ID de la conversación en Facebook
   * @returns Observable con mensaje de confirmación
   * 
   * @example
   * ```typescript
   * this.messagingService.markAsRead('123456789', 't_987654321').subscribe({
   *   next: (response) => {
   *     console.log(response.message); // "Conversación marcada como leída."
   *   }
   * });
   * ```
   */
  markAsRead(
    facebookPageId: string,
    conversationId: string
  ): Observable<MarkAsReadResponse> {
    return this.http.post<MarkAsReadResponse>(
      `${this.apiUrl}/pages/${facebookPageId}/conversations/${conversationId}/read`,
      {}
    ).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Archiva o desarchiva una conversación.
   * 
   * Las conversaciones archivadas pueden filtrarse en la lista de conversaciones.
   * 
   * @param facebookPageId ID de la página en Facebook
   * @param conversationId ID de la conversación en Facebook
   * @param archive true para archivar, false para desarchivar
   * @returns Observable con mensaje de confirmación
   * 
   * @example
   * ```typescript
   * // Archivar conversación
   * this.messagingService.archiveConversation('123456789', 't_987654321', true)
   *   .subscribe(...);
   * 
   * // Desarchivar conversación
   * this.messagingService.archiveConversation('123456789', 't_987654321', false)
   *   .subscribe(...);
   * ```
   */
  archiveConversation(
    facebookPageId: string,
    conversationId: string,
    archive: boolean
  ): Observable<ArchiveConversationResponse> {
    const request: ArchiveConversationRequest = { archive };
    return this.http.post<ArchiveConversationResponse>(
      `${this.apiUrl}/pages/${facebookPageId}/conversations/${conversationId}/archive`,
      request
    ).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Sincroniza conversaciones y mensajes desde Facebook Graph API hacia la base de datos local.
   * 
   * ⚠️ Este proceso puede tardar varios segundos o minutos dependiendo de la cantidad
   * de conversaciones y mensajes. Se recomienda mostrar un indicador de progreso mientras
   * se ejecuta.
   * 
   * El proceso:
   * 1. Obtiene todas las conversaciones de la página desde Facebook Graph API
   * 2. Para cada conversación: crea/actualiza la conversación y obtiene los mensajes
   * 3. Guarda mensajes nuevos en la base de datos
   * 4. Actualiza contadores y vistas previas
   * 
   * @param facebookPageId ID de la página en Facebook
   * @returns Observable con el resultado de la sincronización
   * 
   * @example
   * ```typescript
   * this.messagingService.syncConversations('123456789').subscribe({
   *   next: (response) => {
   *     console.log('Conversaciones sincronizadas:', response.data.conversationsSynced);
   *     console.log('Mensajes sincronizados:', response.data.messagesSynced);
   *     console.log('Nuevas conversaciones:', response.data.newConversations);
   *     console.log('Nuevos mensajes:', response.data.newMessages);
   *   },
   *   error: (error) => {
   *     console.error('Error en sincronización:', error.message);
   *   }
   * });
   * ```
   */
  syncConversations(facebookPageId: string): Observable<SyncConversationsResponse> {
    return this.http.post<SyncConversationsResponse>(
      `${this.apiUrl}/pages/${facebookPageId}/sync`,
      {}
    ).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Maneja errores HTTP de manera consistente.
   * 
   * @param error Error HTTP recibido
   * @returns Observable que emite un error con mensaje descriptivo
   */
  private handleError = (error: HttpErrorResponse) => {
    let errorMessage = 'Error desconocido';

    if (error.error instanceof ErrorEvent) {
      // Error del lado del cliente
      errorMessage = `Error: ${error.error.message}`;
    } else {
      // Error del lado del servidor
      switch (error.status) {
        case 401:
          errorMessage = 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.';
          break;
        case 400:
          errorMessage = error.error?.detail || error.error?.message || 'Solicitud inválida.';
          break;
        case 404:
          errorMessage = 'No se encontró la página o conversación solicitada.';
          break;
        case 500:
          errorMessage = 'Error del servidor. Por favor, intenta más tarde.';
          break;
        default:
          errorMessage = `Error ${error.status}: ${error.message}`;
      }
    }

    return throwError(() => new Error(errorMessage));
  };
}
