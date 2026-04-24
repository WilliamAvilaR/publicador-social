# POST `/api/media/upload` — Construcción técnica (contrato maduro)

Sube un archivo local (`multipart/form-data`) a la biblioteca del tenant, persiste el original y publica estado de derivados (`processingStatus`) con semántica madura de URLs.

---

## 1. Resumen

| Aspecto | Detalle |
|--------|---------|
| Método y ruta | `POST /api/media/upload` |
| Controlador | `MediaController.Upload` |
| Servicio | `IMediaService.UploadAsync` (`MediaService`) |
| Auth | JWT requerido |
| Autorización | `TenantMember` |
| Content-Type | `multipart/form-data` |
| Campo requerido | `file` |
| Respuesta | `200` con `ApiResponse<MediaUploadResultDto>` |

---

## 2. Flujo de capas

1. Controller valida tenant (`TenantContext`) y usuario (`NameIdentifier`).
2. `MediaService` valida cuota y persiste registro inicial de `ComposerMedia`.
3. Se guarda el original en storage con ruta estable por `tenantId/mediaId`.
4. Se dispara generación de derivados:
   - síncrona para imágenes pequeñas.
   - asíncrona (job) para videos, PDF y archivos grandes.
5. Se responde con `publicUrl` + estado de derivados (`processingStatus`, `hasThumbnail`, `hasPreview`).

---

## 3. Contrato de entrada

Body `multipart/form-data`:

- `file` (`IFormFile`) obligatorio.

---

## 4. Contrato de salida (`200`)

```json
{
  "data": {
    "mediaId": 123,
    "publicUrl": "https://host/uploads/media/121/123/original.jpg",
    "thumbnailUrl": "https://host/uploads/media/121/123/thumb_320.webp",
    "previewUrl": "https://host/uploads/media/121/123/preview_1280.webp",
    "hasThumbnail": true,
    "hasPreview": true,
    "processingStatus": "completed",
    "mimeType": "image/jpeg",
    "width": 2400,
    "height": 1600
  }
}
```

Notas:

- `publicUrl` siempre apunta al original.
- `thumbnailUrl`/`previewUrl` son derivados reales o `null` (nunca fallback al original).
- `width`/`height` representan dimensiones del original.

---

## 5. Comportamiento temporal async

Cuando el derivado se procesa en job asíncrono, la respuesta inicial puede salir así:

```json
{
  "data": {
    "mediaId": 124,
    "publicUrl": "https://host/uploads/media/121/124/original.mp4",
    "thumbnailUrl": null,
    "previewUrl": null,
    "hasThumbnail": false,
    "hasPreview": false,
    "processingStatus": "pending",
    "mimeType": "video/mp4",
    "width": null,
    "height": null
  }
}
```

Estados posibles:

- `pending`
- `completed`
- `failed`

---

## 6. Códigos HTTP y errores

- `200`: upload correcto.
- `400`: request inválido (incluye extensión engañosa o validaciones de negocio).
- `401`: token inválido o ausente.
- `403`: sin acceso tenant o cuota excedida (`MEDIA_QUOTA_EXCEEDED`).
- `413`: tamaño excedido (`MEDIA_TOO_LARGE`).
- `415`: MIME/tipo no permitido (`MEDIA_INVALID_TYPE`).

Formato de error de negocio:

```json
{ "message": "texto", "code": "MEDIA_INVALID_TYPE" }
```

---

## 7. Reglas de negocio / invariantes

- Siempre se valida cuota en backend.
- Se valida MIME real por contenido (no solo por extensión o header).
- Puede rechazarse extensión engañosa (`Media.RejectMismatchedExtension`).
- Upload/import operan con streaming para evitar cargas completas en memoria.
- Consistencia storage/DB: ante error en persistencia se compensa borrando archivo físico.

---

## 8. Referencias en código

- `DataColor.Api/Controllers/MediaController.cs`
- `DataColor.Core/Services/MediaService.cs`
- `DataColor.Core/Services/MediaDerivativeService.cs`
- `DataColor.Core/Interfaces/IFileStorageService.cs`
- `DataColor.Core/DTOs/MediaDtos.cs`
