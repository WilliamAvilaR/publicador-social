/**
 * Modelos para el módulo de Mensajería de Facebook Messenger
 */

/**
 * DTO de una conversación de Messenger
 */
export interface ConversationDto {
  id: number;
  facebookPageId: string;
  conversationId: string;
  participantId: string;
  participantName: string | null;
  participantPictureUrl: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  lastMessagePreview: string | null;
  isArchived: boolean;
}

/**
 * Response de lista de conversaciones
 */
export interface ConversationsResponse {
  data: {
    conversations: ConversationDto[];
    totalCount: number;
    hasMore: boolean;
    nextCursor: string | null;
  };
}

/**
 * Parámetros de query para listar conversaciones
 */
export interface GetConversationsParams {
  limit?: number;
  cursor?: string;
  isArchived?: boolean | null;
}

/**
 * DTO de un mensaje de Messenger
 */
export interface MessageDto {
  id: number;
  messageId: string;
  fromId: string;
  toId: string;
  message: string;
  createdTime: string;
  isFromPage: boolean;
  messageType: string | null;
  isRead: boolean;
}

/**
 * Response de mensajes de una conversación
 */
export interface MessagesResponse {
  data: MessageDto[];
}

/**
 * Parámetros de query para obtener mensajes
 */
export interface GetMessagesParams {
  limit?: number;
  cursor?: string;
}

/**
 * Request para enviar un mensaje
 */
export interface SendMessageRequest {
  message: string;
}

/**
 * Response de envío de mensaje
 */
export interface SendMessageResponse {
  data: MessageDto;
}

/**
 * Request para archivar/desarchivar conversación
 */
export interface ArchiveConversationRequest {
  archive: boolean;
}

/**
 * Response de archivar/desarchivar conversación
 */
export interface ArchiveConversationResponse {
  message: string;
}

/**
 * Response de marcar conversación como leída
 */
export interface MarkAsReadResponse {
  message: string;
}

/**
 * Response de sincronización de conversaciones
 */
export interface SyncConversationsResponse {
  data: {
    conversationsSynced: number;
    messagesSynced: number;
    newConversations: number;
    newMessages: number;
    message: string;
    startedAt: string;
    endedAt: string;
  };
}
