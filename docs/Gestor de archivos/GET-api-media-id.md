# GET `/api/media/{id}` — Construcción técnica

Obtiene el detalle de un activo media por id dentro del tenant actual.

---

## 1. Resumen

| Aspecto | Detalle |
|--------|---------|
| Método y ruta | `GET /api/media/{id}` |
| Controlador | `MediaController.GetById` |
| Servicio | `IMediaService.GetByIdAsync` |
| Auth | JWT requerido |
| Autorización | `TenantMember` |
| Respuesta | `200` con `ApiResponse<MediaDetailDto>` |

---

## 2. Flujo de capas

1. Controller valida tenant/usuario.
2. Service busca por `id + tenantId`.
3. Si existe, retorna detalle enriquecido (`isInUse`, `tags`, etc.).

---

## 3. Contrato de entrada

- Path param: `id` (`int`).

---

## 4. Contrato de salida (`200`)

```json
{
  "data": {
    "id": 123,
    "tenantId": 121,
    "createdByUserId": 44,
    "mimeType": "image/jpeg",
    "sizeBytes": 452310,
    "storageKey": "/uploads/media/121/media_x.jpg",
    "publicUrl": "https://host/uploads/media/121/media_x.jpg",
    "thumbnailUrl": "https://host/uploads/media/121/media_x.jpg",
    "source": "upload",
    "name": "campana.jpg",
    "status": "active",
    "isInUse": false,
    "usageCount": 0,
    "tags": ["promo"],
    "createdAt": "2026-04-21T15:00:00Z"
  }
}
```

---

## 5. Códigos HTTP y errores

- `200`: encontrado.
- `401`: no autenticado.
- `404`: no existe en ese tenant.

---

## 6. Reglas de negocio / invariantes

- No expone medios de otro tenant.
- `isInUse` es derivado, no fuente persistida.

---

## 7. Referencias en código

- `DataColor.Api/Controllers/MediaController.cs`
- `DataColor.Core/Services/MediaService.cs`
