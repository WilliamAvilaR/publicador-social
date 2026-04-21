# POST `/api/media/import-url` — Construcción técnica

Importa un recurso remoto por URL, lo copia a storage interno del tenant y crea un activo media.

---

## 1. Resumen

| Aspecto | Detalle |
|--------|---------|
| Método y ruta | `POST /api/media/import-url` |
| Controlador | `MediaController.ImportUrl` |
| Servicio | `IMediaService.ImportUrlAsync` |
| Auth | JWT requerido |
| Autorización | `TenantMember` |
| Body | `MediaImportUrlRequestDto` |
| Respuesta | `200` con `ApiResponse<MediaUploadResultDto>` |

---

## 2. Flujo de capas

1. Valida tenant/usuario.
2. `MediaService` usa preview seguro.
3. Descarga recurso remoto y valida tamaño/cuota.
4. Guarda en storage interno (`source=url`) y persiste en DB.
5. Si falla DB, compensa eliminando archivo físico.

---

## 3. Contrato de entrada

```json
{
  "url": "https://ejemplo.com/banner.jpg",
  "name": "banner-campana",
  "tags": ["promo", "abril"]
}
```

---

## 4. Contrato de salida (`200`)

```json
{
  "data": {
    "mediaId": 124,
    "publicUrl": "https://host/uploads/media/121/media_y.jpg",
    "mimeType": "image/jpeg",
    "width": null,
    "height": null
  }
}
```

---

## 5. Códigos HTTP y errores

- `200`: importación correcta.
- `400`: URL inválida/no soportada (`MEDIA_URL_UNSUPPORTED`).
- `401`: no autenticado.
- `403`: cuota excedida (`MEDIA_QUOTA_EXCEEDED`).
- `404`: recurso remoto no descargable.
- `413`: tamaño remoto excedido (`MEDIA_TOO_LARGE`).

---

## 6. Reglas de negocio / invariantes

- Import externo siempre termina en storage interno.
- Se aplican las mismas reglas de cuota que upload local.
- Duplicados permitidos (sin deduplicación por hash).

---

## 7. Referencias en código

- `DataColor.Api/Controllers/MediaController.cs`
- `DataColor.Core/Services/MediaService.cs`
