import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subscription, forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
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
  
  // Errores específicos de modales
  createError: string | null = null;
  
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
  selectedPageIds: number[] = [];
  selectedGroupIds: number[] = [];
  loadingAssets = false;
  
  // Estado del modal de creación (dos pasos)
  createStep: 1 | 2 = 1;
  searchQuery: string = '';
  activeTab: 'all' | 'pages' | 'groups' = 'all';
  
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
   * Carga la lista de colecciones
   */
  loadSegments(): void {
    this.loading = true;
    this.error = null;

    // Solo enviar archived=true si showArchived es true, de lo contrario undefined (solo activas)
    const archivedParam = this.showArchived ? true : undefined;
    
    const subscription = this.segmentsService.listSegments(archivedParam, true).subscribe({
      next: (segments) => {
        this.segments = segments;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error al cargar colecciones:', error);
        this.error = extractErrorMessage(error, 'Error al cargar las colecciones');
        this.loading = false;
      }
    });

    this.subscriptions.add(subscription);
  }

  /**
   * Carga el detalle de una colección
   */
  loadSegmentDetail(collectionId: number): void {
    this.loading = true;
    const subscription = this.segmentsService.getSegmentDetail(collectionId, true).subscribe({
      next: (detail) => {
        this.selectedSegment = detail;
        this.loading = false;
      },
      error: (error) => {
        this.error = extractErrorMessage(error, 'Error al cargar el detalle de la colección');
        this.loading = false;
      }
    });

    this.subscriptions.add(subscription);
  }

  /**
   * Abre el modal para crear una colección
   */
  openCreateModal(): void {
    this.createForm.reset();
    this.createError = null;
    this.createStep = 1;
    this.searchQuery = '';
    this.activeTab = 'all';
    this.selectedPageIds = [];
    this.selectedGroupIds = [];
    this.showCreateModal = true;
  }

  /**
   * Cierra el modal de crear
   */
  closeCreateModal(): void {
    this.showCreateModal = false;
    this.createForm.reset();
    this.createError = null;
    this.createStep = 1;
    this.searchQuery = '';
    this.activeTab = 'all';
    this.selectedPageIds = [];
    this.selectedGroupIds = [];
  }

  /**
   * Avanza al paso 2 del modal de creación (selección de activos)
   */
  goToStep2(): void {
    if (this.createForm.invalid) {
      markFormGroupTouched(this.createForm);
      return;
    }

    this.createStep = 2;
    this.loadAvailableAssets();
  }

  /**
   * Retrocede al paso 1 del modal de creación
   */
  goToStep1(): void {
    this.createStep = 1;
  }

  /**
   * Crea una nueva colección y agrega los items seleccionados
   */
  onCreateSubmit(): void {
    if (this.createForm.invalid) {
      markFormGroupTouched(this.createForm);
      return;
    }

    this.creating = true;
    this.createError = null;
    
    const request: CreateSegmentRequest = {
      name: this.createForm.value.name.trim(),
      description: this.createForm.value.description?.trim() || undefined
    };

    // Primero crear la colección
    const createSubscription = this.segmentsService.createSegment(request).subscribe({
      next: (response) => {
        // Si hay items seleccionados, agregarlos
        const totalSelected = this.selectedPageIds.length + this.selectedGroupIds.length;
        if (totalSelected > 0) {
          const addItemsRequest: AddItemsToSegmentRequest = {};
          
          if (this.selectedPageIds.length > 0) {
            addItemsRequest.pageIds = this.selectedPageIds;
          }
          
          if (this.selectedGroupIds.length > 0) {
            addItemsRequest.groupIds = this.selectedGroupIds;
          }

          const addItemsSubscription = this.segmentsService.addItemsToSegment(
            response.collectionId,
            addItemsRequest
          ).subscribe({
            next: (addResponse) => {
              this.creating = false;
              this.closeCreateModal();
              this.loadSegments();
            },
            error: (error) => {
              // La colección se creó pero falló al agregar items
              this.creating = false;
              this.createError = extractErrorMessage(error, 'La colección se creó pero hubo un error al agregar los activos');
              // Cerrar el modal después de un tiempo para que el usuario vea el mensaje
              setTimeout(() => {
                this.closeCreateModal();
                this.loadSegments();
              }, 3000);
            }
          });

          this.subscriptions.add(addItemsSubscription);
        } else {
          // No hay items seleccionados, solo cerrar
          this.creating = false;
          this.closeCreateModal();
          this.loadSegments();
        }
      },
      error: (error) => {
        this.creating = false;
        this.createError = extractErrorMessage(error, 'Error al crear la colección');
      }
    });

    this.subscriptions.add(createSubscription);
  }

  /**
   * Abre el modal para editar una colección
   */
  openEditModal(segment: SegmentListItem): void {
    this.loadSegmentDetail(segment.collectionId);
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
   * Actualiza una colección
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
      this.selectedSegment.collectionId,
      request
    ).subscribe({
      next: () => {
        this.updating = false;
        this.closeEditModal();
        this.loadSegments();
      },
      error: (error) => {
        this.updating = false;
        this.error = extractErrorMessage(error, 'Error al actualizar la colección');
      }
    });

    this.subscriptions.add(subscription);
  }

  /**
   * Abre el modal de confirmación para eliminar
   */
  openDeleteModal(segment: SegmentListItem): void {
    this.selectedSegment = {
      collectionId: segment.collectionId,
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
   * Elimina una colección
   */
  confirmDelete(): void {
    if (!this.selectedSegment) return;

    this.deleting = true;
    const subscription = this.segmentsService.deleteSegment(
      this.selectedSegment.collectionId
    ).subscribe({
      next: () => {
        this.deleting = false;
        this.closeDeleteModal();
        this.loadSegments();
      },
      error: (error) => {
        this.deleting = false;
        this.error = extractErrorMessage(error, 'Error al eliminar la colección');
      }
    });

    this.subscriptions.add(subscription);
  }

  /**
   * Archiva o desarchiva una colección
   */
  toggleArchive(segment: SegmentListItem, archive: boolean): void {
    const request: ArchiveSegmentRequest = { isArchived: archive };
    const subscription = this.segmentsService.archiveSegment(segment.collectionId, request).subscribe({
      next: () => {
        this.loadSegments();
      },
      error: (error) => {
        this.error = extractErrorMessage(error, `Error al ${archive ? 'archivar' : 'desarchivar'} la colección`);
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
      collectionId: segment.collectionId,
      name: segment.name
    };
    this.selectedPageIds = [];
    this.selectedGroupIds = [];
    this.loadAvailableAssets();
    this.showAddItemsModal = true;
  }

  /**
   * Cierra el modal de agregar items
   */
  closeAddItemsModal(): void {
    this.showAddItemsModal = false;
    this.selectedPageIds = [];
    this.selectedGroupIds = [];
    this.addItemsForm.reset();
  }

  /**
   * Carga los activos disponibles (páginas y grupos)
   */
  loadAvailableAssets(): void {
    this.loadingAssets = true;
    
    // Usar forkJoin para esperar a que ambas peticiones terminen
    const pages$ = this.facebookService.getConnectedPages().pipe(
      catchError(error => {
        console.error('Error al cargar páginas:', error);
        return of([]); // Retornar array vacío en caso de error
      })
    );

    const groups$ = this.groupsService.getGroups().pipe(
      catchError(error => {
        console.error('Error al cargar grupos:', error);
        return of({ data: [] }); // Retornar objeto con data vacía en caso de error
      })
    );

    const subscription = forkJoin({
      pages: pages$,
      groups: groups$
    }).subscribe({
      next: ({ pages, groups }) => {
        this.availablePages = pages.filter(p => p.isActive);
        this.availableGroups = groups.data.filter(g => g.isActive);
        this.loadingAssets = false;
      },
      error: (error) => {
        console.error('Error al cargar activos:', error);
        this.loadingAssets = false;
      }
    });

    this.subscriptions.add(subscription);
  }

  /**
   * Toggle selección de una página
   */
  togglePageSelection(pageId: number): void {
    const index = this.selectedPageIds.indexOf(pageId);
    if (index > -1) {
      this.selectedPageIds.splice(index, 1);
    } else {
      this.selectedPageIds.push(pageId);
    }
  }

  /**
   * Toggle selección de un grupo
   */
  toggleGroupSelection(groupId: number): void {
    const index = this.selectedGroupIds.indexOf(groupId);
    if (index > -1) {
      this.selectedGroupIds.splice(index, 1);
    } else {
      this.selectedGroupIds.push(groupId);
    }
  }

  /**
   * Verifica si una página está seleccionada
   */
  isPageSelected(pageId: number): boolean {
    return this.selectedPageIds.includes(pageId);
  }

  /**
   * Verifica si un grupo está seleccionado
   */
  isGroupSelected(groupId: number): boolean {
    return this.selectedGroupIds.includes(groupId);
  }

  /**
   * Obtiene el total de items seleccionados
   */
  getTotalSelectedCount(): number {
    return this.selectedPageIds.length + this.selectedGroupIds.length;
  }

  /**
   * Agrega items a la colección
   */
  onAddItemsSubmit(): void {
    const totalSelected = this.selectedPageIds.length + this.selectedGroupIds.length;
    if (totalSelected === 0 || !this.selectedSegment) {
      return;
    }

    this.addingItems = true;
    const request: AddItemsToSegmentRequest = {};
    
    if (this.selectedPageIds.length > 0) {
      request.pageIds = this.selectedPageIds;
    }
    
    if (this.selectedGroupIds.length > 0) {
      request.groupIds = this.selectedGroupIds;
    }

    const subscription = this.segmentsService.addItemsToSegment(
      this.selectedSegment.collectionId,
      request
    ).subscribe({
      next: (response) => {
        this.addingItems = false;
        this.closeAddItemsModal();
        this.loadSegments();
        if (this.selectedSegment) {
          this.loadSegmentDetail(this.selectedSegment.collectionId);
        }
        alert(`Se agregaron ${response.added} items. ${response.skippedDuplicates > 0 ? `${response.skippedDuplicates} duplicados omitidos.` : ''}`);
      },
      error: (error) => {
        this.addingItems = false;
        this.error = extractErrorMessage(error, 'Error al agregar items a la colección');
      }
    });

    this.subscriptions.add(subscription);
  }

  /**
   * Quita un item de la colección
   */
  removeItemFromSegment(item: SegmentItem): void {
    if (!this.selectedSegment || this.removingItem) return;

    if (!confirm(`¿Estás seguro de que deseas quitar "${item.name}" de la colección?`)) {
      return;
    }

    this.removingItem = true;
    const subscription = this.segmentsService.removeItemFromSegment(
      this.selectedSegment.collectionId,
      item.socialAssetId
    ).subscribe({
      next: () => {
        this.removingItem = false;
        if (this.selectedSegment) {
          this.loadSegmentDetail(this.selectedSegment.collectionId);
        }
        this.loadSegments();
      },
      error: (error) => {
        this.removingItem = false;
        this.error = extractErrorMessage(error, 'Error al quitar el item de la colección');
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
   * Obtiene el ID numérico de una página para usar en pageIds
   * 
   * Nota: El modelo FacebookPage no incluye un campo 'id' numérico directamente.
   * Este método intenta obtener el ID desde campos extendidos del objeto.
   * Si el backend devuelve el ID en la respuesta, debería estar disponible aquí.
   * 
   * Si este método retorna 0, significa que no se pudo obtener el ID y la página
   * no se podrá agregar a la colección. En ese caso, sería necesario que el backend
   * incluya el ID numérico en la respuesta de GET /api/Facebook/pages.
   */
  getPageAssetId(page: FacebookPage): number {
    // Intentar obtener el ID desde campos extendidos
    // El backend debería incluir el ID numérico en la respuesta
    return (page as any).id || (page as any).socialAssetId || (page as any).pageId || 0;
  }

  /**
   * Filtra las páginas según la búsqueda y el tab activo
   */
  getFilteredPages(): FacebookPage[] {
    let filtered = this.availablePages;

    // Filtrar por búsqueda
    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase().trim();
      filtered = filtered.filter(page => 
        page.name.toLowerCase().includes(query) ||
        page.facebookPageId?.toString().includes(query)
      );
    }

    return filtered;
  }

  /**
   * Filtra los grupos según la búsqueda y el tab activo
   */
  getFilteredGroups(): FacebookGroup[] {
    let filtered = this.availableGroups;

    // Filtrar por búsqueda
    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase().trim();
      filtered = filtered.filter(group => 
        group.name.toLowerCase().includes(query) ||
        group.facebookGroupId?.toString().includes(query)
      );
    }

    return filtered;
  }

  /**
   * Obtiene todos los activos filtrados (páginas y grupos) según el tab activo
   */
  getAllFilteredAssets(): Array<{type: 'page' | 'group', page?: FacebookPage, group?: FacebookGroup, id: number}> {
    const assets: Array<{type: 'page' | 'group', page?: FacebookPage, group?: FacebookGroup, id: number}> = [];

    if (this.activeTab === 'all' || this.activeTab === 'pages') {
      this.getFilteredPages().forEach(page => {
        assets.push({
          type: 'page',
          page,
          id: this.getPageAssetId(page)
        });
      });
    }

    if (this.activeTab === 'all' || this.activeTab === 'groups') {
      this.getFilteredGroups().forEach(group => {
        assets.push({
          type: 'group',
          group,
          id: group.id
        });
      });
    }

    return assets;
  }

  /**
   * Verifica si un activo está seleccionado
   */
  isAssetSelected(assetId: number, type: 'page' | 'group'): boolean {
    if (type === 'page') {
      return this.selectedPageIds.includes(assetId);
    } else {
      return this.selectedGroupIds.includes(assetId);
    }
  }

  /**
   * Toggle selección de un activo
   */
  toggleAssetSelection(assetId: number, type: 'page' | 'group'): void {
    if (type === 'page') {
      this.togglePageSelection(assetId);
    } else {
      this.toggleGroupSelection(assetId);
    }
  }

  /**
   * Obtiene la inicial de un activo para el placeholder
   */
  getAssetInitial(asset: {type: 'page' | 'group', page?: FacebookPage, group?: FacebookGroup}): string {
    const name = asset.type === 'page' ? asset.page?.name : asset.group?.name;
    return name?.charAt(0)?.toUpperCase() || '?';
  }
}
