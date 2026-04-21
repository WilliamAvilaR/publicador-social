# Gestor de archivos — Endpoints backend requeridos

Documento operativo para alinear frontend y backend en la implementación completa del **Gestor de archivos** y su integración con el **compositor de publicaciones**.

## 1) Matriz de endpoints

| Endpoint | Estado actual | Prioridad | Fase | ¿Bloqueante? | Propósito |
|----------|---------------|-----------|------|--------------|-----------|
| `POST /api/media/upload` | Disponible | P0 | Fase 1 | Sí | Subir archivos locales a biblioteca del tenant. |
| `GET /api/media` | Disponible | P0 | Fase 1 | Sí | Listado paginado para grid principal. |
| `GET /api/media/{id}` | Disponible | P0 | Fase 1 | Sí | Detalle de activo (drawer/modal). |
| `POST /api/media/preview-url` | Disponible | P0 | Fase 1.5 | Parcial | Validar y previsualizar URL externa. |
| `POST /api/media/import-url` | Pendiente | P0 | Fase 1.5 | Sí (para import persistente) | Persistir en biblioteca una URL validada. |
| `POST /api/media/{id}/archive` | Pendiente | P0 | Fase 2 | Sí (para liberar espacio sin romper referencias) | Archivado seguro del activo. |
| `DELETE /api/media/{id}` | Pendiente | P0 | Fase 2 | Sí (para higiene de storage) | Borrado duro solo en condiciones permitidas. |
| `POST /api/media/bulk-delete` | Pendiente | P1 | Fase 2 | No (hay fallback) | Eliminación masiva en batch. |
| `POST /api/media/bulk-tag` | Pendiente | P1 | Fase 2 | No (hay fallback) | Etiquetado masivo en batch. |
| `PATCH /api/media/{id}` | Pendiente | P1 | Fase 2 | No | Renombrar/actualizar tags/estado por ítem. |
| `GET /api/media/storage-summary` | Pendiente | P1 | Fase 1/2 | No (pero mejora UX) | Barra de cuota real: usado vs límite. |

## 2) Requisitos funcionales del listado (`GET /api/media`)

Para evitar cuellos de rendimiento y habilitar UX inteligente:

- Debe devolver `thumbnailUrl` para grid (liviano).
- `publicUrl` idealmente solo cuando sea necesario o en detalle.
- Soportar paginación: `page`, `pageSize`.
- Soportar búsqueda: `q`.
- Recomendado soportar filtros/orden:
  - `sort=recently_used|most_used|recently_uploaded|smart`
  - `status=active|archived`
  - `isInUse=true|false` (derivado)
  - `source=upload|url|google_drive|onedrive|canva|unsplash`
  - `tags=...`

### 2.1 Definición de estado de uso (`in_use`)

Para evitar inconsistencias de sincronización:

- **Persistidos en DB:** `status=active|archived`.
- **Derivado en respuesta:** `isInUse: boolean` (calculado al vuelo según referencias activas).

No se recomienda persistir `status=in_use` como estado físico salvo que exista un proceso transaccional robusto que garantice consistencia.

## 3) Reglas backend críticas

### 3.1 Borrado seguro

**Decisión cerrada para el contrato:**

- El flujo primario de UI usa **archivado** (`POST /api/media/{id}/archive`).
- `DELETE /api/media/{id}` se reserva para borrado duro (mantenimiento/higiene), no como acción principal de usuario final.
- En ambos casos se aplica regla de protección por referencias.

No permitir borrado duro ni archivado inconsistente si el activo está en uso por publicaciones programadas pendientes.

- Respuesta recomendada: `409 Conflict` con código de negocio estable.
- Si el activo está en uso:
  - `DELETE /api/media/{id}` -> `409 Conflict`.
  - `POST /api/media/{id}/archive` -> permitido solo si la política de negocio lo acepta; si no, también `409`.

### 3.1.1 Estandar de códigos HTTP por endpoint

La API debe responder de forma consistente para que frontend pueda reaccionar distinto según caso:

| Endpoint | 200 | 400 | 401 | 403 | 404 | 409 | 413 | 415 |
|----------|-----|-----|-----|-----|-----|-----|-----|-----|
| `POST /api/media/upload` | Upload exitoso | Parámetros o metadata inválida | No autenticado | Sin permiso o cuota excedida | - | - | Archivo demasiado grande | MIME no permitido |
| `GET /api/media` | Lista paginada | Query inválida (`page`, `pageSize`, `sort`) | No autenticado | Sin permiso | - | - | - | - |
| `GET /api/media/{id}` | Detalle | Id inválido | No autenticado | Sin permiso tenant | Medio no existe / no pertenece al tenant | - | - | - |
| `POST /api/media/preview-url` | Preview validada | URL/formato request inválido | No autenticado | Sin permiso | Recurso remoto no accesible | Conflicto de política (dominio bloqueado, etc.) | Payload remoto excesivo (si aplica) | Tipo remoto no soportado (si aplica) |
| `POST /api/media/import-url` | Import persistido | URL inválida o no importable | No autenticado | Sin permiso / cuota excedida | Recurso remoto no encontrado | Recurso en conflicto de políticas | Recurso remoto demasiado grande | Tipo remoto no permitido |
| `POST /api/media/{id}/archive` | Archivado exitoso | Request inválido | No autenticado | Sin permiso | Medio no encontrado | Activo en uso / regla de negocio | - | - |
| `DELETE /api/media/{id}` | Borrado duro exitoso | Request inválido | No autenticado | Sin permiso | Medio no encontrado | Activo en uso / regla de negocio | - | - |

### 3.2 Importaciones externas

Recomendación técnica de producto:

- **Siempre copiar a storage interno** del tenant al importar (URL/Drive/Canva/OneDrive).
- Registrar `source` para trazabilidad.
- Evitar dependencia de enlaces externos frágiles.

### 3.3 Límites por tipo (además de cuota global)

Backend debe validar y devolver errores consistentes para:

- `maxImageSize`
- `maxVideoSize`
- `allowedFormats` (MIME)

### 3.4 Idempotencia y política de duplicados (fase inicial)

Definir comportamiento explícito para evitar ambigüedad en front y soporte:

- **Fase 1 (política inicial):**
  - Se **permiten duplicados** tanto en upload como en import URL.
  - No se deduplica por hash todavía.
  - Dos activos idénticos pueden existir con distinto `name`.
- **Fase 2 (evolución):**
  - Evaluar deduplicación por hash + advertencia no bloqueante en UI.
  - Opcional: idempotencia por `Idempotency-Key` en import/upload para reintentos de red.

## 4) Campos de dominio recomendados por activo

Campos mínimos para evolucionar de “archivo” a “asset reutilizable”:

- `id` / `mediaId`
- `name`
- `mimeType`
- `sizeBytes`
- `thumbnailUrl`
- `publicUrl`
- `createdAt`
- `source`
- `status` (`active|archived`) persistido
- `isInUse` (boolean derivado)
- `usageCount`
- `lastUsedAt`
- `tags`

## 4.1 Contrato de operaciones batch (resultado parcial)

Para `POST /api/media/bulk-delete` y `POST /api/media/bulk-tag` se define:

- **Semántica no atómica** (parcial por ítem), recomendada para UX operativa.
- El endpoint procesa todo lo posible y devuelve resultado por cada `mediaId`.

Respuesta sugerida:

```json
{
  "data": {
    "totalRequested": 20,
    "processed": 15,
    "failed": 5,
    "results": [
      { "mediaId": 101, "ok": true },
      { "mediaId": 102, "ok": false, "status": 409, "code": "MEDIA_IN_USE", "message": "Activo en uso" }
    ]
  }
}
```

Esto permite al frontend mostrar resumen + errores por item sin perder todo el lote por 1 fallo.

## 5) Integraciones externas (roadmap)

### Google Drive
- `GET /api/integrations/google-drive/oauth/start`
- `GET /api/integrations/google-drive/oauth/callback`
- `POST /api/integrations/google-drive/import`

### OneDrive
- `GET /api/integrations/onedrive/oauth/start`
- `GET /api/integrations/onedrive/oauth/callback`
- `POST /api/integrations/onedrive/import`

### Canva
- `GET /api/integrations/canva/oauth/start`
- `GET /api/integrations/canva/oauth/callback`
- `POST /api/integrations/canva/import`

## 6) Prioridad sugerida de entrega backend

1. Completar P0 faltantes:
   - `POST /api/media/import-url`
   - `POST /api/media/{id}/archive` + `DELETE /api/media/{id}` con regla de “en uso” y contrato de códigos.
2. Completar P1 para UX escalable:
   - `GET /api/media/storage-summary`
   - `POST /api/media/bulk-delete`
   - `POST /api/media/bulk-tag`
   - `PATCH /api/media/{id}`
3. Integraciones externas por etapas (Drive, OneDrive, Canva).

## 7) Criterio de “100% funcional”

Se considera 100% funcional cuando:

- El usuario puede listar, buscar, subir, previsualizar URL e importar URL en biblioteca.
- Puede eliminar o archivar sin romper publicaciones pendientes.
- Ve y gestiona cuota con datos reales.
- Puede operar batch básico (eliminar/etiquetar).
- El listado escala bien (thumbnails + paginación + orden/filtros).

Adicionalmente:

- Los endpoints críticos responden con el estándar de códigos HTTP de **3.1.1**, para que frontend pueda diferenciar validación, permisos, cuota, conflicto de negocio y tipo de archivo.

