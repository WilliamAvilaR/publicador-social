# Arquitectura del Proyecto

Este proyecto sigue los principios de **Arquitectura Limpia** y las mejores prácticas de Angular.

## Estructura de Carpetas

```
src/app/
├── core/                    # Módulo core - Singleton services
│   ├── guards/             # Guards de autenticación y autorización
│   ├── interceptors/       # HTTP interceptors
│   └── services/           # Servicios singleton (providedIn: 'root')
│
├── shared/                  # Módulo compartido
│   ├── components/         # Componentes reutilizables
│   ├── directives/         # Directivas personalizadas
│   └── pipes/              # Pipes reutilizables
│
├── features/                # Features/Módulos por funcionalidad
│   └── auth/               # Feature de autenticación
│       ├── components/     # Componentes específicos de auth
│       ├── services/       # Servicios específicos de auth
│       └── models/         # Interfaces y tipos de auth
│
├── models/                  # Modelos globales compartidos
├── utils/                   # Utilidades y helpers
│
├── app.component.*         # Componente raíz
├── app.config.ts           # Configuración de la aplicación
└── app.routes.ts           # Rutas principales
```

## Principios de Arquitectura

### 1. Core Module
- **Propósito**: Servicios singleton y funcionalidades centrales
- **Regla**: Solo se importa en `app.config.ts`
- **Contenido**:
  - Guards (autenticación, autorización)
  - Interceptors (HTTP, errores)
  - Servicios singleton (API, storage, etc.)

### 2. Shared Module
- **Propósito**: Componentes, directivas y pipes reutilizables
- **Regla**: Puede ser importado en cualquier feature
- **Contenido**:
  - Componentes UI reutilizables (botones, inputs, modales)
  - Directivas personalizadas
  - Pipes de transformación

### 3. Features
- **Propósito**: Módulos independientes por funcionalidad
- **Regla**: Cada feature es autocontenida
- **Estructura**:
  ```
  feature-name/
    ├── components/     # Componentes específicos
    ├── services/       # Servicios específicos
    ├── models/         # Interfaces y tipos
    └── routes.ts       # Rutas de la feature (opcional)
  ```

### 4. Models
- **Propósito**: Interfaces y tipos compartidos globalmente
- **Uso**: Tipos que se usan en múltiples features

### 5. Utils
- **Propósito**: Funciones de utilidad y helpers
- **Uso**: Funciones puras sin dependencias de Angular

## Convenciones de Nomenclatura

- **Componentes**: `kebab-case.component.ts` (ej: `login.component.ts`)
- **Servicios**: `kebab-case.service.ts` (ej: `auth.service.ts`)
- **Guards**: `kebab-case.guard.ts` (ej: `auth.guard.ts`)
- **Interceptors**: `kebab-case.interceptor.ts` (ej: `http.interceptor.ts`)
- **Models**: `kebab-case.model.ts` o `kebab-case.interface.ts`

## Reglas de Importación

1. **Core** solo se importa en `app.config.ts`
2. **Shared** puede importarse en cualquier feature
3. **Features** no deben importarse entre sí directamente
4. **Models** y **Utils** pueden importarse desde cualquier lugar

## Ejemplo de Uso

### Crear un nuevo Feature

```typescript
// features/dashboard/components/dashboard.component.ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent {
  // ...
}
```

### Agregar una ruta

```typescript
// app.routes.ts
export const routes: Routes = [
  {
    path: 'dashboard',
    loadComponent: () => import('./features/dashboard/components/dashboard.component')
      .then(m => m.DashboardComponent)
  }
];
```

## Beneficios

✅ **Separación de responsabilidades**
✅ **Reutilización de código**
✅ **Mantenibilidad**
✅ **Escalabilidad**
✅ **Testabilidad**
✅ **Lazy loading** por feature
