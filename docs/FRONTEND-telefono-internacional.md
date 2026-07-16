# Teléfono internacional — guía Frontend

Guía para implementar el selector de teléfono con indicativo de país en registro y perfil.

---

## 1. Catálogo de países

```http
GET /api/catalogs/phone-countries
```

- **Sin autenticación**
- Cacheable 24 h (`Cache-Control: public, max-age=86400`)
- Doc técnica: [GET-api-catalogs-phone-countries.md](../Catalogs/GET-api-catalogs-phone-countries.md)

### Ítem

| Campo | Uso |
|-------|-----|
| `isoCode` | Valor estable del selector (`CO`, `MX`, …) |
| `name` | Texto visible en lista abierta |
| `callingCode` | Indicativo (`+57`) |
| `flag` | Emoji de bandera (`🇨🇴`) |
| `exampleNumber` | Solo placeholder; **no** validar longitudes con esto |

---

## 2. Contrato al guardar (registro y perfil)

### Registro — `POST /api/token/register`

```json
{
  "firstName": "Ana",
  "lastName": "Pérez",
  "email": "ana@ejemplo.com",
  "password": "******",
  "telephone": "+573001234567",
  "telephoneCountry": "CO"
}
```

### Perfil — `PUT /api/me`

```json
{
  "firstName": "Ana",
  "lastName": "Pérez",
  "email": "ana@ejemplo.com",
  "telephone": "+573001234567",
  "telephoneCountry": "CO",
  "birthDate": "1990-05-20"
}
```

### Lectura — `GET /api/me`

```json
{
  "data": {
    "telephone": "+573001234567",
    "telephoneCountry": "CO",
    "...": "..."
  }
}
```

### Reglas de API

| Campo | Regla |
|-------|--------|
| `telephone` | Opcional. Preferible **E.164** sin espacios (`+573001234567`). Máx. 16 caracteres. |
| `telephoneCountry` | ISO 3166-1 alpha-2. Obligatorio si envías número **sin** `+` (nacional). |
| Ambos vacíos / null | Se borra el teléfono del perfil. |
| Solo `telephoneCountry` | **400** — debes enviar también `telephone`. |

El backend valida con **libphonenumber** (no solo longitud). Si el número no es válido para el país → **400**.

---

## 3. Selector híbrido (implementado)

### Principio

| Capa | Qué usar |
|------|----------|
| Valor interno del form | `isoCode` (`CO`, `MX`) |
| Mostrar bandera | `flag` del API (emoji) o SVG por `isoCode` |
| Mostrar indicativo | `callingCode` (`+57`) |
| Placeholder del número | `exampleNumber` |
| Guardar en API | `telephone` (E.164) + `telephoneCountry` (isoCode) |

La bandera **no se guarda**; solo ayuda a elegir el país.

### Layout

```
┌─────────────────────────────────────────────┐
│ [🇨🇴 +57 ▼] │ 300 123 4567                │
└─────────────────────────────────────────────┘
```

- **Cerrado:** `🇨🇴 +57`
- **Abierto:** `🇨🇴 Colombia +57` (con buscador por nombre, ISO o indicativo)

### País inicial (solo ayuda)

1. `telephoneCountry` del perfil (`GET /api/me`)
2. `navigator.language` → ISO (`es-CO` → `CO`)
3. Default plataforma: **`CO`**

### Bandera híbrida (emoji + fallback SVG)

Por defecto se usan imágenes SVG vía `flagcdn.com` (`USE_SVG_FLAGS = true` en `phone.utils.ts`), porque en Windows los emojis de bandera suelen verse como letras (`CO` en vez de 🇨🇴).

Para volver a emoji del API:

```html
<app-phone-field [formGroup]="form" [useSvgFlags]="false"></app-phone-field>
```

SVG: `https://flagcdn.com/24x18/{iso}.png`

### Archivos clave

| Archivo | Rol |
|---------|-----|
| `src/app/shared/components/phone-field/` | Componente reutilizable del selector |
| `src/app/core/services/phone-catalog.service.ts` | Catálogo + caché en memoria |
| `src/app/shared/utils/phone.utils.ts` | E.164, paste, hidratación, validación |
| `src/app/features/auth/components/register.component.*` | Registro |
| `src/app/features/auth/components/edit-profile/` | Perfil (`PUT /api/me`) |

---

## 4. Comportamiento UI

### Al escribir número nacional

País `CO` + `3001234567` → muestra `300 123 4567` → envía `+573001234567`.

### Al pegar internacional (único auto-detect fiable)

Si pega `+14155552671` → parsear con **libphonenumber-js**, actualizar selector y formatear.

**No** detectar país mientras escribe dígitos nacionales sin `+`.

### Al enviar al API

- `telephone`: E.164 **sin espacios**
- `telephoneCountry`: `isoCode` del selector
- Borrar teléfono: `{ "telephone": null, "telephoneCountry": null }`

### Validación en front (UX)

Antes de submit: `isPhoneValidForCountry()` con **libphonenumber-js**. El backend valida de nuevo.

### Accesibilidad

- Selector: `aria-label` = "País del teléfono" (`PHONE_FIELD.COUNTRY_ARIA_LABEL`)
- Input: `aria-label` = "Número de teléfono"
- Bandera: `aria-hidden` (el nombre del país va en texto)

---

## 5. Librería

- **`libphonenumber-js`**: `parsePhoneNumberFromString`, `AsYouType`, `isValidPhoneNumber`

---

## 6. Checklist

- [x] Cargar `GET /api/catalogs/phone-countries` al abrir registro/perfil
- [x] Cachear catálogo en memoria
- [x] Selector con `isoCode` + bandera + indicativo + buscador
- [x] Input nacional con placeholder del país (`exampleNumber`)
- [x] Paste con `+` → cambiar país automáticamente
- [x] Formateo visual; al API enviar E.164 + `telephoneCountry`
- [x] No validar solo con longitud de `exampleNumber`
- [x] Formularios de **registro** y **perfil** (`PUT /api/me`)
- [x] Mostrar teléfono formateado al cargar `GET /api/me`
- [x] Mensajes de error i18n (`PHONE_FIELD.*`)
- [x] Fallback SVG opcional para banderas

---

## 7. Ejemplos rápidos

| Acción usuario | Payload al API |
|----------------|----------------|
| Colombia, escribe `3001234567` | `{ "telephone": "+573001234567", "telephoneCountry": "CO" }` |
| Pega `+525512345678` | `{ "telephone": "+525512345678", "telephoneCountry": "MX" }` |
| Quita el teléfono | `{ "telephone": null, "telephoneCountry": null }` |

---

## 8. Endpoints relacionados

| Endpoint | Auth | Uso |
|----------|------|-----|
| `GET /api/catalogs/phone-countries` | No | Catálogo del selector |
| `POST /api/token/register` | No | Guardar teléfono en registro |
| `GET /api/me` | Sí | Leer `telephone` + `telephoneCountry` |
| `PUT /api/me` | Sí | Actualizar teléfono |

Migración de BD aplicada en backend: `telefono` varchar(16) + `telephone_country` char(2). Números viejos de 10 dígitos se migran como Colombia (`+57…`).
