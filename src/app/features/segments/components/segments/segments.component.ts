import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { SegmentsService } from '../../services/segments.service';
import { FacebookOAuthService } from '../../../../core/services/facebook-oauth.service';
import { FacebookGroupsService } from '../../../facebook/services/facebook-groups.service';
import {
  SegmentListItem,
  SegmentDetail,
  CreateSegmentRequest,
  UpdateSegmentRequest,
  ArchiveSegmentRequest,
  AddItemsToSegmentRequest,
  SegmentItem
} from '../../models/segment.model';
import { FacebookPage } from '../../../facebook/models/facebook.model';
import { FacebookGroup } from '../../../facebook/models/facebook.model';
import { extractErrorMessage } from '../../../../shared/utils/error.utils';
import { markFormGroupTouched } from '../../../../shared/utils/form.utils';

@Component({
  selector: 'app-segments',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './segments.component.html',
  styleUrl: './segments.component.scss'
})
export class SegmentsComponent implements OnInit, OnDestroy {
  segments: SegmentListItem[] = [];
  selectedSegment: SegmentDetail | null = null;
  loading = false;
  error: string | null = null;
  showArchived = false;
  
  // Modales
  showCreateModal = false;
  showEditModal = false;
  showDeleteModal = false;
  showAddItemsModal = false;
  
  // Formularios
  createForm!: FormGroup;
  editForm!: FormGroup;
  addItemsForm!: FormGroup;
  
  // Estados de carga
  creating = false;
  updating = false;
  deleting = false;
  addingItems = false;
  removingItem = false;
  
  // Datos para agregar items
  availablePages: FacebookPage[] = [];
  availableGroups: FacebookGroup[] = [];
  selectedAssetIds: number[] = [];
  loadingAssets = false;
  
  private subscriptions = new Subscription();

  constructor(
    private segmentsService: SegmentsService,
    private facebookService: FacebookOAuthService,
    private groupsService: FacebookGroupsService,
    private fb: FormBuilder
  ) {
    this.initForms();
  }

  ngOnInit(): void {
    this.loadSegments();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  /**
   * Inicializa los formularios
   */
  private initForms(): void {
    this.createForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
      description: ['']
    });

    this.editForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
      description: [''],
      isArchived: [false]
    });

    this.addItemsForm = this.fb.group({
      socialAssetIds: [[], Validators.required]
    });
  }

  /**
   * Carga la lista de segmentos
   */
  loadSegments(): void {
    this.loading = true;
    this.error = null;

    const subscription = this.segmentsService.listSegments(this.showArchived, true).subscribe({
      next: (segments) => {
        this.segments = segments;
        this.loading = false;
      },
      error: (error) => {
        this.error = extractErrorMessage(error, 'Error al cargar los segmentos');
        this.loading = false;
      }
    });

    this.subscriptions.add(subscription);
  }

  /**
   * Carga el detalle de un segmento
   */
  loadSegmentDetail(segmentId: number): void {
    this.loading = true;
    const subscription = this.segmentsService.getSegmentDetail(segmentId, true).subscribe({
      next: (detail) => {
        this.selectedSegment = detail;
        this.loading = false;
      },
      error: (error) => {
        this.error = extractErrorMessage(error, 'Error al cargar el detalle del segmento');
        this.loading = false;
      }
    });

    this.subscriptions.add(subscription);
  }

  /**
   * Abre el modal para crear un segmento
   */
  openCreateModal(): void {
    this.createForm.reset();
    this.showCreateModal = true;
  }

  /**
   * Cierra el modal de crear
   */
  closeCreateModal(): void {
    this.showCreateModal = false;
    this.createForm.reset();
  }

  /**
   * Crea un nuevo segmento
   */
  onCreateSubmit(): void {
    if (this.createForm.invalid) {
      markFormGroupTouched(this.createForm);
      return;
    }

    this.creating = true;
    const request: CreateSegmentRequest = {
      name: this.createForm.value.name.trim(),
      description: this.createForm.value.description?.trim() || undefined
    };

    const subscription = this.segmentsService.createSegment(request).subscribe({
      next: () => {
        this.creating = false;
        this.closeCreateModal();
        this.loadSegments();
      },
      error: (error) => {
        this.creating = false;
        this.error = extractErrorMessage(error, 'Error al crear el segmento');
      }
    });

    this.subscriptions.add(subscription);
  }

  /**
   * Abre el modal para editar un segmento
   */
  openEditModal(segment: SegmentListItem): void {
    this.loadSegmentDetail(segment.segmentId);
    this.editForm.patchValue({
      name: segment.name,
      isArchived: false
    });
    this.showEditModal = true;
  }

  /**
   * Cierra el modal de editar
   */
  closeEditModal(): void {
    this.showEditModal = false;
    this.selectedSegment = null;
    this.editForm.reset();
  }

  /**
   * Actualiza un segmento
   */
  onEditSubmit(): void {
    if (this.editForm.invalid || !this.selectedSegment) {
      markFormGroupTouched(this.editForm);
      return;
    }

    this.updating = true;
    const request: UpdateSegmentRequest = {
      name: this.editForm.value.name.trim(),
      description: this.editForm.value.description?.trim() || undefined,
      isArchived: this.editForm.value.isArchived
    };

    const subscription = this.segmentsService.updateSegment(
      this.selectedSegment.segmentId,
      request
    ).subscribe({
      next: () => {
        this.updating = false;
        this.closeEditModal();
        this.loadSegments();
      },
      error: (error) => {
        this.updating = false;
        this.error = extractErrorMessage(error, 'Error al actualizar el segmento');
      }
    });

    this.subscriptions.add(subscription);
  }

  /**
   * Abre el modal de confirmación para eliminar
   */
  openDeleteModal(segment: SegmentListItem): void {
    this.selectedSegment = {
      segmentId: segment.segmentId,
      name: segment.name
    };
    this.showDeleteModal = true;
  }

  /**
   * Cierra el modal de eliminar
   */
  closeDeleteModal(): void {
    this.showDeleteModal = false;
    this.selectedSegment = null;
  }

  /**
   * Elimina un segmento
   */
  confirmDelete(): void {
    if (!this.selectedSegment) return;

    this.deleting = true;
    const subscription = this.segmentsService.deleteSegment(
      this.selectedSegment.segmentId
    ).subscribe({
      next: () => {
        this.deleting = false;
        this.closeDeleteModal();
        this.loadSegments();
      },
      error: (error) => {
        this.deleting = false;
        this.error = extractErrorMessage(error, 'Error al eliminar el segmento');
      }
    });

    this.subscriptions.add(subscription);
  }

  /**
   * Archiva o desarchiva un segmento
   */
  toggleArchive(segment: SegmentListItem, archive: boolean): void {
    const request: ArchiveSegmentRequest = { isArchived: archive };
    const subscription = this.segmentsService.archiveSegment(segment.segmentId, request).subscribe({
      next: () => {
        this.loadSegments();
      },
      error: (error) => {
        this.error = extractErrorMessage(error, `Error al ${archive ? 'archivar' : 'desarchivar'} el segmento`);
      }
    });

    this.subscriptions.add(subscription);
  }

  /**
   * Formatea un número grande
   */
  formatNumber(value: number): string {
    return new Intl.NumberFormat('es-ES').format(value);
  }

  /**
   * Abre el modal para agregar items
   */
  openAddItemsModal(segment: SegmentListItem): void {
    this.selectedSegment = {
      segmentId: segment.segmentId,
      name: segment.name
    };
    this.selectedAssetIds = [];
    this.loadAvailableAssets();
    this.showAddItemsModal = true;
  }

  /**
   * Cierra el modal de agregar items
   */
  closeAddItemsModal(): void {
    this.showAddItemsModal = false;
    this.selectedAssetIds = [];
    this.addItemsForm.reset();
  }

  /**
   * Carga los activos disponibles (páginas y grupos)
   */
  loadAvailableAssets(): void {
    this.loadingAssets = true;
    
    const pagesSub = this.facebookService.getConnectedPages().subscribe({
      next: (pages) => {
        this.availablePages = pages.filter(p => p.isActive);
        this.loadingAssets = false;
      },
      error: (error) => {
        console.error('Error al cargar páginas:', error);
        this.loadingAssets = false;
      }
    });

    const groupsSub = this.groupsService.getGroups().subscribe({
      next: (response) => {
        this.availableGroups = response.data.filter(g => g.isActive);
        this.loadingAssets = false;
      },
      error: (error) => {
        console.error('Error al cargar grupos:', error);
        this.loadingAssets = false;
      }
    });

    this.subscriptions.add(pagesSub);
    this.subscriptions.add(groupsSub);
  }

  /**
   * Toggle selección de un activo
   */
  toggleAssetSelection(assetId: number): void {
    const index = this.selectedAssetIds.indexOf(assetId);
    if (index > -1) {
      this.selectedAssetIds.splice(index, 1);
    } else {
      this.selectedAssetIds.push(assetId);
    }
  }

  /**
   * Verifica si un activo está seleccionado
   */
  isAssetSelected(assetId: number): boolean {
    return this.selectedAssetIds.includes(assetId);
  }

  /**
   * Agrega items al segmento
   */
  onAddItemsSubmit(): void {
    if (this.selectedAssetIds.length === 0 || !this.selectedSegment) {
      return;
    }

    this.addingItems = true;
    const request: AddItemsToSegmentRequest = {
      socialAssetIds: this.selectedAssetIds
    };

    const subscription = this.segmentsService.addItemsToSegment(
      this.selectedSegment.segmentId,
      request
    ).subscribe({
      next: (response) => {
        this.addingItems = false;
        this.closeAddItemsModal();
        this.loadSegments();
        if (this.selectedSegment) {
          this.loadSegmentDetail(this.selectedSegment.segmentId);
        }
        alert(`Se agregaron ${response.added} items. ${response.skippedDuplicates > 0 ? `${response.skippedDuplicates} duplicados omitidos.` : ''}`);
      },
      error: (error) => {
        this.addingItems = false;
        this.error = extractErrorMessage(error, 'Error al agregar items al segmento');
      }
    });

    this.subscriptions.add(subscription);
  }

  /**
   * Quita un item del segmento
   */
  removeItemFromSegment(item: SegmentItem): void {
    if (!this.selectedSegment || this.removingItem) return;

    if (!confirm(`¿Estás seguro de que deseas quitar "${item.name}" del segmento?`)) {
      return;
    }

    this.removingItem = true;
    const subscription = this.segmentsService.removeItemFromSegment(
      this.selectedSegment.segmentId,
      item.socialAssetId
    ).subscribe({
      next: () => {
        this.removingItem = false;
        if (this.selectedSegment) {
          this.loadSegmentDetail(this.selectedSegment.segmentId);
        }
        this.loadSegments();
      },
      error: (error) => {
        this.removingItem = false;
        this.error = extractErrorMessage(error, 'Error al quitar el item del segmento');
      }
    });

    this.subscriptions.add(subscription);
  }

  /**
   * Formatea una fecha
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
   * Obtiene el ID del activo social de una página
   * Nota: El socialAssetId debe obtenerse del backend.
   * Por ahora, necesitamos un endpoint que devuelva los activos sociales con sus IDs.
   * Esta función es un placeholder que necesita ser implementada correctamente.
   * 
   * IMPORTANTE: El endpoint de segmentos espera `socialAssetId` que es un número interno
   * del sistema, no el `facebookPageId` que es un string. Necesitamos un endpoint que
   * devuelva los activos sociales disponibles con sus `socialAssetId` correspondientes.
   */
  getPageAssetId(page: FacebookPage): number {
    // TODO: Necesitamos un endpoint como GET /api/social-assets que devuelva:
    // { socialAssetId: number, facebookPageId: string, assetType: 'page' | 'group', ... }
    // Por ahora, intentamos usar el ID si está disponible en el objeto extendido
    return (page as any).id || (page as any).socialAssetId || 0;
  }
}
