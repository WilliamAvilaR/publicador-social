# POST `/api/media/{id}/archive` — Construcción técnica

Archiva un activo media del tenant (soft state), respetando reglas de uso.

---

## 1. Resumen

| Aspecto | Detalle |
|--------|---------|
| Método y ruta | `POST /api/media/{id}/archive` |
| Controlador | `MediaController.Archive` |
| Servicio | `IMediaService.ArchiveAsync` |
| Auth | JWT requerido |
| Autorización | `TenantMember` |
| Respuesta | `200` con `ApiResponse<MediaDetailDto>` |

---

## 2. Flujo de capas

1. Controller valida tenant/usuario.
2. Servicio carga medio y verifica si está en uso (`IsInUseAsync`).
3. Si no está en uso, `status=archived` y `updatedAt=utcNow`.

---

## 3. Contrato de entrada

- Path param: `id` (`int`).

---

## 4. Contrato de salida (`200`)

```json
{
  "data": {
    "id": 124,
    "status": "archived",
    "updatedAt": "2026-04-21T16:10:00Z"
  }
}
```

---

## 5. Códigos HTTP y errores

- `200`: archivado correcto.
- `401`: no autenticado.
- `404`: medio no encontrado (`MEDIA_NOT_FOUND`).
- `409`: medio en uso (`MEDIA_IN_USE`).

---

## 6. Reglas de negocio / invariantes

- Un medio en uso no se archiva.
- El archivado no implica borrado físico.

---

## 7. Referencias en código

- `DataColor.Api/Controllers/MediaController.cs`
- `DataColor.Core/Services/MediaService.cs`
