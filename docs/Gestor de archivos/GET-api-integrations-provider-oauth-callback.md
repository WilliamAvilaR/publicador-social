# GET `/api/integrations/{provider}/oauth/callback` — Construcción técnica

Procesa callback OAuth del proveedor y devuelve estado de conexión.

---

## 1. Resumen

| Aspecto | Detalle |
|--------|---------|
| Método y ruta | `GET /api/integrations/{provider}/oauth/callback` |
| Controlador | `MediaIntegrationsController.OAuthCallback` |
| Servicio | `IMediaIntegrationService.HandleOAuthCallbackAsync` |
| Auth | JWT requerido |
| Autorización | `TenantMember` |
| Entrada | Path + query (`code`, `state`) |
| Respuesta | `200` con `ApiResponse<IntegrationOAuthCallbackResponseDto>` |

---

## 2. Flujo de capas

1. Controller delega callback al servicio.
2. Servicio valida presencia de `code/state` para marcar conexión.
3. Responde `connected` y mensaje.

---

## 3. Contrato de entrada

Query típica:

`/api/integrations/google-drive/oauth/callback?code=abc&state=xyz`

---

## 4. Contrato de salida (`200`)

```json
{
  "data": {
    "provider": "google-drive",
    "connected": true,
    "message": "Integración conectada."
  }
}
```

---

## 5. Códigos HTTP y errores

- `200`: callback procesado.
- `401`: no autenticado.

---

## 6. Reglas de negocio / invariantes

- Endpoint responde estado lógico de conexión según `code/state`.
- No persiste token real en la implementación actual placeholder.

---

## 7. Referencias en código

- `DataColor.Api/Controllers/MediaIntegrationsController.cs`
- `DataColor.Core/Services/MediaIntegrationService.cs`
