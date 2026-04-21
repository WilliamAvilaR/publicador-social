# POST `/api/media/bulk-tag` — Construcción técnica

Actualiza tags de múltiples medios con resultado parcial por ítem.

---

## 1. Resumen

| Aspecto | Detalle |
|--------|---------|
| Método y ruta | `POST /api/media/bulk-tag` |
| Controlador | `MediaController.BulkTag` |
| Servicio | `IMediaService.BulkTagAsync` |
| Auth | JWT requerido |
| Autorización | `TenantMember` |
| Body | `BulkTagMediaRequestDto` |
| Respuesta | `200` con `ApiResponse<BulkOperationResultDto>` |

---

## 2. Flujo de capas

1. Valida tenant/usuario.
2. Normaliza tags (`trim/lowercase/distinct`).
3. Procesa ids uno a uno, reemplazando tags por activo.
4. Devuelve resultados por item.

---

## 3. Contrato de entrada

```json
{
  "mediaIds": [101, 102],
  "tags": ["promo", "Q2", "promo"]
}
```

---

## 4. Contrato de salida (`200`)

```json
{
  "data": {
    "totalRequested": 2,
    "processed": 2,
    "failed": 0,
    "results": [
      { "mediaId": 101, "ok": true },
      { "mediaId": 102, "ok": true }
    ]
  }
}
```

---

## 5. Códigos HTTP y errores

- `200`: batch procesado.
- `401`: no autenticado.
- Fallos por ítem en `results[]` (`404`, `409`, etc.).

---

## 6. Reglas de negocio / invariantes

- No atómico por diseño.
- El set de tags final por media se reemplaza por el enviado (normalizado).

---

## 7. Referencias en código

- `DataColor.Api/Controllers/MediaController.cs`
- `DataColor.Core/Services/MediaService.cs`
