# Plan V2 — Cuenta híbrida: múltiples métodos de acceso

**Fecha:** 8 julio 2026  
**Estado:** Propuesta técnica — pendiente de implementación  
**Depende de:** V1 implementado ([`plan-login-externo-google-microsoft.md`](./plan-login-externo-google-microsoft.md), [`guia-frontend-login-externo-google-microsoft.md`](./guia-frontend-login-externo-google-microsoft.md))  
**Relacionado:** [`POST-api-token-login.md`](../Api%20Docs/Autenticación%20y%20cuenta/POST-api-token-login.md), [`plan-notifications-worker.md`](./plan-notifications-worker.md)

---

## 0. Resumen ejecutivo

| Pregunta | Respuesta V2 |
|----------|----------------|
| ¿Qué problema resuelve? | Completar la visión de **una sola cuenta de plataforma** (`usuario`) con **varios métodos de acceso**: contraseña local, Google y Microsoft. |
| ¿Qué falta hoy (V1)? | Vincular un segundo IdP a cuenta `Active`, desvincular proveedores, establecer contraseña sin “olvidé mi contraseña”, y vincular OAuth a cuenta password existente con confirmación explícita. |
| ¿Se crean usuarios u organizaciones duplicados? | **No.** Todos los flujos V2 operan sobre el mismo `User` y los mismos `UserTenant` existentes. |
| ¿Patrón de seguridad? | Step-up + OAuth + confirmación en pantalla; email **informativo** (no bloqueante). Sin auto-vincular. |
| ¿Entregas? | Tres fases: **V2.0** (cuenta híbrida autenticada), **V2.1** (vinculación en conflicto OAuth), **V2.2** (operaciones avanzadas y BackOffice). |

### Visión de producto (objetivo final)

```text
Usuario: william@empresa.com
Organización: DataIFX

Métodos de acceso vinculados:
  ✓ Contraseña local
  ✓ Google
  ✓ Microsoft
```

Un solo registro en `usuario`, múltiples filas en `user_external_login`, y `password_hash` opcional.

---

## 1. Estado actual (V1) — baseline

### 1.1 Lo que V1 ya cumple

| Capacidad | Implementación |
|-----------|----------------|
| Una identidad OAuth por proveedor (V1: `provider` + `provider_user_id`; **incompleto para Microsoft multi-tenant**) | `UserExternalLogin` — ver migración V2 §4.1 |
| Un usuario puede tener password **o** OAuth | `PasswordHash` nullable, `HasLocalPassword` |
| OAuth-only → login password rechazado con código explícito | `password_login_not_available` en `AuthService.LoginAsync` |
| Crear primera contraseña vía reset | `forgot-password` / `reset-password` (usuario `Active`) |
| Primer OAuth sin sesión en estados pendientes | `PendingEmailVerification`, `PendingTenantSetup`, invitación |
| Conflicto email en cuenta `Active` sin auto-vincular | `EXTERNAL_AUTH_EMAIL_ALREADY_EXISTS` + `existingProvider` |

### 1.2 Brechas respecto a la recomendación de producto

| Escenario | V1 | V2 objetivo |
|-----------|-----|-------------|
| OAuth-only intenta password | Error específico (sí) | UX con CTA Google + “Configurar contraseña” |
| Establecer contraseña sin flujo “olvidé” | Solo `forgot-password` | `POST /api/account/password` con JWT + step-up |
| Cuenta password + Google mismo email | **Bloqueado** | Vinculación explícita con verificación |
| Google + Microsoft misma cuenta | **Bloqueado** sin sesión | `/link` con JWT |
| Desvincular proveedor | No existe | `DELETE /api/auth/external/{provider}` |
| Ver métodos de acceso en perfil | No expuesto | `GET /api/account/authentication-methods` (+ resumen en `GET /api/me`) |
| Mensaje forgot-password para OAuth-only | Genérico | Copy: “Aún no tienes contraseña…” |
| Clave de identidad externa | V1: `(provider, provider_user_id)` | V2: **`(provider, issuer, subject)`** — §4.1, D-V2-14 |
| Operaciones sensibles solo con JWT largo | Sesión puede durar horas sin re-verificación | **Step-up** + confirmación en pantalla al vincular (§4.5.7) |

---

## 2. Alcance por fase

### 2.1 V2.0 — Cuenta híbrida autenticada (MVP)

**Incluye:**

- Tabla **`auth_session`** + claim JWT `sid` — entidad formal de sesión (§4.1b, D-V2-18)
- **Infraestructura de autenticación reciente (step-up)** — ver §4.5; estado por sesión en `auth_session`
- `GET /api/account/authentication-methods` — listar **métodos de acceso** (contraseña + OAuth + huecos para futuros tipos)
- `POST /api/auth/external/{provider}/link/start` — OAuth para vincular (step-up + revisión en pantalla; §5.2, §4.5.7)
- Callback OAuth con `intent=link` — `ExternalAuthPendingLink` + confirmación en pantalla; vínculo activo en `link/complete` (§5.3)
- `DELETE /api/auth/external/{provider}` — desvincular (JWT + autenticación reciente)
- `POST /api/account/password` — establecer la **primera** contraseña local (JWT + autenticación reciente)
- `PUT /api/account/password` — cambiar contraseña existente (JWT + autenticación reciente)
- `POST /api/account/step-up/password` — re-verificar contraseña y renovar `auth_time` del JWT
- `POST /api/auth/external/{provider}/step-up/start` — re-autenticación OAuth para renovar `auth_time` (§4.5.4, D-V2-22)
- Migrar `POST /api/auth/external/{provider}/start` (login/registro) desde `GET` V1 (§5.1b)
- Ampliar `UserProfileDto` / `GET /api/me` con `hasLocalPassword`, `authTime`, `requiresStepUp`
- Exigir step-up también en `PUT /api/me` cuando cambie el **correo principal** (V2.0 base; flujo completo de verificación en V2.2)
- Exigir step-up en `PUT /api/account/password` (cambio de contraseña existente)
- Migrar/deprecar `POST /api/account/change-password` (V1) → `PUT /api/account/password` (V2)
- Migración identidad externa: `issuer`, `subject` (= `sub`), `tenant_id`/`object_id` (Microsoft); índice `UNIQUE (provider, issuer, subject)` (§4.1, D-V2-14, D-V2-21)
- Copy y códigos de error documentados para frontend
- Tests unitarios e integración de link/unlink/password

**Excluye:**

- Vincular durante conflicto OAuth sin estar logueado (V2.1)
- Cambio de `usuario.email` desde IdP (V2.2+)
- BackOffice abandonos onboarding (V2.2)

### 2.2 V2.1 — Vinculación en conflicto (sin sesión previa)

**Incluye:**

- Flujo “Ya existe una cuenta → Vincular con mi cuenta existente” cuando `EXTERNAL_AUTH_EMAIL_ALREADY_EXISTS`
- Verificación adicional: contraseña actual **o** enlace/código al email registrado
- Redirect al frontend **solo** con `flowCode` opaco (§6.0) — sin errores ni tokens en query string
- `POST /api/auth/external/link/context` — intercambiar `flowCode` por contexto seguro
- `POST /api/auth/external/link/confirm` — completar vínculo con `challengeToken` (del cuerpo de `/context`, nunca de la URL)
- Entidad `ExternalAuthLinkChallenge` + almacenamiento de `flowCode` con hash

### 2.3 V2.2 — Operaciones avanzadas (opcional)

- **Gestión de sesiones activas** (requiere `auth_session` de V2.0 — §4.1b):
  - `GET /api/account/sessions` — dispositivos / sesiones conectadas
  - `DELETE /api/account/sessions/current` — cerrar esta sesión
  - `POST /api/account/sessions/revoke-others` — cerrar las demás
  - `POST /api/account/sessions/revoke-all` — cerrar todas (+ rotar `SecurityStamp`)
- BackOffice: listado `PendingTenantSetup` 30/60/90 días
- Recordatorios email onboarding incompleto
- Cambio explícito de email de plataforma (flujo separado, no automático desde IdP)
- Revocación de tokens en proveedor al desvincular (best-effort)

---

## 3. Casos de uso y criterios de aceptación

### UC-V2-1 — OAuth-only intenta login por contraseña

**Actor:** usuario creado con Google/Microsoft, `PasswordHash = null`, `Status = Active`.

| Paso | Comportamiento |
|------|----------------|
| 1 | Usuario ingresa email + contraseña en `/login` |
| 2 | API responde `401`, `code: password_login_not_available` |
| 3 | Frontend muestra mensaje accionable (no “credenciales incorrectas”) |
| 4 | CTAs: **Continuar con Google/Microsoft** y **Configurar contraseña** |

**Configurar contraseña (dos caminos V2.0):**

| Camino | API | Requisito |
|--------|-----|-----------|
| A — Con sesión OAuth previa | `POST /api/account/password` | JWT + **autenticación reciente** + `!HasLocalPassword` |
| B — Sin sesión | `POST /api/account/forgot-password` → `reset-password` | Usuario `Active` (el enlace por email **sí** cuenta como verificación fuera de banda) |

**Criterio:** no se crea otro `usuario` ni otro `tenant`.

---

### UC-V2-2 — Usuario logueado vincula segundo proveedor (Google → Microsoft)

**Precondición:** JWT válido, cuenta `Active`, ya tiene vínculo Google, **step-up** con método existente y **confirmación en pantalla** (`link/complete`) — §4.5.7. El email del IdP Microsoft **no** tiene que coincidir con `usuario.email` ni con el de otros proveedores (D-V2-24).

```mermaid
sequenceDiagram
  participant U as Usuario
  participant FE as Frontend
  participant API as Backend
  participant IdP as Microsoft

  U->>FE: Configuración → Vincular Microsoft
  alt JWT sin autenticación reciente (método existente)
    FE->>U: Modal "Confirma tu identidad"
    U->>FE: Contraseña o re-login con Google (ya vinculado)
    FE->>API: POST /account/step-up/password o POST .../step-up/start (google)
    API-->>FE: JWT con auth_time renovado
  end
  FE->>API: POST /auth/external/microsoft/link/start { returnUrl } (JWT reciente — obligatorio)
  API->>API: INSERT external_auth_session (intent=Link, userId)
  API-->>FE: authorizationUrl (prompt=login)
  FE->>IdP: Redirect
  IdP->>API: GET /callback?code&state
  API->>IdP: Token + perfil
  API->>API: Validar email IdP verificado; identidad (provider, issuer, subject) libre
  API->>API: INSERT external_auth_pending_link (sin user_external_login)
  API-->>FE: Redirect ?flowCode=...
  FE->>API: POST /flow/resolve { flowCode }
  API-->>FE: link_pending_review (provider + emails)
  FE->>U: Pantalla "¿Vincular Google wrar@... con william@...?"
  U->>FE: [Confirmar vinculación]
  FE->>API: POST /link/complete { pendingLinkToken }
  API->>API: INSERT user_external_login; completed_at; email informativo (async)
  API-->>FE: 200 { provider, message: vinculado }
  FE->>U: Pantalla éxito en /account/security
```

**Criterios:**

- Mismo `user_id` en ambas filas `user_external_login`
- Índice único `(user_id, provider)` respetado
- El step-up previo usa un método **ya vinculado** (no el proveedor nuevo)
- `prompt=login` en el IdP del proveedor **nuevo** es obligatorio pero **no sustituye** el step-up previo (§4.5.7)
- Tras `POST /link/complete`, el vínculo queda **activo de inmediato** (`INSERT user_external_login`)
- Se envía email **informativo** de seguridad al correo principal (sin enlace de confirmación obligatorio)
- `SecurityStamp` **no** rota en link exitoso (es adición de método, no compromiso detectado)
- Auditoría: `AuditLog` acción `ExternalAuthProviderLinked`

---

### UC-V2-3 — Usuario logueado vincula Google teniendo solo contraseña

Igual que UC-V2-2, pero partida: `HasLocalPassword = true`, sin `user_external_login`.

**Validación crítica (D-V2-24):** el email del IdP es **metadata** (`provider_email`); la identidad técnica es `(provider, issuer, subject)`. En vinculación autenticada **no** se exige coincidencia con `usuario.email`.

Requisitos:

- Step-up reciente con método existente
- OAuth del proveedor nuevo (`prompt=login`)
- Email IdP verificado cuando el proveedor lo expone
- `(provider, issuer, subject)` no vinculado a otro usuario
- Confirmación explícita en pantalla (`link/complete`)
- Auditoría + email informativo post-vínculo

---

### UC-V2-4 — Desvincular proveedor

**Precondición adicional:** el usuario debe haber **re-autenticado recientemente** (últimos 15 min por defecto) mediante contraseña o OAuth de un proveedor **ya vinculado**.

**Regla de oro:** el usuario debe conservar **al menos un método de acceso** utilizable.

| Estado cuenta | ¿Puede desvincular Google? |
|---------------|---------------------------|
| Password + Google | Sí (queda password) |
| Google + Microsoft (sin password) | Sí solo si queda al menos otro OAuth |
| Solo Google (sin password) | **No** — `EXTERNAL_AUTH_LAST_AUTH_METHOD` |
| Solo password | N/A (no hay vínculo OAuth) |

Al desvincular:

1. Eliminar fila `user_external_login`
2. **Revocación selectiva de sesiones** (ver §4.6) — no rotar `SecurityStamp` global por defecto
3. Revocar sesiones con `session_amr` = proveedor eliminado (§4.6.3); mantener las que tienen `session_amr ≠` ese proveedor (p. ej. login con contraseña → desvincular Google → sigue logueado)
4. Auditoría: `ExternalAuthProviderUnlinked`

**Ejemplo UX:** usuario entró con **contraseña** (`session_amr=pwd`), step-up, desvincula Google → sigue en sesión. Si entró con **Google** (`session_amr=google`), tras desvincular Google debe volver a autenticarse con otro método.

---

### UC-V2-5 — Cuenta password existente + OAuth mismo email (V2.1)

**Actor:** `Active`, `EmailConfirmed = true`, `HasLocalPassword = true`, sin vínculo Google.

| Paso | Comportamiento |
|------|----------------|
| 1 | Pulsa “Continuar con Google” (sin JWT) |
| 2 | Callback detecta email existente → **no** auto-vincular |
| 3 | Redirect al frontend **solo** con `flowCode` opaco → `POST /link/context` devuelve contexto (§6.0–6.2) |
| 4 | Frontend ofrece: “Vincular con mi cuenta existente” (copy según `verificationMethods`) |
| 5 | Usuario confirma con **contraseña actual** o **código por email** (`challengeToken` en body) |
| 6 | Backend completa vínculo sobre el `User` existente |

**Criterio:** tras vincular, puede entrar con password **o** Google; misma organización.

---

## 4. Modelo de datos

### 4.1 Identidad externa: `provider` + `issuer` + `subject` (D-V2-14, D-V2-21)

**Problema V1:** el índice `UNIQUE (provider, provider_user_id)` y el cliente Microsoft V1 (Graph `/me.id`) tratan **`oid` como si fuera `sub`**. Eso rompe el modelo OpenID Connect y genera ambigüedad entre proveedores.

**Regla OIDC (V2):** la identidad estándar es siempre:

```text
issuer  = claim iss
subject = claim sub    -- SIEMPRE, Google y Microsoft
```

**Microsoft — campos adicionales (no sustituyen a `subject`):**

| Campo BD | Claim | Uso |
|----------|-------|-----|
| `tenant_id` | `tid` | Tenant de Azure AD; auditoría, soporte, correlación |
| `object_id` | `oid` | Object ID del directorio; **no** usar para login ni índice único |

**Prohibido:** `subject = oid` en Microsoft. `oid` y `sub` son claims distintos; el lookup de login es **`(provider, issuer, subject)`** con `subject` = `sub`.

**Problema V1 (adicional):** sin `issuer`, dos tenants podían colisionar si se reutilizaba un identificador global. Con `iss` + `sub` la terna es estable por emisor.

| Campo | Descripción | Ejemplo |
|-------|-------------|---------|
| `provider` | Enum interno | `google`, `microsoft` |
| `issuer` | Claim `iss` del `id_token` (normalizado) | Google: `https://accounts.google.com` — Microsoft: `https://login.microsoftonline.com/{tenantId}/v2.0` |
| `subject` | Claim **`sub`** del `id_token` dentro de ese `iss` | Valor opaco del emisor (no confundir con `oid`) |
| `tenant_id` | Solo Microsoft — claim `tid` | GUID del tenant Azure AD |
| `object_id` | Solo Microsoft — claim `oid` | GUID del objeto usuario en el directorio |

En BD la columna de login es **`subject`** (V1: `provider_user_id`, a menudo `sub` en Google y **`oid` erróneo** en Microsoft).

**Migración desde V1:**

| V1 (implementado) | V2 (objetivo) |
|-----------------|---------------|
| Columna `provider_user_id` | Renombrar a **`subject`** |
| Microsoft: Graph `id` → `provider_user_id` | Microsoft: **`sub`** del `id_token` en `subject`; **`oid`** en `object_id`; **`tid`** en `tenant_id` |
| Sin `issuer` | Añadir **`issuer`** NOT NULL desde `iss` del `id_token` |
| `UNIQUE (provider, provider_user_id)` | `UNIQUE (provider, issuer, subject)` |
| Búsqueda login: `(provider, provider_user_id)` | `(provider, issuer, subject)` |
| Comentarios “sub u oid según proveedor” | **Eliminar** — `subject` es siempre `sub` |

**Backfill Microsoft (obligatorio en migración o próximo login):** filas existentes con `provider_user_id` = Graph `oid` deben re-resolverse con `id_token` (`sub`, `iss`, `tid`, `oid`). No asumir `oid == sub`.

```text
user_external_login
├── id
├── user_id               (FK → usuario)
├── provider              (enum: Google, Microsoft)
├── issuer                (varchar, NOT NULL) — claim iss
├── subject               (varchar, NOT NULL) — claim sub (NUNCA oid)
├── tenant_id             (varchar, nullable) — Microsoft: claim tid
├── object_id             (varchar, nullable) — Microsoft: claim oid (referencia, no login)
├── provider_email        (snapshot IdP)
├── provider_display_name
├── linked_at
├── last_login_at
├── created_at
└── updated_at

UNIQUE (provider, issuer, subject)
UNIQUE (user_id, provider)
INDEX (user_id)
INDEX (provider, issuer, subject)
```

**Pseudocódigo — validar `id_token` y perfil (V2):**

```text
tokens = intercambiar code
idToken = validar y parsear id_token (firma, aud, exp)

issuer  = NormalizeIssuer(idToken.iss)
subject = idToken.sub                    -- obligatorio; rechazar si falta

profile = ExternalAuthIdpProfile {
  Issuer  = issuer,
  Subject = subject,
  TenantId = idToken.tid,               -- Microsoft; null en Google
  ObjectId = idToken.oid,               -- Microsoft; null en Google
  Email = ...,
  EmailVerified = ...
}

existing = user_external_login
  .Where(x => x.Provider == provider
           && x.Issuer == profile.Issuer
           && x.Subject == profile.Subject)
  .SingleOrDefault()
```

**Google:** `iss` estable (`https://accounts.google.com`); `tenant_id` / `object_id` = `NULL`.

**Microsoft — obligatorio parsear `id_token`:** no usar solo Graph `/me?id` como clave de login. Graph puede seguir usándose para email/display name; la identidad de vínculo sale del **`id_token`**.

**Deuda V1 documentada:** `MicrosoftExternalAuthClient` actual asigna `ProviderUserId = profile.Id` (Graph oid). Corregir en PR-V2-0 antes de confiar en índice `(provider, issuer, subject)`.

Un usuario puede tener hasta **2 filas** OAuth (Google + Microsoft) + `password_hash` opcional.

### 4.1b Entidad formal `auth_session` (D-V2-17, D-V2-18)

V2 necesita resolver **varias** necesidades a la vez:

| Necesidad | Sin `auth_session` (acoplamiento actual) |
|-----------|------------------------------------------|
| Step-up por sesión | Claims JWT + columnas globales en `usuario` ❌ |
| Revocación al desvincular proveedor | Tabla `user_auth_provider_revocation` + comparar `JWT.iat` |
| Distinguir sesiones Google vs password | Claim `session_amr` sin fila de sesión en BD |
| Cerrar sesiones específicas | Solo `SecurityStamp` global (expulsa a todos) |
| Conservar método de origen | Claim `session_amr` aislado del ciclo de vida |
| Refresh con elevación segura | Lógica ad hoc en `RefreshTokenAsync` |
| Desvincular proveedores | Middleware paralelo al refresh |
| Cerrar todas las sesiones | Rotar `SecurityStamp` (efecto colateral en todo) |

**Conclusión:** llegados a este punto, una tabla **`auth_session`** es más clara que seguir agregando mecanismos paralelos (JWT + `SecurityStamp` + tablas parciales).

#### Problema crítico (cross-session)

Persistir `recent_auth_at` en `usuario` hace que un step-up en **una** sesión eleve **todas** las demás. Un atacante con JWT robado (`sid` distinto) podría refrescar y obtener `auth_time` reciente tras el step-up legítimo del dueño.

**Regla:** el estado de autenticación reciente y la revocación selectiva pertenecen a la **sesión**, no al usuario global.

#### Modelo recomendado

```text
auth_session
├── id                      (PK, bigint)
├── user_id                 (FK → usuario)
├── session_id              (uuid, UNIQUE) — claim JWT `sid`
├── session_amr             (pwd | google | microsoft) — origen; no cambia en step-up
├── recent_amr              (pwd | google | microsoft) — último step-up
├── authenticated_at        (timestamptz) — inicio de sesión (login/OAuth)
├── recent_auth_at          (timestamptz) — último step-up; al crear = authenticated_at
├── issued_at               (timestamptz) — última emisión/refresh de JWT para esta sesión
├── expires_at              (timestamptz, nullable) — TTL opcional de sesión larga
├── revoked_at              (timestamptz, nullable)
├── revoked_reason          (varchar, nullable) — ver enum abajo
├── security_stamp_snapshot (varchar) — sello del usuario al crear/último refresh
├── ip_address              (varchar, nullable)
├── user_agent              (varchar, nullable)
├── last_seen_at            (timestamptz, nullable) — última petición autenticada
├── created_at
└── updated_at

INDEX (user_id)
INDEX (session_id)
INDEX (user_id, revoked_at) WHERE revoked_at IS NULL  -- sesiones activas
```

**`revoked_reason` (valores sugeridos):**

| Valor | Cuándo |
|-------|--------|
| `provider_unlinked` | Unlink del proveedor que originó la sesión (`session_amr`) |
| `password_changed` | Cambio/establecimiento de contraseña — revoca las **demás** sesiones; la actual sobrevive (§4.6.4 política A) |
| `security_stamp_rotated` | Compromiso, “cerrar todas”, reset sin sesión — revoca **todas** (§4.6.4 política B) |
| `user_logout` | Cierre explícito de esta sesión (V2.2) |
| `user_logout_others` | “Cerrar las demás” desde otra sesión (V2.2) |
| `admin_revoked` | Suspensión / BackOffice |
| `session_expired` | `expires_at` superado (si se usa TTL) |

**JWT incluye** (claims de sesión; el resto del JWT sigue igual — `sub`, tenants, etc.):

```json
{
  "sid": "550e8400-e29b-41d4-a716-446655440000",
  "session_amr": "google",
  "recent_amr": "pwd",
  "auth_time": 1783520100
}
```

#### Ciclo de vida — ejemplos

**Al iniciar sesión (login / OAuth `/exchange`):**

```sql
INSERT INTO auth_session (
  user_id, session_id, session_amr, recent_amr,
  authenticated_at, recent_auth_at, issued_at,
  security_stamp_snapshot, ip_address, user_agent, last_seen_at
) VALUES (
  @user_id, @new_sid, 'google', 'google',
  @now, @now, @now,
  @user_security_stamp, @ip, @ua, @now
);
-- JWT: sid = @new_sid, session_amr = recent_amr = 'google', auth_time = @now
```

**Al hacer step-up con contraseña:**

```text
session_amr permanece google
recent_amr cambia a pwd
recent_auth_at cambia a now
-- JWT: mismo sid; session_amr sin cambio
```

```sql
UPDATE auth_session
SET recent_amr = 'pwd',
    recent_auth_at = @now,
    issued_at = @now,
    updated_at = @now
WHERE session_id = @jwt_sid AND user_id = @jwt_sub AND revoked_at IS NULL;
```

**Al desvincular Google:**

```sql
UPDATE auth_session
SET revoked_at = @now,
    revoked_reason = 'provider_unlinked',
    updated_at = @now
WHERE user_id = @user_id
  AND session_amr = 'google'
  AND revoked_at IS NULL;
```

No hace falta tabla auxiliar: la revocación queda **directamente** en las filas afectadas.

#### Qué se elimina o simplifica

| Mecanismo V2 (descartado) | Reemplazo en `auth_session` |
|---------------------------|----------------------------|
| `usuario.recent_auth_at` / `recent_auth_amr` | `recent_auth_at` / `recent_amr` por fila |
| `user_auth_provider_revocation` + `JWT.iat` vs `revoked_at` | `revoked_at` + `revoked_reason` en la sesión |
| `ProviderAuthRevocationMiddleware` (revocación por proveedor) | `AuthSessionValidationMiddleware` — valida `sid` ↔ fila activa |
| Rotar `SecurityStamp` como único cierre selectivo | Revocar filas concretas; `SecurityStamp` solo para “cerrar todas” / alto riesgo |

`usuario.security_stamp` **se mantiene** para invalidación global rápida; cada fila guarda `security_stamp_snapshot` para detectar rotaciones sin recorrer todas las sesiones en cada request (ver §4.6.3).

#### Eventos resumidos

| Evento | `auth_session` |
|--------|----------------|
| Login / OAuth `/exchange` | **INSERT** nueva fila + nuevo `sid` |
| Step-up | **UPDATE** solo `WHERE session_id = JWT.sid` |
| `POST /token/refresh` | **SELECT** por `sid`; rechazar si revocada; elevar claims; actualizar `issued_at`, `last_seen_at` |
| Unlink proveedor | **UPDATE** `revoked_at` donde `session_amr = provider` |
| Cambio/set de contraseña (política A §4.6.4) | **UPDATE** las demás filas del `user_id` (excepto `JWT.sid`) → `password_changed`; la actual actualiza `security_stamp_snapshot` |
| Rotación `SecurityStamp` total (política B §4.6.4) | **UPDATE** todas las filas del `user_id` → `revoked_reason = security_stamp_rotated` |
| Petición API autenticada | Middleware valida fila por `sid`; opcional `last_seen_at` (throttled) |

**Escenario cross-session que se evita:**

```text
1. Atacante tiene JWT antiguo robado (sid = A).
2. Dueño hace step-up con contraseña (sid = B).
3. ❌ Con usuario.recent_auth_at global → refresh del atacante elevado.
4. ✓ Con auth_session → solo sid B tiene recent_auth_at nuevo; sid A no se eleva.
```

#### Capacidades futuras (V2.2 — pantalla de seguridad)

Con `auth_session` persistida, estas funciones son naturales sin rediseño:

| Función producto | Implementación |
|------------------|----------------|
| Ver dispositivos conectados | `GET /api/account/sessions` — listar filas activas (`revoked_at IS NULL`) con `user_agent`, `ip_address`, `last_seen_at`, `session_amr` |
| Cerrar esta sesión | `DELETE /api/account/sessions/current` — revocar `sid` del JWT |
| Cerrar las demás sesiones | `POST /api/account/sessions/revoke-others` — revocar todas excepto `JWT.sid` |
| Cerrar todas las sesiones | `POST /api/account/sessions/revoke-all` + rotar `SecurityStamp` |

Detalle de contratos API en §2.3 (V2.2). V2.0 implementa la **tabla y validación**; la UI de dispositivos puede llegar después sin cambiar el modelo.

**Alternativas descartadas:** `usuario.recent_auth_at`; `user_auth_provider_revocation` como fuente de verdad paralela a `auth_session`.

### 4.2 Cambios en `external_auth_session` (migración V2.0)

Ampliar entidad para flujo `link`:

| Columna nueva | Tipo | Uso |
|---------------|------|-----|
| `user_id` | `int` nullable | Usuario autenticado que inicia vinculación; `NULL` en flujos V1 |
| `link_mode` | `smallint` / enum | `None = 0`, `AuthenticatedLink = 1`, `ChallengeLink = 2` (V2.1) |

Ampliar enum `ExternalAuthIntent`:

```csharp
public enum ExternalAuthIntent
{
    Auto = 0,
    Login = 1,
    Register = 2,
    Link = 3,      // V2.0 — vincular a user_id de la sesión (con prompt=login)
    StepUp = 4     // V2.0 — re-autenticación; solo renovar auth_time
}
```

**Alternativa descartada:** tabla separada `external_auth_link_session` — más complejidad sin beneficio claro en V2.0.

### 4.3 Cambios V2.1 — `external_auth_link_challenge` y códigos opacos

Entidad para el challenge de vinculación en conflicto (sin sesión JWT previa):

| Campo | Descripción |
|-------|-------------|
| `state` | Correlación con `external_auth_session` |
| `target_user_id` | Cuenta destino (`Active`) |
| `provider` | Google / Microsoft |
| `issuer` | Claim `iss` del callback |
| `subject` | Claim **`sub`** del `id_token` (nunca `oid`) |
| `flow_code_hash` | Hash del `flowCode` enviado al frontend (consumido en `/link/context`) |
| `challenge_token_hash` | Hash del `challengeToken` emitido en respuesta de `/context` (consumido en `/link/confirm`) |
| `expires_at` | TTL 10 min |
| `flow_consumed_at` | Tras `POST /link/context` |
| `completed_at` | Tras vínculo exitoso |

**Reutilización:** puede apoyarse en `SecurityToken` con propósitos `ExternalAuthFlow` (redirect) y `ExternalAuthLinkChallenge` (confirm V2.1). `ExternalAuthLinkVerify` solo si se activa modo estricto V2.2+ (§5.3d).

### 4.3b V2.0 — `external_auth_pending_link` (`ExternalAuthPendingLink`)

Identidad externa obtenida en callback OAuth, **antes** de crear `user_external_login`:

| Campo | Descripción |
|-------|-------------|
| `user_id` | Cuenta DataColor destino |
| `provider` | `google` / `microsoft` |
| `issuer` | Claim `iss` normalizado del id_token |
| `subject` | Claim **`sub`** del `id_token` — columna `subject` en BD |
| `tenant_id` | Microsoft: claim `tid` (opcional en pendiente; obligatorio al persistir vínculo) |
| `object_id` | Microsoft: claim `oid` — referencia; **no** sustituye a `subject` |
| `provider_email` | Email devuelto por el IdP en el callback (metadata visible; **no** determina pertenencia a la cuenta — D-V2-24) |
| `pending_link_token_hash` | Hash del token para `POST /link/complete` (emitido en `flow/resolve`) |
| `expires_at` | TTL 30 min desde callback |
| `ui_confirmed_at` | Tras `POST /link/complete` (confirmación en pantalla) |
| `completed_at` | Tras `POST /link/complete` → `INSERT user_external_login` (mismo instante que `ui_confirmed_at`) |

**No usado en V2.0:** `verify_token_hash` — reservado solo si producto activa flujo endurecido con confirmación por email (§4.5.7, alternativa descartada).

Índice único parcial: no dos pendientes activos por `(user_id, provider)`.

### 4.4 Auditoría (nuevas acciones)

| `ActionType` | Cuándo |
|--------------|--------|
| `ExternalAuthProviderLinkRequested` | Callback OAuth OK; `ExternalAuthPendingLink` creado |
| `ExternalAuthProviderLinkReviewConfirmed` | Usuario confirmó en pantalla (`POST /link/complete`) |
| `ExternalAuthProviderLinkConfirmed` | Vínculo activo tras `POST /link/complete` (V2.0) o challenge V2.1 (`link/confirm`) |
| `ExternalAuthProviderUnlinked` | Desvinculación |
| `LocalPasswordSet` | Primera contraseña en cuenta OAuth-only |
| `LocalPasswordChanged` | Cambio con `PUT /api/account/password` |
| `StepUpAuthenticationSucceeded` | Re-verificación reciente (password u OAuth) |
| `PrimaryEmailChangeRequested` | Solicitud de cambio de correo principal (V2.2) |

### 4.5 Autenticación reciente (step-up) — obligatoria en V2.0

#### 4.5.1 Problema: el JWT solo no es suficiente

Un JWT válido puede permanecer activo **varias horas** (login, refresh, pestaña abierta). Si alguien accede a un equipo desbloqueado con sesión iniciada, podría, **sin volver a demostrar identidad**:

- vincular **su propio** Google o Microsoft a la cuenta ajena;
- desvincular el proveedor legítimo del dueño;
- establecer una contraseña local y tomar control persistente;
- cambiar la contraseña o el correo principal.

Por eso V2 **no** debe permitir operaciones sensibles únicamente con “tener JWT”.

#### 4.5.2 Operaciones que exigen autenticación reciente

| Operación | Endpoint(s) | Step-up aceptado |
|-----------|-------------|-------------------|
| Vincular un nuevo proveedor | `link/start` → callback → `flow/resolve` → `POST /link/complete` | Step-up (método existente) + OAuth + pantalla de revisión (§4.5.7) |
| Desvincular un proveedor | `DELETE .../{provider}` | Contraseña actual **o** OAuth de proveedor **ya vinculado** con re-login |
| Establecer la **primera** contraseña | `POST /api/account/password` | Step-up previo (OAuth re-login de proveedor vinculado o forgot-password fuera de banda) |
| Cambiar contraseña existente | `PUT /api/account/password` | Step-up; `currentPassword` solo si el step-up **no** fue con contraseña (§4.5.3c) |
| Cambiar correo principal | `PUT /api/me` (campo email) | Step-up + verificación del **nuevo** correo (V2.2) |

**No requieren step-up adicional** (solo JWT normal):

- `GET /api/me`, `GET /api/account/authentication-methods` (lectura)
- Navegación general en la app
- `POST /api/account/forgot-password` / `reset-password` (la prueba es el enlace al email)

#### 4.5.3 Modelo técnico: `auth_time` y claims de método (D-V2-16)

Un solo claim `amr` es **ambiguo** tras step-up: si la sesión nació con Google y el usuario hace step-up con contraseña, sobrescribir `amr=pwd` haría que la revocación al desvincular Google **no** afecte sesiones que en realidad dependían de Google.

**Claims JWT (V2):**

| Claim | Nombre corto | Cuándo se fija | Uso |
|-------|--------------|----------------|-----|
| `sid` | ID de sesión | Login/OAuth (nueva fila `auth_session`) | Correlacionar JWT ↔ estado en BD (§4.1b) |
| `session_amr` | Origen de la sesión | **Solo** en login/OAuth `/exchange` | Revocación selectiva al unlink (§4.6) |
| `recent_amr` | Última re-autenticación fuerte | Login **y** cada step-up en **esta** `sid` | `[RequireRecentAuthentication]` + auditoría |
| `auth_time` | Unix UTC | Login y step-up en **esta** `sid` | Ventana de operaciones sensibles |

Valores: `pwd` \| `google` \| `microsoft`.

**Ejemplo tras login Google + step-up contraseña + refresh:**

```json
{
  "sid": "550e8400-e29b-41d4-a716-446655440000",
  "session_amr": "google",
  "recent_amr": "pwd",
  "auth_time": 1783520100
}
```

**Regla de oro:** el step-up **nunca** modifica `session_amr`. Solo actualiza `recent_amr` y `auth_time`.

**Compatibilidad OIDC (opcional):** se puede emitir además claim `amr` como array JSON `["google","pwd"]` para depuración; **no** usarlo para revocación ni autorización — solo `session_amr` / `recent_amr`.

| Evento | `sid` | `auth_time` | `session_amr` | `recent_amr` |
|--------|-------|-------------|---------------|--------------|
| Login email/password | **nuevo** UUID | `now` | `pwd` | `pwd` |
| OAuth login (`/exchange`) | **nuevo** UUID | `now` | `google`/`microsoft` | igual que `session_amr` |
| `POST /step-up/password` | **sin cambio** | `now` | **sin cambio** | `pwd` |
| OAuth step-up | **sin cambio** | `now` | **sin cambio** | proveedor usado |
| `POST /token/refresh` | **sin cambio** | ver §4.5.3b (`auth_session`) | **sin cambio** | elevar desde `auth_session` si aplica |
| Forgot-password → reset (nuevo login) | **nuevo** UUID | `now` | `pwd` | `pwd` |

**Ventana de validez** (configurable):

```json
"Authentication": {
  "RecentAuthMaxAgeMinutes": 15
}
```

**Filtro / atributo:** `[RequireRecentAuthentication]` en endpoints sensibles.

Si `UtcNow - auth_time > RecentAuthMaxAgeMinutes`:

```http
HTTP/1.1 403 Forbidden
```

```json
{
  "errors": [{
    "status": 403,
    "title": "Acceso denegado",
    "detail": "Por seguridad, confirma tu identidad antes de continuar.",
    "code": "recent_authentication_required",
    "stepUpMethods": ["password", "google"]
  }]
}
```

`stepUpMethods` indica qué puede usar el frontend (password si `HasLocalPassword`; proveedores OAuth ya vinculados).

#### 4.5.3b Step-up, `auth_session` y `POST /api/token/refresh` (D-V2-15, D-V2-17)

**Contexto V1:** `POST /api/token/refresh` presenta el JWT actual y recibe uno nuevo. No hay refresh token opaco aparte.

**Dos problemas a cerrar:**

| # | Problema | Sin `auth_session` |
|---|----------|-------------------|
| A | Misma sesión: refresh con JWT pre-step-up pierde elevación | JWT antiguo mismo `sid` → leer `recent_auth_at` de **esa** sesión en BD |
| B | **Cross-session:** step-up en sesión B eleva JWT robado de sesión A | **Nunca** usar campos globales en `usuario` |

**Decisión V2 (defensa en dos capas):**

| Capa | Responsable | Comportamiento |
|------|-------------|----------------|
| **Cliente** | Frontend | Tras step-up, **reemplazar** el JWT almacenado por el de la respuesta (mismo `sid`). |
| **Servidor** | `AuthService` | Estado en `auth_session` keyed por `sid`; refresh solo eleva la sesión del JWT presentado. |

**Step-up — SQL lógico:**

```sql
UPDATE auth_session
SET recent_auth_at = @now,
    recent_amr = @method,
    updated_at = @now
WHERE session_id = @jwt_sid
  AND user_id = @jwt_sub
  AND revoked_at IS NULL;
```

**`POST /api/token/refresh` — pseudocódigo:**

```text
1. Validar JWT entrante (firma, exp, security_stamp).
2. sid = JWT.sid; si falta → 401 (tokens V2 deben tener sid).
3. session = auth_session WHERE session_id = sid AND user_id = sub.
4. si session == null OR session.revoked_at != null → 401.
5. incoming_auth_time = JWT.auth_time
6. session_auth_time = session.recent_auth_at (Unix); si UtcNow - session.recent_auth_at > RecentAuthMaxAgeMinutes → session_auth_time = 0
7. auth_time_claim = max(incoming_auth_time, session_auth_time)
8. recent_amr_claim = session.recent_amr si session_auth_time ganó; si no, JWT.recent_amr
9. session_amr_claim = session.session_amr  -- nunca del step-up
10. Emitir JWT con mismo sid, claims actualizados.
```

**Nunca:** `auth_time_claim = max(incoming, usuario.recent_auth_at)` — **prohibido** (elevación cross-session).

**Login / OAuth `/exchange`:** crear nueva `auth_session` + nuevo `sid` en cada emisión inicial.

**Rotación `SecurityStamp` total (política B §4.6.4):** `UPDATE auth_session SET revoked_at = now, revoked_reason = 'security_stamp_rotated' WHERE user_id = @id` + rotar sello en `usuario`. En cambio de contraseña aplica la **política A** (§4.6.4): se excluye `JWT.sid` y la sesión actual recibe nuevo JWT.

**Qué no hace el refresh:** no pone `auth_time = now` sin step-up; solo reconcilia JWT entrante con el estado de **su** `auth_session`.

#### 4.5.3c Step-up reutilizable y `PUT /password` (D-V2-19)

**Problema:** combinar `[RequireRecentAuthentication]` + `currentPassword` obligatorio en `PUT /api/account/password` duplica verificación si el flujo es:

```text
1. POST /api/account/step-up/password   ← usuario ingresa contraseña actual
2. PUT  /api/account/password           ← vuelve a pedir currentPassword
```

Eso obliga a escribir la contraseña **dos veces seguidas** sin beneficio de seguridad adicional.

**Decisión V2 — Opción A (step-up reutilizable):**

Si el JWT tiene autenticación reciente **con contraseña** (`recent_amr = pwd` dentro de la ventana), esa verificación **sustituye** `currentPassword` en el `PUT`. El body solo necesita `newPassword`.

| Condición en JWT (ventana activa) | `PUT /password` — body |
|-----------------------------------|------------------------|
| `recent_amr = pwd` (login password, o `POST /step-up/password` reciente) | `{ "newPassword": "..." }` — **sin** `currentPassword` |
| `recent_amr = google` \| `microsoft` (solo step-up OAuth) | `{ "currentPassword": "...", "newPassword": "..." }` — contraseña **no** demostrada aún |
| Sin `auth_time` reciente | `403 recent_authentication_required` — antes de validar el body |

**Flujo UX recomendado (cambiar contraseña):**

```text
Usuario pulsa "Cambiar contraseña"
  → si requiresStepUp: modal step-up
       → elige contraseña → POST /step-up/password → JWT con recent_amr=pwd
  → formulario solo con "Nueva contraseña" + confirmación
  → PUT /password { newPassword }   ← una sola vez la contraseña actual (en step-up)
```

Si el usuario prefiere step-up OAuth (cuenta híbrida), el formulario de cambio **sí** incluye `currentPassword`.

**Pseudocódigo `ChangePasswordAsync`:**

```text
[RequireRecentAuthentication]  -- auth_time en ventana

if !user.HasLocalPassword → 400 password_not_set

passwordProvenByStepUp = (JWT.recent_amr == "pwd")

if passwordProvenByStepUp:
  -- No re-verificar hash; step-up/password o login reciente con pwd ya lo hizo
  if dto.CurrentPassword != null → ignorar (no obligatorio)
  aplicar newPassword
else:
  if string.IsNullOrEmpty(dto.CurrentPassword) → 400 current_password_required
  if !VerifyHash(dto.CurrentPassword) → 401
  aplicar newPassword

-- Política A (§4.6.4): la sesión actual sobrevive
rotar usuario.security_stamp
revocar auth_session del user_id EXCEPTO JWT.sid (revoked_reason = password_changed)
UPDATE auth_session actual: security_stamp_snapshot = nuevo sello
emitir nuevo JWT (mismo sid) → devolver en respuesta
```

**Seguridad:** `recent_amr=pwd` solo lo fija el servidor tras verificar hash en login o `POST /step-up/password` (y se persiste en `auth_session`); el cliente no puede “declararlo” sin JWT firmado + fila BD coherente.

**Alternativas descartadas:**

| Opción | Motivo |
|--------|--------|
| Siempre exigir `currentPassword` en `PUT` además del step-up | UX duplicada (contraseña dos veces) |
| `currentPassword` nullable “a veces” sin regla clara | Ambiguo; la regla es **`recent_amr`** |

**Sin cambio:** `POST /api/account/password` (primera contraseña) sigue con solo `newPassword` + step-up previo (OAuth o forgot-password fuera de banda).

#### 4.5.4 Endpoints de step-up

**Re-verificación por contraseña** (cuentas con `HasLocalPassword`):

```http
POST /api/account/step-up/password
Authorization: Bearer {jwt}
Content-Type: application/json

{ "password": "contraseña-actual" }
```

**Respuesta 200:** mismo contrato que login/refresh — **`LoginResponseDto` completo** (no solo el access token):

```json
{
  "data": {
    "token": "eyJ...",
    "authTime": 1720441200,
    "requiresTenantSetup": false
  }
}
```

**Efectos servidor:**

1. Verificar contraseña actual.
2. `UPDATE auth_session` para `JWT.sid`: `recent_auth_at = now`, `recent_amr = pwd` (§4.1b).
3. Emitir JWT: **mismo `sid`**, `auth_time = now`, `recent_amr = pwd`, `session_amr` sin cambio.
4. **No** rotar `SecurityStamp`.

**Frontend (obligatorio):** sustituir el JWT almacenado por `data.token` **antes** de reintentar la operación sensible o de llamar `/token/refresh`.

Tras step-up con contraseña, operaciones como **`PUT /api/account/password`** no deben volver a pedir la contraseña actual (D-V2-19, §4.5.3c).

**Re-verificación por OAuth** (cuentas OAuth-only o preferencia del usuario):

```http
POST /api/auth/external/{provider}/step-up/start
Authorization: Bearer {jwt}
Content-Type: application/json

{
  "returnUrl": "/account/security"
}
```

**Respuesta 200:**

```json
{
  "data": {
    "authorizationUrl": "https://login.microsoftonline.com/..."
  }
}
```

- `provider` debe ser un proveedor **ya vinculado** a la cuenta (no sirve para añadir uno nuevo).
- `authorizationUrl` incluye `prompt=login` y `max_age=0` (Google) / equivalente Microsoft.
- Callback con `intent=StepUp`: valida terna IdP → `UPDATE auth_session` por `JWT.sid` → JWT con mismo `sid`, `recent_amr` renovado, `session_amr` intacto.

Ampliar enum:

```csharp
public enum ExternalAuthIntent
{
    Auto = 0,
    Login = 1,
    Register = 2,
    Link = 3,
    StepUp = 4    // V2.0 — solo renovar auth_time, sin crear vínculo
}
```

#### 4.5.5 Flujo UX recomendado (frontend)

Antes de cualquier acción sensible en `/account/security`:

1. Usuario pulsa “Vincular Microsoft” / “Desvincular Google” / “Establecer contraseña” / etc.
2. Si `requiresStepUp === true` (derivado de `auth_time` o respuesta `403`), mostrar modal:

```text
Por seguridad, confirma tu identidad para continuar.

[Introducir contraseña]     (si hasLocalPassword)
[Continuar con Google]      (si google vinculado)
[Continuar con Microsoft]   (si microsoft vinculado)
```

[Continuar con Google]      (si google vinculado — step-up, no vincular)
[Continuar con Microsoft]   (si microsoft vinculado — step-up, no vincular)
```

> Para **vincular un proveedor nuevo**, el step-up debe usar un método **distinto** al que se va a añadir (§4.5.7).

3. Tras step-up exitoso, **reemplazar JWT** (§4.5.3b) y ejecutar la operación solicitada (`link/start`, `DELETE`, etc.).

#### 4.5.6 Escenario de ataque: sesión abierta + proveedor ajeno

**Ataque que se debe impedir:**

```text
1. Atacante encuentra sesión JWT de la víctima (equipo desbloqueado).
2. Pulsa “Vincular Google” sin re-autenticarse con un método de la víctima.
3. Inicia OAuth del proveedor nuevo; se autentica con SU propia cuenta Google/Microsoft.
4. Si el sistema aceptara solo prompt=login del proveedor nuevo como “step-up”,
   el IdP validaría al atacante — no al dueño de la sesión DataColor.
5. Riesgo: vincular identidad del atacante a la cuenta de la víctima
   (mitigado además por match de email, pero insuficiente por sí solo).
```

**Por qué `prompt=login` en el proveedor nuevo NO basta:** demuestra control de **esa** cuenta IdP, no que quien tiene el JWT es el dueño de la cuenta DataColor.

#### 4.5.7 Vincular proveedor nuevo — flujo equilibrado (D-V2-12, D-V2-20)

**Problema de producto:** un flujo con **cuatro** pasos de verificación (step-up → OAuth → pantalla → **email con enlace**) es muy seguro, pero para una vinculación rutinaria puede sentirse excesivo: el usuario confirma contraseña, entra al IdP, confirma en pantalla, abre Gmail, pulsa otro enlace y regresa — alto riesgo de abandono y tickets de soporte.

**Comparación:**

| Flujo (descartado V2.0) | Flujo equilibrado **V2.0** |
|-------------------------|----------------------------|
| Step-up → OAuth → revisión → **correo confirmación** → vínculo activo | Step-up → OAuth → revisión → **vínculo activo** → email **informativo** |

**Tres controles obligatorios** (ninguno sustituye a otro):

| Capa | Cuándo | Qué demuestra |
|------|--------|----------------|
| **1. Step-up obligatorio** | Antes de `POST .../link/start` — `[RequireRecentAuthentication]` | El titular de la sesión controla un método **ya existente** |
| **2. Re-auth en IdP nuevo** | `authorizationUrl` — `prompt=login` + `max_age=0` | Pasó por el selector del IdP (insuficiente solo — ver capa 3) |
| **3. Confirmación en pantalla** | Tras callback; **antes** de `INSERT user_external_login` | El usuario **ve y confirma** qué identidad externa se vincula (D-V2-13) |

**Post-vínculo (no bloqueante):** email **informativo** de seguridad al `usuario.email` — avisa que se añadió un método de acceso; incluye enlace a `/account/security` para desvincular si no fue el titular. **No** requiere clic para activar el vínculo.

**Por qué hace falta la capa 3:** el selector del IdP no es consentimiento fiable — sesión reutilizada, varias cuentas, proveedor equivocado. La pantalla DataColor deja constancia explícita en UX y auditoría.

**Flujo V2.0:**

```text
step-up (método existente)
  → link/start → OAuth (proveedor nuevo)
  → callback → INSERT ExternalAuthPendingLink (sin user_external_login)
  → redirect ?flowCode=
  → POST /flow/resolve → flow: link_pending_review
  → pantalla "Vas a vincular Google wrar@... con william@empresa.com"
  → POST /link/complete → INSERT user_external_login + completed_at
  → (async) email informativo "Se añadió {provider} a tu cuenta"
```

**Pantalla de confirmación (frontend)** — ejemplo copy:

```text
Vas a vincular:

  Google
  wrar2014@gmail.com

con tu cuenta:

  william@empresa.com

[Confirmar vinculación]   [Cancelar]
```

**MVP / atajo no recomendado:** crear `user_external_login` directamente en el callback (sin capa 3) — el plan V2.0 **no** lo adopta: la pantalla del IdP sola no equivale a consentimiento auditable.

**Alternativa descartada para V2.0 — capa 4 (confirmación por email):**

```text
Step-up → OAuth → revisión → correo con enlace → vínculo activo
```

Reservada como opción **V2.2+** (`Q-V2-6`) para tenants con política estricta. Requeriría `POST /link/verify-email` y `verify_token_hash` en el pendiente.

**Email informativo** (tras `link/complete`, vía outbox — §5.3c):

```text
Asunto: Se añadió {provider} como método de acceso en DataColor

Se vinculó {provider} ({providerEmail}) a tu cuenta {accountEmail}.
Si fuiste tú, no necesitas hacer nada.
Si no reconoces esta acción, entra a Seguridad de la cuenta y desvincula el método.
```

#### 4.5.8 Otros escenarios mitigados

| Sin defensa en capas | Con V2 (§4.5.7) |
|----------------------|-----------------|
| Atacante con laptop desbloqueado vincula su Google sin step-up del dueño | `403` en `link/start` sin `auth_time` reciente vía método existente |
| Atacante con sesión robada pasa OAuth con su IdP | Step-up con método existente + pantalla de revisión; titular recibe **email informativo** y puede desvincular |
| Usuario vincula cuenta Google equivocada por sesión IdP reutilizada | Pantalla de revisión (capa 3) muestra email IdP real antes de confirmar |
| Atacante desvincula OAuth del dueño | Requiere step-up con método existente (15 min) |
| Atacante fija contraseña en cuenta OAuth-only | Requiere step-up con proveedor OAuth ya vinculado |

### 4.6 Revocación de sesiones al desvincular (política selectiva)

#### 4.6.1 Problema con rotar `SecurityStamp` siempre

Rotar `SecurityStamp` en cada unlink **invalida todos los JWT** del usuario. Es seguro ante compromiso total, pero perjudica la UX en el caso habitual:

```text
Usuario entra con contraseña → desvincula Google → queda expulsado de la sesión que acaba de usar.
```

Eso no es necesario si la sesión activa **no** dependía del proveedor eliminado.

#### 4.6.2 Política recomendada (D-V2-3)

| Acción al desvincular `{provider}` | Comportamiento |
|-----------------------------------|----------------|
| Revocar sesiones que **nacieron** con ese proveedor | Invalidar JWT con `session_amr == provider` eliminado (§4.6.3) |
| Mantener sesión actual | Si `session_amr ≠ provider` eliminado (p. ej. `session_amr=pwd`, unlink Google) |
| **No** usar `recent_amr` para revocación | Step-up con contraseña **no** “convierte” una sesión Google en sesión password |
| Rotación `SecurityStamp` | **Nunca** en unlink rutinario; cambio de contraseña → política A; compromiso / “cerrar todas” → política B (§4.6.4) |

#### 4.6.3 Implementación técnica — `session_amr` vs `recent_amr` (D-V2-16)

| Claim | Significado | ¿Cambia en step-up? | Uso principal |
|-------|-------------|---------------------|---------------|
| `session_amr` | Método con el que se **emitió** la sesión (login/OAuth) | **No** | Revocación selectiva al unlink |
| `recent_amr` | Último método de re-autenticación fuerte | **Sí** | `[RequireRecentAuthentication]` |

**Ejemplo crítico:**

```text
1. Login con Google        → session_amr=google, recent_amr=google
2. Step-up con contraseña  → session_amr=google, recent_amr=pwd  (sin cambiar origen)
3. DELETE /google          → 204 OK (step-up válido por recent_amr)
4. Siguiente petición API  → 401 session_revoked_provider_unlinked
   (session_amr sigue siendo google → revocada al desvincular)
```

El dueño debe **volver a entrar con contraseña** (u otro método vigente). Eso es correcto: la sesión dependía de Google.

**Caso UX favorable (sin expulsión):**

```text
Login con contraseña → session_amr=pwd
Step-up con contraseña → recent_amr=pwd
DELETE /google → sesión sigue válida (session_amr ≠ google)
```

**Registro de revocación:** **no** se usa tabla `user_auth_provider_revocation`. Al desvincular, se revocan directamente las filas `auth_session` con `session_amr` igual al proveedor eliminado (§4.1b).

Al desvincular Google en `T_revoke`:

1. `DELETE user_external_login` (google)
2. `UPDATE auth_session SET revoked_at = T_revoke, revoked_reason = 'provider_unlinked' WHERE user_id = X AND session_amr = 'google' AND revoked_at IS NULL`
3. **No** rotar `SecurityStamp` (caso normal)

**Validación en middleware** (`AuthSessionValidationMiddleware`):

```text
sid = JWT.sid
si sid ausente → 401 (tokens V2 requieren sid)

session = auth_session WHERE session_id = sid AND user_id = JWT.sub
si session == null OR session.revoked_at != null:
  si session.revoked_reason == 'provider_unlinked' → 401 session_revoked_provider_unlinked
  sino → 401 session_revoked
si session.expires_at != null AND UtcNow > session.expires_at → 401 session_expired
si usuario.security_stamp != session.security_stamp_snapshot → 401 (sello rotado)

-- NO comparar JWT.session_amr con tabla auxiliar de revocación por proveedor
-- La fila auth_session ya refleja revoked_at tras unlink

opcional (throttled, p. ej. cada 5 min):
  UPDATE auth_session SET last_seen_at = UtcNow WHERE id = session.id
```

En `POST /token/refresh`: misma validación por `sid`; rechazar si revocada; emitir JWT con **mismo `sid`**; actualizar `issued_at`, `security_stamp_snapshot` si aplica.

**Petición `DELETE` que ejecuta el unlink:** responde `204` aunque `session_amr` sea el proveedor eliminado; la revocación de **otras** sesiones `session_amr=google` es inmediata; la sesión del JWT que ejecutó el unlink solo falla en la **siguiente** petición si su `session_amr` era el proveedor eliminado.

#### 4.6.4 Rotación de `SecurityStamp` — dos políticas distintas (D-V2-23)

Rotar el sello y revocar sesiones **no** es una sola política. Hay que distinguir si la **sesión actual sobrevive**:

| Política | Sesión actual | Demás sesiones | Cuándo |
|----------|---------------|----------------|--------|
| **A — Rotación preservando sesión actual** | **Sobrevive** — se actualiza su `security_stamp_snapshot` y se emite **nuevo JWT** en la misma respuesta | Revocadas (`revoked_reason = 'password_changed'`) | Cambio de contraseña, primera contraseña — el usuario que ejecuta la acción es legítimo (paso step-up); expulsarlo sería castigo sin beneficio |
| **B — Rotación total (compromiso)** | **Revocada también** — el usuario debe volver a autenticarse | Revocadas (`revoked_reason = 'security_stamp_rotated'`) | Señal de compromiso (soporte, fraude), “cerrar todas las sesiones”, admin suspende cuenta |

**Política A — pasos (cambio de contraseña):**

```text
1. Rotar usuario.security_stamp.
2. Revocar todas las auth_session del user_id EXCEPTO session_id = JWT.sid
   (revoked_reason = 'password_changed').
3. UPDATE auth_session actual: security_stamp_snapshot = nuevo sello.
4. Emitir nuevo JWT para la sesión actual (mismo sid, sello nuevo embebido/validable).
5. Devolver el token en la respuesta — el frontend lo reemplaza de inmediato.
```

Así el usuario **no queda expulsado**, todas las demás sesiones pierden acceso, y el JWT actual no queda desfasado con el nuevo sello (el middleware §4.6.3 compara `usuario.security_stamp` vs `session.security_stamp_snapshot`; sin el paso 3-4 la propia sesión fallaría en la siguiente petición).

**Política B — pasos (compromiso / cerrar todas):**

```text
1. Rotar usuario.security_stamp.
2. Revocar TODAS las auth_session del user_id (incluida la actual)
   con revoked_reason = 'security_stamp_rotated'.
3. No emitir JWT — 401 en la siguiente petición; re-login obligatorio.
```

**Matriz de eventos:**

| Evento | Política |
|--------|----------|
| Unlink rutinario con otros métodos disponibles | Ninguna — revocación selectiva por `session_amr` (§4.6.2), sin rotar sello |
| Cambio de contraseña (`PUT /api/account/password`) | **A** — preservar sesión actual |
| Establecer primera contraseña (`POST /api/account/password`, cuenta OAuth-only) | **A** — preservar sesión actual |
| `forgot-password` → `reset-password` (sin sesión) | **B** — no hay sesión actual que preservar; revocar todas |
| Usuario pulsa “cerrar todas las sesiones” (V2.2) | **B** |
| Señal explícita de compromiso (soporte, fraude) | **B** |
| Unlink del **último** método OAuth sin password (bloqueado por `LAST_AUTH_METHOD`) | N/A — operación rechazada |
| Admin suspende cuenta | **B** (ya existe) |

#### 4.6.5 Escenario de ataque vs UX

| Escenario | Sin política selectiva | Con `session_amr` + revocación selectiva |
|-----------|------------------------|------------------------------------------|
| JWT robado emitido vía Google | Unlink rota todo | Revoca `session_amr=google` ✓ |
| Sesión `session_amr=pwd` desvincula Google | Expulsado innecesariamente | Sigue en sesión ✓ |
| Sesión `session_amr=google`, step-up pwd, unlink Google | Si se usara `recent_amr` para revocar, quedaría activa ✗ | Fila `auth_session` revocada (`provider_unlinked`) ✓ |

---

## 5. API — contratos detallados (V2.0)

### 5.1 Listar métodos de acceso (D-V2-10)

El objetivo funcional es mostrar **métodos de acceso**, no solo identidades OAuth. La ruta vive bajo `/api/account/` porque describe la cuenta del usuario, no el protocolo OAuth.

```http
GET /api/account/authentication-methods
Authorization: Bearer {jwt}
```

**Respuesta 200:**

```json
{
  "data": {
    "methods": [
      {
        "type": "password",
        "configured": true,
        "canRemove": false
      },
      {
        "type": "external",
        "provider": "google",
        "email": "william@gmail.com",
        "linked": true,
        "linkedAt": "2026-07-08T12:00:00Z",
        "lastLoginAt": "2026-07-08T15:30:00Z",
        "canUnlink": true
      },
      {
        "type": "external",
        "provider": "microsoft",
        "linked": false,
        "canLink": true
      }
    ],
    "requiresStepUp": true,
    "authTime": "2026-07-08T15:20:00Z",
    "recentAuthMaxAgeMinutes": 15
  }
}
```

**Modelo polimórfico por `type`:**

| `type` | V2.0 | Campos principales |
|--------|------|-------------------|
| `password` | Sí | `configured`, `canRemove` (siempre `false` en V2.0), `canConfigure` si `!configured` |
| `external` | Sí | `provider`, `linked`, `email` (si vinculado), `canLink` / `canUnlink` |
| `passkey` | Futuro | `configured`, `credentials[]` |
| `totp` / `backup_codes` | Futuro | Segundo factor |
| `saml` / `enterprise` | Futuro | SSO corporativo |

El array `methods` es la **fuente de verdad** para la pantalla `/account/security`. Evita acoplar la UI a “proveedores OAuth” cuando el producto ya contempla contraseña local y tipos futuros.

**Ejemplo — cuenta OAuth-only (sin contraseña):**

```json
{
  "type": "password",
  "configured": false,
  "canConfigure": true,
  "canRemove": false
}
```

**Reglas de negocio:**

| Campo | Regla |
|-------|-------|
| `password.configured` | `user.HasLocalPassword` |
| `password.canConfigure` | `!configured` y usuario elegible (`Active`; ver Q-V2-1 para `PendingTenantSetup`) |
| `password.canRemove` | Siempre `false` en V2.0 — desactivar contraseña no está soportado |
| `external.linked` | Existe fila en `user_external_login` para ese `provider` |
| `external.canLink` | `linked == false`, proveedor habilitado en `ExternalAuth:Enabled`, usuario no `Internal` |
| `external.canUnlink` | `linked == true` y quedaría al menos un método tras el unlink (no violar `LAST_AUTH_METHOD`) |
| `external.email` | Solo si `linked`; no exponer `issuer` ni `subject` |

`requiresStepUp`: `true` si `UtcNow - authTime > RecentAuthMaxAgeMinutes` (el frontend puede calcularlo con `authTime` del JWT).

**Orden sugerido en `methods`:** `password` primero; luego externos en orden estable (`google`, `microsoft`, … según config).

**Extensibilidad futura (sin breaking change):** nuevos `type` se añaden al array; clientes que no los reconozcan pueden ignorarlos o mostrar “Método no soportado en esta versión”.

---

### 5.1b Semántica HTTP — endpoints `*/start` (D-V2-22)

Los endpoints que **inician** OAuth crean estado en servidor (`external_auth_session`, `state`, URL de autorización). Por semántica HTTP deben ser **`POST`**, no `GET`:

| Riesgo de `GET` | Consecuencia |
|-----------------|--------------|
| Prefetch del navegador | Inicia OAuth sin intención del usuario |
| Reintento de proxies / CDNs | Sesiones OAuth duplicadas o `state` inválido |
| Caché incorrecta | Respuestas obsoletas con `authorizationUrl` |
| Preview de enlaces (Slack, email) | Dispara flujo OAuth al abrir preview |
| Idempotencia mal asumida | Operación con efectos secundarios tratada como “segura” |

**Regla:** todo `*/start` que persiste sesión OAuth → **`POST`** + cuerpo JSON (`returnUrl` y parámetros de flujo). El **callback** del IdP sigue siendo `GET` (redirect del proveedor).

| Endpoint | Método V2 | Auth |
|----------|-----------|------|
| `/api/auth/external/{provider}/start` | **POST** | `AllowAnonymous` — login/registro (alinear V1; ver plan Google/Microsoft §6.1) |
| `/api/auth/external/{provider}/link/start` | **POST** | JWT + `[RequireRecentAuthentication]` |
| `/api/auth/external/{provider}/step-up/start` | **POST** | JWT + step-up previo recomendado |

**DTO compartido (mínimo):**

```json
{
  "returnUrl": "/account/security"
}
```

Login/registro añade opcionalmente `intent`, `invitationToken` en el mismo cuerpo (no query string).

**V1 implementado:** `ExternalAuthController` expone `[HttpGet("{provider}/start")]`. **Migración:** cambiar a `POST` antes o durante V2.0; actualizar frontend y guías. No mantener GET paralelo salvo deprecación explícita con fecha.

---

### 5.2 Iniciar vinculación (autenticado + step-up obligatorio)

```http
POST /api/auth/external/{provider}/link/start
Authorization: Bearer {jwt}
Content-Type: application/json

{
  "returnUrl": "/account/security"
}
```

**Atributo:** `[RequireRecentAuthentication]` — **obligatorio siempre**. No hay excepción por `prompt=login` en el flujo posterior (D-V2-12).

**Requisitos de seguridad:**

1. JWT con `auth_time` dentro de la ventana — renovado por step-up con método **ya existente** (§4.5.7 capa 1).
2. El proveedor solicitado **no** puede usarse para el step-up previo (p. ej. para vincular Microsoft, el step-up debe ser contraseña o Google ya vinculado).
3. `prompt=login` + `max_age=0` en la URL de autorización del proveedor **nuevo** (capa 2) — complementa, no reemplaza, el step-up.

**Cuerpo JSON:**

| Campo | Obligatorio | Descripción |
|-------|-------------|-------------|
| `returnUrl` | No | Ruta frontend tras éxito (allowlist: `/account/security`, `/dashboard`, etc.) |

**Respuesta 200:** `{ "data": { "authorizationUrl": "..." } }`.

**Errores:**

| HTTP | Código | Cuándo |
|------|--------|--------|
| 400 | `external_auth_provider_invalid` | Proveedor no soportado |
| 409 | `external_auth_provider_already_linked` | Ya tiene ese proveedor |
| 403 | `account_inactive` | Usuario no `Active` / `PendingTenantSetup` con política restringida |
| 403 | `recent_authentication_required` | `auth_time` expirado — step-up con método existente obligatorio |
| 403 | `external_auth_link_step_up_wrong_provider` | Intento de step-up con el mismo proveedor que se quiere vincular |

**Implementación `StartLinkAsync`:**

1. Resolver `userId` del JWT
2. Verificar usuario elegible (`Active` o `PendingTenantSetup` según política)
3. Verificar proveedor no vinculado
4. Crear `external_auth_session` con `Intent = Link`, `UserId = userId`
5. Devolver `authorizationUrl` con **`prompt=login`** y **`max_age=0`** (Google) o `prompt=login` (Microsoft)

---

### 5.3 Callback OAuth — rama `Link`

Extender `CompleteCallbackAsync`:

```text
si session.Intent == Link AND session.UserId != null:
  → CompleteLinkCallbackAsync(provider, code, state, session)
  → NO llamar ResolveAsync (evita conflicto EMAIL_ALREADY_EXISTS)
```

**`CompleteLinkCallbackAsync` — validaciones:**

1. `session.UserId` existe y usuario no bloqueado
2. Intercambiar `code` por perfil IdP
3. `profile.EmailVerified == true`
4. `(provider, issuer, subject)` no vinculado a **otro** `user_id` — **no** exigir coincidencia de email IdP con `user.email` (D-V2-24)
5. Usuario no tiene ya vínculo para ese `provider`
6. **No** crear `UserExternalLogin` — insertar `ExternalAuthPendingLink` (§4.3b)
7. Auditoría: `ExternalAuthProviderLinkRequested`
8. Redirect: `{returnUrl}?flowCode={opaque}` — el frontend resuelve con `POST /flow/resolve` (§5.3a)

### 5.3a Resolver flujo — revisión de identidad IdP

Tras redirect con `flowCode`, el frontend llama:

```http
POST /api/auth/external/flow/resolve
Content-Type: application/json

{ "flowCode": "abc123" }
```

**Respuesta 200 — pendiente de confirmación en pantalla:**

```json
{
  "data": {
    "flow": "link_pending_review",
    "provider": "google",
    "providerEmail": "wrar2014@gmail.com",
    "accountEmail": "william@empresa.com",
    "pendingLinkToken": "opaque-for-complete-only"
  }
}
```

- `flowCode` **consumido** (un solo uso)
- `pendingLinkToken` solo en el **cuerpo** — TTL hasta `expires_at` del pendiente; hash en BD
- Mostrar pantalla §4.5.7 (Confirmar / Cancelar)

**Errores:** `400 external_auth_flow_invalid` si `flowCode` expirado o ya usado.

---

### 5.3b Confirmar identidad en pantalla (`link/complete`)

```http
POST /api/auth/external/link/complete
Authorization: Bearer {jwt}
Content-Type: application/json

{
  "pendingLinkToken": "opaque-for-complete-only"
}
```

**Precondiciones:**

- JWT del mismo `user_id` que el pendiente
- `ExternalAuthPendingLink` activo (`ui_confirmed_at` null, no expirado)
- `[RequireRecentAuthentication]` recomendado si pasó tiempo desde step-up (opcional endurecer)

**Respuesta 200:**

```json
{
  "data": {
    "message": "Microsoft se vinculó correctamente a tu cuenta.",
    "provider": "microsoft",
    "accountEmail": "william@empresa.com"
  }
}
```

**Efectos:**

- `ui_confirmed_at = now`; `completed_at = now`
- **`INSERT user_external_login`** desde datos del pendiente (vínculo **activo**)
- Encolar email **informativo** de seguridad (async, §5.3c) — no bloquea la respuesta
- Archivar o eliminar `ExternalAuthPendingLink`
- Auditoría: `ExternalAuthProviderLinkReviewConfirmed` + `ExternalAuthProviderLinkConfirmed`
- `SecurityStamp` **no** rota (adición de método, no compromiso detectado)

**Cancelar** (descartar pendiente):

```http
POST /api/auth/external/link/cancel
Authorization: Bearer {jwt}
Content-Type: application/json

{ "pendingLinkToken": "opaque-for-complete-only" }
```

**Errores:**

| HTTP | Código | Cuándo |
|------|--------|--------|
| 400 | `external_auth_link_pending_invalid` | Token inexistente, expirado o ya confirmado/cancelado |
| 403 | `external_auth_link_pending_user_mismatch` | JWT no corresponde al `user_id` del pendiente |
| 409 | `external_auth_provider_already_linked` | Vínculo ya activo (race) |

---

### 5.3c Email informativo de seguridad (post-vínculo)

Tras `POST /link/complete` exitoso, el worker de notificaciones envía un correo al **`usuario.email`** principal. Es **informativo** — el vínculo ya está activo; no hay token ni enlace de confirmación obligatorio.

| Propiedad | Valor |
|-----------|-------|
| Disparador | `ExternalAuthProviderLinkConfirmed` / outbox |
| Destinatario | `usuario.email` |
| Contenido | Proveedor, email IdP, cuenta destino, enlace a `/account/security` |
| Bloqueante | **No** — fallo de envío no revierte el vínculo |

Plantilla sugerida: §4.5.7 (email informativo).

---

### 5.3d `link/verify-email` — no incluido en V2.0

> **Estado V2.0:** **no implementar** `POST /api/auth/external/link/verify-email` en el MVP de cuenta híbrida autenticada. El flujo de cuatro capas con confirmación por correo quedó **descartado** por UX (§4.5.7, D-V2-20).

Si producto activa modo estricto en **V2.2+** (`Q-V2-6`), el contrato sería: pendiente tras `link/complete` hasta `verify-email` con token de un solo uso. Hasta entonces, no añadir `verify_token_hash` ni rate limit en ruta inexistente.

---

### 5.4 Desvincular proveedor (requiere autenticación reciente)

```http
DELETE /api/auth/external/{provider}
Authorization: Bearer {jwt}
```

**Atributo:** `[RequireRecentAuthentication]` — el JWT debe tener `auth_time` dentro de la ventana configurada.

Si no es reciente → `403 recent_authentication_required` con `stepUpMethods` (ver §4.5.3).

**Respuesta 204** sin cuerpo. La sesión del JWT que ejecutó el `DELETE` **permanece válida en esa respuesta**; si `session_amr` era el proveedor eliminado, las **siguientes** peticiones fallan (§4.6.3).

**Errores:**

| HTTP | Código | Cuándo |
|------|--------|--------|
| 403 | `recent_authentication_required` | Sesión JWT válida pero `auth_time` demasiado antiguo |
| 404 | `external_auth_provider_not_linked` | No hay vínculo |
| 409 | `external_auth_last_auth_method` | Quedaría sin ningún método de acceso |
| 403 | `account_inactive` | Cuenta bloqueada |

**Pseudocódigo `UnlinkProviderAsync`:**

```text
user = cargar con ExternalLogins
linked = vínculo del provider solicitado
if linked == null → 404

remainingOAuth = count(external_logins) - 1
hasPassword = user.HasLocalPassword

if !hasPassword && remainingOAuth == 0 → 409 LAST_AUTH_METHOD

DELETE user_external_login
UPDATE auth_session
  SET revoked_at = UtcNow, revoked_reason = 'provider_unlinked'
  WHERE user_id = @user_id AND session_amr = @provider AND revoked_at IS NULL
-- NO rotar SecurityStamp en unlink rutinario (§4.6)
INSERT audit_log ExternalAuthProviderUnlinked
SAVE

-- Respuesta 204: sesiones session_amr=provider quedan revocadas; la del JWT actual
-- solo falla en la siguiente petición si session_amr == provider eliminado
```

---

### 5.5 Contraseña local — dos endpoints distintos (D-V2-9)

V2 **no** mezcla “establecer primera contraseña” y “cambiar contraseña” en un solo contrato. Son operaciones diferentes con validaciones, auditoría y errores propios.

| Operación | Método y ruta | Cuándo |
|-----------|---------------|--------|
| **Establecer** la primera contraseña | `POST /api/account/password` | `!HasLocalPassword` (cuenta OAuth-only o sin hash) |
| **Cambiar** contraseña existente | `PUT /api/account/password` | `HasLocalPassword` |

**Migración desde V1:** `POST /api/account/change-password` queda **deprecado** en favor de `PUT /api/account/password`. Mantener el endpoint legacy solo durante transición si hace falta compatibilidad temporal.

Ambos requieren `[RequireRecentAuthentication]`.

---

### 5.5a Establecer primera contraseña

```http
POST /api/account/password
Authorization: Bearer {jwt}
Content-Type: application/json

{
  "newPassword": "MiClaveSegura1!"
}
```

**Precondiciones:**

- Usuario autenticado con `auth_time` reciente (step-up)
- `!HasLocalPassword` — si ya tiene contraseña → **`409 Conflict`** `password_already_set` (“Usa PUT para cambiar la contraseña”)

**Respuesta 200:**

```json
{
  "data": {
    "message": "Contraseña establecida correctamente.",
    "token": "nuevo-jwt",
    "otherSessionsRevoked": true
  }
}
```

**Efectos (política A — §4.6.4):**

- `PasswordHash` = hash PBKDF2 (primera vez)
- Rotar `SecurityStamp`; revocar las demás `auth_session` (`password_changed`); actualizar `security_stamp_snapshot` de la sesión actual
- Emitir nuevo JWT (mismo `sid`) con `recent_amr=pwd`; **`session_amr` sin cambio**
- `AuditLog`: **`LocalPasswordSet`**

**Frontend obligatorio:** reemplazar el JWT almacenado por `data.token`.

**Errores:**

| HTTP | Código | Cuándo |
|------|--------|--------|
| 403 | `recent_authentication_required` | Sin step-up |
| 409 | `password_already_set` | Ya tiene contraseña local |
| 400 | validación | `newPassword` no cumple política |

---

### 5.5b Cambiar contraseña existente (D-V2-19)

**Contrato según step-up reciente** — ver §4.5.3c:

**Caso A — step-up (o login) reciente con contraseña** (`recent_amr = pwd`):

```http
PUT /api/account/password
Authorization: Bearer {jwt}
Content-Type: application/json

{
  "newPassword": "ClaveNueva1!"
}
```

**Caso B — step-up reciente solo con OAuth** (`recent_amr = google` \| `microsoft`):

```http
PUT /api/account/password
Authorization: Bearer {jwt}
Content-Type: application/json

{
  "currentPassword": "ClaveActual1!",
  "newPassword": "ClaveNueva1!"
}
```

**Precondiciones:**

- `[RequireRecentAuthentication]` — `auth_time` dentro de la ventana
- `HasLocalPassword` — si no tiene contraseña → **`400`** `password_not_set`
- `currentPassword` **obligatorio solo** cuando `recent_amr ≠ pwd` (caso B)
- Si `recent_amr = pwd` y se envía `currentPassword` → **ignorado** (opcional; no error)

**DTO:** `ChangePasswordDto` — `newPassword` siempre requerido; `currentPassword` opcional en validación, obligatorio en runtime si `recent_amr ≠ pwd`.

**Respuesta 200:**

```json
{
  "data": {
    "message": "Contraseña actualizada correctamente.",
    "token": "nuevo-jwt",
    "otherSessionsRevoked": true
  }
}
```

`token` es el **nuevo JWT de la sesión actual** (mismo `sid`, coherente con el sello rotado). **Frontend obligatorio:** reemplazar el JWT almacenado por `data.token` de inmediato; el anterior deja de validar contra el nuevo `security_stamp`.

**Efectos (política A — §4.6.4):**

- Caso A: aplicar `newPassword` sin re-verificar hash (step-up ya demostró posesión)
- Caso B: verificar `currentPassword` contra hash actual
- `PasswordHash` = nuevo hash
- Rotar `SecurityStamp`; revocar las demás `auth_session` (`password_changed`); actualizar `security_stamp_snapshot` de la sesión actual; emitir nuevo JWT (mismo `sid`)
- `AuditLog`: **`LocalPasswordChanged`**

**Errores:**

| HTTP | Código | Cuándo |
|------|--------|--------|
| 403 | `recent_authentication_required` | Sin step-up / `auth_time` expirado |
| 400 | `password_not_set` | Cuenta sin contraseña local |
| 400 | `current_password_required` | `recent_amr ≠ pwd` y falta `currentPassword` |
| 401 | — | Caso B: `currentPassword` incorrecta |
| 400 | validación | `newPassword` no cumple política |

---

### 5.5c Flujos anónimos (sin cambio de ruta)

| Flujo | Sigue vigente | Step-up JWT |
|-------|---------------|-------------|
| `POST /api/account/forgot-password` | Sí — usuarios sin sesión | No (prueba por email) |
| `POST /api/account/reset-password` | Sí — crea o reemplaza contraseña con token | No (token de un solo uso) |

`reset-password` puede crear la **primera** contraseña en cuenta OAuth-only sin JWT; es el camino “fuera de banda” cuando el usuario no tiene sesión activa.

---

### 5.5d Step-up — re-verificación

Ver §4.5.4 para `POST /api/account/step-up/password` y `POST /api/auth/external/{provider}/step-up/start`.

---

### 5.5e Cambio de correo principal

`PUT /api/me` con cambio en campo `email`:

| Fase | Requisito |
|------|-----------|
| V2.0 | `[RequireRecentAuthentication]` + rechazar si no hay step-up |
| V2.2 | Flujo completo: verificación del **nuevo** correo antes de aplicar cambio (no confiar solo en IdP snapshot) |

---

### 5.6 Ampliación `GET /api/me`

`GET /api/me` conserva datos de **perfil**; el detalle de métodos de acceso y acciones (`canLink`, `canUnlink`, `canConfigure`) vive en `GET /api/account/authentication-methods` (§5.1).

Añadir a `UserProfileDto` solo un **resumen** para el resto de la app:

```json
{
  "hasLocalPassword": false,
  "authTime": "2026-07-08T15:20:00Z",
  "requiresStepUp": false
}
```

No duplicar en `/api/me` la lista completa de proveedores ni datos IdP sensibles (`issuer`, `subject`, snapshots).

---

### 5.7 Mejora `forgot-password` (copy, sin breaking change)

Comportamiento actual: envía email si `user.Status == Active`.

**V2.0 — ajuste opcional:**

- Permitir `PendingTenantSetup` si el producto quiere configurar contraseña **antes** de completar onboarding (decisión de producto; por defecto **no** en V2.0).
- Plantilla email distinta si `!HasLocalPassword`:

```text
Asunto: Crea tu contraseña en DataColor

Aún no tienes una contraseña configurada en tu cuenta.
Usa el enlace siguiente para crearla y poder acceder también con correo y contraseña.
```

---

## 6. API — V2.1 (vinculación en conflicto)

### 6.0 Política de redirect al frontend (D-V2-11)

**Problema:** transportar errores, tokens o contexto de negocio en la query string del callback expone datos en historial del navegador, logs del servidor, herramientas de analítica, reverse proxies, encabezado `Referer` y capturas de soporte — aunque el token sea “opaco”.

**Regla V2:** el redirect HTTP 302 al frontend lleva **como máximo** un código de intercambio:

```http
GET /auth/callback?flowCode=abc123
```

Nada más en la URL: ni `error=`, ni `linkChallengeToken=`, ni emails, ni `existingAuthMethod=`, ni `linked=`, ni JWT.

**Propiedades del `flowCode`:**

| Propiedad | Valor |
|-----------|-------|
| Generación | Aleatoria criptográficamente segura |
| Uso | **Un solo uso** — consumido al primer `POST` de resolución exitoso |
| TTL | Corto: **60 s** (login/exchange, link/step-up éxito); **10 min** (link challenge V2.1) |
| Almacenamiento | Hash en BD (PBKDF2/SHA-256); nunca plaintext |
| Vinculación | Ligado a `external_auth_session.state` / sesión OAuth; PKCE cuando el IdP lo soporte |

**Relación con V1:** el `exchangeCode` de login/registro (`POST /api/auth/external/exchange`) sigue el **mismo patrón** de seguridad. En unificación futura puede renombrarse a `flowCode`; mientras tanto son equivalentes en propiedades.

**Endpoints de resolución (el frontend siempre hace POST):**

| Flujo | POST | Respuesta (ejemplos) |
|-------|------|----------------------|
| Login / registro V1 | `/api/auth/external/exchange` | JWT, `authAction` |
| Link / step-up / error V2.0 | `/api/auth/external/flow/resolve` | `{ flow: "link_completed", provider }`, `{ flow: "step_up_completed" }`, `{ flow: "error", code, ... }` |
| Conflicto email V2.1 | `/api/auth/external/link/context` | Contexto de vinculación + `challengeToken` |

```mermaid
sequenceDiagram
  participant IdP as Google/Microsoft
  participant API as Backend
  participant FE as Frontend

  IdP->>API: GET /callback?code&state
  API->>API: Validar OAuth; persistir flowCode (hash)
  API-->>FE: 302 /auth/callback?flowCode=abc123
  FE->>API: POST /link/context { flowCode }
  API-->>FE: provider, maskedEmail, verificationMethods, challengeToken
  Note over FE: challengeToken solo en body — nunca en URL
  FE->>API: POST /link/confirm { challengeToken, password }
  API-->>FE: JWT + vínculo creado
```

**Ejemplo `POST /api/auth/external/flow/resolve` (V2.0 link/step-up/error):**

```json
{ "flowCode": "abc123" }
```

Respuestas posibles:

```json
{ "data": { "flow": "link_pending_review", "provider": "google", "providerEmail": "wrar2014@gmail.com", "accountEmail": "william@empresa.com", "pendingLinkToken": "..." } }
```

```json
{ "data": { "flow": "link_email_sent", "provider": "microsoft", "maskedAccountEmail": "w***@empresa.com" } }
```

```json
{ "data": { "flow": "link_completed", "provider": "microsoft" } }
```

```json
{ "data": { "flow": "step_up_completed", "provider": "google" } }
```

```json
{ "data": { "flow": "error", "code": "EXTERNAL_AUTH_PROVIDER_ALREADY_LINKED", "provider": "google" } }
```

> `EXTERNAL_AUTH_LINK_EMAIL_MISMATCH` quedó **obsoleto** en vinculación autenticada (D-V2-24).

---

**Qué NO va en la URL del callback:**

- `linkChallengeToken`, `challengeToken`, JWT, contraseñas
- `error=EXTERNAL_AUTH_*` ni códigos de negocio
- `existingAuthMethod`, `linkAvailable`, `provider` (salvo resolución server-side)
- `issuer` o `subject` del IdP en query string

---

### 6.1 Redirect en conflicto de email (V2.1)

Cuando `ResolveAsync` devolvería `EXTERNAL_AUTH_EMAIL_ALREADY_EXISTS` y el email IdP coincide con un usuario `Active` con otro método:

1. Persistir `ExternalAuthLinkChallenge` (`provider`, `issuer`, `subject`, email normalizado, `target_user_id`, TTL 10 min)
2. Generar `flowCode` opaco (hash en BD)
3. Redirect **únicamente**:

```http
GET /auth/callback?flowCode=abc123
```

El frontend **no** interpreta la URL más allá de extraer `flowCode`.

---

### 6.2 Obtener contexto seguro del challenge

```http
POST /api/auth/external/link/context
Content-Type: application/json

{
  "flowCode": "abc123"
}
```

**Respuesta 200:**

```json
{
  "data": {
    "flow": "link_challenge",
    "provider": "google",
    "existingAuthMethod": "local",
    "maskedEmail": "w***@empresa.com",
    "verificationMethods": ["password", "email"],
    "linkAvailable": true,
    "challengeToken": "opaque-for-confirm-only"
  }
}
```

**Efectos:**

- `flowCode` **consumido** (un solo uso)
- `challengeToken` emitido en el **cuerpo** — TTL 10 min, hash en BD; válido solo para `POST /link/confirm`
- No devolver email completo ni `issuer`/`subject` al frontend

**Errores:**

| HTTP | Código | Cuándo |
|------|--------|--------|
| 400 | `external_auth_flow_invalid` | `flowCode` inexistente, expirado o ya consumido |
| 409 | — | Challenge ya completado |

---

### 6.3 Confirmar vínculo

```http
POST /api/auth/external/link/confirm
Content-Type: application/json

{
  "challengeToken": "opaque-for-confirm-only",
  "verificationMethod": "password",
  "password": "contraseña-actual"
}
```

O:

```json
{
  "challengeToken": "opaque-for-confirm-only",
  "verificationMethod": "email",
  "emailVerificationToken": "token-del-correo"
}
```

**Respuesta 200:** JWT de sesión (`LoginResponseDto`) — el usuario queda logueado con el vínculo creado.

**Validaciones:**

- `challengeToken` no expirado ni consumido (nunca aceptar token por query string)
- Password correcta **o** token email válido para el mismo `user_id` del challenge
- Mismas reglas anti-colisión que §5.3
- **V2.1:** la pantalla tras `POST /link/context` cumple función de revisión (capa 3 análoga); `link/confirm` con contraseña o código email **sustituye el step-up JWT** del flujo autenticado (usuario sin sesión previa)

**Rate limiting:** aplicar `ExternalAuthRateLimitFilter` en `/link/context` y `/link/confirm`.

---

## 7. Seguridad

### 7.0 Autenticación reciente — regla transversal (D-V2-6)

**Un JWT válido no autoriza por sí solo** las operaciones listadas en §4.5.2. Para **vincular** (V2.0), se exigen **tres** capas de §4.5.7 (step-up, OAuth, confirmación en pantalla) + email informativo no bloqueante.

El **refresh** reconcilia `auth_time` solo con la `auth_session` del `sid` presentado (§4.5.3b, D-V2-17) — nunca con estado global del usuario.

### 7.1 Principios (heredados de D22 + step-up)

| Regla | Detalle |
|-------|---------|
| No auto-link por email | Sin JWT o challenge, nunca crear `user_external_login` en cuenta `Active` ajena |
| Email IdP debe coincidir | En link autenticado: `idp.email == usuario.email` normalizado |
| Identidad externa única | La terna **`(provider, issuer, subject)`** no puede vincularse a dos usuarios (D-V2-14) |
| Revocación selectiva al unlink | Revocar filas `auth_session` por `session_amr` (§4.1b, D-V2-18); no `recent_amr` |
| Rotación `SecurityStamp` | Cambio de contraseña → política A (§4.6.4): preservar sesión actual + nuevo JWT; compromiso / “cerrar todas” → política B: revocar todo — **no** en unlink rutinario |
| Rate limiting | `ExternalAuthRateLimitFilter` en `/link/start`, `/link/complete`, `/step-up/start`, `/link/context`, `/link/confirm` |
| Internal users | `UserType.Internal` **no** puede usar link OAuth en V2.0 (solo password) |
| Step-up obligatorio | Link, unlink, `POST/PUT /api/account/password`, cambio email principal |

### 7.2 Amenazas y mitigaciones

| Amenaza | Mitigación |
|---------|------------|
| Sesión JWT robada en equipo desbloqueado | `auth_time` + step-up antes de link/unlink/password/email |
| Account takeover por sesión abandonada + link IdP ajeno | Step-up + pantalla de revisión; email informativo permite al titular **desvincular** (§4.5.7) |
| Vincular IdP de otra persona | Step-up + OAuth + confirmación en pantalla; email informativo al titular |
| Quedar bloqueado sin métodos de acceso | Regla `LAST_AUTH_METHOD` |
| Session fixation en link | `flowCode` / `challengeToken` de un solo uso, TTL corto, hash en BD; nunca en URL |
| Filtración por query string | Solo `flowCode` en redirect; contexto vía POST (§6.0) |
| Elevación cross-session tras step-up | **Prohibido** `usuario.recent_auth_at`; solo `auth_session` por `sid` (§4.1b) |
| Step-up perdido en misma sesión | Refresh lee `auth_session.recent_auth_at` del mismo `sid` |

### 7.3 Google / Microsoft — buenas prácticas

- Vinculación iniciada **explícitamente** por el usuario (pantalla Configuración o diálogo de conflicto)
- **Step-up** con método ya existente **antes** de `link/start`; **`prompt=login`** en el IdP nuevo es complemento, no sustituto (D-V2-12)
- **Pantalla de revisión** (`link_pending_review` + `POST /link/complete`) activa el vínculo (D-V2-13)
- **Email informativo** tras vincular — no sustituye step-up ni pantalla (D-V2-20)
- Permitir **desvincular** desde la misma pantalla (con step-up previo)
- Documentar en política de privacidad los datos IdP almacenados (`provider_email`, `provider_display_name`)

---

## 8. Cambios en capas (implementación)

### 8.1 Archivos nuevos / modificados (V2.0)

| Capa | Archivo | Cambio |
|------|---------|--------|
| Core | `AuthSession.cs` / `IAuthSessionRepository` | Entidad y persistencia por `session_id` (§4.1b) |
| Core | `AuthClaimTypes.cs` | `sid`, `auth_time`, `session_amr`, `recent_amr` |
| Core | `ExternalAuthIntent.cs` | Añadir `Link = 3`, `StepUp = 4` |
| Core | `ExternalAuthSession.cs` | `UserId` nullable |
| Core | `IAccountAuthenticationService.cs` | `GetAuthenticationMethodsAsync` |
| Core | `IExternalAuthService.cs` | `StartLinkAsync`, `StartStepUpAsync`, `UnlinkProviderAsync` |
| Core | `IAuthService.cs` / `AuthService.cs` | Login crea `auth_session`; step-up/refresh por `sid` (§4.5.3b) |
| Core | `AuthenticationMethodDto.cs` | DTOs polimórficos por `type` (`password`, `external`, …) |
| Core | `UserProfileDto.cs` | `HasLocalPassword`, `AuthTime`, `RequiresStepUp` (resumen; sin lista de proveedores) |
| Core | `ExternalAuthStartRequestDto.cs` | `returnUrl`; opcional `intent`, `invitationToken` (login) |
| Api | `RequireRecentAuthenticationAttribute.cs` | Valida `auth_time` (+ opcional `recent_amr` en auditoría) |
| Api | `AccountStepUpController.cs` | `POST step-up/password` |
| Infrastructure | Migración EF | `auth_session`; `user_external_login`: `issuer`, `subject`; `external_auth_pending_link`; etc. |
| Infrastructure | `ExternalAuthService.cs` | Ramas link, step-up, unlink |
| Infrastructure | `GoogleExternalAuthClient.cs` | `subject` = `sub`, `issuer` = `iss`; `prompt=login`, `max_age=0` en link/step-up |
| Infrastructure | `MicrosoftExternalAuthClient.cs` | Parsear `id_token` (`sub`, `iss`, `tid`, `oid`); Graph para email/nombre; `prompt=login` en link/step-up (D-V2-21) |
| Api | `AccountAuthenticationMethodsController.cs` | `GET /api/account/authentication-methods` |
| Api | `ExternalAuthController.cs` | `POST` link/start, step-up/start, start (migrar V1); callback sigue `GET` |
| Api | `AccountPasswordController.cs` | `POST` y `PUT /api/account/password` con step-up |
| Api | `MeController.cs` | Step-up en cambio de email |
| Api | `Program.cs` | `RecentAuthMaxAgeMinutes`; registrar `AuthSessionValidationMiddleware` tras autenticación JWT |
| Api | `AuthSessionValidationMiddleware.cs` | Valida `sid` ↔ `auth_session`; `revoked_at`, `security_stamp_snapshot`, `last_seen_at` |
| Tests | Unit + Integration | Matriz §11 |

### 8.2 Pseudocódigo `ResolveAsync` — sin cambios en V2.0

El flujo `intent=auto` de login/registro **permanece igual**. La vinculación autenticada **bypasea** `ResolveAsync` mediante `intent=Link`.

### 8.3 Configuración `appsettings`

```json
"Authentication": {
  "RecentAuthMaxAgeMinutes": 15
},
"ExternalAuth": {
  "LinkReturnPath": "/account/security",
  "StepUpReturnPath": "/account/security",
  "AllowedLinkReturnUrlPrefixes": [ "/account", "/dashboard", "/auth/callback" ],
  "AllowSetPasswordInPendingTenantSetup": false,
  "RequirePromptLoginOnLink": true
}
```

---

## 9. Frontend — pantallas y flujos (resumen)

Documento detallado sugerido: `guia-frontend-login-externo-v2-cuenta-hibrida.md` (crear al implementar).

### 9.1 Rutas nuevas

| Ruta | Responsabilidad |
|------|-----------------|
| `/account/security` | Métodos de acceso: listar, vincular, desvincular, establecer contraseña |
| `/account/security/step-up` | Modal o página de re-verificación (contraseña u OAuth ya vinculado) |
| `/account/security/link-review` | Confirmar identidad IdP tras OAuth (`link_pending_review`) |
| `/auth/callback` | Leer **solo** `flowCode` (o `exchangeCode` V1); resolver siempre vía POST |
| `/login` | Error `password_login_not_available` → CTAs |

### 9.2 Pantalla Seguridad de la cuenta

Antes de **Desvincular**, **Establecer contraseña** o **Cambiar contraseña**, el frontend debe cargar `GET /api/account/authentication-methods`, comprobar `requiresStepUp` (o `canUnlink` / `canConfigure` según acción) y capturar `403 recent_authentication_required` → modal §4.5.5.

**Cambiar contraseña (D-V2-19):** tras step-up con **contraseña**, el formulario de cambio solo pide `newPassword` (+ confirmación en UI). No repetir `currentPassword` en `PUT /password`. Si el step-up fue OAuth, el formulario sí incluye contraseña actual.

```text
Métodos de acceso
─────────────────
✓ Correo y contraseña          [Cambiar contraseña]  ← step-up pwd → PUT solo newPassword
✓ Google (william@empresa.com) [Desvincular]         ← step-up con método existente
○ Microsoft                    [Vincular]            ← step-up → OAuth → revisar identidad → email
```

**Ruta `/account/security/link-review`:** tras `flow/resolve` con `link_pending_review`, mostrar pantalla §4.5.7. Tras `link/complete` exitoso → pantalla de **éxito inmediato** (proveedor vinculado); el correo informativo llega en segundo plano.

### 9.3 Login — `password_login_not_available`

```text
Esta cuenta fue creada usando Google.
Continúa con Google o configura una contraseña para acceder también con correo y contraseña.

[Continuar con Google]   [Configurar contraseña]
```

“Configurar contraseña” → `forgot-password` con el email ya rellenado, o redirect a login OAuth y luego `/account/security`.

### 9.4 Conflicto OAuth — V2.1

```text
/auth/callback?flowCode=abc123   ← única lectura de la URL

POST /api/auth/external/link/context
→ maskedEmail, verificationMethods, challengeToken (en body)

Pantalla:
Ya existe una cuenta con w***@empresa.com.
Puedes vincular tu cuenta de Google para utilizar ambos métodos de acceso.

[Vincular con mi cuenta existente]   [Cancelar]
```

Modal vincular: campo contraseña **o** “Enviar enlace a mi correo”. El `challengeToken` de `/context` se guarda en memoria del componente — **no** en `localStorage` ni en la URL.

---

## 10. Plan de implementación por PRs

### PR-V2-0 — Identidad externa (prerequisito o PR-V2-1)

- [ ] Migración: `issuer`, `subject` (= `sub`), `tenant_id`, `object_id`; renombrar `provider_user_id` → `subject`
- [ ] `MicrosoftExternalAuthClient`: parsear **`id_token`** (`sub`, `iss`, `tid`, `oid`); dejar de usar Graph `id` como clave de login (D-V2-21)
- [ ] Backfill filas Microsoft V1 (`provider_user_id` = oid) en migración o próximo login
- [ ] Índice `UNIQUE (provider, issuer, subject)`; drop índice V1
- [ ] `ExternalAuthIdpProfile` / clientes IdP: `Issuer`, `Subject` (= `sub`), `TenantId`, `ObjectId` (Microsoft)
- [ ] `ResolveAsync`, link, step-up: lookup por terna
- [ ] Test T34: mismo `subject`, distinto `issuer` → identidades distintas

### PR-V2-1 — Step-up + dominio

- [ ] Claims `sid`, `session_amr`, `recent_amr`, `auth_time`; step-up no altera `session_amr`
- [ ] Tabla `auth_session` (modelo completo §4.1b) + repositorio; **sin** `usuario.recent_auth_at` ni `user_auth_provider_revocation`
- [ ] `AuthSessionValidationMiddleware` (reemplaza revocación por proveedor vía tabla auxiliar)
- [ ] `RequireRecentAuthenticationAttribute` + `RecentAuthMaxAgeMinutes`
- [ ] `ExternalAuthIntent.Link`, `ExternalAuthIntent.StepUp`
- [ ] `ExternalAuthSession.UserId` + migración
- [ ] `RefreshTokenAsync`: elevar solo desde `auth_session` del `sid` entrante (§4.5.3b)
- [ ] `POST /api/account/step-up/password` → `LoginResponseDto` + `UPDATE auth_session`
- [ ] Tests step-up (T14–T17, T35, T37)

### PR-V2-2 — Dominio link (continuación)

- [ ] Constantes error/audit
- [ ] Tests entidad

### PR-V2-3 — Servicios link/unlink/step-up OAuth

- [ ] `CompleteLinkAsync` en `link/complete`: INSERT `user_external_login` + email informativo (D-V2-20)
- [ ] `StartLinkAsync`, `StartStepUpAsync`, `CompleteLinkCallbackAsync`, `CompleteStepUpCallbackAsync`
- [ ] `UnlinkProviderAsync`, `GetAuthenticationMethodsAsync`
- [ ] Tests unitarios `ExternalAuthService` (link email mismatch, last auth method, happy path)

### PR-V2-4 — API endpoints sensibles

- [ ] `GET /api/account/authentication-methods`; `POST` link/start, step-up/start; `POST /start` login (D-V2-22); `DELETE {provider}` con step-up
- [ ] Callback branches `Intent.Link` y `Intent.StepUp`; redirect solo `?flowCode=`
- [ ] `ExternalAuthController`: `POST` en `/start`, `/link/start`, `/step-up/start`; deprecar `GET /start` V1 (D-V2-22)
- [ ] `prompt=login` en URLs de link/step-up
- [ ] Tests integración WebApplicationFactory

### PR-V2-5 — Password API + perfil

- [ ] `POST /api/account/password` (primera contraseña) con `[RequireRecentAuthentication]`
- [ ] `PUT /api/account/password` con regla D-V2-19 (§4.5.3c); deprecar `POST /change-password`
- [ ] DTOs: `SetPasswordDto` (`newPassword`); `ChangePasswordDto` (`newPassword` + `currentPassword` condicional por `recent_amr`)
- [ ] Política A de rotación (D-V2-23, §4.6.4): revocar demás `auth_session` (`password_changed`), actualizar `security_stamp_snapshot` de la actual, devolver nuevo JWT en `data.token`
- [ ] `UserProfileDto` ampliado
- [ ] Tests: POST con/sin step-up; PUT tras step-up pwd (sin `currentPassword`); PUT tras step-up OAuth (con `currentPassword`); POST cuando ya hay password → 409; sesión actual sobrevive y las demás quedan revocadas (T42, T43)
- [ ] `PUT /api/me` — step-up si cambia email

### PR-V2-6 — Frontend guía + copy emails

- [ ] Documento guía frontend V2
- [ ] `CompleteLinkCallbackAsync` → `ExternalAuthPendingLink`; `flow/resolve`, `link/complete`, `link/cancel`
- [ ] Plantilla email informativo “Se añadió {provider} a tu cuenta” (§5.3c)
- [ ] Actualizar `guia-frontend-login-externo-google-microsoft.md` con referencia V2

### PR-V2-7 — V2.1 link challenge (opcional fase 2)

- [ ] Entidad `ExternalAuthLinkChallenge` + `flowCode` / `challengeToken` con hash
- [ ] `POST /api/auth/external/link/context` (consumir `flowCode`)
- [ ] `POST /api/auth/external/link/confirm` (`challengeToken` solo en body)
- [ ] Redirect conflicto: **solo** `?flowCode=` (§6.0)
- [ ] `POST /api/auth/external/flow/resolve` para link/step-up/error V2.0
- [ ] Tests E2E conflicto password → vincular Google; T26–T27

---

## 11. Matriz de pruebas obligatorias

| # | Escenario | Resultado esperado |
|---|-----------|-------------------|
| T1 | OAuth-only login password | `401 password_login_not_available` |
| T2 | OAuth-only forgot → reset | `HasLocalPassword = true`, mismo `user_id` |
| T3 | JWT + link Microsoft (tiene Google) | step-up → OAuth → `link/complete` → vínculo activo + email informativo |
| T4 | JWT + link Microsoft con email distinto al principal | step-up → OAuth → `link_pending_review` → `link/complete` → vínculo activo |
| T5 | JWT + link proveedor ya vinculado | `409 already_linked` |
| T6 | Unlink único OAuth sin password | `409 last_auth_method` |
| T7 | Unlink Google con password | OK, login password funciona |
| T8 | `POST /password` OAuth-only con JWT reciente | OK; `LocalPasswordSet` |
| T8b | `POST /password` OAuth-only sin step-up | `403 recent_authentication_required` |
| T9 | `POST /password` cuando ya hay password | `409 password_already_set` |
| T9b | `PUT /password` solo `newPassword`, `recent_amr=pwd` reciente | `200` |
| T9d | `PUT /password` sin `currentPassword`, `recent_amr=google` | `400 current_password_required` |
| T39 | `POST /step-up/password` → `PUT /password` solo `newPassword` | `200`; contraseña pedida **una** vez |
| T42 | `PUT /password` OK con sesiones B y C activas | Respuesta incluye `token` nuevo; sesión actual sigue válida; B y C → `401` (`password_changed`) |
| T43 | Tras `PUT /password`, request con el JWT **anterior** de la sesión actual | `401` (sello rotado); con `data.token` → `200` |
| T9c | `PUT /password` sin password local | `400 password_not_set` |
| T10 | `(provider, issuer, subject)` ya en otro `user_id` | `409` / error vinculación |
| T11 | Internal user link OAuth | `403` |
| T12 | V2.1 challenge + password correcta | Vínculo + JWT |
| T13 | V2.1 challenge expirado | `401` |
| T14 | Unlink con JWT antiguo (>15 min) | `403 recent_authentication_required` |
| T15 | step-up/password correcto | Nuevo JWT, `auth_time` renovado |
| T16 | step-up/password incorrecto | `401` |
| T17 | Refresh tras login antiguo (sin step-up) | `auth_time` del JWT emitido = del JWT entrante (no `now`) |
| T35 | Step-up password (sid B) → refresh con JWT **pre**-step-up **mismo sid B** | `auth_time` elevado desde `auth_session` de B |
| T37 | Step-up en sid B; atacante refresh con JWT robado **sid A** | `auth_time` **no** elevado; operación sensible → 403 |
| T18 | step-up OAuth proveedor vinculado | JWT con `auth_time` nuevo |
| T19 | step-up OAuth proveedor no vinculado | `400` |
| T20 | `PUT /password` sin step-up | `403 recent_authentication_required` |
| T21 | Unlink Google, `session_amr=pwd` | `204`; siguientes requests OK |
| T22 | Unlink Google; otra sesión activa `session_amr=google` | Fila `auth_session` revocada; siguiente request → `401 session_revoked_provider_unlinked` |
| T38 | Unlink Google; sesión laptop `session_amr=pwd` | Fila laptop **no** revocada; sigue activa |
| T36 | Unlink Google, `session_amr=google`, `recent_amr=pwd` (step-up previo) | `204` en DELETE; siguiente request → `401` (no salvar por `recent_amr`) |
| T23 | Unlink rutinario | `SecurityStamp` **sin** cambio |
| T24 | `GET /authentication-methods` cuenta híbrida | `password` + `external` google linked + microsoft `canLink` |
| T25 | `GET /authentication-methods` Internal | Solo `type: password`; sin externos con `canLink` |
| T26 | Redirect conflicto V2.1 | URL solo `?flowCode=`; sin `linkChallengeToken` ni `error=` |
| T27 | `POST /link/context` con `flowCode` reutilizado | `400 external_auth_flow_invalid` |
| T28 | `link/start` sin step-up previo (método existente) | `403 recent_authentication_required` |
| T29 | Callback link OK sin `link/complete` | Sin fila `user_external_login`; pendiente expira |
| T40 | `link/complete` exitoso | `user_external_login` creado de inmediato; email informativo encolado |
| T30 | Step-up con mismo proveedor que se quiere vincular | `403 external_auth_link_step_up_wrong_provider` |
| T31 | Callback OK sin `link/complete` | Sin `user_external_login`; pendiente expira |
| T33 | Usuario pulsa Cancelar en revisión | `link/cancel`; pendiente descartado |
| T34 | Mismo `sub` en distintos `iss` (Microsoft multi-tenant) | Dos identidades distintas; sin colisión |
| T41 | Microsoft login | Lookup por `(issuer, sub)`; `object_id` = `oid` almacenado aparte |

---

## 12. Códigos de error nuevos (referencia UX)

| Código | Mensaje sugerido (es) |
|--------|------------------------|
| `external_auth_provider_already_linked` | Ya tienes {provider} vinculado a tu cuenta. |
| `external_auth_provider_not_linked` | No tienes {provider} vinculado. |
| `external_auth_last_auth_method` | No puedes desvincular el único método de acceso. Configura una contraseña primero. |
| `external_auth_link_challenge_invalid` | La solicitud de vinculación expiró. Vuelve a intentarlo. |
| `external_auth_link_pending_invalid` | La solicitud de vinculación expiró o no fue confirmada en pantalla. |
| `external_auth_link_pending_user_mismatch` | Esta vinculación pertenece a otra sesión. |
| `external_auth_link_verify_invalid` | El enlace de confirmación por correo expiró o ya fue utilizado. |
| `external_auth_link_step_up_wrong_provider` | Para vincular {provider}, confirma tu identidad con otro método ya configurado. |
| `external_auth_flow_invalid` | El enlace de autenticación expiró o ya fue utilizado. Vuelve a iniciar sesión. |
| `recent_authentication_required` | Por seguridad, confirma tu identidad antes de continuar. |
| `session_revoked_provider_unlinked` | Tu sesión con {provider} ya no es válida porque desvinculaste ese método. Inicia sesión de nuevo. |
| `password_login_not_available` | (V1) Solo Google/restablecer contraseña — ver UC-V2-1 |
| `password_not_set` | (V1) Usa `POST /api/account/password` para establecer la primera contraseña |
| `password_already_set` | Ya tienes contraseña local. Usa `PUT /api/account/password` para cambiarla. |
| `current_password_required` | Confirma tu contraseña actual o haz step-up con contraseña antes de cambiarla. |

---

## 13. Decisiones cerradas vs abiertas

### Cerradas (recomendación)

| ID | Decisión |
|----|----------|
| D-V2-1 | Vinculación autenticada usa `intent=Link` + `user_id` en sesión OAuth |
| D-V2-2 | No auto-vincular en `ResolveAsync` para cuentas `Active` (se mantiene D22) |
| D-V2-3 | Unlink: revocar filas `auth_session` con `session_amr = provider`; no rotar `SecurityStamp` global (§4.6) |
| D-V2-4 | Primera contraseña: `POST /api/account/password` + step-up; anónimos siguen con forgot/reset |
| D-V2-5 | Máximo un vínculo por proveedor por usuario (índice existente) |
| D-V2-6 | Operaciones sensibles exigen `auth_time` reciente; refresh reconcilia solo con `auth_session` del `sid` (§4.5.3b) |
| D-V2-7 | Link OAuth usa `prompt=login` en el IdP **nuevo**; **no** sustituye step-up con método existente |
| D-V2-8 | Unlink / `POST|PUT /api/account/password` / cambio email exigen `[RequireRecentAuthentication]` |
| D-V2-9 | Contratos separados: `POST /password` (establecer, solo `newPassword`) vs `PUT /password` (cambiar); ver D-V2-19 para `currentPassword` |
| D-V2-10 | `GET /api/account/authentication-methods` con `methods[]` polimórfico; no `GET /api/auth/external/providers` |
| D-V2-11 | Callback frontend: **solo** `flowCode` en URL; contexto/errores/tokens vía POST |
| D-V2-12 | Vincular: step-up (método existente) + `prompt=login` IdP nuevo + confirmación en pantalla antes de `user_external_login` |
| D-V2-13 | Tras callback link, **nunca** crear vínculo directo; pantalla `link_pending_review` + `POST /link/complete` obligatorios |
| D-V2-20 | V2.0: **sin** confirmación por email bloqueante al vincular; email informativo post-vínculo (§4.5.7) |
| D-V2-22 | Endpoints OAuth `*/start` que crean sesión en BD → **`POST`** + JSON; callback IdP sigue `GET` (§5.1b) |
| D-V2-14 | Identidad externa = **`(provider, issuer, subject)`** con `subject` = claim **`sub`**; índice único en la terna |
| D-V2-21 | Microsoft: **`subject` = `sub`** del `id_token`; persistir `tid` → `tenant_id`, `oid` → `object_id`; **prohibido** usar `oid` como `subject` |
| D-V2-15 | Step-up persiste en `auth_session` del `sid`; refresh eleva `auth_time`/`recent_amr` solo de esa sesión |
| D-V2-24 | Vinculación autenticada: correo IdP **no** obligado a coincidir con `usuario.email`; identidad = `(provider, issuer, subject)`; email IdP = metadata; flujos anónimos sin auto-link por email |
| D-V2-23 | Cambio/set de contraseña: rotar sello **preservando la sesión actual** (revocar demás con `password_changed`, actualizar `security_stamp_snapshot`, devolver nuevo JWT); revocación total (`security_stamp_rotated`) solo ante compromiso / “cerrar todas” (§4.6.4) |
| D-V2-16 | Claims `session_amr` (origen, revocación) vs `recent_amr` (step-up); unlink revoca por `session_amr` |
| D-V2-17 | **Prohibido** `usuario.recent_auth_at`; estado reciente solo en `auth_session` + claim `sid` |
| D-V2-18 | `auth_session` como entidad formal única para step-up, refresh, revocación selectiva y gestión de dispositivos (§4.1b); sin `user_auth_provider_revocation` |
| D-V2-19 | `PUT /password`: si `recent_amr=pwd` en ventana, solo `newPassword`; `currentPassword` si step-up fue OAuth (§4.5.3c) |

### Abiertas (requieren producto)

| ID | Pregunta | Opciones |
|----|----------|----------|
| Q-V2-1 | ¿`PendingTenantSetup` puede usar `POST /password` o forgot-password? | A) Solo tras `complete-registration` (default) / B) Permitir antes |
| Q-V2-2 | ¿V2.1 challenge usa solo password o también email? | Recomendado: ambos |
| Q-V2-3 | ¿Revocar token en Google/Microsoft al desvincular? | Best-effort V2.2 |
| Q-V2-4 | ¿Mensaje login menciona solo Google o Google+Microsoft dinámico? | Según proveedores vinculados |
| Q-V2-5 | ¿Ventana `RecentAuthMaxAgeMinutes`? | Default **15** min; recomendado 10–20 |
| Q-V2-6 | ¿Modo estricto link con confirmación por email (4 capas)? | **No** en V2.0 (D-V2-20); opcional V2.2+ / enterprise |

---

## 15. Checklist de aceptación global V2.0

- [ ] Usuario con Google puede vincular Microsoft (step-up → revisión pantalla → vínculo activo)
- [ ] Usuario con Google puede establecer contraseña y entrar por email (tras step-up)
- [ ] Usuario con password puede vincular Google estando logueado (V2.0 link/start con re-login IdP)
- [ ] No se crean duplicados de `usuario` ni `tenant` en ningún flujo V2.0
- [ ] Desvincular respeta “último método de acceso” **y** exige autenticación reciente
- [ ] Tras unlink Google, sesiones `session_amr=google` revocadas aunque `recent_amr=pwd`; `session_amr=pwd` intactas
- [ ] Unlink rutinario **no** rota `SecurityStamp` global
- [ ] Unlink / `POST|PUT /api/account/password` fallan con `403` si la sesión lleva >15 min sin re-auth
- [ ] Refresh token no extiende privilegios para operaciones sensibles
- [ ] `GET /api/account/authentication-methods` refleja password + OAuth + flags de acción; `GET /api/me` solo resumen (`hasLocalPassword`, `authTime`)
- [ ] Callback V2 redirige solo con `flowCode`; sin tokens ni `error=` en query string
- [ ] Vincular: sin `link/complete` no hay `user_external_login`; con `link/complete` vínculo activo sin paso de email
- [ ] Pantalla link-review muestra `providerEmail` y `accountEmail` antes de confirmar
- [ ] Índice `UNIQUE (provider, issuer, subject)`; `subject` = `sub`; Microsoft con `tenant_id`/`object_id`
- [ ] Tests T1–T43 en verde
- [ ] Cambiar contraseña: tras step-up con pwd, `PUT /password` no exige `currentPassword` (D-V2-19)
- [ ] Cambiar contraseña **no** expulsa al usuario: sesión actual recibe nuevo JWT; las demás quedan revocadas (D-V2-23)
- [ ] Documentación API actualizada en `docs/Api Docs/Autenticación y cuenta/`

---

## 14. Relación con documentos existentes

| Documento | Acción tras V2 |
|-----------|----------------|
| [`plan-login-externo-google-microsoft.md`](./plan-login-externo-google-microsoft.md) | D4/D27: `subject` = `sub`; Microsoft `tid`/`oid`; nota deuda V1 Graph oid |
| [`guia-frontend-login-externo-google-microsoft.md`](./guia-frontend-login-externo-google-microsoft.md) | Añadir sección “Ver V2 para cuenta híbrida” |
| [`POST-api-token-login.md`](../Api%20Docs/Autenticación%20y%20cuenta/POST-api-token-login.md) | `password_login_not_available`; claim `auth_time` |
| [`POST-api-token-refresh.md`](../Api%20Docs/Autenticación%20y%20cuenta/POST-api-token-refresh.md) | Refresh por `sid` + `auth_session`; sin elevación global (§4.5.3b, D-V2-17) |
| [`POST-api-account-change-password.md`](../Api%20Docs/Autenticación%20y%20cuenta/POST-api-account-change-password.md) | V1 `POST`; V2 `PUT` + D-V2-19 (step-up reutilizable) |
| Nuevo | `guia-frontend-login-externo-v2-cuenta-hibrida.md` al iniciar PR-V2-6 |

---

*Documento de propuesta V2. Ante cambios de alcance, actualizar fases y checklist antes de implementar.*
