# POST `/api/media/upload` — Construcción técnica

Sube un archivo local (`multipart/form-data`) a la biblioteca del tenant y crea un `ComposerMedia`.

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
2. `MediaService` valida archivo (MIME/tamaño), cuota (`ITenantEntitlementsService`) y guarda en storage.
3. Se persiste `ComposerMedia` y se responde `mediaId/publicUrl`.

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
    "publicUrl": "https://host/uploads/media/121/media_xxx.jpg",
    "mimeType": "image/jpeg",
    "width": null,
    "height": null
  }
}
```

---

## 5. Códigos HTTP y errores

- `200`: upload correcto.
- `400`: request inválido.
- `401`: token inválido o ausente.
- `403`: sin acceso tenant o cuota excedida (`MEDIA_QUOTA_EXCEEDED`).
- `413`: tamaño excedido (`MEDIA_TOO_LARGE`).
- `415`: tipo no permitido (`MEDIA_INVALID_TYPE`).

Errores de negocio salen como:

```json
{ "message": "texto", "code": "MEDIA_INVALID_TYPE" }
```

---

## 6. Reglas de negocio / invariantes

- Siempre se valida cuota en backend.
- No se confía en validación de frontend para MIME/tamaño.
- El storage físico y DB se mantienen consistentes (si falla DB, se compensa borrando archivo).

---

## 7. Referencias en código

- `DataColor.Api/Controllers/MediaController.cs`
- `DataColor.Core/Services/MediaService.cs`
- `DataColor.Core/Interfaces/IFileStorageService.cs`
- `DataColor.Core/DTOs/MediaDtos.cs`
