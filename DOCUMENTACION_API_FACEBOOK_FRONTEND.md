# 📘 Documentación API Facebook OAuth - Frontend

Documentación técnica para integrar los endpoints de Facebook OAuth en Angular.

---

## 🔗 Endpoints Disponibles

### 1. `GET /api/facebook/connect`
Genera la URL de autorización de Facebook OAuth.

### 2. `GET /api/facebook/callback`
Procesa el callback de Facebook después de la autorización (llamado automáticamente por Facebook).

---

## 🔐 Endpoint 1: GET /api/facebook/connect

### **Cuándo llamarlo**
Cuando el usuario hace clic en el botón **"Conectar Facebook"** en tu aplicación Angular.

### **URL**
```
GET https://tu-api.com/api/facebook/connect
```

### **Autenticación**
✅ **Requerida**: Debes enviar el token JWT del usuario autenticado.

**Header:**
```
Authorization: Bearer {JWT_TOKEN}
```

### **Request**
No requiere parámetros en el body ni query string.

### **Response Exitosa (200 OK)**

```json
{
  "data": {
    "authorizationUrl": "https://www.facebook.com/v18.0/dialog/oauth?client_id=XXX&redirect_uri=YYY&scope=pages_show_list,pages_manage_posts&state=ZZZ&response_type=code"
  }
}
```

**Estructura:**
- `data.authorizationUrl` (string): URL completa de autorización de Facebook

### **Response de Error**

#### **401 Unauthorized**
```json
{
  "message": "Token inválido o usuario no identificado"
}
```
**Causa**: Token JWT inválido o expirado.

#### **400 Bad Request**
```json
{
  "errors": [
    {
      "Status": 400,
      "Title": "Respuesta con error",
      "Detail": "Usuario no encontrado"
    }
  ]
}
```
**Causas posibles**:
- Usuario no existe
- Usuario inactivo

### **Ejemplo de Implementación en Angular**

```typescript
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class FacebookService {
  private apiUrl = 'https://tu-api.com/api';

  constructor(private http: HttpClient) {}

  /**
   * Obtiene la URL de autorización de Facebook OAuth.
   * @returns Observable con la URL de autorización
   */
  connectFacebook(): Observable<FacebookConnectResponse> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${this.getAuthToken()}`
    });

    return this.http.get<FacebookConnectResponse>(
      `${this.apiUrl}/facebook/connect`,
      { headers }
    );
  }

  private getAuthToken(): string {
    // Obtener token del localStorage, sessionStorage, o servicio de auth
    return localStorage.getItem('authToken') || '';
  }
}
```

### **Uso en el Componente**

```typescript
import { Component } from '@angular/core';
import { FacebookService } from './services/facebook.service';

@Component({
  selector: 'app-facebook-connect',
  template: `
    <button (click)="onConnectFacebook()" [disabled]="loading">
      {{ loading ? 'Conectando...' : 'Conectar Facebook' }}
    </button>
  `
})
export class FacebookConnectComponent {
  loading = false;

  constructor(private facebookService: FacebookService) {}

  onConnectFacebook(): void {
    this.loading = true;

    this.facebookService.connectFacebook().subscribe({
      next: (response) => {
        // Redirigir navegador a la URL de autorización
        window.location.href = response.data.authorizationUrl;
        // No necesitas hacer this.loading = false porque el navegador se redirige
      },
      error: (error) => {
        this.loading = false;
        console.error('Error al conectar Facebook:', error);
        
        // Mostrar mensaje de error al usuario
        if (error.status === 401) {
          alert('Tu sesión ha expirado. Por favor, inicia sesión nuevamente.');
        } else {
          alert('Error al conectar con Facebook. Por favor, intenta nuevamente.');
        }
      }
    });
  }
}
```

### **Interfaces TypeScript**

```typescript
export interface FacebookConnectResponse {
  data: {
    authorizationUrl: string;
  };
}
```

---

## 🔄 Endpoint 2: GET /api/facebook/callback

### **Cuándo se llama**
**Automáticamente por Facebook** después de que el usuario:
1. Ingresa sus credenciales en Facebook.com
2. Autoriza los permisos solicitados

**Facebook redirige automáticamente a:**
```
GET https://tu-api.com/api/facebook/callback?code=AAA123&state=XYZ789
```

### **⚠️ IMPORTANTE**
Este endpoint **NO se llama desde tu código Angular**. Facebook lo llama directamente redirigiendo el navegador.

### **Parámetros de Query (enviados por Facebook)**
- `code` (string, requerido): Código de autorización temporal
- `state` (string, requerido): State único para validar la sesión

### **Response Exitosa (200 OK)**

```json
{
  "data": {
    "pagesImported": 3,
    "errors": 0,
    "message": "Se importaron 3 página(s) exitosamente.",
    "pages": [
      {
        "facebookPageId": "123456789",
        "name": "Mi Página de Facebook",
        "isActive": true
      },
      {
        "facebookPageId": "987654321",
        "name": "Otra Página",
        "isActive": true
      }
    ]
  }
}
```

**Estructura:**
- `data.pagesImported` (number): Número de páginas importadas exitosamente
- `data.errors` (number): Número de errores durante la importación
- `data.message` (string): Mensaje descriptivo del resultado
- `data.pages` (array, opcional): Lista de páginas importadas

### **Response de Error**

#### **400 Bad Request**
```json
{
  "message": "El parámetro 'code' es requerido."
}
```
o
```json
{
  "message": "Sesión OAuth no encontrada. El state es inválido."
}
```

**Causas posibles**:
- Parámetros faltantes (`code` o `state`)
- State inválido o expirado
- Sesión OAuth ya utilizada
- Sesión OAuth expirada

### **Manejo en Angular (Página de Callback)**

Debes crear una **ruta/componente de callback** que maneje la redirección de Facebook:

```typescript
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-facebook-callback',
  template: `
    <div *ngIf="loading">
      <p>Procesando conexión con Facebook...</p>
    </div>
    <div *ngIf="!loading && result">
      <div *ngIf="result.pagesImported > 0" class="success">
        <h2>¡Conexión exitosa!</h2>
        <p>{{ result.message }}</p>
        <p>Páginas importadas: {{ result.pagesImported }}</p>
      </div>
      <div *ngIf="result.errors > 0" class="warning">
        <p>Se importaron {{ result.pagesImported }} página(s) con {{ result.errors }} error(es).</p>
      </div>
    </div>
    <div *ngIf="error" class="error">
      <h2>Error</h2>
      <p>{{ error }}</p>
    </div>
  `
})
export class FacebookCallbackComponent implements OnInit {
  loading = true;
  result: FacebookCallbackResponse | null = null;
  error: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    // Obtener parámetros de la URL (enviados por Facebook)
    this.route.queryParams.subscribe(params => {
      const code = params['code'];
      const state = params['state'];

      if (!code || !state) {
        this.error = 'Parámetros de autorización faltantes.';
        this.loading = false;
        return;
      }

      // El callback ya fue procesado por el backend
      // Solo necesitas mostrar el resultado o redirigir
      // El backend ya procesó todo cuando Facebook redirigió

      // Opción 1: Si el backend retorna JSON, puedes leerlo aquí
      // (pero normalmente el backend ya procesó todo)

      // Opción 2: Redirigir a una página de éxito
      setTimeout(() => {
        this.router.navigate(['/facebook-connected'], {
          queryParams: {
            success: 'true',
            pagesImported: params['pagesImported'] || 0
          }
        });
      }, 2000);
    });
  }
}
```

### **Configuración de Rutas**

```typescript
// app-routing.module.ts
import { Routes } from '@angular/router';
import { FacebookCallbackComponent } from './components/facebook-callback/facebook-callback.component';

const routes: Routes = [
  // ... otras rutas
  {
    path: 'facebook-callback',
    component: FacebookCallbackComponent
  },
  {
    path: 'facebook-connected',
    component: FacebookSuccessComponent // Componente de éxito
  }
];
```

### **Interfaces TypeScript**

```typescript
export interface FacebookCallbackResponse {
  data: {
    pagesImported: number;
    errors: number;
    message: string;
    pages?: FacebookPage[];
  };
}

export interface FacebookPage {
  facebookPageId: string;
  name: string;
  isActive: boolean;
}
```

---

## 🔄 Flujo Completo (Diagrama)

```
┌─────────────────┐
│ Usuario hace    │
│ click "Conectar │
│ Facebook"       │
└────────┬────────┘
         │
         ↓
┌─────────────────────────┐
│ Angular: GET            │
│ /api/facebook/connect   │
│ (con JWT token)         │
└────────┬────────────────┘
         │
         ↓
┌─────────────────────────┐
│ API retorna:            │
│ authorizationUrl        │
└────────┬────────────────┘
         │
         ↓
┌─────────────────────────┐
│ Angular redirige:       │
│ window.location.href =   │
│ authorizationUrl         │
└────────┬────────────────┘
         │
         ↓
┌─────────────────────────┐
│ Usuario en Facebook.com │
│ - Ingresa email         │
│ - Ingresa password      │
│ - Autoriza permisos    │
└────────┬────────────────┘
         │
         ↓
┌─────────────────────────┐
│ Facebook redirige:     │
│ /api/facebook/callback │
│ ?code=AAA&state=XYZ    │
└────────┬────────────────┘
         │
         ↓
┌─────────────────────────┐
│ Backend procesa:        │
│ - Valida state          │
│ - Intercambia code      │
│ - Obtiene páginas       │
│ - Guarda en BD          │
└────────┬────────────────┘
         │
         ↓
┌─────────────────────────┐
│ Backend retorna JSON    │
│ con resultado           │
└────────┬────────────────┘
         │
         ↓
┌─────────────────────────┐
│ Angular muestra         │
│ resultado o redirige    │
│ a página de éxito       │
└─────────────────────────┘
```

---

## ⚠️ Puntos Importantes

### **1. Autenticación**
- El endpoint `/connect` **requiere JWT token**
- El endpoint `/callback` **NO requiere autenticación** (es público, Facebook lo llama)

### **2. Redirección**
- Después de obtener `authorizationUrl`, debes redirigir el **navegador completo**:
  ```typescript
  window.location.href = response.data.authorizationUrl;
  ```
- **NO uses** `HttpClient` para hacer la redirección (no funcionará)

### **3. Callback**
- El callback es llamado **automáticamente por Facebook**
- No necesitas hacer una llamada HTTP manual al callback
- Solo necesitas una ruta/componente que maneje la URL cuando Facebook redirige

### **4. Manejo de Errores**
- Siempre maneja errores 401 (sesión expirada)
- Muestra mensajes claros al usuario
- Considera reintentar en caso de errores temporales

### **5. Estado de Carga**
- Muestra un indicador de carga mientras se procesa
- Después de redirigir a Facebook, el usuario estará fuera de tu app

---

## 📝 Ejemplo Completo de Servicio Angular

```typescript
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class FacebookOAuthService {
  private readonly apiUrl = 'https://tu-api.com/api';

  constructor(private http: HttpClient) {}

  /**
   * Inicia el flujo de conexión con Facebook.
   * Redirige al usuario a Facebook para autorización.
   */
  connectFacebook(): void {
    const headers = this.getAuthHeaders();

    this.http.get<FacebookConnectResponse>(
      `${this.apiUrl}/facebook/connect`,
      { headers }
    ).pipe(
      catchError(this.handleError)
    ).subscribe({
      next: (response) => {
        // Redirigir navegador a Facebook
        window.location.href = response.data.authorizationUrl;
      },
      error: (error) => {
        console.error('Error al conectar Facebook:', error);
        // El error ya fue manejado en handleError
      }
    });
  }

  /**
   * Obtiene las páginas de Facebook conectadas del usuario.
   */
  getConnectedPages(): Observable<FacebookPage[]> {
    const headers = this.getAuthHeaders();
    
    // Este endpoint deberías crearlo en el backend
    return this.http.get<FacebookPage[]>(
      `${this.apiUrl}/facebook/pages`,
      { headers }
    ).pipe(
      catchError(this.handleError)
    );
  }

  private getAuthHeaders(): HttpHeaders {
    const token = this.getAuthToken();
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  private getAuthToken(): string {
    // Implementar según tu sistema de autenticación
    return localStorage.getItem('authToken') || '';
  }

  private handleError = (error: HttpErrorResponse) => {
    let errorMessage = 'Error desconocido';

    if (error.error instanceof ErrorEvent) {
      // Error del lado del cliente
      errorMessage = `Error: ${error.error.message}`;
    } else {
      // Error del lado del servidor
      switch (error.status) {
        case 401:
          errorMessage = 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.';
          // Opcional: redirigir a login
          // this.router.navigate(['/login']);
          break;
        case 400:
          errorMessage = error.error?.message || 'Solicitud inválida.';
          break;
        case 500:
          errorMessage = 'Error del servidor. Por favor, intenta más tarde.';
          break;
        default:
          errorMessage = `Error ${error.status}: ${error.message}`;
      }
    }

    return throwError(() => new Error(errorMessage));
  };
}
```

---

## 🎯 Checklist de Implementación

- [ ] Crear servicio Angular para llamar a `/api/facebook/connect`
- [ ] Agregar botón "Conectar Facebook" en el componente
- [ ] Implementar redirección a `authorizationUrl`
- [ ] Crear componente/ruta para manejar `/facebook-callback`
- [ ] Manejar parámetros `code` y `state` del callback
- [ ] Mostrar resultado al usuario (éxito/error)
- [ ] Manejar errores (401, 400, etc.)
- [ ] Agregar indicadores de carga
- [ ] Probar flujo completo end-to-end

---

## 📞 Soporte

Si tienes dudas o problemas:
1. Verifica que el token JWT sea válido
2. Revisa la consola del navegador para errores
3. Verifica que la URL de callback esté configurada en Facebook Developers
4. Asegúrate de que los scopes solicitados estén aprobados en tu app de Facebook

---

**Última actualización**: Enero 2025
