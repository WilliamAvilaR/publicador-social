import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/login',
    pathMatch: 'full'
  },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/components/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'register',
    loadComponent: () => import('./features/auth/components/register.component').then(m => m.RegisterComponent)
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./features/dashboard/components/dashboard/dashboard.component').then(m => m.DashboardComponent),
    canActivate: [authGuard],
    children: [
      {
        path: '',
        loadComponent: () => import('./features/dashboard/components/dashboard-overview/dashboard-overview.component').then(m => m.DashboardOverviewComponent)
      },
      {
        path: 'cuentas',
        loadComponent: () => import('./features/dashboard/components/cuentas-conectadas/cuentas-conectadas.component').then(m => m.CuentasConectadasComponent)
      },
      {
        path: 'programador',
        loadComponent: () => import('./features/scheduler/components/programador/programador.component').then(m => m.ProgramadorComponent)
      },
      {
        path: 'analiticas',
        loadComponent: () => import('./features/facebook/components/analytics/analytics.component').then(m => m.AnalyticsComponent)
      }
    ]
  },
  {
    path: 'facebook-callback',
    loadComponent: () => import('./features/facebook/components/facebook-callback/facebook-callback.component').then(m => m.FacebookCallbackComponent)
  },
  {
    path: 'facebook-connected',
    loadComponent: () => import('./features/facebook/components/facebook-success/facebook-success.component').then(m => m.FacebookSuccessComponent)
  }
];
