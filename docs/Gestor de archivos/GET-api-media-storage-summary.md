# GET `/api/media/storage-summary` — Construcción técnica

Retorna resumen de consumo de almacenamiento del tenant.

---

## 1. Resumen

| Aspecto | Detalle |
|--------|---------|
| Método y ruta | `GET /api/media/storage-summary` |
| Controlador | `MediaController.StorageSummary` |
| Servicio | `IMediaService.GetStorageSummaryAsync` |
| Auth | JWT requerido |
| Autorización | `TenantMember` |
| Respuesta | `200` con `ApiResponse<MediaStorageSummaryDto>` |

---

## 2. Flujo de capas

1. Valida tenant/usuario.
2. Calcula bytes usados desde repositorio.
3. Resuelve límites del plan (`limit.storageMB`).
4. Retorna usado/límite/disponible.

---

## 3. Contrato de entrada

Sin body ni query.

---

## 4. Contrato de salida (`200`)

```json
{
  "data": {
    "usedBytes": 10485760,
    "limitBytes": 52428800,
    "availableBytes": 41943040,
    "isUnlimited": false
  }
}
```

---

## 5. Códigos HTTP y errores

- `200`: resumen generado.
- `401`: no autenticado.
- `400/500`: error al resolver límites.

---

## 6. Reglas de negocio / invariantes

- El cálculo es por tenant.
- Si el plan no tiene límite, `limitBytes = null` e `isUnlimited = true`.

---

## 7. Referencias en código

- `DataColor.Api/Controllers/MediaController.cs`
- `DataColor.Core/Services/MediaService.cs`
