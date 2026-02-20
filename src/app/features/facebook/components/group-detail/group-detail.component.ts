import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { FacebookGroupsService } from '../../services/facebook-groups.service';
import { GroupOverview, GroupOverviewConnectionAlert } from '../../models/facebook.model';

@Component({
  selector: 'app-group-detail',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './group-detail.component.html',
  styleUrl: './group-detail.component.scss'
})
export class GroupDetailComponent implements OnInit, OnDestroy {
  groupId: string | null = null;
  overview: GroupOverview | null = null;
  loading = true;
  error: string | null = null;

  private subscriptions = new Subscription();

  constructor(
    private route: ActivatedRoute,
    public router: Router,
    private groupsService: FacebookGroupsService
  ) {}

  ngOnInit(): void {
    this.groupId = this.route.snapshot.paramMap.get('groupId');
    if (this.groupId) {
      this.loadGroupOverview(this.groupId);
    } else {
      this.error = 'ID de grupo no válido';
      this.loading = false;
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  /**
   * Carga el overview completo del grupo
   */
  loadGroupOverview(groupId: string): void {
    this.loading = true;
    this.error = null;

    const overviewSubscription = this.groupsService.getGroupOverview(groupId).subscribe({
      next: (response) => {
        this.overview = response.data;
        this.loading = false;
      },
      error: (error) => {
        this.error = error.message || 'Error al cargar la información del grupo';
        this.loading = false;
        console.error('Error al cargar overview:', error);
      }
    });

    this.subscriptions.add(overviewSubscription);
  }

  /**
   * Navega a programar una publicación para este grupo
   */
  goToScheduler(): void {
    this.router.navigate(['/dashboard/programador'], {
      queryParams: { groupId: this.groupId }
    });
  }

  /**
   * Obtiene el icono según la severidad de la alerta
   */
  getAlertIcon(alert: GroupOverviewConnectionAlert): string {
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
   * Obtiene la URL de Facebook del grupo
   */
  getFacebookGroupUrl(): string {
    if (this.overview?.header.originalUrl) {
      return this.overview.header.originalUrl;
    }
    if (this.groupId) {
      return `https://www.facebook.com/groups/${this.groupId}`;
    }
    return '#';
  }
}
