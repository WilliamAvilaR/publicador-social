import { Router } from '@angular/router';

/** Ruta principal de Seguridad dentro del dashboard. */
export const ACCOUNT_SECURITY_PATH = '/dashboard/configuracion';

export interface NavigateToAccountSecurityOptions {
  linked?: boolean;
  linkReview?: boolean;
  replaceUrl?: boolean;
}

export function buildAccountSecurityQueryParams(
  options?: NavigateToAccountSecurityOptions
): Record<string, string> {
  const queryParams: Record<string, string> = { section: 'seguridad' };
  if (options?.linked) {
    queryParams['linked'] = '1';
  }
  if (options?.linkReview) {
    queryParams['linkReview'] = '1';
  }
  return queryParams;
}

export function navigateToAccountSecurity(
  router: Router,
  options?: NavigateToAccountSecurityOptions
): void {
  router.navigate([ACCOUNT_SECURITY_PATH], {
    queryParams: buildAccountSecurityQueryParams(options),
    replaceUrl: options?.replaceUrl
  });
}
