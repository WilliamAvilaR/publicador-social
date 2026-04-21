# Gestor de archivos — ideación técnica y de producto

Documento para alinear **producto**, **backend** y **frontend** antes de implementar una **nueva vista** y una **nueva entrada de menú** llamada **Gestor de archivos**, aprovechando los endpoints de medios ya disponibles.

**Referencias en el repo**

- Rutas del dashboard: [`src/app/app.routes.ts`](../src/app/app.routes.ts) (hijos bajo `path: 'dashboard'`).
- Menú lateral y filtrado por plan: [`src/app/features/dashboard/components/dashboard/dashboard.component.ts`](../src/app/features/dashboard/components/dashboard/dashboard.component.ts) (`allMenuItems`, `visibleMenuItems`, `maybeRedirectIfRouteBlocked`).
- Contrato HTTP de medios: [`docs/composer-media-api-contract.md`](./composer-media-api-contract.md) y servicio [`ComposerMediaService`](../src/app/features/scheduler/services/composer-media.service.ts).

**API asumida (ya operativa)**

| Método | Ruta | Uso en el gestor |
|--------|------|------------------|
| `POST` | `/api/media/upload` | Subir archivos al tenant |
| `GET` | `/api/media` | Listado paginado (`page`, `pageSize`, `q`) |
| `GET` | `/api/media/{id}` | Detalle / metadatos / URL firmada si aplica |
| `POST` | `/api/media/preview-url` | Validar URL externa antes de registrar o previsualizar |

---

## 1. Visión de producto (por qué existe, no solo “qué hace”)

Un **storage** responde: “aquí hay archivos”. Una **herramienta competitiva** responde:

| Pregunta | Qué debe ofrecer el gestor |
|----------|----------------------------|
| ¿Para qué lo usa el usuario? | Encontrar **rápido** un visual que ya subió o importó, **reutilizarlo** en publicaciones sin volver a buscar en el disco, y en el futuro asociarlo a **contexto** (campaña, cliente, etiqueta). |
| ¿Cómo le ahorra tiempo? | **Selección rápida**, preview sin fricción, acción directa **“Usar en publicación”**, copiar `mediaId`/URL, y menos idas al explorador de archivos. |
| ¿Qué lo diferencia de “carpeta en la nube”? | **Dónde se usa** el archivo (planes, redes — cuando el API lo exponga), **sugerencias** por uso reciente / popularidad, y **valor de almacenamiento** visible (cuota). |

**Principio:** el gestor es la **casa de los activos visuales del tenant**, no un listado técnico. La implementación puede ir por fases, pero el **copy**, el **orden por defecto** (**2.3**), los **dos modos de uso** (**3.1**) y las **acciones primarias** deben reflejar esta visión desde el MVP.

---

## 2. Concepto de dominio: de “archivo” a **activo reutilizable**

Hoy el modelo mental del API puede ser “media = fichero”. Para producto y analítica futura conviene documentar el objetivo:

**Media = activo reutilizable** con identidad estable (`mediaId`), uso en el producto y metadatos enriquecidos.

### 2.1 Campos recomendados (contrato API — muchos pueden ser fase 2)

| Campo | Descripción | Valor producto |
|--------|-------------|----------------|
| `tags` | Etiquetas libres o taxonomía | Filtrar, campañas, cliente |
| `usageCount` | Veces usado en publicaciones (o referencias) | Ordenar por valor, destacar “top” |
| `lastUsedAt` | Última vez referenciado | Orden “recientes en publicaciones” |
| `source` | `upload`, `url`, `google_drive`, `onedrive`, `canva`, `unsplash`, … | Filtros, confianza, soporte |
| `name` / `path` | Nombre legible o ruta lógica | Búsqueda (`q`) y escaneo humano |
| `mimeType`, `sizeBytes`, `width`, `height` | Tipo y peso | Badges, límites, layout grid |
| `status` | Ciclo de vida del activo | Ver **2.2** |

### 2.2 Estado del activo (`status`)

| Valor sugerido | Significado | UI / reglas de negocio |
|-----------------|-------------|-------------------------|
| `active` | Disponible en biblioteca y en flujos de selección | Visible por defecto |
| `archived` | Retirado de la vista principal; conserva histórico y referencias | Oculto en “selección rápida”; recuperable desde filtro “Archivados” |
| `in_use` | (Opcional, derivado o materializado) Referenciado por borrador o publicación pendiente | **Badge** “En uso”; no permitir eliminación dura sin desreferenciar |

Permite **no borrar** físicamente, **solo ocultar** (archivado) y mantener trazabilidad.

### 2.3 Orden por defecto (“orden inteligente”)

Con datos como `lastUsedAt`, `usageCount` y fecha de alta (`createdAt` / `uploadedAt`), el producto debe fijar **desde ya** el comportamiento por defecto del listado:

**Prioridad de ordenación por defecto (tie-breakers en cascada):**

1. **Más recientes usados** — `lastUsedAt` descendente (los sin uso al final de este criterio).
2. **Más usados** — `usageCount` descendente.
3. **Más recientes subidos** — `createdAt` descendente.

Esto comunica **inteligencia**: lo que el usuario reutiliza sube; lo nuevo también tiene cabida.

**Contrato API recomendado para `GET /api/media`:** query opcional `sort` con valores, por ejemplo:

| `sort` | Comportamiento |
|--------|----------------|
| `recently_used` | Solo criterio 1 (y desempates acordados) |
| `most_used` | Solo criterio 2 |
| `recently_uploaded` | Solo criterio 3 |
| *(omitido)* | Aplicar la **jerarquía 1 → 2 → 3** como default del producto |

Hasta existir `sort` / campos, el front ordena solo sobre la página cargada o acepta el orden del servidor documentado.

### 2.4 Límites por tipo (además del storage global)

La cuota `limit.storageMB` no sustituye reglas por tipo de archivo. Definir (en entitlements, cabeceras de error o documentación de upload):

| Límite | Objetivo |
|--------|----------|
| `maxImageSize` / `maxVideoSize` (o equivalente) | Evitar uploads que llenan ancho de banda y fallan tarde |
| `allowedFormats` / lista MIME permitida | Misma validación en cliente y servidor; mensajes 400 homogéneos |

El gestor y el compositor deben mostrar los mismos mensajes cuando el servidor rechaza por tipo o tamaño.

Hasta que el backend exponga todos los campos anteriores, el front puede mostrar solo lo disponible y **dejar huecos** en UI (badges simples por `mimeType`) sin fingir datos que no existen.

---

## 3. Valor en UI (más allá de grid + detalle + upload)

Comportamiento **mínimo competitivo** a especificar en diseño e implementación:

| Patrón | Comportamiento |
|--------|----------------|
| **Hover** | Preview ampliada (popover o lateral) sin abandonar la lista. |
| **Click** | Abrir detalle **o** menú de acciones según convención del producto. |
| **Acciones inline** | “Usar en publicación”, “Copiar enlace”, “Copiar ID”, “Abrir detalle” visibles en tarjeta o menú `…`. |
| **Badges** | Tipo **imagen / video** (y más si el API lo permite). |
| **Selección rápida** | Un solo clic en “Usar en publicación” dispara el flujo hacia el compositor (ver sección 6). |

### 3.1 Dos modos de pantalla (UX crítica)

El mismo código base debe soportar **dos experiencias** distintas:

| Modo | Cuándo | Objetivo del usuario | UI prioritaria |
|------|--------|----------------------|----------------|
| **Biblioteca** | Entrada normal desde el menú “Gestor de archivos” | Gestionar, explorar, subir, etiquetar, archivar | Toolbar completa, batch, filtros, detalle |
| **Selección** | Navegación desde el compositor (“Elegir de biblioteca”) | Elegir **rápido** un activo y **volver** al compositor | Grid denso, preview hover, **un toque** para confirmar, menos chrome |

**Implementación sugerida (Angular):**

- Ruta única `dashboard/archivos` con **`queryParam` `mode=select`** o `state` en `NavigationExtras` (`{ state: { selectionMode: true } }`).
- En **modo selección**: ocultar o minimizar acciones de gestión masiva; destacar botón **“Seleccionar y volver”**; al confirmar, escribir en `MediaSelectionService` y `navigateBack` o `navigate` al programador.

Sin este bifurcador, un solo botón “Usar en publicación” mezcla dos mentalidades y la pantalla se siente “admin” incluso cuando el usuario solo quiere **cerrar la tarea**.

### 3.2 Empty state estratégico

No basta con el copy “No hay archivos”. El estado vacío debe **enseñar los tres caminos** de valor:

| CTA | Acción |
|-----|--------|
| **Subir archivo** | Abre flujo de subida / dropzone |
| **Importar desde URL** | Abre flujo fase 1.5 (`preview-url` + persistencia cuando exista) |
| **Explorar banco de imágenes** | Placeholder / “Próximamente” (Unsplash u otro) sin romper confianza |

Opcional: enlace “Ir al programador” si el usuario entró buscando publicar primero.

Esto convierte la pantalla en **herramienta de trabajo**, no solo CRUD pasivo.

---

## 4. Cuota de almacenamiento como **feature visible**, no solo error

### 4.1 UI obligatoria (MVP recomendado)

- Barra de uso: **X MB / Y MB** (o GB) según `limit.storageMB` y uso real del tenant.
- Si el API de entitlements no expone “usado” aún: mostrar **solo límite** + mensaje al fallar subida por 403/413, y backlog “exponer `storageUsedBytes` en entitlements”.

### 4.2 Relación con `module.mediaLibrary` (o la feature key elegida)

| Dimensión | Comportamiento propuesto |
|-----------|---------------------------|
| **Feature desactivada** | Ocultar menú + bloquear ruta (`maybeRedirectIfRouteBlocked`). |
| **Feature activa + cuota no llena** | Gestor completo: listar, subir, importar URL (fase 1.5). |
| **Feature activa + cuota llena** | Dos políticas posibles (elegir una y documentarla): **A)** gestor visible pero **subida bloqueada** con CTA “liberar espacio / upgrade”; **B)** mismo + permitir **solo borrar** si existe DELETE. |

Sin política explícita, el usuario llena storage y entra en **frustración** (punto crítico de producto).

---

## 5. Feature flag: incompleto si no se liga a límites

- **Clave sugerida:** `module.mediaLibrary` (u otra acordada con backend).
- **Debe coordinarse con:** `limit.storageMB` (y en el futuro `storageUsedBytes` o equivalente).
- **Menú:** misma clave que la guard de ruta.
- **Comportamiento “lleno”:** ver tabla en 4.2.

---

## 6. Integración real con el flujo principal (compositor)

El gestor **no sustituye** el panel de medios del compositor; **alimenta** el flujo de publicación.

### 6.1 Problema con solo `queryParams` (`?mediaId=`)

- Expone estado en URL, se comparte por error, se pierde semántica al refrescar de forma inconsistente, y no transporta bien “preview + tipo + nombre” sin más llamadas.

### 6.2 Recomendación: `MediaSelectionService` (estado compartido)

**Responsabilidad:** mantener en memoria (y opcionalmente `sessionStorage` con TTL corto) la **selección pendiente** para el compositor.

**Flujo:**

1. Usuario en **Gestor de archivos** elige un activo → **“Usar en publicación”**.
2. El servicio guarda `{ mediaId, publicUrl?, mimeType?, name?, thumbnailUrl? }` (lo mínimo para hidratar UI del compositor sin race).
3. `router.navigate(['/dashboard/programador'])` (u ruta del compositor).
4. Al iniciar o al abrir modal, el **compositor** pregunta al servicio: si hay selección pendiente, hace `patchValue` / abre panel de medios en pestaña coherente y **limpia** la selección tras consumirla (o al cancelar publicación).

**Opcional:** persistir en `sessionStorage` con clave por tenant para sobrevivir **F5** en la misma sesión (decisión explícita de producto).

### 6.3 Alineación con “modo selección” (sección 3.1)

Cuando el compositor abre el gestor en **modo selección**, al confirmar un activo el flujo debe ser **obligatoriamente**: escribir `MediaSelectionService` → navegar de vuelta al compositor → consumir y limpiar. No depender de `queryParams` con `mediaId` como único mecanismo.

El compositor ya puede aplicar `mediaId` e `imageUrl` vía formulario; el servicio evita acoplar navegación frágil.

---

## 7. Importación por URL — subir de fase 3 a **MVP o fase 1.5**

**Por qué:** bajo coste relativo (ya existe `POST /api/media/preview-url`); alto valor (pegar enlace de CDN, Drive público, imagen hospedada).

**Flujo sugerido:**

1. Usuario pega URL → `preview-url` → preview en UI.
2. Confirmar → el backend **persiste** un nuevo registro en la biblioteca del tenant (mismo contrato conceptual que un upload: nuevo `mediaId`).

Si hoy solo existe validación vía `preview-url` sin crear fila, hace falta **`POST /api/media/import-url`** (o extensión acordada) que devuelva el mismo shape que `upload`. Hasta entonces: empty state y CTA pueden ofrecer “copiar URL al portapapeles” como **parche**, no como solución final.

---

## 8. Fuentes externas (alineado al roadmap del producto)

Origen en UI | Dependencia
-------------|--------------
**URL** | `preview-url` + persistencia (`import-url` o equivalente)
**Google Drive / OneDrive** | OAuth servidor + import a storage + fila en `media` con `source`
**Canva** | Acuerdo / API de export
**Unsplash** (fase posterior) | API keys, términos de uso, `source=unsplash`

### 8.1 Comportamiento ante importación externa (definición recomendada)

**Política recomendada (producto + legal + rendimiento):** **siempre copiar a storage interno del tenant** tras autorizar la importación.

| Pregunta | Respuesta recomendada |
|----------|-------------------------|
| ¿Se copia el binario? | **Sí** — el activo queda bajo control de cuotas, antivirus, CDN y revocación. |
| ¿Solo referencia a Drive/URL? | **No** como única fuente en MVP de biblioteca “seria”; las URLs externas pueden romperse o cambiar permisos. |
| ¿Se versiona? | Fase posterior; si aplica, nuevo `mediaId` por versión o campo `version` / `replacedBy`. |
| Campo `source` | Obligatorio: `google_drive`, `onedrive`, `url`, `canva`, etc., para filtros y soporte. |

El gestor puede mostrar **entradas de menú internas** (pestañas) aunque algunas estén “Próximamente”, igual que en el compositor, para **comunicar** el roadmap sin prometer datos falsos.

---

## 9. Rendimiento y estrategia de thumbnails (requisito, no sugerencia)

A escala, el grid **muere** si cada celda dispara la carga del asset completo (`publicUrl` de imagen pesada o video).

### 9.1 Contrato explícito lista vs detalle

| Contexto | Qué debe devolver el API | Uso en front |
|----------|--------------------------|--------------|
| **`GET /api/media` (lista)** | Por ítem: **`thumbnailUrl`** (ligero, cacheable), metadatos (`mimeType`, `sizeBytes`, nombres, `status`, ordenación) | `<img [src]="thumbnailUrl" loading="lazy">` |
| **`GET /api/media/{id}` (detalle)** | `publicUrl` y/o URL firmada, dimensiones, `source`, tags, etc. | Preview grande, copiar enlace, reproductor video |
| **Hover preview** | Preferir thumbnail ampliado o **una** petición de detalle; no prefetch masivo de `publicUrl` |

Si el listado solo devuelve `publicUrl` sin thumbnail, el backend debería **generar o almacenar** `thumbnailUrl` (o derivados por tamaño) como **requisito de escalabilidad**.

### 9.2 Otras directrices

| Tema | Directriz |
|------|------------|
| **Lista** | Paginación estricta; no asumir “cargar todo”. |
| **Lazy loading** | `loading="lazy"` en thumbnails; virtual scroll si > N ítems visibles (fase 2). |
| **Detalle** | Cargar URL completa / firmada solo al abrir detalle o preview hover (idealmente vía `GET /api/media/{id}`). |

---

## 10. Eliminación — subir prioridad a **fase 2 mínima**

Sin borrado (o archivado), el usuario **llena** `limit.storageMB` y no puede liberar espacio salvo upgrade → **fricción alta**.

**Requisito:** `DELETE /api/media/{id}` (o `POST /api/media/{id}/archive`) + reglas explícitas en servidor y mensajes en UI.

### 10.1 Regla de negocio crítica (no romper publicaciones)

**No eliminar** (ni eliminación dura ni vaciar recurso) si el medio está referenciado por:

- una **publicación programada** pendiente (`PostPlan` / equivalente en vuestro dominio), o
- cualquier entidad que el backend considere “en uso” (definir lista).

En esos casos el API debe responder **409 Conflict** (o 400 con código estable) y el UI debe ofrecer: **“Archivar”** (soft) si el producto lo permite, o mensaje claro.

### 10.2 Soft-delete vs hard-delete

- **Archivado (`status=archived`)**: recuperable, oculta de selección rápida; recomendado como primera acción en UI.
- **Eliminación dura**: solo si no hay referencias o tras flujo de “desasociar” explícito.

Esto debe negociarse con backend **antes** de prometer “gestor completo” en planes con cuota finita.

---

## 11. Objetivo operativo de la pantalla (resumen ejecutivo)

- **Biblioteca viva** de activos visuales del tenant.
- **Ahorro de tiempo:** reutilizar, previsualizar, enviar al compositor en pocos clics.
- **Contexto futuro:** campaña/cliente/tags cuando el modelo de datos lo permita.
- **Cuota y borrado** como parte del valor, no como nota al pie.

---

## 12. Alcance por fases (revisado)

### Fase 1 — MVP producto-mínimo

- Ruta + menú + guard de plan.
- Lista paginada + búsqueda `q`.
- Grid con **badges** tipo, **hover preview**, acciones **Usar en publicación** / copiar.
- Subida con feedback y errores 400/403/413.
- **Barra de cuota** (datos reales o placeholder + backlog).
- Integración compositor vía **`MediaSelectionService`**.

### Fase 1.5 — Alto valor / bajo coste

- **Importar desde URL** (preview + persistencia o workaround documentado).

### Fase 2 — Continuidad y salud del tenant

- **`DELETE` / archivar** + reglas de referencias (**10.1**).
- **Acciones por lote (mínimo):** selección múltiple + **eliminar** / **archivar** + **etiquetar** (requiere endpoints batch o bucle documentado con límites de rate).
- Rendimiento: lazy load agresivo, virtual scroll si aplica; cumplimiento del contrato **thumbnailUrl en lista** (**9.1**).
- Controles de orden explícito alineados con **2.3** (`sort` en API o UI sobre página).

### Fase 3 — Profundidad

- Carpetas/colecciones de medios, integraciones Drive/OneDrive/Canva en UI completa, Unsplash, analítica (`usageCount` / `lastUsedAt` en UI).

---

## 13. Diseño de rutas y navegación

### 13.1 Ruta sugerida

- **Path:** `dashboard/archivos` (recomendado).

### 13.2 Registro en Angular Router

En [`app.routes.ts`](../src/app/app.routes.ts), dentro de `children` de `dashboard`:

```ts
{
  path: 'archivos',
  loadComponent: () =>
    import('./features/.../gestor-archivos.component').then((m) => m.GestorArchivosComponent)
}
```

### 13.3 Cabecera del dashboard

Añadir caso para `/dashboard/archivos` → título **Gestor de archivos**.

---

## 14. Menú lateral

- Entrada **Gestor de archivos** → `/dashboard/archivos`.
- **`featureKeys`:** preferible `module.mediaLibrary` + coherencia con `limit.storageMB` (sección 5).
- **`maybeRedirectIfRouteBlocked`:** misma clave que el menú.

---

## 15. Arquitectura frontend (Angular)

### 15.1 Carpeta recomendada

`src/app/features/media/` (dominio independiente del scheduler).

### 15.2 Servicios

- API HTTP: extraer **`MediaApiService`** compartido o reutilizar / envolver [`ComposerMediaService`](../src/app/features/scheduler/services/composer-media.service.ts).
- **`MediaSelectionService`**: selección pendiente para el compositor (sección 6).

### 15.3 Componentes sugeridos

| Componente | Responsabilidad |
|------------|-----------------|
| `GestorArchivosComponent` | Toolbar: búsqueda, subida, importar URL, barra de cuota, refresh. |
| `GestorArchivosGridComponent` | Tarjetas con hover preview, badges, menú de acciones. |
| `GestorArchivosDetailDrawerComponent` | Detalle `GET /api/media/{id}`, copiar ID/URL. |

Standalone + lazy load.

---

## 16. Checklist backend ampliado

- [ ] Shape `ApiResponse` + `meta` paginación.
- [ ] Lista: **`thumbnailUrl` obligatorio u obligatorio para tipos pesados**; `publicUrl` reservado a detalle (**9.1**).
- [ ] `GET /api/media`: query `sort` alineada con **2.3** (o orden server documentado equivalente).
- [ ] Campos de **activo**: `tags`, `usageCount`, `lastUsedAt`, `source`, `status` (**2.2**).
- [ ] Límites por tipo: `maxImageSize`, `maxVideoSize`, `allowedFormats` (o errores 400 documentados) — **2.4**.
- [ ] Uso de almacenamiento vs `limit.storageMB` para barra de UI.
- [ ] Importación persistida por URL + política **copiar a storage** (**8.1**).
- [ ] `DELETE` / archivar + **regla 10.1** (no borrar si hay publicación programada pendiente).
- [ ] Endpoints batch opcionales: `POST /api/media/bulk-delete`, `POST /api/media/bulk-tag`, etc., o contrato de lote único.

---

## 17. Criterios de aceptación (ampliados)

- El usuario entiende **para qué sirve** la pantalla (copy + acciones primarias).
- El listado respeta el **orden por defecto** definido en **2.3** (o control “Ordenar por” explícito).
- En **modo biblioteca** puede gestionar y explorar; en **modo selección** (**3.1**) puede elegir y volver al compositor con **mínima fricción**.
- Puede localizar un medio, **previsualizarlo** y **enviarlo al compositor** sin pegar `mediaId` a mano (`MediaSelectionService`).
- Ve **cuota** (o mensaje claro de por qué no puede subir) y conoce **límites por tipo** cuando existan (**2.4**).
- La lista **no degrada** con cientos de ítems: paginación + **solo `thumbnailUrl` en grid** (**9.1**).
- **Empty state** con CTAs definidos en **3.2**.
- (Fase 2) Puede **liberar espacio** eliminando o archivando según **10.1** y usar **acciones por lote** mínimas.

---

## 18. Orden de implementación sugerido (tickets)

1. Ruta + menú + guard + título.
2. `MediaApiService` / envoltorio + lista paginada + búsqueda + **orden por defecto** acordado (**2.3**).
3. Grid con badges + hover preview + **empty state estratégico** (**3.2**) + acciones inline.
4. **Modo selección** desde compositor (`mode=select` o `state`) + `MediaSelectionService` + consumo en compositor (**3.1**, **6**).
5. Subida + barra de cuota + validación **límites por tipo** en UI cuando existan datos (**2.4**, **4**).
6. Fase 1.5: importar por URL con persistencia y `source` (**7**, **8.1**).
7. Fase 2: DELETE/archivo + **regla 10.1** + **batch** mínimo + rendimiento / virtual scroll (**12**, **9**).

---

## 19. Riesgos y decisiones abiertas

- **RBAC** vs solo entitlements de plan.
- **Import URL sin endpoint de persistencia:** riesgo de expectativas; alinear doc API antes de prometerlo en UI.
- **Borrado y publicaciones programadas:** regla **10.1** obligatoria antes de exponer eliminación dura.
- **Referencias externas vs copia interna:** si en algún caso se permitiera “solo enlace”, documentar riesgos (rotura de URL, privacidad); la recomendación del doc sigue siendo **copia a storage** (**8.1**).

Este documento combina **brief de producto** y **especificación técnica** para que el gestor sea una herramienta diferenciada de un simple almacenamiento de ficheros.
