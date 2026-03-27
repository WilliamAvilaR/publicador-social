import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { TenantService } from './tenant.service';

/**
 * Cumple la guía: tras `requiresReauth` o cabecera `X-Requires-Reauth`,
 * renovar JWT (refresh) y rehidratar lista de tenants / rol en contexto.
 */
@Injectable({
  providedIn: 'root'
})
export class TenantReauthService {
  private inFlight = false;

  constructor(
    private auth: AuthService,
    private tenantService: TenantService
  ) {}

  handleRequiresReauthSignal(): void {
    if (this.inFlight || !this.auth.isAuthenticated()) {
      return;
    }
    this.inFlight = true;
    this.auth.refreshToken().subscribe({
      next: (res) => {
        this.auth.setAuthData(res.data.token, res.data);
        this.tenantService.getUserTenants().subscribe({
          next: (response) => {
            const tenants = this.tenantService.getTenantsListFromResponse(response);
            this.tenantService.reconcileContextWithTenantList(tenants);
            this.inFlight = false;
          },
          error: () => {
            this.inFlight = false;
          }
        });
      },
      error: () => {
        this.inFlight = false;
      }
    });
  }

  /**
   * Tras aceptar invitación el JWT ya viene nuevo en `data`; solo reconstruir tenants.
   */
  rehydrateTenantsAfterNewSession(): Observable<void> {
    return this.tenantService.getUserTenants().pipe(
      map((response) => {
        const tenants = this.tenantService.getTenantsListFromResponse(response);
        this.tenantService.reconcileContextWithTenantList(tenants);
        return undefined;
      })
    );
  }
}
