# GET `/api/integrations/{provider}/oauth/start` — Construcción técnica

Inicia el flujo OAuth para un proveedor de media (`google-drive`, `onedrive`, `canva`).

---

## 1. Resumen

| Aspecto | Detalle |
|--------|---------|
| Método y ruta | `GET /api/integrations/{provider}/oauth/start` |
| Controlador | `MediaIntegrationsController.StartOAuth` |
| Servicio | `IMediaIntegrationService.StartOAuthAsync` |
| Auth | JWT requerido |
| Autorización | `TenantMember` |
| Respuesta | `200` con `ApiResponse<IntegrationOAuthStartResponseDto>` |

---

## 2. Flujo de capas

1. Valida tenant/usuario.
2. Servicio genera URL de autorización y `state`.
3. Retorna datos de arranque de OAuth.

---

## 3. Contrato de entrada

- Path param: `provider` (`google-drive`, `onedrive`, `canva`).

---

## 4. Contrato de salida (`200`)

```json
{
  "data": {
    "provider": "google-drive",
    "authorizationUrl": "https://auth.placeholder.local/google-drive/authorize?...",
    "state": "a8d9f0..."
  }
}
```

---

## 5. Códigos HTTP y errores

- `200`: inicio generado.
- `400`: tenant no resuelto.
- `401`: no autenticado.

---

## 6. Reglas de negocio / invariantes

- Requiere contexto de tenant y usuario.
- `provider` se normaliza a minúsculas en servicio.

---

## 7. Referencias en código

- `DataColor.Api/Controllers/MediaIntegrationsController.cs`
- `DataColor.Core/Services/MediaIntegrationService.cs`
