# POST `/api/media/preview-url` — Construcción técnica

Valida una URL remota y retorna metadatos de previsualización seguros (anti-SSRF básico).

---

## 1. Resumen

| Aspecto | Detalle |
|--------|---------|
| Método y ruta | `POST /api/media/preview-url` |
| Controlador | `MediaController.PreviewUrl` |
| Servicio | `IMediaUrlPreviewService.PreviewAsync` |
| Auth | JWT requerido |
| Autorización | `TenantMember` |
| Body | `MediaPreviewUrlRequestDto` |
| Respuesta | `200` con `ApiResponse<MediaPreviewUrlResultDto>` |

---

## 2. Flujo de capas

1. Controller valida tenant/usuario y body.
2. Servicio aplica reglas de seguridad (HTTPS, host, DNS/IP pública, sin redirects inseguros).
3. Retorna tipo (`image/video`) y `canonicalUrl`.

---

## 3. Contrato de entrada

```json
{ "url": "https://ejemplo.com/media.jpg" }
```

---

## 4. Contrato de salida (`200`)

```json
{
  "data": {
    "ok": true,
    "type": "image",
    "canonicalUrl": "https://ejemplo.com/media.jpg",
    "thumbnailUrl": "https://ejemplo.com/media.jpg",
    "width": null,
    "height": null
  }
}
```

---

## 5. Códigos HTTP y errores

- `200`: URL válida y soportada.
- `400`: URL inválida o no permitida.
- `401`: no autenticado.
- `403`: sin permiso tenant.

---

## 6. Reglas de negocio / invariantes

- Solo URLs remotas permitidas por política de seguridad.
- No confiar en preview del navegador para decisiones de backend.

---

## 7. Referencias en código

- `DataColor.Api/Controllers/MediaController.cs`
- `DataColor.Core/Services/MediaUrlPreviewService.cs`
