import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { catchError, finalize, map, tap } from 'rxjs/operators';
import { TenantEntitlementsResponse } from '../models/tenant.model';
import { TenantService } from './tenant.service';
import { TenantContextService } from './tenant-context.service';

@Injectable({
  providedIn: 'root'
})
export class TenantEntitlementsService {
  private readonly entitlementsSubject = new BehaviorSubject<TenantEntitlementsResponse['data'] | null>(null);
  private readonly loadingSubject = new BehaviorSubject<boolean>(false);
  private readonly errorSubject = new BehaviorSubject<string | null>(null);

  entitlements$: Observable<TenantEntitlementsResponse['data'] | null> = this.entitlementsSubject.asObservable();
  loading$: Observable<boolean> = this.loadingSubject.asObservable();
  error$: Observable<string | null> = this.errorSubject.asObservable();

  constructor(
    private tenantService: TenantService,
    private tenantContext: TenantContextService
  ) {}

  getCurrentEntitlements(): TenantEntitlementsResponse['data'] | null {
    return this.entitlementsSubject.value;
  }

  /**
   * Normaliza respuesta del backend (PascalCase) al modelo camelCase del front.
   */
  private normalizeEntitlementsData(raw: any): TenantEntitlementsResponse['data'] {
    if (!raw) return raw;

    const planInfoSrc = raw.planInfo ?? raw.PlanInfo;
    const planInfo = planInfoSrc
      ? {
          ...planInfoSrc,
          isPaid: planInfoSrc.isPaid ?? planInfoSrc.IsPaid ?? false,
          price: planInfoSrc.price ?? planInfoSrc.Price ?? null,
          isActive: planInfoSrc.isActive ?? planInfoSrc.IsActive ?? true,
          currency: planInfoSrc.currency ?? planInfoSrc.Currency
        }
      : (raw.planInfo ?? raw.PlanInfo);

    return {
      tenantId: raw.tenantId ?? raw.TenantId,
      tenantName: raw.tenantName ?? raw.TenantName,
      planCode: raw.planCode ?? raw.PlanCode ?? '',
      planName: raw.planName ?? raw.PlanName ?? '',
      planDescription: raw.planDescription ?? raw.PlanDescription ?? '',
      features: raw.features ?? raw.Features ?? {},
      limits: raw.limits ?? raw.Limits ?? {},
      currentUsage: raw.currentUsage ?? raw.CurrentUsage ?? {},
      planInfo: (planInfo ?? {
        isPaid: false,
        price: null,
        isActive: true
      }) as TenantEntitlementsResponse['data']['planInfo'],
      resolutionInfo: raw.resolutionInfo ?? raw.ResolutionInfo
    };
  }

  /**
   * Carga entitlements para el tenant actual (según TenantContextService).
   */
  refreshCurrentEntitlements(): Observable<TenantEntitlementsResponse['data'] | null> {
    const tenantId = this.tenantContext.getCurrentTenantId();
    if (tenantId == null) {
      this.entitlementsSubject.next(null);
      this.loadingSubject.next(false);
      this.errorSubject.next(null);
      return of(null);
    }

    this.loadingSubject.next(true);
    this.errorSubject.next(null);

    return this.tenantService.getTenantEntitlements(tenantId).pipe(
      map((resp) => this.normalizeEntitlementsData(resp.data)),
      tap((data) => this.entitlementsSubject.next(data)),
      catchError((err) => {
        const msg = err?.message || 'Error al cargar entitlements del tenant';
        this.errorSubject.next(msg);
        return of(null);
      }),
      finalize(() => this.loadingSubject.next(false))
    );
  }

  /**
   * Sobrecarga por si un componente quiere cargar entitlements para un tenant explícito.
   */
  refreshEntitlementsForTenant(tenantId: number): Observable<TenantEntitlementsResponse['data']> {
    if (tenantId == null) {
      return throwError(() => new Error('tenantId inválido para entitlements'));
    }

    this.loadingSubject.next(true);
    this.errorSubject.next(null);

    return this.tenantService.getTenantEntitlements(tenantId).pipe(
      map((resp) => this.normalizeEntitlementsData(resp.data)),
      tap((data) => this.entitlementsSubject.next(data)),
      catchError((err) => {
        const msg = err?.message || 'Error al cargar entitlements del tenant';
        this.errorSubject.next(msg);
        return throwError(() => err);
      }),
      finalize(() => this.loadingSubject.next(false))
    );
  }
}

