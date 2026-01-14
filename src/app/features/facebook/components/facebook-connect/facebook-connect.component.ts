import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FacebookOAuthService } from '../../services/facebook-oauth.service';

@Component({
  selector: 'app-facebook-connect',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './facebook-connect.component.html',
  styleUrl: './facebook-connect.component.scss'
})
export class FacebookConnectComponent {
  loading = false;

  constructor(private facebookService: FacebookOAuthService) {}

  onConnectFacebook(): void {
    this.loading = true;
    
    try {
      this.facebookService.connectFacebook();
      // No necesitamos hacer loading = false porque el navegador se redirige
    } catch (error) {
      this.loading = false;
      console.error('Error al conectar Facebook:', error);
      alert('Error al conectar con Facebook. Por favor, intenta nuevamente.');
    }
  }
}
