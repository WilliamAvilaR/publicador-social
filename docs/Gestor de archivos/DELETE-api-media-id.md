# DELETE `/api/media/{id}` — Construcción técnica

Elimina un activo media del tenant (hard delete lógico + intento de borrado físico).

---

## 1. Resumen

| Aspecto | Detalle |
|--------|---------|
| Método y ruta | `DELETE /api/media/{id}` |
| Controlador | `MediaController.Delete` |
| Servicio | `IMediaService.DeleteAsync` |
| Auth | JWT requerido |
| Autorización | `TenantMember` |
| Respuesta | `200` con `ApiResponse<object>` |

---

## 2. Flujo de capas

1. Valida tenant/usuario.
2. Servicio verifica existencia y regla de uso.
3. Borra registro DB.
4. Intenta borrar archivo físico en storage (`DeleteAsync`).
5. Si falla borrado físico, deja warning en logs.

---

## 3. Contrato de entrada

- Path param: `id` (`int`).

---

## 4. Contrato de salida (`200`)

```json
{
  "data": {
    "deleted": true
  }
}
```

---

## 5. Códigos HTTP y errores

- `200`: eliminado.
- `401`: no autenticado.
- `404`: no encontrado (`MEDIA_NOT_FOUND`).
- `409`: en uso (`MEDIA_IN_USE`).

---

## 6. Reglas de negocio / invariantes

- Un medio en uso no puede borrarse duro.
- La consistencia DB/storage se trata con compensación best-effort y logging.

---

## 7. Referencias en código

- `DataColor.Api/Controllers/MediaController.cs`
- `DataColor.Core/Services/MediaService.cs`
