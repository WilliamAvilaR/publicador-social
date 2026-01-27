import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, RouterOutlet, NavigationEnd } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { filter } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import { AuthService } from '../../../../core/services/auth.service';
import { UserData, UserProfileData } from '../../../../core/models/auth.model';
import { FacebookConnectComponent } from '../../../../shared/components/facebook-connect/facebook-connect.component';

interface MenuItem {
  label: string;
  route?: string; // Opcional si tiene submenú
  icon?: string; // SVG como string opcional
  hasSubmenu?: boolean; // Flag para identificar si tiene submenú
  children?: MenuItem[]; // Submenú
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterOutlet, FacebookConnectComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit, OnDestroy {
  user: UserData | UserProfileData | null = null;
  sidebarCollapsed = false;
  showUserDropdown = false;
  showNotifications = false;
  activeSection = 'Dashboard';
  expandedMenuItems: Set<string> = new Set(); // Para trackear qué items están expandidos
  private subscriptions = new Subscription();

  menuItems: MenuItem[] = [
    { 
      label: 'Dashboard', 
      route: '/dashboard',
      icon: `<svg class="menu-icon" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24">
        <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m4 12 8-8 8 8M6 10.5V19a1 1 0 0 0 1 1h3v-3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v3h3a1 1 0 0 0 1-1v-8.5"/>
      </svg>`
    },
    { 
      label: 'Publicaciones', 
      route: '/dashboard/publicaciones',
      icon: `<svg class="menu-icon" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24">
        <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m12 18-7 3 7-18 7 18-7-3Zm0 0v-5"/>
      </svg>`
    },
    { 
      label: 'Programador', 
      route: '/dashboard/programador',
      icon: `<svg class="menu-icon" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24">
        <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/>
      </svg>`
    },
    { 
      label: 'Analíticas', 
      route: '/dashboard/analiticas',
      icon: `<svg class="menu-icon" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24">
        <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18.5A2.493 2.493 0 0 1 7.51 20H7.5a2.468 2.468 0 0 1-2.4-3.154 2.98 2.98 0 0 1-.85-5.274 2.468 2.468 0 0 1 .92-3.182 2.477 2.477 0 0 1 1.876-3.344 2.5 2.5 0 0 1 3.41-1.856A2.5 2.5 0 0 1 12 5.5m0 13v-13m0 13a2.493 2.493 0 0 0 4.49 1.5h.01a2.468 2.468 0 0 0 2.403-3.154 2.98 2.98 0 0 0 .847-5.274 2.468 2.468 0 0 0-.921-3.182 2.477 2.477 0 0 0-1.875-3.344A2.5 2.5 0 0 0 14.5 3 2.5 2.5 0 0 0 12 5.5m-8 5a2.5 2.5 0 0 1 3.48-2.3m-.28 8.551a3 3 0 0 1-2.953-5.185M20 10.5a2.5 2.5 0 0 0-3.481-2.3m.28 8.551a3 3 0 0 0 2.954-5.185"/>
      </svg>`,
      hasSubmenu: true,
      children: [
        {
          label: 'Páginas',
          route: '/dashboard/analiticas',
          icon: `<svg class="menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/>
          </svg>`
        },
        {
          label: 'Grupos',
          route: '/dashboard/analiticas',
          icon: `<svg class="menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
          </svg>`
        }
      ]
    },
    { 
      label: 'Mensajes', 
      route: '/dashboard/mensajes',
      icon: `<svg class="menu-icon" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24">
        <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
      </svg>`
    },
    { 
      label: 'Cuentas conectadas', 
      route: '/dashboard/cuentas',
      icon: `<svg class="menu-icon" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24">
        <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 12h4m-2 2v-4M4 18v-1a3 3 0 0 1 3-3h4a3 3 0 0 1 3 3v1a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1Zm8-10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/>
      </svg>`
    },
    { 
      label: 'Automatizaciones', 
      route: '/dashboard/automatizaciones',
      icon: `<svg class="menu-icon" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24">
        <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 6c0 1.657-3.134 3-7 3S5 7.657 5 6m14 0c0-1.657-3.134-3-7-3S5 4.343 5 6m14 0v6M5 6v6m0 0c0 1.657 3.134 3 7 3s7-1.343 7-3M5 12v6c0 1.657 3.134 3 7 3s7-1.343 7-3v-6"/>
      </svg>`
    },
    { 
      label: 'Integraciones', 
      route: '/dashboard/integraciones',
      icon: `<svg class="menu-icon" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24">
        <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5v14m8-7h-2m0 0h-2m2 0v2m0-2v-2M3 11h6m-6 4h6m11 4H4c-.55228 0-1-.4477-1-1V6c0-.55228.44772-1 1-1h16c.5523 0 1 .44772 1 1v12c0 .5523-.4477 1-1 1Z"/>
      </svg>`
    }
  ];

  constructor(
    private authService: AuthService,
    private router: Router,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit() {
    // Verificar autenticación
    if (!this.authService.isAuthenticated()) {
      this.router.navigate(['/login']);
      return;
    }

    this.user = this.authService.getUser();

    if (!this.user) {
      // Si no hay datos de usuario pero hay token, limpiar y redirigir
      this.authService.logout();
      this.router.navigate(['/login']);
      return;
    }

    // Detectar sección activa desde la ruta
    this.updateActiveSection();
    const navigationSubscription = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        this.updateActiveSection();
        // Auto-expandir submenú de Analíticas si estamos en esa ruta
        const analyticsItem = this.menuItems.find(item => item.label === 'Analíticas');
        if (analyticsItem && this.router.url.startsWith('/dashboard/analiticas')) {
          if (!this.expandedMenuItems.has('Analíticas')) {
            this.expandedMenuItems.add('Analíticas');
          }
        }
      });

    this.subscriptions.add(navigationSubscription);
    
    // Auto-expandir submenú de Analíticas si estamos en esa ruta al iniciar
    if (this.router.url.startsWith('/dashboard/analiticas')) {
      const analyticsItem = this.menuItems.find(item => item.label === 'Analíticas');
      if (analyticsItem) {
        this.expandedMenuItems.add('Analíticas');
      }
    }

    // Cerrar dropdowns al hacer click fuera (mejora UX)
    this.handleDocumentClick = this.handleDocumentClick.bind(this);
    document.addEventListener('click', this.handleDocumentClick);
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
    document.removeEventListener('click', this.handleDocumentClick);
  }

  private handleDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;

    // Cerrar dropdown de usuario si se hace click fuera
    if (!target.closest('.user-menu')) {
      this.showUserDropdown = false;
    }

    // Cerrar dropdown de notificaciones si se hace click fuera
    if (!target.closest('.notifications-btn') && !target.closest('.notifications-dropdown')) {
      this.showNotifications = false;
    }
  }

  updateActiveSection() {
    const currentRoute = this.router.url;
    const urlTree = this.router.parseUrl(currentRoute);
    const queryParams = urlTree.queryParams;
    
    // Buscar en items principales y submenús
    for (const item of this.menuItems) {
      if (item.hasSubmenu && item.children) {
        // Verificar si alguna subopción está activa (por ruta o query params)
        const activeChild = item.children.find(child => {
          const baseMatch = currentRoute === child.route || currentRoute.startsWith(child.route + '/');
          // También verificar por query params
          const categoryMatch = child.label === 'Páginas' && queryParams['category'] === 'pages' ||
                               child.label === 'Grupos' && queryParams['category'] === 'groups';
          return baseMatch && (categoryMatch || !queryParams['category']);
        });
        
        if (activeChild || (currentRoute.startsWith('/dashboard/analiticas') && queryParams['category'])) {
          this.activeSection = activeChild ? `${item.label} - ${activeChild.label}` : item.label;
          // Auto-expandir el submenú si está activo
          if (!this.expandedMenuItems.has(item.label)) {
            this.expandedMenuItems.add(item.label);
          }
          return;
        }
      } else if (item.route && (currentRoute === item.route || currentRoute.startsWith(item.route + '/'))) {
        this.activeSection = item.label;
        return;
      }
    }
    
    if (currentRoute === '/dashboard' || currentRoute.startsWith('/dashboard')) {
      this.activeSection = 'Dashboard';
    } else {
      this.activeSection = 'Dashboard';
    }
  }

  /**
   * Toggle del submenú expandible
   */
  toggleSubmenu(itemLabel: string, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    
    if (this.expandedMenuItems.has(itemLabel)) {
      this.expandedMenuItems.delete(itemLabel);
    } else {
      this.expandedMenuItems.add(itemLabel);
    }
  }

  /**
   * Verifica si un item del menú está expandido
   */
  isSubmenuExpanded(itemLabel: string): boolean {
    return this.expandedMenuItems.has(itemLabel);
  }

  /**
   * Verifica si un submenú está activo basado en la ruta y query params
   */
  isSubmenuActive(childRoute: string, expectedCategory: string): boolean {
    const currentRoute = this.router.url;
    const urlTree = this.router.parseUrl(currentRoute);
    const queryParams = urlTree.queryParams;
    
    const routeMatch = currentRoute === childRoute || currentRoute.startsWith(childRoute + '/');
    const categoryMatch = queryParams['category'] === expectedCategory;
    
    return routeMatch && categoryMatch;
  }

  get currentRoute(): string {
    return this.router.url;
  }

  toggleSidebar() {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }

  toggleUserDropdown() {
    this.showUserDropdown = !this.showUserDropdown;
  }

  toggleNotifications() {
    this.showNotifications = !this.showNotifications;
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  navigateTo(route: string) {
    this.router.navigate([route]);
    this.showUserDropdown = false;
  }

  getUserInitials(): string {
    if (!this.user?.fullName) return 'U';
    const names = this.user.fullName.split(' ');
    if (names.length >= 2) {
      return (names[0][0] + names[1][0]).toUpperCase();
    }
    return names[0][0].toUpperCase();
  }

  getIconHtml(icon: string | undefined): SafeHtml | null {
    if (!icon) return null;
    return this.sanitizer.bypassSecurityTrustHtml(icon);
  }

  getNotificationIcon(): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(`
      <svg class="notification-icon" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24">
        <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5.464V3.099m0 2.365a5.338 5.338 0 0 1 5.133 5.368v1.8c0 2.386 1.867 2.982 1.867 4.175C19 17.4 19 18 18.462 18H5.538C5 18 5 17.4 5 16.807c0-1.193 1.867-1.789 1.867-4.175v-1.8A5.338 5.338 0 0 1 12 5.464ZM6 5 5 4M4 9H3m15-4 1-1m1 5h1M8.54 18a3.48 3.48 0 0 0 6.92 0H8.54Z"/>
      </svg>
    `);
  }

  getConfigIcon(): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(`
      <svg class="menu-icon" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24">
        <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 13v-2a1 1 0 0 0-1-1h-.757l-.707-1.707.535-.536a1 1 0 0 0 0-1.414l-1.414-1.414a1 1 0 0 0-1.414 0l-.536.535L14 4.757V4a1 1 0 0 0-1-1h-2a1 1 0 0 0-1 1v.757l-1.707.707-.536-.535a1 1 0 0 0-1.414 0L4.929 6.343a1 1 0 0 0 0 1.414l.536.536L4.757 10H4a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h.757l.707 1.707-.535.536a1 1 0 0 0 0 1.414l1.414 1.414a1 1 0 0 0 1.414 0l.536-.535 1.707.707V20a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-.757l1.707-.708.536.536a1 1 0 0 0 1.414 0l1.414-1.414a1 1 0 0 0 0-1.414l-.535-.536.707-1.707H20a1 1 0 0 0 1-1Z"/>
        <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/>
      </svg>
    `);
  }
}
