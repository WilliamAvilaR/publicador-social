# POST `/api/integrations/{provider}/import` — Construcción técnica

Importa media desde proveedor externo usando URL de descarga y reutiliza reglas de importación de media.

---

## 1. Resumen

| Aspecto | Detalle |
|--------|---------|
| Método y ruta | `POST /api/integrations/{provider}/import` |
| Controlador | `MediaIntegrationsController.Import` |
| Servicio | `IMediaIntegrationService.ImportAsync` |
| Auth | JWT requerido |
| Autorización | `TenantMember` |
| Body | `ExternalImportRequestDto` |
| Respuesta | `200` con `ApiResponse<MediaUploadResultDto>` |

---

## 2. Flujo de capas

1. Valida tenant/usuario.
2. Servicio de integración mapea request a `MediaImportUrlRequestDto`.
3. Reutiliza `MediaService.ImportUrlAsync`.
4. Devuelve `mediaId/publicUrl`.

---

## 3. Contrato de entrada

```json
{
  "downloadUrl": "https://provider.example/file.jpg",
  "name": "asset-drive",
  "tags": ["drive", "campana"]
}
```

---

## 4. Contrato de salida (`200`)

```json
{
  "data": {
    "mediaId": 125,
    "publicUrl": "/uploads/media/121/media_z.jpg",
    "mimeType": "image/jpeg",
    "width": null,
    "height": null
  }
}
```

---

## 5. Códigos HTTP y errores

- `200`: import correcto.
- `400`: request/URL inválida.
- `401`: no autenticado.
- `403`: cuota excedida.
- `404`: recurso remoto no disponible.
- `409`: conflictos de política de negocio cuando apliquen.

Incluye `code` estable cuando el error viene de `BusinessException`.

---

## 6. Reglas de negocio / invariantes

- Siempre persiste en storage interno del tenant.
- Mantiene invariantes de `import-url` (cuota, tamaño, seguridad URL).
- `provider` se pasa como contexto de integración.

---

## 7. Referencias en código

- `DataColor.Api/Controllers/MediaIntegrationsController.cs`
- `DataColor.Core/Services/MediaIntegrationService.cs`
- `DataColor.Core/Services/MediaService.cs`
