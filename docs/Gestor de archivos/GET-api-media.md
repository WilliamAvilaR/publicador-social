# GET `/api/media` — Construcción técnica

Lista paginada de activos media del tenant, con búsqueda por texto y filtro por estado.

---

## 1. Resumen

| Aspecto | Detalle |
|--------|---------|
| Método y ruta | `GET /api/media` |
| Controlador | `MediaController.List` |
| Servicio | `IMediaService.ListAsync` |
| Auth | JWT requerido |
| Autorización | `TenantMember` |
| Entrada | Query (`page`, `pageSize`, `q`, `status`) |
| Respuesta | `200` con `ApiResponse<List<MediaListItemDto>>` + `meta` |

---

## 2. Flujo de capas

1. Controller valida tenant/usuario.
2. `MediaService` llama repositorio con paginación y filtros.
3. Se calcula `isInUse` por ítem y se retorna paginado.

---

## 3. Contrato de entrada (query)

| Parámetro | Tipo | Default | Descripción |
|-----------|------|---------|-------------|
| `page` | `int` | `1` | Página solicitada. |
| `pageSize` | `int` | `24` | Tamaño de página (normalizado internamente 1..100). |
| `q` | `string?` | — | Búsqueda por nombre/storageKey. |
| `status` | `string?` | `active` | `active` o `archived`. |

---

## 4. Contrato de salida (`200`)

```json
{
  "data": [
    {
      "id": 123,
      "thumbnailUrl": "https://host/uploads/media/121/media_x.jpg",
      "publicUrl": "https://host/uploads/media/121/media_x.jpg",
      "mimeType": "image/jpeg",
      "name": "campana-junio.jpg",
      "createdAt": "2026-04-21T15:00:00Z"
    }
  ],
  "meta": {
    "totalCount": 1,
    "pageSize": 24,
    "currentPage": 1,
    "totalPages": 1
  }
}
```

---

## 5. Códigos HTTP y errores

- `200`: lista obtenida (puede ser vacía).
- `400`: tenant no resuelto u otros parámetros inválidos.
- `401`: no autenticado.

---

## 6. Reglas de negocio / invariantes

- El listado siempre está acotado al tenant del request.
- Por defecto se listan activos (`status=active`).
- URLs se transforman a absolutas en el controller cuando aplican.

---

## 7. Referencias en código

- `DataColor.Api/Controllers/MediaController.cs`
- `DataColor.Core/Services/MediaService.cs`
- `DataColor.Infrastructure/Repositories/MediaRepository.cs`
