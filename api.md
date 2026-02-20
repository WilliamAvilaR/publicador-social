Account


POST
/api/Account/change-password
Cambia la contraseña del usuario autenticado actual. Requiere validar la contraseña actual antes de establecer una nueva.


AgGrid


GET
/api/ag-grid/page-summaries
Obtiene resumen de páginas en formato plano para AG Grid. Muestra una fila por página con información básica y métricas más recientes.



GET
/api/ag-grid/group-summaries
Obtiene resumen de grupos en formato plano para AG Grid. Muestra una fila por grupo con información básica y métricas más recientes.



GET
/api/ag-grid/conversations
Obtiene conversaciones en formato plano para AG Grid.



GET
/api/ag-grid/messages
Obtiene mensajes en formato plano para AG Grid.



GET
/api/ag-grid/pages
Obtiene páginas en formato plano para AG Grid.



GET
/api/ag-grid/groups
Obtiene grupos en formato plano para AG Grid.



GET
/api/ag-grid/posts
Obtiene publicaciones en formato plano para AG Grid con paginación y filtros. Soporta dos modos: 'posts' (vista global) y 'targets' (vista operativa).


Facebook


GET
/api/Facebook/connect
Genera una URL de autorización de Facebook OAuth para conectar la cuenta del usuario. El usuario ingresará sus credenciales directamente en Facebook.com.



GET
/api/Facebook/callback
Procesa el callback de Facebook OAuth después de que el usuario autoriza. Valida la sesión, intercambia el código por un token y guarda las páginas del usuario.



GET
/api/Facebook/pages
Obtiene todas las páginas de Facebook conectadas por el usuario autenticado. Incluye información de permisos y estado de publicación. Los tokens no se incluyen por seguridad.



PATCH
/api/Facebook/pages/{facebookPageId}/status
Actualiza el estado (isActive) de una página de Facebook. Activar permite que la página sea usada por el Scheduler, desactivar la ignora.



GET
/api/Facebook/status
Obtiene el estado de la conexión de Facebook del usuario autenticado. Solo lee estado interno previamente calculado, no realiza llamadas a Facebook.



POST
/api/Facebook/pages/validate
Valida los tokens de las páginas de Facebook conectadas mediante llamadas a Facebook Graph API. Actualiza el estado de validación en la base de datos. No devuelve tokens, solo resumen.



GET
/api/Facebook/pages/{facebookPageId}/overview
Obtiene un resumen completo (overview) de una página de Facebook. Incluye header de la página, resumen de analytics, contadores operativos, publicaciones recientes y alertas.


FacebookAnalytics


GET
/api/Facebook/analytics/pages/{facebookPageId}/snapshot
Obtiene el snapshot más reciente de una página de Facebook.



GET
/api/Facebook/analytics/pages/{facebookPageId}/metrics
Obtiene métricas de una página de Facebook para un rango de fechas.



POST
/api/Facebook/analytics/sync
Sincroniza métricas de páginas desde Facebook Graph API. Este endpoint puede tardar varios segundos dependiendo de la cantidad de páginas.



GET
/api/Facebook/analytics/sync-logs
Obtiene los logs de sincronización más recientes del usuario.



GET
/api/Facebook/analytics/pages/{facebookPageId}/chart
Obtiene métricas de una página en formato optimizado para gráficos.


FacebookGroup


POST
/api/Facebook/groups/add
Agrega un grupo de Facebook a partir de una URL.



GET
/api/Facebook/groups
Obtiene todos los grupos de Facebook del usuario autenticado.



GET
/api/Facebook/groups/{facebookGroupId}/metrics
Obtiene métricas de un grupo de Facebook para un rango de fechas. Incluye métricas como número de miembros y publicaciones diarias.



GET
/api/Facebook/groups/{facebookGroupId}/snapshot
Obtiene el snapshot más reciente de un grupo de Facebook. Incluye información básica del grupo y métricas más recientes.



GET
/api/Facebook/groups/{facebookGroupId}/chart
Obtiene métricas de un grupo de Facebook en formato optimizado para gráficos.



PATCH
/api/Facebook/groups/{facebookGroupId}/status
Actualiza el estado (isActive) de un grupo de Facebook. Activar permite que el grupo sea monitoreado por el servicio externo, desactivar lo ignora.


FacebookMessaging


GET
/api/Facebook/messaging/pages/{facebookPageId}/conversations
Obtiene las conversaciones de una página de Facebook.



GET
/api/Facebook/messaging/pages/{facebookPageId}/conversations/{conversationId}/messages
Obtiene los mensajes de una conversación específica.



POST
/api/Facebook/messaging/pages/{facebookPageId}/conversations/{conversationId}/send
Envía un mensaje a una conversación.



POST
/api/Facebook/messaging/pages/{facebookPageId}/conversations/{conversationId}/read
Marca una conversación como leída.



POST
/api/Facebook/messaging/pages/{facebookPageId}/conversations/{conversationId}/archive
Archiva o desarchiva una conversación.



POST
/api/Facebook/messaging/pages/{facebookPageId}/sync
Sincroniza conversaciones y mensajes desde Facebook Graph API.


Me


GET
/api/me
Obtiene el perfil del usuario autenticado actual.



PUT
/api/me
Actualiza el perfil del usuario autenticado actual. Permite actualizar: nombres, apellidos, email, teléfono y fecha de nacimiento.



POST
/api/me/avatar
Sube o actualiza el avatar del usuario autenticado actual. Acepta archivos de imagen (JPG, PNG, GIF, WEBP) con un tamaño máximo de 5MB.



DELETE
/api/me/avatar
Elimina el avatar del usuario autenticado actual.


Post


GET
/api/Post
Obtiene una lista paginada de publicaciones.



POST
/api/Post
Crea una nueva publicación.



PUT
/api/Post
Actualiza una publicación existente.



DELETE
/api/Post
Elimina una publicación por su ID.



GET
/api/Post/{id}
Obtiene una publicación específica por su ID.


PostPlan


POST
/api/PostPlan
Crea un nuevo plan de publicación y genera los targets para las páginas seleccionadas. Si no se especifican páginas, usa todas las publicables del usuario.



GET
/api/PostPlan
Obtiene planes de publicación de un usuario en un rango de fechas para mostrar en calendario. Optimizado para ser liviano y rápido, ideal para FullCalendar.



GET
/api/PostPlan/{planId}
Obtiene el detalle completo de un plan de publicación con sus targets. Incluye información del plan y estado detallado de cada target (status, errores, intentos).


Token


POST
/api/Token/login
Autentica un usuario y genera un token JWT.



POST
/api/Token/register
Registra un nuevo usuario en el sistema.



POST
/api/Token/refresh
Renueva el token JWT del usuario autenticado sin requerir credenciales.


UserSettings


GET
/api/UserSettings
Obtiene las preferencias del usuario autenticado actual. Devuelve valores por defecto si el usuario no ha configurado sus preferencias.



PUT
/api/UserSettings
Actualiza las preferencias del usuario autenticado actual. Solo se actualizan los campos proporcionados (los campos null se ignoran).
