import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SecurityToastService } from '../../services/security-toast.service';

@Component({
  selector: 'app-security-toast',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './security-toast.component.html',
  styleUrl: './security-toast.component.scss'
})
export class SecurityToastComponent {
  private readonly toastService = inject(SecurityToastService);
  readonly state$ = this.toastService.state$;

  close(): void {
    this.toastService.clear();
  }
}
