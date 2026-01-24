import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { UserData, UserProfileData } from '../../../../core/models/auth.model';
import { ChangePasswordComponent } from '../../../auth/components/change-password/change-password.component';
import { EditProfileComponent } from '../../../auth/components/edit-profile/edit-profile.component';

type ConfigSection = 'perfil' | 'seguridad' | 'notificaciones' | 'preferencias';

@Component({
  selector: 'app-configuracion',
  standalone: true,
  imports: [CommonModule, ChangePasswordComponent, EditProfileComponent],
  templateUrl: './configuracion.component.html',
  styleUrl: './configuracion.component.scss'
})
export class ConfiguracionComponent implements OnInit {
  user: UserData | UserProfileData | null = null;
  activeSection: ConfigSection = 'perfil';

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    // Verificar autenticación
    if (!this.authService.isAuthenticated()) {
      this.router.navigate(['/login']);
      return;
    }

    this.user = this.authService.getUser();
  }

  setActiveSection(section: ConfigSection) {
    this.activeSection = section;
  }

  onPasswordChanged() {
    // El componente de cambio de contraseña manejará su propio éxito
    // Aquí solo podríamos hacer alguna acción adicional si es necesario
  }

  onProfileUpdated() {
    // Recargar datos del usuario después de actualizar el perfil
    this.user = this.authService.getUser();
  }
}
