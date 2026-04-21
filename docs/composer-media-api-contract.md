# Contrato API: medios del compositor de publicaciones

> Estado actual (confirmado): `POST /api/media/upload`, `GET /api/media`, `GET /api/media/{id}` y `POST /api/media/preview-url` ya están disponibles en backend.

Este documento define los endpoints que **backend** debe exponer para que el panel de medios del compositor ([`PostComposerMediaPanelComponent`](../src/app/features/scheduler/components/post-composer/media/post-composer-media-panel.component.ts), servicio [`ComposerMediaService`](../src/app/features/scheduler/services/composer-media.service.ts)) quede **100% funcional** junto con `POST /api/PostPlan`.

Las rutas son **orientativas**; podéis versionarlas (`/api/v1/media/...`) siempre que el front actualice la base URL en `ComposerMediaService`.

---

## 1. Resumen

| Origen en UI | Sin backend | Con backend al 100% |
|--------------|-------------|---------------------|
| Ordenador (subida) | El usuario ve error al pulsar «Usar en la publicación» si no existe upload | `POST /api/media/upload` devuelve `mediaId` (+ URL pública opcional) |
| Biblioteca | Lista vacía o error | `GET /api/media` (+ metadato por id) |
| Google Drive | Botón deshabilitado / copia | OAuth servidor + import |
| Canva | Botón deshabilitado / copia | Acuerdo Canva + import |
| URL externa | Vista previa en navegador (limitada por CORS) | `POST /api/media/preview-url` valida de forma segura |

El modelo de creación de plan ya contempla **`imageUrl`** y **`mediaId`** opcionales: [`CreatePostPlanRequest`](../src/app/features/scheduler/models/post-plan.model.ts).

---

## 2. Prioridad `mediaId` vs `imageUrl` en `POST /api/PostPlan`

Recomendación para el servidor al resolver el adjunto del plan:

1. Si viene **`mediaId`**, obtener el medio interno (URL firmada o CDN) y usarlo como fuente de verdad para publicar. **`imageUrl` del body puede ignorarse** o usarse solo si coincide con el derivado del medio (validación).
2. Si **no** hay `mediaId` pero sí **`imageUrl`** HTTPS, usar esa URL si pasa validación (dominio permitido, tipo MIME, tamaño, anti-SSRF si el servidor la descarga).
3. Si vienen ambos y son inconsistentes, responder **400** con detalle claro o aplicar la regla 1 estrictamente.

El front, al aplicar selección desde **biblioteca**, envía típicamente solo `mediaId`. Al aplicar desde **URL**, envía `imageUrl` y deja `mediaId` en `null`. Tras **subida exitosa**, puede enviar `mediaId` y opcionalmente `imageUrl` si el upload devuelve `publicUrl`.

---

## 3. Modelo de datos sugerido (medio / asset de biblioteca)

Campos mínimos recomendados para un ítem almacenado:

| Campo | Tipo | Notas |
|-------|------|--------|
| `id` | int | `mediaId` en PostPlan |
| `tenantId` | guid/int | Multi-tenant |
| `createdByUserId` | guid/int | Auditoría |
| `mimeType` | string | `image/jpeg`, `video/mp4`, … |
| `sizeBytes` | long | Límites por plan |
| `storageKey` | string | Ruta interna en blob/S3 |
| `publicUrl` | string? | URL estable o null si solo URLs firmadas |
| `thumbnailUrl` | string? | Para grids |
| `width`, `height` | int? | Opcional |
| `source` | string | `upload`, `url`, `google_drive`, `canva`, … |
| `createdAt` | ISO 8601 | Ordenación en biblioteca |

---

## 4. Endpoints obligatorios para funcionalidad completa

### 4.1 `POST /api/media/upload`

**Objetivo:** subir archivo local (ordenador / drag & drop) y obtener `mediaId`.

- **Content-Type:** `multipart/form-data`
- **Campo archivo:** `file` (un archivo por request)
- **Respuesta 200 (ejemplo):**

```json
{
  "data": {
    "mediaId": 42,
    "publicUrl": "https://cdn.ejemplo.com/tenants/1/media/42.jpg",
    "mimeType": "image/jpeg",
    "width": 1080,
    "height": 1080
  }
}
```

- **Errores:** 400 (tipo no permitido), 413 (tamaño), 401, 403 (plan sin cuota).

El front ya llama a esta ruta desde `ComposerMediaService.uploadMedia()`.

---

### 4.2 `GET /api/media`

**Objetivo:** biblioteca de contenidos (paginación + búsqueda).

**Query sugerida:**

| Parámetro | Ejemplo | Descripción |
|-----------|---------|-------------|
| `page` | 1 | Página |
| `pageSize` | 24 | Tamaño |
| `q` | verano | Búsqueda opcional por nombre/tags |

**Respuesta 200 (ejemplo):**

```json
{
  "data": [
    {
      "id": 42,
      "thumbnailUrl": "https://…",
      "publicUrl": "https://…",
      "mimeType": "image/jpeg",
      "name": "Campaña verano",
      "createdAt": "2026-04-18T12:00:00Z"
    }
  ],
  "meta": {
    "totalCount": 120,
    "pageSize": 24,
    "currentPage": 1,
    "totalPages": 5
  }
}
```

Al elegir un ítem, el front emite `mediaId` en el formulario y **PostPlan** debe resolver el adjunto por id.

---

### 4.3 `GET /api/media/{id}`

**Objetivo:** detalle de un medio (metadatos, URL firmada temporal si no hay `publicUrl`).

**Respuesta 200:** objeto `data` con los campos del modelo (sección 3).

Opcional si la lista (`GET /api/media`) ya devuelve todo lo necesario para el grid y la publicación solo usa `mediaId`.

---

### 4.4 `POST /api/media/preview-url`

**Objetivo:** validar una URL pegada por el usuario **sin** que el navegador exponga riesgos; devolver tipo y miniatura segura.

**Body:**

```json
{ "url": "https://ejemplo.com/imagen.jpg" }
```

**Respuesta 200 (ejemplo):**

```json
{
  "data": {
    "ok": true,
    "type": "image",
    "canonicalUrl": "https://ejemplo.com/imagen.jpg",
    "thumbnailUrl": "https://cdn.ejemplo.com/proxy-thumb/…",
    "width": 1200,
    "height": 630
  }
}
```

Para video:

```json
{
  "data": {
    "ok": true,
    "type": "video",
    "canonicalUrl": "https://…/video.mp4",
    "thumbnailUrl": "https://…/poster.jpg"
  }
}
```

**Seguridad (obligatorio en servidor):**

- No seguir redirects a redes internas (anti-SSRF).
- Timeouts y límite de bytes al descargar cabecera o fragmento.
- Lista blanca/negra de dominios opcional por política del producto.

Si el endpoint no existe, el front intenta **vista previa solo en el navegador** (limitada por CORS).

---

## 5. Integraciones: Google Drive y Canva

No están cableadas en el front más allá de placeholders. Para **100% funcional**:

### 5.1 Google Drive (orientación)

- Flujo OAuth **en servidor** (refresh tokens por usuario/tenant).
- Tras autorizar, el front puede abrir **Google Picker** con un **token de corta duración** emitido por vuestra API, o elegir archivos vía API Drive con permisos del usuario.
- **Importación:** copiar el archivo a vuestro storage y crear fila en `media` (mismo modelo que upload).

**Ejemplo de endpoint de importación:**

- `POST /api/integrations/google-drive/import`  
  Body: `{ "driveFileId": "…" }`  
  Respuesta: mismo shape que `POST /api/media/upload` (`mediaId`, …).

Endpoints OAuth típicos (nombres orientativos):

- `GET /api/integrations/google-drive/oauth/start`
- `GET /api/integrations/google-drive/oauth/callback`

---

### 5.2 Canva (orientación)

Depende del producto Canva acordado (Connect / export / enlaces). Patrón habitual:

- OAuth o token de diseño en servidor.
- `POST /api/integrations/canva/import` con `{ "designId": "…" }` o export URL.
- Respuesta: de nuevo `mediaId` + metadatos.

---

## 6. Coherencia con el front actual

| Método en `ComposerMediaService` | Ruta actual en código |
|----------------------------------|------------------------|
| `uploadMedia` | `POST /api/media/upload` |
| `listMedia` | `GET /api/media` |
| `getMedia` | `GET /api/media/{id}` |
| `previewUrl` | `POST /api/media/preview-url` |

Referencia de perfil existente para multipart (otro dominio): `POST /api/me/avatar` en [`AuthService`](../src/app/core/services/auth.service.ts).

---

## 7. Checklist backend para “listo producción”

- [ ] `POST /api/media/upload` con límites y tipos MIME alineados al plan (entitlements).
- [ ] `GET /api/media` paginado y filtrado por `tenantId`.
- [ ] Reglas en `POST /api/PostPlan` para `mediaId` / `imageUrl` (sección 2).
- [ ] `POST /api/media/preview-url` con controles anti-SSRF.
- [ ] (Opcional fase 2) Drive + Canva según secciones 5.

---

## 8. MVP solo front (sin API de medios)

- Pestaña **URL**: pegar enlace y **«Vista previa en navegador»** + **«Usar en la publicación»** rellena `imageUrl`.
- Pestaña **Ordenador**: requiere `POST /api/media/upload` para confirmar adjunto publicable con `mediaId`; sin API, el usuario ve el error devuelto por HTTP.

Cuando implementéis los endpoints anteriores, el mismo front de Angular debería empezar a funcionar sin cambios de contrato si respetáis los shapes de respuesta indicados.
