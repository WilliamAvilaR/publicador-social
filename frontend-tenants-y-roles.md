# Guía para frontend: tenants y roles (API DataColor)

Documento orientado al equipo de interfaz: **cómo consumir** los endpoints relacionados con tenants y roles de tenant, **qué enviar**, **qué recibir** y **comportamiento esperado**. No incluye ejemplos de código.

---

## 1. Autenticación y tipo de usuario

- Las rutas bajo **`/api/tenants`** (salvo las indicadas) exigen usuario autenticado con JWT (**Bearer**).
- El claim **`userType`** debe ser **`Customer`** para el flujo de clientes con workspaces por tenant.
- Los usuarios **Internal** (backoffice) usan otros controladores; esta guía se centra en **Customer** y tenants.

---

## 2. Cómo indica el backend el tenant activo en cada petición

Muchas operaciones exigen la política **TenantMember**: el usuario debe **pertenecer** al tenant cuya operación se realiza.

El servidor obtiene el identificador del tenant en este **orden de prioridad**:

1. Cabecera HTTP **`X-Tenant-Id`** (valor numérico del tenant).
2. Si no está, el parámetro de ruta **`tenantId`** (cuando la URL lo incluye, p. ej. rutas del tipo `/api/tenants/{tenantId}/...`).
3. Si no está, query string **`tenantId`**.

**Recomendación para el front:** en llamadas al workspace actual, enviar de forma consistente **`X-Tenant-Id`** con el tenant seleccionado por el usuario, además de usar URLs que ya lleven `{tenantId}` cuando aplique. Así se evitan ambigüedades.

---

## 3. JWT y claim de tenants

El token incluye un claim (habitualmente serializado como JSON) con la lista de tenants del usuario. Cada elemento asocia **id de tenant** y **rol en ese tenant** (el mismo valor que se persiste como código de rol en base de datos, p. ej. `TenantOwner`, `Admin`, `Editor`).

**Implicaciones para el front:**

- La **fuente de verdad** de permisos en tiempo real es el **servidor**; el JWT puede quedar **desactualizado** tras cambios de rol o membresía hasta que el usuario vuelva a autenticarse o se obtenga un token nuevo.
- Tras ciertas respuestas exitosas, la API señala que conviene **renovar sesión** (ver sección 5).

---

## 4. Formato general de respuesta `ApiResponse`

La mayoría de respuestas envuelven el payload en un objeto con esta forma lógica:

| Campo (JSON) | Descripción |
|----------------|-------------|
| **`data`** | Cuerpo principal: objeto, lista o primitivo según el endpoint. |
| **`meta`** | Opcional; metadatos de paginación u otros (puede ser nulo). |
| **`requiresReauth`** | Booleano. Si es **`true`**, el cliente debe tratar de **volver a iniciar sesión o refrescar el token** y actualizar estado local (menús, permisos). |

Los nombres en JSON suelen ir en **camelCase** (`data`, `requiresReauth`, etc.), según la configuración típica de la API.

**Errores:** en muchos casos **`400 Bad Request`** devuelve `data` como **mensaje de texto** describiendo la regla de negocio incumplida. **`401`** si no hay sesión válida; **`403`** si el usuario no tiene permiso para la acción o no es miembro del tenant solicitado; **`404`** si el recurso no existe.

---

## 5. Señal de reautenticación (`requiresReauth` y cabecera)

En respuestas **correctas** de operaciones que cambian **rol** o **pertenencia** al tenant (y en un caso de administración global de usuario), además de **`requiresReauth: true`** en el cuerpo puede enviarse la cabecera:

- **`X-Requires-Reauth`**: valor **`true`**.

**Acción recomendada en el cliente:** si aparece el flag o la cabecera, forzar flujo de **login de nuevo** o **refresh** (si existe) y **rehidratar** claims y listado de tenants antes de confiar en la UI de administración.

**Endpoints que suelen activar esta señal en éxito:**

- Cambio de rol de un miembro en el tenant.
- Activar o desactivar la membresía de un usuario en el tenant.
- Vincular un usuario existente al tenant (alta por email).
- Transferencia de propiedad del tenant.
- (Solo panel interno) cambio del estado global activo/inactivo del usuario.

La **aceptación de invitación** devuelve un **nuevo JWT** dentro de `data`; ahí el usuario ya entra con token actualizado, por lo que el patrón `requiresReauth` en ese flujo concreto no sustituye a guardar el nuevo token.

---

## 6. Catálogo de roles de tenant

| Método y ruta | Autorización | Envío | Respuesta (`data`) |
|---------------|--------------|--------|---------------------|
| **GET** `/api/tenants/roles` | **Customer** autenticado (no exige `TenantMember` sobre un tenant concreto) | Sin cuerpo; sin `tenantId` obligatorio en ruta | Objeto con lista **`roles`** y **`count`**. Cada rol incluye: **`code`**, **`name`**, **`description`**, **`isAdmin`**, **`isDefaultForNewUsers`**. |

**Uso en UI:** poblar desplegables de “rol al invitar” o “rol al editar” con los **`code`** devueltos. Los valores **`code`** son los que debe enviar el front en **`roleInTenant`** (o equivalente) al crear invitaciones, vincular usuarios o actualizar rol.

**Nota de negocio:** aunque el catálogo liste un rol, el servidor puede **rechazar** su asignación según quién actúe (propietario vs administrador del tenant) y según el tipo de operación; en ese caso llegará un **400** con mensaje explicativo en `data`.

---

## 7. Listado y contexto de tenants del usuario

| Método y ruta | Autorización | Envío | Respuesta (`data`) |
|---------------|--------------|--------|---------------------|
| **GET** `/api/tenants` | **Customer** | Sin cuerpo | Objeto con **`tenants`** (lista) y **`count`**. Por cada tenant: **`tenantId`**, **`name`**, **`slug`**, **`description`**, **`planCode`**, **`role`** (código de rol en ese tenant), **`joinedAt`**, **`isActive`**. Solo tenants **activos** y no suspendidos según reglas del backend. |

| Método y ruta | Autorización | Envío | Respuesta (`data`) |
|---------------|--------------|--------|---------------------|
| **GET** `/api/tenants/current` | **TenantMember** (hace falta resolver `tenantId` por cabecera, ruta o query) | — | Objeto con **`tenantId`**, **`roleInTenant`**, **`isSet`**, mensaje descriptivo. |

| Método y ruta | Autorización | Envío | Respuesta (`data`) |
|---------------|--------------|--------|---------------------|
| **GET** `/api/tenants/{tenantId}/info` | **TenantMember** | `tenantId` en ruta (y opcionalmente `X-Tenant-Id` alineado) | Información del tenant, plan/suscripción resumida, **`userRole`** (rol del usuario actual en ese tenant). |

| Método y ruta | Autorización | Envío | Respuesta (`data`) |
|---------------|--------------|--------|---------------------|
| **GET** `/api/tenants/{tenantId}/workspace` | **TenantMember** | Igual | Datos de workspace; incluye **`userRole`**. |

| Método y ruta | Autorización | Envío | Respuesta (`data`) |
|---------------|--------------|--------|---------------------|
| **GET** `/api/tenants/{tenantId}/entitlements` | **TenantMember** | Igual | Límites y features del plan, uso actual; pensado para mostrar u ocultar funcionalidad según plan. |

---

## 8. Miembros del tenant (lista y gestión)

### 8.1 Listar usuarios del tenant

| Método y ruta | Autorización | Envío | Respuesta (`data`) |
|---------------|--------------|--------|---------------------|
| **GET** `/api/tenants/{tenantId}/users` | **TenantMember** (cualquier miembro con acceso al tenant) | — | Objeto con **`users`** y **`count`**. Cada elemento: **`userId`**, **`email`**, **`fullName`**, **`roleInTenant`**, **`isActive`**, **`joinedAt`**. |

### 8.2 Cambiar rol de un miembro

| Método y ruta | Autorización | Envío (cuerpo JSON) | Respuesta (`data`) |
|---------------|--------------|----------------------|---------------------|
| **PATCH** `/api/tenants/{tenantId}/users/{userId}/role` | Solo **propietario** o **administrador** del tenant (según JWT + reglas servidor) | Objeto con propiedad **`roleInTenant`**: string con el **código** del rol (igual que en el catálogo). | Objeto con **`tenantId`**, **`userId`**, **`roleInTenant`**, **`updatedAt`**. Suele ir con **`requiresReauth: true`**. |

**Restricciones que el front debe anticipar en mensajes (400):** no cambiar el propio rol; un administrador de tenant no puede modificar a un propietario; no asignar rol de propietario por este endpoint; no dejar al tenant sin propietario activo; administrador de tenant no puede asignar roles “administrativos” del catálogo.

### 8.3 Activar o desactivar membresía en el tenant

| Método y ruta | Autorización | Envío (cuerpo JSON) | Respuesta (`data`) |
|---------------|--------------|----------------------|---------------------|
| **PATCH** `/api/tenants/{tenantId}/users/{userId}/status` | Propietario o administrador del tenant | Objeto con **`isActive`** (booleano). | Objeto con **`tenantId`**, **`userId`**, **`isActive`**, **`updatedAt`**. Suele ir con **`requiresReauth: true`**. |

**Restricciones típicas (400):** no desactivarse a uno mismo; administrador no desactiva a un propietario; no desactivar al único propietario activo.

**Nota para producto/UI:** un **propietario** del tenant puede desactivar la membresía de roles no propietarios (p. ej. **Editor**), siempre que el servidor no aplique otra regla; el administrador de tenant no puede desactivar a un propietario.

### 8.4 Vincular usuario existente por email

| Método y ruta | Autorización | Envío (cuerpo JSON) | Respuesta (`data`) |
|---------------|--------------|----------------------|---------------------|
| **POST** `/api/tenants/{tenantId}/users` | Propietario o administrador | **`email`** obligatorio; **`roleInTenant`** opcional (si se omite, el servidor usa el rol por defecto del catálogo); resto de campos del DTO pueden ir vacíos o según contrato actual. | Objeto tipo usuario del tenant: **`userId`**, **`email`**, **`fullName`**, **`roleInTenant`**, **`isActive`**, **`joinedAt`**. Suele ir con **`requiresReauth: true`**. |

**Notas:** si el email no corresponde a un usuario registrado, error indicando usar el flujo de invitación. Si ya pertenece activamente al tenant, error de negocio. No se puede asignar rol de **propietario** por este medio.

---

## 9. Invitaciones (desde el tenant)

| Método y ruta | Autorización | Envío (cuerpo JSON) | Respuesta (`data`) |
|---------------|--------------|----------------------|---------------------|
| **POST** `/api/tenants/{tenantId}/invitations` | Propietario o administrador | **`email`** obligatorio; **`firstName`**, **`lastName`** opcionales; **`roleInTenant`** opcional (por defecto según catálogo). | Objeto con **`invitationId`**, **`email`**, **`expiresAt`**, **`acceptLink`**, **`message`**. |

El enlace de aceptación apunta al front (configuración del servidor); el usuario final abre esa URL con el token en query.

**Restricciones:** un administrador de tenant no puede invitar con roles marcados como administrativos en catálogo; no se invita como propietario.

---

## 10. Invitaciones (público: validar y aceptar)

Sin JWT (rutas abiertas bajo **`/api/invitations`**).

| Método y ruta | Envío | Respuesta (`data`) |
|---------------|--------|---------------------|
| **GET** `/api/invitations/validate?token=...` | Query **`token`** | Objeto **`InvitationValidationDto`**: **`valid`**, y si aplica **`email`**, **`tenantName`**, nombres, **`expiresAt`**; si no es válido, **`errorMessage`**. |
| **POST** `/api/invitations/accept` | Cuerpo: **`token`**, **`password`** obligatorios; **`confirmPassword`**, **`firstName`**, **`lastName`** opcionales. | Objeto de login: **`token`** (JWT nuevo), **`idUsuario`**, **`email`**, **`rol`** (rol global de aplicación), **`fullName`**. |

Tras aceptar, el cliente debe **persistir el nuevo JWT** y reconstruir el estado de tenants a partir del token o de **GET /api/tenants**.

---

## 11. Transferencia de propiedad

| Método y ruta | Autorización | Envío (cuerpo JSON) | Respuesta (`data`) |
|---------------|--------------|----------------------|---------------------|
| **POST** `/api/tenants/{tenantId}/transfer-ownership` | Solo **propietario** del tenant (según JWT y validación en servidor) | **`newOwnerUserId`**: entero, id del usuario que ya es miembro **activo** del tenant. | Objeto con **`tenantId`**, **`previousOwnerUserId`**, **`newOwnerUserId`**, **`message`**. **`requiresReauth: true`**. |

**Comportamiento:** el antiguo propietario pasa a rol **Editor** (según catálogo); el destino pasa a rol de propietario. Pueden coexistir **varios** propietarios si ya los había; el producto no fuerza “un solo propietario” salvo reglas futuras.

---

## 12. Matriz UX resumida (sin código)

- **Cualquier miembro** del tenant puede: listar usuarios del tenant, consultar info/workspace/entitlements del tenant (según políticas de la app).
- **Propietario o administrador del tenant** pueden: invitar, vincular usuarios existentes, cambiar roles (con límites), cambiar estado de membresía (con límites).
- **Solo propietario** puede: transferir propiedad.
- **Administrador del tenant** no debe ver acciones sobre **propietarios** que impliquen cambiar rol, degradar o desactivar; el API devolverá error si se intenta.

Confiar en los **códigos de rol** del **GET /api/tenants/roles** y en el **rol** devuelto en **GET /api/tenants** o en el JWT para mostrar u ocultar secciones; tras operaciones mutadoras, respetar **`requiresReauth`**.

---

## 13. Cabeceras y convenciones útiles

- **`Authorization`**: esquema Bearer con el JWT.
- **`X-Tenant-Id`**: id numérico del tenant activo cuando la ruta o la política lo requieran.
- **`Content-Type`**: `application/json` en peticiones con cuerpo.

---

## 14. Referencia cruzada

Para reglas de negocio detalladas, invariantes (mínimo un propietario activo), concurrencia y catálogo `TenantRoles`, ver **`docs/reglas-membresia-y-roles-tenant.md`**.

---

*Documento para equipo frontend. Mantener alineado con cambios en controladores y DTOs del backend.*
