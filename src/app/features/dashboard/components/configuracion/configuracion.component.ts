import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../../../../core/services/auth.service';
import { UserData, UserProfileData } from '../../../../core/models/auth.model';
import { AccountSecurityComponent } from '../../../account/components/account-security/account-security.component';
import { EditProfileComponent } from '../../../auth/components/edit-profile/edit-profile.component';
import { EditPreferencesComponent } from '../../../auth/components/edit-preferences/edit-preferences.component';
import { TenantTeamComponent } from './tenant-team.component';

type ConfigSection = 'perfil' | 'seguridad' | 'notificaciones' | 'preferencias' | 'equipo';

@Component({
  selector: 'app-configuracion',
  standalone: true,
  imports: [CommonModule, TranslateModule, AccountSecurityComponent, EditProfileComponent, EditPreferencesComponent, TenantTeamComponent],
  templateUrl: './configuracion.component.html',
  styleUrl: './configuracion.component.scss'
})
export class ConfiguracionComponent implements OnInit, OnDestroy {
  user: UserData | UserProfileData | null = null;
  activeSection: ConfigSection = 'perfil';

  private subscriptions = new Subscription();

  constructor(
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    // Verificar autenticación
    if (!this.authService.isAuthenticated()) {
      this.router.navigate(['/login']);
      return;
    }

    this.user = this.authService.getUser();

    const sub = this.route.queryParams.subscribe(params => {
      const section = params['section'];
      if (
        section === 'seguridad' ||
        section === 'perfil' ||
        section === 'notificaciones' ||
        section === 'preferencias' ||
        section === 'equipo'
      ) {
        this.activeSection = section;
      }
    });
    this.subscriptions.add(sub);
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  setActiveSection(section: ConfigSection) {
    this.activeSection = section;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { section },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  onPasswordChanged() {
    // El componente de cambio de contraseña manejará su propio éxito
    // Aquí solo podríamos hacer alguna acción adicional si es necesario
  }

  onProfileUpdated() {
    // Recargar datos del usuario después de actualizar el perfil
    this.user = this.authService.getUser();
  }

  onPreferencesUpdated() {
    // Las preferencias se actualizaron exitosamente
    // Aquí podríamos aplicar los cambios en tiempo real si es necesario
  }
}
