import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { navigateToAccountSecurity } from '../../../../shared/utils/account-security.navigation';

@Component({
  selector: 'app-link-review-redirect',
  standalone: true,
  template: ''
})
export class LinkReviewRedirectComponent implements OnInit {
  constructor(private router: Router) {}

  ngOnInit(): void {
    navigateToAccountSecurity(this.router, { step: 'link-review', replaceUrl: true });
  }
}
