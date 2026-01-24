# Guía de Endpoints - Módulo de Mensajes de Facebook Messenger

## 📋 Resumen

Esta guía explica los endpoints disponibles para gestionar mensajes de Messenger de páginas de Facebook conectadas. Todos los endpoints requieren autenticación JWT y están bajo la ruta base `/api/Facebook/messaging`.

---

## 🔐 Autenticación

Todos los endpoints requieren:
- **Header**: `Authorization: Bearer {token}`
- El token JWT debe contener el `userId` en el claim `NameIdentifier`

---

## 📡 Endpoints Disponibles

### 1. Listar Conversaciones

**Endpoint:** `GET /api/Facebook/messaging/pages/{facebookPageId}/conversations`

**Descripción:**  
Obtiene la lista de conversaciones de Messenger de una página de Facebook específica. Las conversaciones se ordenan por fecha del último mensaje (más recientes primero).

**Parámetros de Ruta:**
- `facebookPageId` (string, requerido): ID de la página en Facebook

**Parámetros de Query:**
- `limit` (int, opcional, default: 25): Cantidad máxima de conversaciones a retornar
- `cursor` (string, opcional): Cursor para paginación (actualmente no implementado, siempre null)
- `isArchived` (bool, opcional): Filtrar por conversaciones archivadas
  - `true`: Solo conversaciones archivadas
  - `false`: Solo conversaciones no archivadas
  - `null` o omitido: Todas las conversaciones

**Respuesta Exitosa (200 OK):**
```json
{
  "data": {
    "conversations": [
      {
        "id": 1,
        "facebookPageId": "123456789",
        "conversationId": "t_123456789",
        "participantId": "987654321",
        "participantName": "Juan Pérez",
        "participantPictureUrl": "https://...",
        "lastMessageAt": "2024-01-15T10:30:00Z",
        "unreadCount": 3,
        "lastMessagePreview": "Hola, tengo una pregunta...",
        "isArchived": false
      }
    ],
    "totalCount": 15,
    "hasMore": false,
    "nextCursor": null
  }
}
```

**Campos de Respuesta:**
- `conversations`: Array de objetos ConversationDto
  - `id`: ID interno de la conversación
  - `facebookPageId`: ID de la página en Facebook
  - `conversationId`: ID de la conversación en Facebook (usado para otras operaciones)
  - `participantId`: ID del usuario que conversa con la página
  - `participantName`: Nombre del participante (puede ser null)
  - `participantPictureUrl`: URL de la imagen de perfil (puede ser null)
  - `lastMessageAt`: Fecha del último mensaje (puede ser null)
  - `unreadCount`: Cantidad de mensajes no leídos
  - `lastMessagePreview`: Vista previa del último mensaje (primeros 100 caracteres, puede ser null)
  - `isArchived`: Indica si la conversación está archivada
- `totalCount`: Total de conversaciones disponibles según el filtro
- `hasMore`: Indica si hay más conversaciones disponibles (actualmente siempre false)
- `nextCursor`: Cursor para la siguiente página (actualmente siempre null)

**Errores:**
- `400 Bad Request`: Parámetros inválidos
- `401 Unauthorized`: Token inválido o usuario no identificado
- `404 Not Found`: Página no encontrada para el usuario

---

### 2. Obtener Mensajes de una Conversación

**Endpoint:** `GET /api/Facebook/messaging/pages/{facebookPageId}/conversations/{conversationId}/messages`

**Descripción:**  
Obtiene los mensajes de una conversación específica. Los mensajes se ordenan por fecha de creación (más recientes primero).

**Parámetros de Ruta:**
- `facebookPageId` (string, requerido): ID de la página en Facebook
- `conversationId` (string, requerido): ID de la conversación en Facebook

**Parámetros de Query:**
- `limit` (int, opcional, default: 50): Cantidad máxima de mensajes a retornar
- `cursor` (string, opcional): Cursor para paginación (actualmente no implementado)

**Respuesta Exitosa (200 OK):**
```json
{
  "data": [
    {
      "id": 1,
      "messageId": "m_123456789",
      "fromId": "123456789",
      "toId": "987654321",
      "message": "Hola, ¿cómo puedo ayudarte?",
      "createdTime": "2024-01-15T10:30:00Z",
      "isFromPage": true,
      "messageType": "text",
      "isRead": true
    }
  ]
}
```

**Campos de Respuesta:**
- Array de objetos MessageDto:
  - `id`: ID interno del mensaje
  - `messageId`: ID del mensaje en Facebook
  - `fromId`: ID del remitente
  - `toId`: ID del destinatario
  - `message`: Contenido del mensaje
  - `createdTime`: Fecha y hora de creación (timestamp de Facebook)
  - `isFromPage`: `true` si fue enviado desde la página, `false` si fue recibido
  - `messageType`: Tipo de mensaje ("text", "image", "video", etc., puede ser null)
  - `isRead`: Indica si el mensaje ha sido leído

**Errores:**
- `400 Bad Request`: Parámetros inválidos
- `401 Unauthorized`: Token inválido o usuario no identificado
- `404 Not Found`: Página o conversación no encontrada

---

### 3. Enviar Mensaje

**Endpoint:** `POST /api/Facebook/messaging/pages/{facebookPageId}/conversations/{conversationId}/send`

**Descripción:**  
Envía un mensaje de texto desde la página a un usuario en una conversación específica. El mensaje se envía a través de Facebook Graph API y se guarda en la base de datos local.

**Parámetros de Ruta:**
- `facebookPageId` (string, requerido): ID de la página en Facebook
- `conversationId` (string, requerido): ID de la conversación en Facebook

**Body (JSON):**
```json
{
  "message": "Texto del mensaje a enviar"
}
```

**Campos del Body:**
- `message` (string, requerido): Contenido del mensaje a enviar

**Respuesta Exitosa (200 OK):**
```json
{
  "data": {
    "id": 1,
    "messageId": "m_123456789",
    "fromId": "123456789",
    "toId": "987654321",
    "message": "Texto del mensaje enviado",
    "createdTime": "2024-01-15T10:35:00Z",
    "isFromPage": true,
    "messageType": "text",
    "isRead": false
  }
}
```

**Comportamiento:**
- El mensaje se envía inmediatamente a Facebook Messenger
- Se actualiza la conversación con el nuevo último mensaje
- Se actualiza la vista previa del último mensaje
- El mensaje se guarda en la base de datos local

**Errores:**
- `400 Bad Request`: Parámetros inválidos, mensaje vacío, o error al enviar a Facebook
- `401 Unauthorized`: Token inválido o usuario no identificado
- `404 Not Found`: Página o conversación no encontrada

**Nota:** El usuario debe haber iniciado la conversación primero. Solo se pueden enviar mensajes dentro de la ventana de 24 horas después del último mensaje del usuario.

---

### 4. Marcar Conversación como Leída

**Endpoint:** `POST /api/Facebook/messaging/pages/{facebookPageId}/conversations/{conversationId}/read`

**Descripción:**  
Marca todos los mensajes de una conversación como leídos y actualiza el contador de mensajes no leídos a cero.

**Parámetros de Ruta:**
- `facebookPageId` (string, requerido): ID de la página en Facebook
- `conversationId` (string, requerido): ID de la conversación en Facebook

**Body:** No requiere body

**Respuesta Exitosa (200 OK):**
```json
{
  "message": "Conversación marcada como leída."
}
```

**Comportamiento:**
- Todos los mensajes no leídos de la conversación se marcan como leídos
- Se actualiza la fecha de lectura (`ReadAt`) de cada mensaje
- El contador `unreadCount` de la conversación se establece en 0

**Errores:**
- `400 Bad Request`: Parámetros inválidos
- `401 Unauthorized`: Token inválido o usuario no identificado
- `404 Not Found`: Página o conversación no encontrada

---

### 5. Archivar/Desarchivar Conversación

**Endpoint:** `POST /api/Facebook/messaging/pages/{facebookPageId}/conversations/{conversationId}/archive`

**Descripción:**  
Archiva o desarchiva una conversación. Las conversaciones archivadas pueden filtrarse en la lista de conversaciones.

**Parámetros de Ruta:**
- `facebookPageId` (string, requerido): ID de la página en Facebook
- `conversationId` (string, requerido): ID de la conversación en Facebook

**Body (JSON):**
```json
{
  "archive": true
}
```

**Campos del Body:**
- `archive` (bool, requerido): 
  - `true`: Archivar la conversación
  - `false`: Desarchivar la conversación

**Respuesta Exitosa (200 OK):**
```json
{
  "message": "Conversación archivada."
}
```
o
```json
{
  "message": "Conversación desarchivada."
}
```

**Comportamiento:**
- Actualiza el campo `isArchived` de la conversación
- Las conversaciones archivadas no aparecen en la lista por defecto (usar `isArchived=true` en el query)

**Errores:**
- `400 Bad Request`: Parámetros inválidos
- `401 Unauthorized`: Token inválido o usuario no identificado
- `404 Not Found`: Página o conversación no encontrada

---

### 6. Sincronizar Conversaciones

**Endpoint:** `POST /api/Facebook/messaging/pages/{facebookPageId}/sync`

**Descripción:**  
Sincroniza conversaciones y mensajes desde Facebook Graph API hacia la base de datos local. Este proceso puede tardar varios segundos dependiendo de la cantidad de conversaciones y mensajes.

**Parámetros de Ruta:**
- `facebookPageId` (string, requerido): ID de la página en Facebook

**Body:** No requiere body

**Respuesta Exitosa (200 OK):**
```json
{
  "data": {
    "conversationsSynced": 10,
    "messagesSynced": 45,
    "newConversations": 2,
    "newMessages": 15,
    "message": "Sincronización completada. 10 conversación(es), 45 mensaje(s).",
    "startedAt": "2024-01-15T10:00:00Z",
    "endedAt": "2024-01-15T10:00:05Z"
  }
}
```

**Campos de Respuesta:**
- `conversationsSynced`: Total de conversaciones procesadas
- `messagesSynced`: Total de mensajes procesados
- `newConversations`: Cantidad de conversaciones nuevas encontradas
- `newMessages`: Cantidad de mensajes nuevos encontrados
- `message`: Mensaje descriptivo del resultado
- `startedAt`: Fecha y hora de inicio de la sincronización
- `endedAt`: Fecha y hora de finalización de la sincronización

**Comportamiento:**
1. Obtiene todas las conversaciones de la página desde Facebook Graph API
2. Para cada conversación:
   - Crea la conversación si no existe
   - Actualiza datos de la conversación (participante, último mensaje, etc.)
   - Obtiene los mensajes de la conversación
   - Guarda mensajes nuevos en la base de datos
3. Actualiza contadores y vistas previas

**Consideraciones:**
- ⚠️ Este endpoint puede tardar varios segundos o minutos si hay muchas conversaciones
- ⚠️ No bloquees la UI mientras se ejecuta, muestra un indicador de progreso
- ✅ Los mensajes duplicados se detectan automáticamente (no se guardan dos veces)
- ✅ Si una conversación o mensaje ya existe, se actualiza en lugar de duplicarse

**Errores:**
- `400 Bad Request`: Error al obtener datos de Facebook o procesar la sincronización
- `401 Unauthorized`: Token inválido o usuario no identificado
- `404 Not Found`: Página no encontrada

**Cuándo usar:**
- Cuando el usuario solicita manualmente una actualización
- Cuando se necesita refrescar los datos después de un período de tiempo
- Como parte de un proceso automático programado (recomendado: cada 5-15 minutos)

---

## 🔄 Flujo de Uso Recomendado

1. **Sincronizar conversaciones:** Llamar a `/sync` para obtener las conversaciones más recientes
2. **Listar conversaciones:** Llamar a `/conversations` para mostrar la lista al usuario
3. **Abrir conversación:** Cuando el usuario selecciona una conversación, llamar a `/messages` para obtener los mensajes
4. **Enviar mensaje:** Usar `/send` para responder
5. **Marcar como leído:** Llamar a `/read` cuando el usuario abre una conversación
6. **Archivar:** Usar `/archive` si el usuario quiere ocultar una conversación

---

## ⚠️ Consideraciones Importantes

### Permisos Requeridos
- El usuario debe haber reconectado su página de Facebook después de agregar los permisos `pages_messaging` y `pages_manage_metadata`
- Si el token no tiene estos permisos, las operaciones fallarán con error 400

### Ventana de Respuesta
- Los mensajes solo se pueden enviar dentro de las 24 horas después del último mensaje del usuario
- Después de 24 horas, solo se pueden enviar mensajes con templates aprobados por Facebook

### Sincronización
- La sincronización obtiene hasta 25 conversaciones y hasta 50 mensajes por conversación
- Para obtener más datos, se puede llamar múltiples veces o implementar paginación en el futuro

### Rendimiento
- Los endpoints de lectura son rápidos (datos desde BD local)
- El endpoint de sincronización puede ser lento (llamadas a Facebook API)
- El endpoint de envío de mensajes es rápido pero depende de la respuesta de Facebook

---

## 📝 Notas Técnicas

- Todos los timestamps están en formato ISO 8601 (UTC)
- Los IDs de Facebook son strings, no números
- Los campos opcionales pueden ser `null` en las respuestas
- Los errores siempre retornan un objeto con campo `message` describiendo el problema
- La paginación con cursor está preparada pero no implementada completamente (siempre retorna `null`)
