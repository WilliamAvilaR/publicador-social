# Guía frontend: POST /api/tenants/personal

Documento **aparte** que describe el endpoint para que un usuario **Customer** cree **su propia organización (tenant)** cuando ya tiene cuenta pero **no tiene ningún workspace activo** (por ejemplo, tras desactivarle la única membresía en un tenant donde entró por invitación).

Para el resto de rutas de tenants, roles y JWT, ver **`docs/frontend-tenants-y-roles.md`**.

---

## 1. Cuándo usar este endpoint

**Situación de producto**

- El usuario **puede iniciar sesión** (cuenta global activa).
- **`GET /api/tenants`** devuelve **`count: 0`** (ninguna membresía activa en un tenant operativo: relación activa, tenant activo y no suspendido).
- La app debe ofrecer un camino **self-service**: “Crear mi organización” / “Seguir usando la plataforma con mi propio espacio”.

**No usar** este endpoint si el usuario **ya tiene al menos una** organización que cumple esas condiciones: el servidor responderá **400** con mensaje de negocio.

**Tipo de usuario**

- Solo **`userType: Customer`** en el JWT. Los usuarios **Internal** no deben llamar a esta ruta (el servidor rechaza con **400**).

---

## 2. Contrato del endpoint

| Aspecto | Valor |
|---------|--------|
| **Método y ruta** | **POST** `/api/tenants/personal` |
| **Autorización** | **Customer** autenticado (**Bearer**). Misma política que **`GET /api/tenants`**: **no** exige **`TenantMember`** ni cabecera **`X-Tenant-Id`** (el usuario aún no tiene tenant en contexto). |
| **Cuerpo** | JSON opcional. Ver tabla siguiente. |
| **`Content-Type`** | `application/json` (o cuerpo vacío/`{}` según lo que acepte el cliente; ver nota abajo). |

### 2.1 Cuerpo de la petición (`CreatePersonalTenantDto`)

| Campo (JSON) | Obligatorio | Descripción |
|----------------|-------------|-------------|
| **`tenantName`** | No | Nombre visible de la nueva organización. **Máximo 200 caracteres.** Si se omite, está vacío o solo espacios, el backend usa **`"Nombre Apellido"`** del usuario; si aun así quedara vacío, usa el literal **`"Mi organización"`**. |

Ejemplos de cuerpo válidos:

- `{}`
- `{ "tenantName": "Mi agencia" }`

---

## 3. Respuesta exitosa (200)

El payload sigue el envoltorio habitual **`ApiResponse`** (camelCase en JSON: **`data`**, **`meta`**, **`requiresReauth`**).

Dentro de **`data`** el backend devuelve un objeto con al menos:

| Campo | Descripción |
|--------|-------------|
| **`tenantId`** | Identificador numérico del tenant recién creado. |
| **`tenantName`** | Nombre persistido (puede coincidir con el enviado o con el generado). |
| **`slug`** | Slug único del tenant. |
| **`token`** | **Nuevo JWT** que ya incluye el claim de **tenants** con esta organización y el rol de propietario (misma idea que tras login o refresh con membresías). |
| **`idUsuario`** | Id del usuario. |
| **`email`** | Email del usuario. |
| **`rol`** | Rol global de aplicación (no confundir con rol en tenant). |
| **`fullName`** | Nombre completo. |

**Importante para el front:** la respuesta **incluye el token nuevo en el cuerpo**; no depende solo de **`requiresReauth`**. El cliente debe **sustituir el JWT almacenado** por **`data.token`** (igual que tras **`POST /api/invitations/accept`**).

---

## 4. Errores habituales

| Código | Cuándo |
|--------|--------|
| **401** | Sin sesión o token inválido. |
| **400** | Reglas de negocio, entre otras: usuario no es **Customer**; ya tiene **al menos una** organización activa según el criterio del listado; validación de **`tenantName`** (longitud); fallo interno poco frecuente al cargar el tenant creado (mensaje en **`data`** como texto según middleware habitual). |

Los mensajes concretos van en el cuerpo de error según el formato estándar de la API (a menudo **`data`** como string con la descripción).

---

## 5. Flujo recomendado en la aplicación

1. Tras **login** o **refresh**, llamar **`GET /api/tenants`**.
2. Si **`count === 0`**, mostrar pantalla vacía con copy del tipo: *“No tienes acceso a ninguna organización activa. Puedes crear la tuya para seguir usando la plataforma.”* y botón que dispare **`POST /api/tenants/personal`**.
3. En éxito: **guardar `data.token`**, actualizar estado de auth, opcionalmente volver a llamar **`GET /api/tenants`** para alinear UI (debería aparecer un elemento).
4. Fijar el workspace activo con **`data.tenantId`** (p. ej. **`X-Tenant-Id`**) antes de navegar a rutas que exijan **TenantMember**.
5. Si el usuario **vuelve** a quedar sin organizaciones activas en el futuro, el mismo flujo aplica de nuevo.

---

## 6. Relación con el JWT y TenantMember

- **Antes** de crear la organización, el JWT del Customer puede **no** traer claim **`tenant`** (lista vacía en lógica de claims). Eso es coherente con no poder llamar a endpoints **TenantMember** sin un tenant resuelto.
- **Después** de un **200** en **`POST /api/tenants/personal`**, el **`token`** devuelto debe usarse para que **`X-Tenant-Id`** coincida con un tenant presente en los claims y pasen las comprobaciones de miembro.

---

## 7. Paridad con el registro

La creación del tenant reutiliza la misma lógica de negocio que el **alta de Customer con tenant** en registro: plan por defecto, usuario como **propietario** del tenant, suscripción inicial, etc. No es un “tenant temporal” distinto en modelo de datos.

---

## 8. Referencia cruzada

- **`docs/frontend-tenants-y-roles.md`**: formato **`ApiResponse`**, **`GET /api/tenants`**, cabeceras, **TenantMember**, invitaciones.
- **`docs/reglas-membresia-y-roles-tenant.md`**: reglas de membresía y roles si el producto necesita alinear mensajes de error con políticas del servidor.

---

*Guía específica para `POST /api/tenants/personal`. Actualizar si cambian DTOs o mensajes en el backend.*
