import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { FacebookOAuthService } from '../../../../core/services/facebook-oauth.service';
import { FacebookAnalyticsService } from '../../services/facebook-analytics.service';
import { PageOverview, PageOverviewConnectionAlert } from '../../models/facebook.model';

@Component({
  selector: 'app-page-detail',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './page-detail.component.html',
  styleUrl: './page-detail.component.scss'
})
export class PageDetailComponent implements OnInit, OnDestroy {
  pageId: string | null = null;
  overview: PageOverview | null = null;
  loading = true;
  error: string | null = null;
  syncing = false;

  private subscriptions = new Subscription();

  constructor(
    private route: ActivatedRoute,
    public router: Router,
    private facebookService: FacebookOAuthService,
    private analyticsService: FacebookAnalyticsService
  ) {}

  ngOnInit(): void {
    this.pageId = this.route.snapshot.paramMap.get('pageId');
    if (this.pageId) {
      this.loadPageOverview(this.pageId);
    } else {
      this.error = 'ID de página no válido';
      this.loading = false;
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  /**
   * Carga el overview completo de la página
   */
  loadPageOverview(pageId: string): void {
    this.loading = true;
    this.error = null;

    const overviewSubscription = this.facebookService.getPageOverview(pageId).subscribe({
      next: (response) => {
        this.overview = response.data;
        this.loading = false;
      },
      error: (error) => {
        this.error = error.message || 'Error al cargar la información de la página';
        this.loading = false;
        console.error('Error al cargar overview:', error);
      }
    });

    this.subscriptions.add(overviewSubscription);
  }

  /**
   * Sincroniza las métricas de la página
   */
  syncAnalytics(): void {
    if (!this.pageId || this.syncing) return;

    this.syncing = true;
    const syncSubscription = this.analyticsService.syncAnalytics({
      pageIds: [this.pageId],
      onlyActive: true
    }).subscribe({
      next: (response) => {
        this.syncing = false;
        // Recargar el overview después de sincronizar
        setTimeout(() => {
          if (this.pageId) {
            this.loadPageOverview(this.pageId);
          }
        }, 2000);
      },
      error: (error) => {
        this.syncing = false;
        console.error('Error al sincronizar:', error);
        alert('Error al sincronizar métricas. Por favor, intenta nuevamente.');
      }
    });

    this.subscriptions.add(syncSubscription);
  }

  /**
   * Navega a la vista de mensajes de la página
   */
  goToMessages(): void {
    if (this.pageId) {
      this.router.navigate(['/dashboard/mensajes'], {
        queryParams: { pageId: this.pageId }
      });
    }
  }

  /**
   * Navega a programar una publicación para esta página
   */
  goToScheduler(): void {
    this.router.navigate(['/dashboard/programador'], {
      queryParams: { pageId: this.pageId }
    });
  }

  /**
   * Obtiene el icono según la severidad de la alerta
   */
  getAlertIcon(alert: PageOverviewConnectionAlert): string {
    switch (alert.severity) {
      case 'error':
      case 'critical':
        return '❌';
      case 'warning':
        return '⚠️';
      case 'info':
        return 'ℹ️';
      case 'success':
        return '✅';
      default:
        return 'ℹ️';
    }
  }

  /**
   * Formatea un número grande con separadores de miles
   */
  formatNumber(value: number): string {
    return new Intl.NumberFormat('es-ES').format(value);
  }

  /**
   * Obtiene el tiempo transcurrido desde una fecha
   */
  getTimeAgo(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) {
      return 'hace unos segundos';
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `hace ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `hace ${hours} ${hours === 1 ? 'hora' : 'horas'}`;
    } else {
      const days = Math.floor(diffInSeconds / 86400);
      return `hace ${days} ${days === 1 ? 'día' : 'días'}`;
    }
  }

  /**
   * Formatea una fecha para mostrar
   */
  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Obtiene la URL de Facebook de la página
   */
  getFacebookPageUrl(): string {
    if (this.pageId) {
      return `https://www.facebook.com/${this.pageId}`;
    }
    return '#';
  }

  /**
   * Obtiene el valor absoluto de un número
   */
  getAbsoluteValue(value: number): number {
    return Math.abs(value);
  }
}
