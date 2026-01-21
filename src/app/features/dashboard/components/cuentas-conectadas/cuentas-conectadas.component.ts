import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FacebookOAuthService } from '../../../../core/services/facebook-oauth.service';
import { FacebookConnectComponent } from '../../../../shared/components/facebook-connect/facebook-connect.component';
import { FacebookPage } from '../../../facebook/models/facebook.model';

@Component({
  selector: 'app-cuentas-conectadas',
  standalone: true,
  imports: [CommonModule, FacebookConnectComponent],
  templateUrl: './cuentas-conectadas.component.html',
  styleUrl: './cuentas-conectadas.component.scss'
})
export class CuentasConectadasComponent implements OnInit {
  pages: FacebookPage[] = [];
  loading = true;
  error: string | null = null;
  imageErrors: Set<string> = new Set();
  updatingStatus: Set<string> = new Set();

  constructor(private facebookService: FacebookOAuthService) {}

  ngOnInit(): void {
    this.loadConnectedPages();
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
}
