import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { PostPlanService } from '../../services/post-plan.service';
import { PostPlanDetails, PostTarget, PostTargetStatus } from '../../models/post-plan.model';

// Exportar PostTargetStatus para uso en template
export { PostTargetStatus };
import { extractErrorMessage } from '../../../../shared/utils/error.utils';

@Component({
  selector: 'app-post-plan-details',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './post-plan-details.component.html',
  styleUrl: './post-plan-details.component.scss'
})
export class PostPlanDetailsComponent implements OnInit, OnDestroy {
  @Input() planId!: number;

  planDetails: PostPlanDetails | null = null;
  loading = true;
  error: string | null = null;
  PostTargetStatus = PostTargetStatus; // Exponer enum para uso en template
  private subscriptions = new Subscription();

  constructor(private postPlanService: PostPlanService) {}

  ngOnInit(): void {
    if (this.planId) {
      this.loadPlanDetails();
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  loadPlanDetails(): void {
    this.loading = true;
    this.error = null;

    const detailsSubscription = this.postPlanService.getPostPlanDetails(this.planId).subscribe({
      next: (response) => {
        this.planDetails = response.data;
        this.loading = false;
      },
      error: (error) => {
        this.error = extractErrorMessage(
          error,
          'Error al cargar los detalles del plan. Por favor, intenta nuevamente.'
        );
        this.loading = false;
      }
    });

    this.subscriptions.add(detailsSubscription);
  }

  getStatusLabel(status: PostTargetStatus): string {
    const labels: Record<PostTargetStatus, string> = {
      [PostTargetStatus.Pending]: 'Pendiente',
      [PostTargetStatus.Published]: 'Publicado',
      [PostTargetStatus.Failed]: 'Fallido',
      [PostTargetStatus.Skipped]: 'Omitido'
    };
    return labels[status] || 'Desconocido';
  }

  getStatusClass(status: PostTargetStatus): string {
    const classes: Record<PostTargetStatus, string> = {
      [PostTargetStatus.Pending]: 'status-pending',
      [PostTargetStatus.Published]: 'status-published',
      [PostTargetStatus.Failed]: 'status-failed',
      [PostTargetStatus.Skipped]: 'status-skipped'
    };
    return classes[status] || 'status-unknown';
  }

  getStatusIcon(status: PostTargetStatus): string {
    const icons: Record<PostTargetStatus, string> = {
      [PostTargetStatus.Pending]: '⏳',
      [PostTargetStatus.Published]: '✅',
      [PostTargetStatus.Failed]: '❌',
      [PostTargetStatus.Skipped]: '⏭️'
    };
    return icons[status] || '❓';
  }

  formatDate(dateString: string): string {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getTargetsByStatus(status: PostTargetStatus): PostTarget[] {
    if (!this.planDetails) return [];
    return this.planDetails.targets.filter(target => target.status === status);
  }

  getTotalTargets(): number {
    return this.planDetails?.targets.length || 0;
  }
}
