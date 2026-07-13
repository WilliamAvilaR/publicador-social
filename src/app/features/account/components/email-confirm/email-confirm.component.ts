import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { take } from 'rxjs/operators';
import { AccountSecurityService } from '../../../../core/services/account-security.service';
import { AuthService } from '../../../../core/services/auth.service';
import { extractApiErrorCode } from '../../../../shared/utils/error.utils';
import { getAccountSecurityErrorMessage } from '../../../../shared/utils/account-security.errors';

@Component({
  selector: 'app-email-confirm',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './email-confirm.component.html',
  styleUrl: './email-confirm.component.scss'
})
export class EmailConfirmComponent implements OnInit, OnDestroy {
  processing = true;
  successMessage = '';
  errorMessage = '';

  private subscriptions = new Subscription();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private accountSecurity: AccountSecurityService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    const sub = this.route.queryParams.pipe(take(1)).subscribe(params => {
      const token = typeof params['token'] === 'string' ? params['token'] : '';
      if (!token) {
        this.processing = false;
        this.errorMessage = 'El enlace no es válido o ha expirado.';
        return;
      }
      this.confirm(token);
    });
    this.subscriptions.add(sub);
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  private confirm(token: string): void {
    const sub = this.accountSecurity.confirmEmailChange({ token }).subscribe({
      next: (res) => {
        this.processing = false;
        this.successMessage = res.message || 'Correo actualizado. Inicia sesión de nuevo.';
        this.authService.logout();
        setTimeout(() => this.router.navigate(['/login']), 2500);
      },
      error: (error: HttpErrorResponse) => {
        this.processing = false;
        this.errorMessage = getAccountSecurityErrorMessage(extractApiErrorCode(error));
      }
    });
    this.subscriptions.add(sub);
  }
}
