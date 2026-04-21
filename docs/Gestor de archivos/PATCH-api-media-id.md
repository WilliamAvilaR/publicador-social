# PATCH `/api/media/{id}` — Construcción técnica

Actualiza metadatos de un activo media (`name`, `status`, `tags`).

---

## 1. Resumen

| Aspecto | Detalle |
|--------|---------|
| Método y ruta | `PATCH /api/media/{id}` |
| Controlador | `MediaController.Update` |
| Servicio | `IMediaService.UpdateAsync` |
| Auth | JWT requerido |
| Autorización | `TenantMember` |
| Body | `MediaUpdateRequestDto` |
| Respuesta | `200` con `ApiResponse<MediaDetailDto>` |

---

## 2. Flujo de capas

1. Valida tenant/usuario.
2. Carga medio por tenant.
3. Aplica cambios permitidos.
4. Si `status=archived`, valida que no esté en uso.
5. Persiste y retorna detalle actualizado.

---

## 3. Contrato de entrada

```json
{
  "name": "banner v2",
  "status": "active",
  "tags": ["promo", "q2"]
}
```

Campos son opcionales; se actualiza solo lo enviado.

---

## 4. Contrato de salida (`200`)

```json
{
  "data": {
    "id": 124,
    "name": "banner v2",
    "status": "active",
    "tags": ["promo", "q2"]
  }
}
```

---

## 5. Códigos HTTP y errores

- `200`: actualización correcta.
- `400`: estado inválido (`active|archived`).
- `401`: no autenticado.
- `404`: no encontrado (`MEDIA_NOT_FOUND`).
- `409`: conflicto por uso (`MEDIA_IN_USE`).

---

## 6. Reglas de negocio / invariantes

- Solo se aceptan estados `active` o `archived`.
- No puede pasar a `archived` si está en uso.
- Tags se normalizan (trim/lowercase/distinct).

---

## 7. Referencias en código

- `DataColor.Api/Controllers/MediaController.cs`
- `DataColor.Core/Services/MediaService.cs`
- `DataColor.Core/DTOs/MediaDtos.cs`
