# Guía de Endpoints de Analytics de Facebook

## 📋 Resumen

Esta guía explica cómo utilizar los nuevos endpoints de analytics para obtener métricas y estadísticas de las páginas de Facebook conectadas. Los endpoints permiten sincronizar datos desde Facebook Graph API y consultarlos desde la base de datos local para un rendimiento óptimo.

---

## 🎯 Endpoints Disponibles

### 1. Sincronizar Métricas
**Endpoint:** `POST /api/Facebook/analytics/sync`

**Descripción:**  
Sincroniza métricas de páginas de Facebook desde Facebook Graph API y las guarda en la base de datos. Este proceso puede tardar varios segundos dependiendo de la cantidad de páginas.

**Cuándo usar:**
- Cuando necesitas actualizar las métricas por primera vez
- Cuando quieres refrescar los datos después de un período de tiempo
- Cuando el usuario solicita manualmente una actualización
- Como parte de un proceso automático programado (recomendado: una vez al día)

**Parámetros opcionales (body):**
- `pageIds`: Array de IDs de páginas específicas a sincronizar. Si no se envía o está vacío, sincroniza todas las páginas activas del usuario.
- `onlyActive`: Boolean que indica si solo sincronizar páginas activas (por defecto: `true`)

**Respuesta:**
- `syncRunId`: ID único de la ejecución de sincronización
- `pagesOk`: Cantidad de páginas procesadas exitosamente
- `pagesFailed`: Cantidad de páginas que fallaron
- `message`: Mensaje descriptivo del resultado
- `startedAt`: Fecha y hora de inicio
- `endedAt`: Fecha y hora de finalización

**Consideraciones:**
- ⚠️ Este endpoint puede tardar varios segundos o minutos si hay muchas páginas
- ⚠️ No bloquees la UI mientras se ejecuta, muestra un indicador de progreso
- ✅ Los datos se actualizan cada ~24 horas en Facebook, no es necesario sincronizar más frecuentemente
- ✅ La sincronización obtiene los últimos 30 días de métricas

---

### 2. Obtener Snapshot Más Reciente
**Endpoint:** `GET /api/Facebook/analytics/pages/{facebookPageId}/snapshot`

**Descripción:**  
Obtiene el snapshot (instantánea) más reciente de datos básicos de una página. Incluye información como nombre, foto, cantidad de fans y seguidores.

**Cuándo usar:**
- Para mostrar información actualizada de la página en el dashboard
- Para comparar datos actuales con históricos
- Para mostrar estadísticas básicas sin necesidad de métricas detalladas

**Parámetros:**
- `facebookPageId`: ID de la página en Facebook (en la ruta)

**Respuesta:**
- `id`: ID interno del snapshot
- `facebookPageId`: ID de la página en Facebook
- `name`: Nombre de la página
- `pictureUrl`: URL de la imagen de perfil
- `fanCount`: Cantidad de fans
- `followersCount`: Cantidad de seguidores
- `snapshotAt`: Fecha y hora en que se tomó el snapshot

**Consideraciones:**
- ✅ Respuesta rápida (consulta desde base de datos local)
- ⚠️ Si no hay snapshots, devuelve 404
- 💡 Útil para mostrar información básica sin cargar métricas completas

---

### 3. Obtener Métricas por Rango de Fechas
**Endpoint:** `GET /api/Facebook/analytics/pages/{facebookPageId}/metrics`

**Descripción:**  
Obtiene métricas detalladas de una página para un rango de fechas específico. Las métricas incluyen reach, impressions, engagements, etc.

**Cuándo usar:**
- Para mostrar gráficos de métricas en un período específico
- Para análisis comparativo entre diferentes períodos
- Para generar reportes de analytics
- Para visualizar tendencias de crecimiento

**Parámetros:**
- `facebookPageId`: ID de la página en Facebook (en la ruta)
- `fromDate`: Fecha de inicio en formato `yyyy-MM-dd` (query parameter)
- `toDate`: Fecha de fin en formato `yyyy-MM-dd` (query parameter)
- `metricKeys`: (Opcional) Claves de métricas específicas separadas por coma. Si no se envía, devuelve todas las métricas disponibles.

**Métricas disponibles:**
- `page_fans`: Total de fans de la página
- `page_followers`: Total de seguidores
- `page_reach`: Alcance de la página
- `page_impressions`: Impresiones de la página
- `page_engaged_users`: Usuarios que interactuaron
- `page_post_engagements`: Engagement total de publicaciones

**Respuesta:**
- `facebookPageId`: ID de la página
- `pageName`: Nombre de la página
- `fromDate`: Fecha de inicio del rango
- `toDate`: Fecha de fin del rango
- `metrics`: Array de métricas, cada una con:
  - `metricKey`: Clave de la métrica
  - `total`: Valor total en el período
  - `average`: Promedio diario
  - `max`: Valor máximo diario
  - `min`: Valor mínimo diario
  - `dailyValues`: Array con valores diarios ordenados por fecha

**Consideraciones:**
- ✅ Respuesta rápida (consulta desde base de datos local)
- ⚠️ Si no hay métricas para el rango solicitado, el array `metrics` estará vacío
- 💡 Usa `dailyValues` para crear gráficos de líneas o barras
- 💡 Usa `total`, `average`, `max`, `min` para mostrar resúmenes estadísticos

---

### 4. Obtener Logs de Sincronización
**Endpoint:** `GET /api/Facebook/analytics/sync-logs`

**Descripción:**  
Obtiene el historial de sincronizaciones ejecutadas por el usuario. Útil para ver el estado de las últimas sincronizaciones y detectar problemas.

**Cuándo usar:**
- Para mostrar un historial de sincronizaciones al usuario
- Para diagnosticar problemas cuando una sincronización falla
- Para mostrar el estado de la última sincronización
- Para implementar un sistema de notificaciones sobre el estado de los datos

**Parámetros:**
- `limit`: (Opcional) Cantidad de logs a obtener (por defecto: 10, máximo: 100)

**Respuesta:**
Array de logs, cada uno con:
- `id`: ID interno del log
- `syncRunId`: ID único de la ejecución
- `userId`: ID del usuario
- `startedAt`: Fecha y hora de inicio
- `endedAt`: Fecha y hora de finalización
- `pagesOk`: Cantidad de páginas exitosas
- `pagesFailed`: Cantidad de páginas fallidas
- `lastError`: Mensaje del último error (si hubo)
- `status`: Estado de la sincronización (Running, Completed, Failed, Cancelled)
- `durationSeconds`: Duración en segundos (si ya terminó)

**Consideraciones:**
- ✅ Útil para mostrar "Última sincronización: hace X horas"
- 💡 Usa `status` para mostrar indicadores visuales (éxito, error, en progreso)
- 💡 Usa `durationSeconds` para mostrar cuánto tardó la sincronización

---

## 🔄 Flujo de Trabajo Recomendado

### Flujo Inicial (Primera Vez)
1. **Sincronizar métricas:** Ejecutar `POST /api/Facebook/analytics/sync` para obtener datos iniciales
2. **Mostrar indicador de progreso:** Mientras se sincroniza, mostrar un spinner o barra de progreso
3. **Verificar logs:** Consultar `GET /api/Facebook/analytics/sync-logs` para ver el resultado
4. **Mostrar datos:** Una vez completada, mostrar las métricas usando `GET /api/Facebook/analytics/pages/{id}/metrics`

### Flujo de Uso Normal
1. **Cargar snapshot:** Usar `GET /api/Facebook/analytics/pages/{id}/snapshot` para datos básicos rápidos
2. **Cargar métricas:** Usar `GET /api/Facebook/analytics/pages/{id}/metrics` para gráficos y análisis
3. **Sincronización periódica:** Ejecutar sincronización automática una vez al día (preferiblemente en horario de bajo tráfico)

### Flujo de Actualización Manual
1. **Mostrar botón "Actualizar":** Permitir al usuario solicitar una sincronización manual
2. **Ejecutar sincronización:** Llamar a `POST /api/Facebook/analytics/sync`
3. **Mostrar progreso:** Indicar que la sincronización está en curso
4. **Actualizar UI:** Una vez completada, refrescar los datos mostrados

---

## 📊 Casos de Uso Comunes

### Dashboard Principal
- **Snapshot:** Muestra información básica de cada página (foto, nombre, fans)
- **Métricas resumidas:** Muestra totales y promedios de las últimas 7 o 30 días
- **Indicador de última sincronización:** Muestra cuándo se actualizaron los datos por última vez

### Página de Analytics Detallada
- **Selector de rango de fechas:** Permite al usuario elegir el período a analizar
- **Gráficos de líneas:** Muestra evolución diaria de cada métrica usando `dailyValues`
- **Tarjetas de resumen:** Muestra totales, promedios, máximos y mínimos
- **Comparación de períodos:** Permite comparar diferentes rangos de fechas

### Vista de Páginas
- **Lista de páginas:** Muestra snapshot de cada página
- **Indicadores de estado:** Muestra si hay datos disponibles, última sincronización, etc.
- **Acciones rápidas:** Botón para sincronizar una página específica

---

## ⚠️ Consideraciones Importantes

### Rendimiento
- ✅ **Consultas rápidas:** Los endpoints de consulta (`GET`) son rápidos porque leen de la base de datos local
- ⚠️ **Sincronización lenta:** El endpoint de sincronización (`POST`) puede tardar varios segundos o minutos
- 💡 **No bloquear UI:** Siempre ejecuta la sincronización de forma asíncrona y muestra un indicador de progreso

### Frecuencia de Sincronización
- ✅ **Recomendado:** Una vez al día (los datos de Facebook se actualizan cada ~24 horas)
- ⚠️ **No exceder:** No sincronices más de una vez cada 6 horas para evitar rate limits de Facebook
- 💡 **Horario óptimo:** Ejecuta sincronizaciones automáticas en horarios de bajo tráfico (ej: 2 AM)

### Manejo de Errores
- ⚠️ **Páginas fallidas:** Si `pagesFailed > 0`, revisa los logs para ver qué páginas fallaron y por qué
- ⚠️ **Sin datos:** Si no hay métricas para un rango de fechas, el array estará vacío (no es un error)
- 💡 **Tokens inválidos:** Si una página falla constantemente, puede ser que el token esté expirado (usa el endpoint de validación de páginas)

### Autenticación
- 🔐 **Todos los endpoints requieren autenticación:** Incluye el token JWT en el header `Authorization: Bearer {token}`
- 🔐 **Datos por usuario:** Cada usuario solo puede acceder a sus propias páginas y métricas

---

## 📈 Mejores Prácticas

### UX/UI
1. **Indicadores de carga:** Muestra spinners o skeletons mientras cargas datos
2. **Mensajes informativos:** Informa al usuario cuando los datos están desactualizados
3. **Actualización manual:** Permite al usuario forzar una sincronización cuando lo necesite
4. **Feedback visual:** Muestra claramente el estado de la última sincronización

### Optimización
1. **Caché local:** Considera cachear los datos en el frontend para evitar llamadas repetidas
2. **Lazy loading:** Carga las métricas solo cuando el usuario las solicita
3. **Paginación:** Si muestras muchas páginas, implementa paginación o scroll infinito
4. **Filtros:** Permite filtrar métricas por tipo para reducir la cantidad de datos transferidos

### Monitoreo
1. **Logs de sincronización:** Revisa regularmente los logs para detectar problemas
2. **Alertas:** Implementa notificaciones cuando una sincronización falla repetidamente
3. **Métricas de uso:** Trackea qué métricas son más consultadas para optimizar

---

## 🎨 Ejemplos de Visualización

### Tarjeta de Resumen
- **Título:** Nombre de la página (desde snapshot)
- **Imagen:** Foto de perfil (desde snapshot)
- **Métricas destacadas:** Fans, Seguidores, Alcance total
- **Última actualización:** "Actualizado hace X horas" (desde sync logs)

### Gráfico de Líneas
- **Eje X:** Fechas (desde `dailyValues[].date`)
- **Eje Y:** Valores de la métrica (desde `dailyValues[].value`)
- **Líneas múltiples:** Una línea por cada métrica seleccionada
- **Tooltip:** Muestra fecha y valor al hacer hover

### Tabla Comparativa
- **Columnas:** Métricas (reach, impressions, engagements, etc.)
- **Filas:** Días del período
- **Totales:** Fila final con totales, promedios, máximos y mínimos

---

## 🔗 Integración con Otros Endpoints

### Endpoint de Validación de Páginas
Antes de sincronizar, considera validar los tokens de las páginas usando:
- `POST /api/Facebook/pages/validate`

Esto asegura que las páginas tengan tokens válidos antes de intentar sincronizar.

### Endpoint de Estado de Facebook
Para obtener un resumen general del estado de la conexión:
- `GET /api/Facebook/status`

Útil para mostrar en el dashboard si hay problemas con las páginas conectadas.

---

## ❓ Preguntas Frecuentes

**¿Con qué frecuencia debo sincronizar?**  
Una vez al día es suficiente. Los datos de Facebook se actualizan cada ~24 horas.

**¿Qué pasa si una sincronización falla?**  
Revisa los logs de sincronización para ver qué páginas fallaron y por qué. Puede ser un token expirado o un problema temporal de Facebook.

**¿Puedo sincronizar solo una página específica?**  
Sí, usa el parámetro `pageIds` en el endpoint de sincronización para especificar qué páginas sincronizar.

**¿Los datos están en tiempo real?**  
No, los datos se sincronizan desde Facebook y se almacenan localmente. Para datos actualizados, ejecuta una sincronización.

**¿Qué métricas están disponibles?**  
Por defecto: fans, seguidores, alcance, impresiones, usuarios que interactuaron y engagement total. Puedes filtrar por métricas específicas usando el parámetro `metricKeys`.

---

## 📝 Notas Finales

- Todos los endpoints requieren autenticación JWT
- Los datos se almacenan en la base de datos local para consultas rápidas
- La sincronización obtiene los últimos 30 días de métricas
- Los snapshots se crean cada vez que se sincroniza una página
- Las métricas se almacenan por día, evitando duplicados automáticamente

Para más información técnica, consulta la documentación de la API o contacta al equipo de desarrollo.
