import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FacebookOAuthService } from '../../../../core/services/facebook-oauth.service';
import { FacebookConnectComponent } from '../../../../shared/components/facebook-connect/facebook-connect.component';
import { FacebookGroupsService } from '../../../facebook/services/facebook-groups.service';
import { FacebookPage, FacebookGroup } from '../../../facebook/models/facebook.model';

@Component({
  selector: 'app-cuentas-conectadas',
  standalone: true,
  imports: [CommonModule, FormsModule, FacebookConnectComponent],
  templateUrl: './cuentas-conectadas.component.html',
  styleUrl: './cuentas-conectadas.component.scss'
})
export class CuentasConectadasComponent implements OnInit {
  pages: FacebookPage[] = [];
  groups: FacebookGroup[] = [];
  loading = true;
  loadingGroups = false;
  error: string | null = null;
  groupsError: string | null = null;
  imageErrors: Set<string> = new Set();
  groupImageErrors: Set<number> = new Set();
  updatingStatus: Set<string> = new Set();
  updatingGroupStatus: Set<string> = new Set();
  
  // Formulario para agregar grupo
  showAddGroupForm = false;
  groupUrl = '';
  addingGroup = false;

  constructor(
    private facebookService: FacebookOAuthService,
    private groupsService: FacebookGroupsService
  ) {}

  ngOnInit(): void {
    this.loadConnectedPages();
    this.loadGroups();
  }

  loadConnectedPages(): void {
    this.loading = true;
    this.error = null;
    this.imageErrors.clear();

    this.facebookService.getConnectedPages().subscribe({
      next: (pages) => {
        this.pages = pages;
        this.loading = false;
      },
      error: (error) => {
        this.error = error.message || 'Error al cargar las páginas conectadas';
        this.loading = false;
        console.error('Error al cargar páginas:', error);
      }
    });
  }

  onConnectSuccess(): void {
    // Recargar la lista después de conectar
    this.loadConnectedPages();
  }

  onImageError(pageId: string): void {
    this.imageErrors.add(pageId);
  }

  hasImageError(pageId: string): boolean {
    return this.imageErrors.has(pageId);
  }

  /**
   * Actualiza el estado (isActive) de una página de Facebook.
   * @param page Página de Facebook a actualizar
   * @param newStatus Nuevo estado (true = activa, false = inactiva)
   */
  updatePageStatus(page: FacebookPage, newStatus: boolean): void {
    // Si ya está actualizando o el estado es el mismo, no hacer nada
    if (this.updatingStatus.has(page.facebookPageId) || page.isActive === newStatus) {
      return;
    }

    this.updatingStatus.add(page.facebookPageId);

    this.facebookService.updatePageStatus(page.facebookPageId, newStatus).subscribe({
      next: (response) => {
        // Actualizar la página en el array local con los datos actualizados del servidor
        const index = this.pages.findIndex(p => p.facebookPageId === page.facebookPageId);
        if (index !== -1) {
          this.pages[index] = response.data;
        }
        this.updatingStatus.delete(page.facebookPageId);
      },
      error: (error) => {
        this.updatingStatus.delete(page.facebookPageId);
        console.error('Error al actualizar el estado de la página:', error);
        // Mostrar mensaje de error al usuario
        alert(error.message || 'Error al actualizar el estado de la página. Por favor, intenta nuevamente.');
      }
    });
  }

  /**
   * Verifica si una página está siendo actualizada.
   * @param pageId ID de la página
   */
  isUpdatingStatus(pageId: string): boolean {
    return this.updatingStatus.has(pageId);
  }

  // ============================================
  // Métodos para Grupos de Facebook
  // ============================================

  /**
   * Carga todos los grupos de Facebook del usuario.
   */
  loadGroups(): void {
    this.loadingGroups = true;
    this.groupsError = null;
    this.groupImageErrors.clear();

    this.groupsService.getGroups().subscribe({
      next: (response) => {
        this.groups = response.data;
        this.loadingGroups = false;
      },
      error: (error) => {
        this.groupsError = error.message || 'Error al cargar los grupos conectados';
        this.loadingGroups = false;
        console.error('Error al cargar grupos:', error);
      }
    });
  }

  /**
   * Muestra/oculta el formulario para agregar un grupo.
   */
  toggleAddGroupForm(): void {
    this.showAddGroupForm = !this.showAddGroupForm;
    if (!this.showAddGroupForm) {
      this.groupUrl = '';
    }
  }

  /**
   * Agrega un nuevo grupo de Facebook desde una URL.
   */
  addGroup(): void {
    if (!this.groupUrl || this.groupUrl.trim() === '') {
      alert('Por favor, ingresa la URL del grupo de Facebook');
      return;
    }

    if (this.addingGroup) {
      return;
    }

    this.addingGroup = true;
    const urlToAdd = this.groupUrl.trim();

    this.groupsService.addGroup(urlToAdd).subscribe({
      next: (response) => {
        // Agregar el nuevo grupo a la lista
        this.groups.unshift(response.data);
        // Limpiar el formulario
        this.groupUrl = '';
        this.showAddGroupForm = false;
        this.addingGroup = false;
      },
      error: (error) => {
        this.addingGroup = false;
        console.error('Error al agregar grupo:', error);
        alert(error.message || 'Error al agregar el grupo. Por favor, verifica que la URL sea correcta y que tengas permisos para acceder al grupo.');
      }
    });
  }

  /**
   * Maneja errores de carga de imágenes de grupos.
   */
  onGroupImageError(groupId: number): void {
    this.groupImageErrors.add(groupId);
  }

  /**
   * Verifica si una imagen de grupo tiene error.
   */
  hasGroupImageError(groupId: number): boolean {
    return this.groupImageErrors.has(groupId);
  }

  /**
   * Actualiza el estado (isActive) de un grupo de Facebook.
   * @param group Grupo de Facebook a actualizar
   * @param newStatus Nuevo estado (true = activo, false = inactivo)
   */
  updateGroupStatus(group: FacebookGroup, newStatus: boolean): void {
    // Si ya está actualizando o el estado es el mismo, no hacer nada
    if (this.updatingGroupStatus.has(group.facebookGroupId) || group.isActive === newStatus) {
      return;
    }

    this.updatingGroupStatus.add(group.facebookGroupId);

    this.groupsService.updateGroupStatus(group.facebookGroupId, newStatus).subscribe({
      next: (response) => {
        // Actualizar el grupo en el array local con los datos actualizados del servidor
        const index = this.groups.findIndex(g => g.facebookGroupId === group.facebookGroupId);
        if (index !== -1) {
          this.groups[index] = response.data;
        }
        this.updatingGroupStatus.delete(group.facebookGroupId);
      },
      error: (error) => {
        this.updatingGroupStatus.delete(group.facebookGroupId);
        console.error('Error al actualizar el estado del grupo:', error);
        // Mostrar mensaje de error al usuario
        alert(error.message || 'Error al actualizar el estado del grupo. Por favor, intenta nuevamente.');
      }
    });
  }

  /**
   * Verifica si un grupo está siendo actualizado.
   * @param groupId ID del grupo
   */
  isUpdatingGroupStatus(groupId: string): boolean {
    return this.updatingGroupStatus.has(groupId);
  }

  /**
   * Calcula el tiempo transcurrido desde una fecha.
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
    } else if (diffInSeconds < 2592000) {
      const days = Math.floor(diffInSeconds / 86400);
      return `hace ${days} ${days === 1 ? 'día' : 'días'}`;
    } else {
      const months = Math.floor(diffInSeconds / 2592000);
      return `hace ${months} ${months === 1 ? 'mes' : 'meses'}`;
    }
  }
}
