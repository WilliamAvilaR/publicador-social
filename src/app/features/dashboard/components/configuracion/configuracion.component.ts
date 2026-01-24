import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { UserData } from '../../../../core/models/auth.model';
import { ChangePasswordComponent } from '../../../auth/components/change-password/change-password.component';

type ConfigSection = 'perfil' | 'seguridad' | 'notificaciones' | 'preferencias';

@Component({
  selector: 'app-configuracion',
  standalone: true,
  imports: [CommonModule, ChangePasswordComponent],
  templateUrl: './configuracion.component.html',
  styleUrl: './configuracion.component.scss'
})
export class ConfiguracionComponent implements OnInit {
  user: UserData | null = null;
  activeSection: ConfigSection = 'seguridad';

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
}
