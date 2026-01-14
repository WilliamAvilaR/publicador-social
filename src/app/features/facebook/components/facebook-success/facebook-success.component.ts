import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-facebook-success',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './facebook-success.component.html',
  styleUrl: './facebook-success.component.scss'
})
export class FacebookSuccessComponent implements OnInit {
  success = false;
  pagesImported = 0;

  constructor(
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      this.success = params['success'] === 'true';
      this.pagesImported = parseInt(params['pagesImported'] || '0', 10);
    });
  }

  goToDashboard(): void {
    this.router.navigate(['/dashboard/cuentas']);
  }
}
