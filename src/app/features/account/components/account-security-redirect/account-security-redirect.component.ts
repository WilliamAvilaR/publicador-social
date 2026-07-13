import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { navigateToAccountSecurity } from '../../../../shared/utils/account-security.navigation';

/** Redirige /account/security[/link-review] al hub de Seguridad dentro del dashboard. */
@Component({
  selector: 'app-account-security-redirect',
  standalone: true,
  template: ''
})
export class AccountSecurityRedirectComponent implements OnInit {
  constructor(
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    const linked = this.route.snapshot.queryParamMap.get('linked') === '1';
    const linkReview =
      this.route.snapshot.queryParamMap.get('linkReview') === '1' ||
      this.router.url.includes('/account/security/link-review');
    navigateToAccountSecurity(this.router, { linked, linkReview, replaceUrl: true });
  }
}
