# Endpoints No Utilizados en la Aplicación

Este documento lista los endpoints de la API que **NO** se están utilizando en el código de la aplicación Angular.

## 📋 Resumen

**Total de endpoints documentados:** 49  
**Endpoints utilizados:** 40  
**Endpoints NO utilizados:** 9

---

## ❌ Endpoints No Utilizados

### 1. **AgGrid - Posts**
- **Método:** `GET`
- **Endpoint:** `/api/ag-grid/posts`
- **Descripción:** Obtiene publicaciones en formato plano para AG Grid con paginación y filtros. Soporta dos modos: 'posts' (vista global) y 'targets' (vista operativa).
- **Ubicación esperada:** `src/app/features/facebook/services/ag-grid.service.ts`
- **Estado:** ❌ No implementado

---

### 2. **Facebook - Callback**
- **Método:** `GET`
- **Endpoint:** `/api/Facebook/callback`
- **Descripción:** Procesa el callback de Facebook OAuth después de que el usuario autoriza. Valida la sesión, intercambia el código por un token y guarda las páginas del usuario.
- **Nota:** Este endpoint normalmente se llama directamente desde el backend después de la redirección de Facebook, no desde el frontend.
- **Estado:** ⚠️ Probablemente usado por el backend, no por el frontend

---

### 3. **Facebook - Status**
- **Método:** `GET`
- **Endpoint:** `/api/Facebook/status`
- **Descripción:** Obtiene el estado de la conexión de Facebook del usuario autenticado. Solo lee estado interno previamente calculado, no realiza llamadas a Facebook.
- **Ubicación esperada:** `src/app/core/services/facebook-oauth.service.ts`
- **Estado:** ❌ No implementado

---

### 4. **Facebook - Validate Pages**
- **Método:** `POST`
- **Endpoint:** `/api/Facebook/pages/validate`
- **Descripción:** Valida los tokens de las páginas de Facebook conectadas mediante llamadas a Facebook Graph API. Actualiza el estado de validación en la base de datos. No devuelve tokens, solo resumen.
- **Ubicación esperada:** `src/app/core/services/facebook-oauth.service.ts`
- **Estado:** ❌ No implementado

---

### 5. **Facebook - Page Overview**
- **Método:** `GET`
- **Endpoint:** `/api/Facebook/pages/{facebookPageId}/overview`
- **Descripción:** Obtiene un resumen completo (overview) de una página de Facebook. Incluye header de la página, resumen de analytics, contadores operativos, publicaciones recientes y alertas.
- **Ubicación esperada:** `src/app/core/services/facebook-oauth.service.ts` o `src/app/features/facebook/services/facebook-analytics.service.ts`
- **Estado:** ❌ No implementado

---

### 6. **Post - List**
- **Método:** `GET`
- **Endpoint:** `/api/Post`
- **Descripción:** Obtiene una lista paginada de publicaciones.
- **Ubicación esperada:** Servicio dedicado para Posts (no existe actualmente)
- **Estado:** ❌ No implementado

---

### 7. **Post - Create**
- **Método:** `POST`
- **Endpoint:** `/api/Post`
- **Descripción:** Crea una nueva publicación.
- **Ubicación esperada:** Servicio dedicado para Posts (no existe actualmente)
- **Estado:** ❌ No implementado

---

### 8. **Post - Update**
- **Método:** `PUT`
- **Endpoint:** `/api/Post`
- **Descripción:** Actualiza una publicación existente.
- **Ubicación esperada:** Servicio dedicado para Posts (no existe actualmente)
- **Estado:** ❌ No implementado

---

### 9. **Post - Delete**
- **Método:** `DELETE`
- **Endpoint:** `/api/Post`
- **Descripción:** Elimina una publicación por su ID.
- **Ubicación esperada:** Servicio dedicado para Posts (no existe actualmente)
- **Estado:** ❌ No implementado

---

### 10. **Post - Get by ID**
- **Método:** `GET`
- **Endpoint:** `/api/Post/{id}`
- **Descripción:** Obtiene una publicación específica por su ID.
- **Ubicación esperada:** Servicio dedicado para Posts (no existe actualmente)
- **Estado:** ❌ No implementado

---

## 📊 Análisis por Categoría

### AgGrid
- ✅ `page-summaries` - Usado
- ✅ `group-summaries` - Usado
- ✅ `conversations` - Usado
- ✅ `messages` - Usado
- ✅ `pages` - Usado
- ✅ `groups` - Usado
- ❌ `posts` - **NO usado**

### Facebook
- ✅ `connect` - Usado
- ⚠️ `callback` - Usado por backend (no frontend)
- ✅ `pages` - Usado
- ✅ `pages/{id}/status` - Usado
- ❌ `status` - **NO usado**
- ❌ `pages/validate` - **NO usado**
- ❌ `pages/{id}/overview` - **NO usado**

### Facebook Analytics
- ✅ `pages/{id}/snapshot` - Usado
- ✅ `pages/{id}/metrics` - Usado
- ✅ `sync` - Usado
- ✅ `sync-logs` - Usado
- ✅ `pages/{id}/chart` - Usado

### Facebook Groups
- ✅ `add` - Usado
- ✅ `groups` - Usado
- ✅ `groups/{id}/metrics` - Usado
- ✅ `groups/{id}/snapshot` - Usado
- ✅ `groups/{id}/chart` - Usado
- ✅ `groups/{id}/status` - Usado

### Facebook Messaging
- ✅ `pages/{id}/conversations` - Usado
- ✅ `pages/{id}/conversations/{id}/messages` - Usado
- ✅ `pages/{id}/conversations/{id}/send` - Usado
- ✅ `pages/{id}/conversations/{id}/read` - Usado
- ✅ `pages/{id}/conversations/{id}/archive` - Usado
- ✅ `pages/{id}/sync` - Usado

### Post (CRUD completo)
- ❌ `GET /api/Post` - **NO usado**
- ❌ `POST /api/Post` - **NO usado**
- ❌ `PUT /api/Post` - **NO usado**
- ❌ `DELETE /api/Post` - **NO usado**
- ❌ `GET /api/Post/{id}` - **NO usado**

**Nota:** La aplicación usa `PostPlan` en lugar de `Post` directamente. Los planes de publicación (`PostPlan`) crean targets que luego se publican, pero no hay un servicio directo para gestionar posts individuales.

### Otros
- ✅ `Account/change-password` - Usado
- ✅ `me` (GET, PUT) - Usado
- ✅ `me/avatar` (POST, DELETE) - Usado
- ✅ `PostPlan` (todos) - Usado
- ✅ `Token` (login, register, refresh) - Usado
- ✅ `UserSettings` (GET, PUT) - Usado

---

## 💡 Recomendaciones

1. **Endpoints de Post (`/api/Post`)**: Si no se planea usar estos endpoints, considerar eliminarlos de la documentación o del backend para evitar confusión.

2. **Facebook Status (`/api/Facebook/status`)**: Podría ser útil para mostrar el estado de conexión de Facebook en el dashboard o en la configuración.

3. **Facebook Page Overview (`/api/Facebook/pages/{id}/overview`)**: Podría ser útil para mostrar un resumen completo de una página en lugar de hacer múltiples llamadas.

4. **Facebook Validate Pages (`/api/Facebook/pages/validate`)**: Podría ser útil para validar tokens periódicamente o antes de publicar.

5. **AgGrid Posts (`/api/ag-grid/posts`)**: Si se necesita una vista de grid para posts, este endpoint está disponible pero no se está usando.

---

## 📝 Notas

- El endpoint `/api/Facebook/callback` probablemente se usa desde el backend después de la redirección de OAuth, por lo que es normal que no aparezca en el código del frontend.

- La aplicación parece usar `PostPlan` como modelo principal para gestionar publicaciones programadas, en lugar de usar directamente los endpoints de `Post`.

- Todos los demás endpoints están siendo utilizados activamente en la aplicación.
