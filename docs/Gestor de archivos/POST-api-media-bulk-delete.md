# POST `/api/media/bulk-delete` — Construcción técnica

Ejecuta eliminación masiva de medios con semántica no atómica (resultado por ítem).

---

## 1. Resumen

| Aspecto | Detalle |
|--------|---------|
| Método y ruta | `POST /api/media/bulk-delete` |
| Controlador | `MediaController.BulkDelete` |
| Servicio | `IMediaService.BulkDeleteAsync` |
| Auth | JWT requerido |
| Autorización | `TenantMember` |
| Body | `BulkDeleteMediaRequestDto` |
| Respuesta | `200` con `ApiResponse<BulkOperationResultDto>` |

---

## 2. Flujo de capas

1. Valida tenant/usuario.
2. Service procesa ids únicos uno a uno.
3. Cada item puede terminar en éxito o error de negocio.
4. Devuelve consolidado (`processed`, `failed`, `results[]`).

---

## 3. Contrato de entrada

```json
{ "mediaIds": [101, 102, 103] }
```

---

## 4. Contrato de salida (`200`)

```json
{
  "data": {
    "totalRequested": 3,
    "processed": 2,
    "failed": 1,
    "results": [
      { "mediaId": 101, "ok": true },
      { "mediaId": 102, "ok": false, "status": 409, "code": "MEDIA_IN_USE", "message": "Activo en uso, no se puede eliminar." }
    ]
  }
}
```

---

## 5. Códigos HTTP y errores

- `200`: operación batch ejecutada (aunque haya fallos parciales).
- `401`: no autenticado.
- Errores por ítem en `data.results[]`.

---

## 6. Reglas de negocio / invariantes

- No atómico por diseño.
- Respeta invariantes de delete individual (`MEDIA_IN_USE`, `MEDIA_NOT_FOUND`, etc.).

---

## 7. Referencias en código

- `DataColor.Api/Controllers/MediaController.cs`
- `DataColor.Core/Services/MediaService.cs`
