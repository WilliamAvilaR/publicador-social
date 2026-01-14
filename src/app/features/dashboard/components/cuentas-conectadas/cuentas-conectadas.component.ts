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
}
