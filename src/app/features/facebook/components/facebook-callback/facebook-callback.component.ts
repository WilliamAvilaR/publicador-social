import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { FacebookCallbackResponse } from '../../models/facebook.model';

@Component({
  selector: 'app-facebook-callback',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './facebook-callback.component.html',
  styleUrl: './facebook-callback.component.scss'
})
export class FacebookCallbackComponent implements OnInit {
  loading = true;
  result: FacebookCallbackResponse['data'] | null = null;
  error: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      const code = params['code'];
      const state = params['state'];

      if (!code || !state) {
        this.error = 'Parámetros de autorización faltantes.';
        this.loading = false;
        return;
      }

      // El backend ya procesó el callback cuando Facebook redirigió
      // Solo necesitamos obtener el resultado si el backend lo expone
      // Por ahora, redirigimos a la página de éxito después de un breve delay
      setTimeout(() => {
        this.router.navigate(['/facebook-connected'], {
          queryParams: {
            success: 'true',
            pagesImported: params['pagesImported'] || 0
          }
        });
      }, 2000);
    });
  }

  goToDashboard(): void {
    this.router.navigate(['/dashboard']);
  }
}
