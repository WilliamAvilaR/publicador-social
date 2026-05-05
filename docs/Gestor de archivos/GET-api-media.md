# GET `/api/media` — Construcción técnica

Lista paginada de activos media del tenant, con búsqueda opcional por nombre visible, etiquetas, origen (`source`); no usa rutas internas (`storageKey`). El **orden** de los resultados lo define el parámetro **`sort`** en el servidor sobre **todo** el conjunto filtrado (no basta con ordenar solo la página en el cliente).

El árbol de carpetas se obtiene con `GET /api/media/folders` (ruta distinta; ver plan en `PLAN-backend-carpetas-media.md`); este endpoint solo devuelve **ítems media**, no nodos de carpeta.

---

## 1. Resumen

| Aspecto | Detalle |
|--------|---------|
| Método y ruta | `GET /api/media` |
| Controlador | `MediaController.List` |
| Servicio | `IMediaService.ListAsync` |
| Auth | JWT requerido |
| Autorización | `TenantMember` |
| Entrada | Query (`page`, `pageSize`, `q`, `status`, `folderId`, `withoutFolder`, `type`, `mimeType`, `sort`) |
| Respuesta | `200` con `ApiResponse<List<MediaListItemDto>>` + `meta` |

---

## 2. Flujo de capas

1. El controller valida contexto de tenant y usuario.
2. `MediaService.ListAsync` valida la carpeta si se envió `folderId` (ver abajo), valida `sort` si se envió, y delega en el repositorio: primero **filtros**, luego **orden** sobre el conjunto completo, después **paginación** (`Skip`/`Take`).
3. Se calcula `IsInUse` para todos los ítems de la página **en una sola consulta** agregada (`GetInUseFlagsForMediaIdsAsync`), misma regla que antes (targets pendientes por tenant). No hay N+1 por fila.
4. Se devuelve la página con URLs absolutas.

---

## 3. Contrato de entrada (query)

| Parámetro | Tipo | Default | Descripción |
|-----------|------|---------|-------------|
| `page` | `int` | `1` | Página solicitada. |
| `pageSize` | `int` | `24` | Tamaño de página (normalizado internamente 1..100). |
| `q` | `string?` | — | Subcadena (`Contains`) en **`name`**, **`source`** o cualquier **etiqueta** (`ComposerMediaTag.Tag`). No busca en `storageKey` (evita filtrar por rutas internas y reduce superficie técnica expuesta). |
| `status` | `string?` | `active` | `active` o `archived`. |
| `folderId` | `int?` | — | Si viene informado, lista solo medios con `FolderId == folderId`, **tras** comprobar que existe una carpeta con ese id para el tenant actual, activa (no eliminada lógicamente). Si la carpeta no aplica, ver [Validación de `folderId`](#validación-de-folderid). |
| `withoutFolder` | `bool` | `false` | Si es `true`, solo medios **sin** carpeta (`FolderId == null`). |
| `type` | `string?` | — | Clase de medio según `MimeType`: `image`, `video` o `document`. Ver [Filtro por tipo (`type` y `mimeType`)](#filtro-por-tipo-type-y-mimetype). |
| `mimeType` | `string?` | — | Filtra medios cuyo `MimeType` **comienza por** este valor (comparación sin distinguir mayúsculas, p. ej. `image/jpeg` o `image/`). Combinable con `type` (se aplica **AND**). |
| `sort` | `string?` | `recently_uploaded` | Orden del listado sobre **todo** el dataset filtrado. Ver [Orden (`sort`)](#orden-sort). |

### Orden (`sort`)

El cliente debe enviar `sort` para que la paginación sea coherente entre páginas. Si se omite, el valor efectivo es **`recently_uploaded`**.

| Valor | Criterio (SQL / LINQ) |
|-------|------------------------|
| `recently_uploaded` | `CreatedAt` descendente (predeterminado). |
| `recently_used` | Primero con `LastUsedAt` no nulo, por `LastUsedAt` descendente; los sin uso van después; desempate estable: `CreatedAt` descendente, `mediaId` descendente (clave `Id` en BD). |
| `most_used` | `UsageCount` descendente; desempate por `CreatedAt` y `mediaId`. |
| `name_asc` | `Name` no nulo antes que nulos; nombre ascendente (collación del servidor); desempate por `mediaId`. |
| `name_desc` | Igual tratamiento de nulos; nombre descendente; desempate por `mediaId`. |
| `size_desc` | `SizeBytes` descendente; desempate por `CreatedAt` y `mediaId`. |

Valor inválido → **`400`**, código `MEDIA_LIST_INVALID_SORT`.

### Filtro por tipo (`type` y `mimeType`)

- **`type`:** opcional. Valores admitidos (minúsculas; el servidor acepta mayúsculas y las normaliza):
  - `image` — `MimeType` comienza por `image/`.
  - `video` — comienza por `video/`.
  - `document` — tipos habituales de documento: `text/*`, `application/pdf`, `application/msword`, `application/vnd.*`, `application/rtf`, prefijos `application/epub`.
- **`mimeType`:** prefijo de MIME (p. ej. `image/jpeg` solo JPEG, `video/` todos los video). Útil para un filtro fino en el gestor.
  - Debe ser **un prefijo con formato MIME razonable**: exactamente **una** barra `/` entre el tipo y el subtipo (el subtipo puede ir vacío, p. ej. `image/`).
  - **Longitud máxima** tras trim: 80 caracteres (`MediaListMimeTypePrefixValidator.MaxLength`).
  - **Caracteres permitidos:** letras y dígitos ASCII y `!#$&^_.+-` (subconjunto de token MIME); **no** espacios, `;`, `%`, comodines ni rutas con más de una `/`.
  - Valores como solo `application`, solo `/`, `mimeType=%25` (u otros fuera del conjunto) responden **`400`** con código `MEDIA_LIST_INVALID_MIME_TYPE_FILTER`.
- Si se envían **ambos**, un medio debe cumplir **las dos** condiciones. Un `type` no admitido responde **`400`** con código `MEDIA_INVALID_TYPE`.

### Combinación de filtros de carpeta

| `withoutFolder` | `folderId` | Comportamiento del listado (además de tenant / `status` / `q` / `type` / `mimeType` / `sort`) |
|-----------------|------------|----------------------------------------------------------------|
| `false` (defecto) | omitido / `null` | **No** se filtra por carpeta: aparecen **todos** los medios del tenant que cumplan el resto de filtros y `sort`. |
| `true` | omitido | Solo medios en “raíz” (sin carpeta asignada). **Uso recomendado para la vista principal tipo biblioteca cuando solo debe mostrarse lo que no está dentro de ninguna carpeta.** |
| `true` | informado | **No permitido:** el servicio lanza error de negocio (no usar ambos a la vez). |
| `false` | informado | Solo medios de esa carpeta (carpeta validada previamente). |

### Validación de `folderId`

Cuando el query incluye `folderId`, el servicio resuelve la carpeta con **`tenantId` del request** y **`includeDeleted: false`**.

| Situación | Resultado HTTP | Notas |
|-----------|----------------|--------|
| Carpeta existe, pertenece al tenant y no está eliminada | `200` | Lista paginada (puede estar vacía si no hay medios en esa carpeta). |
| Id inexistente | `404` | Mensaje genérico del tipo «Carpeta no encontrada»; **no** se distingue si el id no existe en el sistema o pertenece a otro tenant (evita filtrar información entre tenants). |
| Carpeta de otro tenant | `404` | Misma respuesta que id inexistente. |
| Carpeta eliminada lógicamente (`IsDeleted`) | `404` | No listable. |

---

## 4. Contrato de salida (`200`)

Cada elemento de `data` corresponde a `MediaListItemDto`. Las URLs relevantes se exponen en absolutas según el host del API.

El identificador del medio en JSON es **`mediaId`** (camelCase), alineado con `MediaUploadResultDto` y operaciones masivas; no se usa `id` en estos DTOs.

**`folderId`** y **`folderName`:** cada ítem indica en qué carpeta está el activo (`folderId` numérico; `null` si está en la raíz). **`folderName`** es el nombre visible de esa carpeta cuando aplica y la carpeta no está eliminada; puede omitirse o ser `null` en respuestas donde no se resuelva el nombre.

`processingStatus` sigue los valores del dominio: `pending`, `completed`, `failed` (constantes `MediaProcessingStatuses`).

```json
{
  "data": [
    {
      "mediaId": 123,
      "folderId": 45,
      "folderName": "Campaña Junio",
      "thumbnailUrl": "https://host/uploads/media/121/11002/thumb_320.webp",
      "previewUrl": "https://host/uploads/media/121/11002/preview_1280.webp",
      "publicUrl": "https://host/uploads/media/121/11002/original.jpg",
      "hasThumbnail": true,
      "hasPreview": true,
      "processingStatus": "completed",
      "mimeType": "image/jpeg",
      "name": "campana-junio.jpg",
      "status": "active",
      "source": "upload",
      "isInUse": false,
      "usageCount": 0,
      "lastUsedAt": null,
      "tags": [],
      "createdAt": "2026-04-21T15:00:00Z"
    }
  ],
  "meta": {
    "totalCount": 1,
    "pageSize": 24,
    "currentPage": 1,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPreviousPage": false,
    "nextPageUrl": "",
    "previousPageUrl": ""
  }
}
```

---

## 5. Códigos HTTP y errores

- `200`: lista obtenida (puede ser vacía cuando la carpeta solicitada es válida pero no tiene medios).
- `400`: tenant no resuelto, parámetros inválidos o reglas de negocio (por ejemplo `folderId` y `withoutFolder` activos a la vez, `type` inválido, `sort` no admitido — `MEDIA_LIST_INVALID_SORT`, o `mimeType` con formato no permitido — `MEDIA_LIST_INVALID_MIME_TYPE_FILTER`).
- `401`: no autenticado (sin JWT válido o no identificado).
- `403`: autenticado pero **sin acceso** al recurso bajo la política `TenantMember` (por ejemplo usuario sin membresía activa en el tenant del contexto, o denegación explícita de autorización). No confundir con `404` de carpeta: aquí el rechazo es de **permiso**, no de “carpeta inexistente”.
- `404`: `folderId` informado y carpeta no encontrada para el tenant (inexistente, otra organización, o eliminada); ver [Validación de `folderId`](#validación-de-folderid).

Las respuestas de error de negocio suelen incluir cuerpo `{ "message": "...", "code": "..." }`. Los `403`/`401` dependen del pipeline de autenticación/autorización de ASP.NET y pueden usar el cuerpo estándar del framework.

---

## 6. Reglas de negocio / invariantes

- El listado siempre está acotado al tenant del request.
- Por defecto se listan activos (`status=active`), salvo que se pida explícitamente otro valor admitido.
- Las URLs de recurso se transforman a absolutas en el controller cuando aplican.
- **Vista “raíz” del gestor (solo archivos sueltos):** el cliente debe llamar con `withoutFolder=true`. Si solo omite `folderId`, recibirá **todos** los medios del tenant (incluidos los que ya están dentro de una carpeta).
- **`folderId` en query:** no se acepta una carpeta que no sea del tenant o esté borrada; no se devuelve `200` con lista vacía “silenciosa” por carpeta inválida — se responde `404` según la tabla anterior.
- **`q`:** coincide con nombre mostrado, origen del medio (`source`, p. ej. `upload`) o texto de etiquetas; **no** incluye `storageKey`.
- **`type` / `mimeType`:** acotan por cabecera MIME almacenada en el medio; no sustituyen a la validación en subida.
- **`sort`:** define el orden global antes de paginar; no reemplazar por ordenación solo en la página en el front.

---

## 7. Referencias en código

- `DataColor.Api/Controllers/MediaController.cs`
- `DataColor.Core/Services/MediaService.cs`
- `DataColor.Core/DTOs/MediaDtos.cs` (`MediaListItemDto`)
- `DataColor.Core/CustomEntities/MediaProcessingStatuses.cs`
- `DataColor.Core/CustomEntities/MediaListKindFilter.cs`
- `DataColor.Core/CustomEntities/MediaListSortOptions.cs`
- `DataColor.Core/CustomEntities/MediaListMimeTypePrefixValidator.cs`
- `DataColor.Infrastructure/Repositories/MediaRepository.cs` (`ListByTenantAsync`, `GetInUseFlagsForMediaIdsAsync`)

**Frontend (Angular):** `ComposerMediaService.listMedia()` en `src/app/features/scheduler/services/composer-media.service.ts` envía los query params documentados (`withoutFolder` en vista raíz del gestor, `sort` siempre en servidor para paginación coherente). Los filtros `type` / `mimeType` están cableados en el servicio; la UI del gestor puede ampliarse para exponerlos.
