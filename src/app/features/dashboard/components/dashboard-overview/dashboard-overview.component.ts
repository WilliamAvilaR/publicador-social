import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription, forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { FacebookOAuthService } from '../../../../core/services/facebook-oauth.service';
import { FacebookAnalyticsService } from '../../../facebook/services/facebook-analytics.service';
import { FacebookGroupsService } from '../../../facebook/services/facebook-groups.service';
import { FacebookPage, PageSnapshot, SyncLog, FacebookGroup, GroupSnapshot } from '../../../facebook/models/facebook.model';

interface PageWithSnapshot extends FacebookPage {
  snapshot?: PageSnapshot;
  loadingSnapshot?: boolean;
}

interface GroupWithSnapshot extends FacebookGroup {
  snapshot?: GroupSnapshot;
  loadingSnapshot?: boolean;
}

@Component({
  selector: 'app-dashboard-overview',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard-overview.component.html',
  styleUrl: './dashboard-overview.component.scss'
})
export class DashboardOverviewComponent implements OnInit, OnDestroy {
  pages: PageWithSnapshot[] = [];
  groups: GroupWithSnapshot[] = [];
  lastSyncLog: SyncLog | null = null;
  loading = true;
  error: string | null = null;
  syncing = false;
  syncProgress: string = '';
  private subscriptions = new Subscription();

  constructor(
    private facebookService: FacebookOAuthService,
    private analyticsService: FacebookAnalyticsService,
    private groupsService: FacebookGroupsService
  ) {}

  ngOnInit(): void {
    this.loadDashboardData();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  /**
   * Carga los datos iniciales del dashboard: páginas, snapshots y último log de sincronización
   */
  loadDashboardData(): void {
    this.loading = true;
    this.error = null;

    // Cargar páginas y último log de sincronización en paralelo
    const pagesObservable = this.facebookService.getConnectedPages().pipe(
      catchError(error => {
        console.error('Error al cargar páginas:', error);
        return of([]);
      })
    );

    const syncLogsObservable = this.analyticsService.getSyncLogs(1).pipe(
      catchError(error => {
        console.error('Error al cargar logs de sincronización:', error);
        return of({ data: [] });
      })
    );

    const groupsObservable = this.groupsService.getGroups().pipe(
      catchError(error => {
        console.error('Error al cargar grupos:', error);
        return of({ data: [], meta: { totalCount: 0, pageSize: 0, currentPage: 0, totalPages: 0, hasNextPage: false, hasPreviusPage: false, nextPageUrl: '', previusPageUrl: '' } });
      })
    );

    const combinedSubscription = forkJoin({
      pages: pagesObservable,
      syncLogs: syncLogsObservable,
      groups: groupsObservable
    }).subscribe({
      next: ({ pages, syncLogs, groups }) => {
        this.pages = pages.map(page => ({ ...page, loadingSnapshot: true }));
        this.groups = groups.data.map(group => ({ ...group, loadingSnapshot: true }));
        this.lastSyncLog = syncLogs.data.length > 0 ? syncLogs.data[0] : null;

        // Cargar snapshots para cada página y grupo activo
        this.loadSnapshotsForPages();
        this.loadSnapshotsForGroups();
        this.loading = false;
      },
      error: (error) => {
        this.error = error.message || 'Error al cargar los datos del dashboard';
        this.loading = false;
        console.error('Error al cargar datos del dashboard:', error);
      }
    });

    this.subscriptions.add(combinedSubscription);
  }

  /**
   * Carga los snapshots para todas las páginas activas
   */
  private loadSnapshotsForPages(): void {
    this.pages.forEach((page, index) => {
      if (page.isActive) {
        this.loadPageSnapshot(page, index);
      } else {
        page.loadingSnapshot = false;
      }
    });
  }

  /**
   * Carga el snapshot de una página específica
   */
  private loadPageSnapshot(page: PageWithSnapshot, index: number): void {
    const snapshotSubscription = this.analyticsService.getPageSnapshot(page.facebookPageId).subscribe({
      next: (response) => {
        this.pages[index].snapshot = response.data;
        this.pages[index].loadingSnapshot = false;
      },
      error: (error) => {
        // Si no hay snapshot (404), no es un error crítico
        if (error.message.includes('404') || error.message.includes('No se encontraron')) {
          this.pages[index].snapshot = undefined;
        } else {
          console.error(`Error al cargar snapshot para ${page.name}:`, error);
        }
        this.pages[index].loadingSnapshot = false;
      }
    });

    this.subscriptions.add(snapshotSubscription);
  }

  /**
   * Carga los snapshots para todos los grupos activos
   */
  private loadSnapshotsForGroups(): void {
    this.groups.forEach((group, index) => {
      if (group.isActive) {
        this.loadGroupSnapshot(group, index);
      } else {
        group.loadingSnapshot = false;
      }
    });
  }

  /**
   * Carga el snapshot de un grupo específico
   */
  private loadGroupSnapshot(group: GroupWithSnapshot, index: number): void {
    const snapshotSubscription = this.groupsService.getGroupSnapshot(group.facebookGroupId).subscribe({
      next: (response) => {
        this.groups[index].snapshot = response.data;
        this.groups[index].loadingSnapshot = false;
      },
      error: (error) => {
        // Si no hay snapshot (404), no es un error crítico
        if (error.message.includes('404') || error.message.includes('No se encontraron')) {
          this.groups[index].snapshot = undefined;
        } else {
          console.error(`Error al cargar snapshot para ${group.name}:`, error);
        }
        this.groups[index].loadingSnapshot = false;
      }
    });

    this.subscriptions.add(snapshotSubscription);
  }

  /**
   * Sincroniza las métricas de todas las páginas activas
   */
  syncAnalytics(): void {
    if (this.syncing) {
      return;
    }

    this.syncing = true;
    this.syncProgress = 'Iniciando sincronización...';

    const activePageIds = this.pages
      .filter(page => page.isActive)
      .map(page => page.facebookPageId);

    const syncSubscription = this.analyticsService.syncAnalytics({
      pageIds: activePageIds.length > 0 ? activePageIds : undefined,
      onlyActive: true
    }).subscribe({
      next: (response) => {
        this.syncProgress = `Sincronización completada: ${response.data.pagesOk} páginas exitosas, ${response.data.pagesFailed} fallidas`;
        
        // Recargar datos después de la sincronización
        setTimeout(() => {
          this.loadDashboardData();
          this.syncing = false;
          this.syncProgress = '';
        }, 1000);
      },
      error: (error) => {
        this.syncProgress = `Error: ${error.message}`;
        this.syncing = false;
        console.error('Error al sincronizar:', error);
        
        // Ocultar mensaje de error después de 5 segundos
        setTimeout(() => {
          this.syncProgress = '';
        }, 5000);
      }
    });

    this.subscriptions.add(syncSubscription);
  }

  /**
   * Formatea la fecha relativa (ej: "hace 2 horas")
   */
  getTimeAgo(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) {
      return 'hace menos de un minuto';
    } else if (diffMins < 60) {
      return `hace ${diffMins} ${diffMins === 1 ? 'minuto' : 'minutos'}`;
    } else if (diffHours < 24) {
      return `hace ${diffHours} ${diffHours === 1 ? 'hora' : 'horas'}`;
    } else {
      return `hace ${diffDays} ${diffDays === 1 ? 'día' : 'días'}`;
    }
  }

  /**
   * Obtiene el estado de la última sincronización como texto
   */
  getSyncStatusText(): string {
    if (!this.lastSyncLog) {
      return 'Nunca sincronizado';
    }

    switch (this.lastSyncLog.status) {
      case 'Completed':
        return `Completada ${this.getTimeAgo(this.lastSyncLog.startedAt)}`;
      case 'Running':
        return 'En progreso...';
      case 'Failed':
        return `Fallida ${this.getTimeAgo(this.lastSyncLog.startedAt)}`;
      case 'Cancelled':
        return `Cancelada ${this.getTimeAgo(this.lastSyncLog.startedAt)}`;
      default:
        return 'Desconocido';
    }
  }

  /**
   * Obtiene la clase CSS para el estado de sincronización
   */
  getSyncStatusClass(): string {
    if (!this.lastSyncLog) {
      return 'status-unknown';
    }

    switch (this.lastSyncLog.status) {
      case 'Completed':
        return 'status-success';
      case 'Running':
        return 'status-running';
      case 'Failed':
        return 'status-error';
      case 'Cancelled':
        return 'status-cancelled';
      default:
        return 'status-unknown';
    }
  }
}
