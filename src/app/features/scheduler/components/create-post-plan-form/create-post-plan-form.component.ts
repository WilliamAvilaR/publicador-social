import { Component, OnInit, OnDestroy, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { PostPlanService } from '../../services/post-plan.service';
import { FacebookOAuthService } from '../../../../core/services/facebook-oauth.service';
import { FacebookPage } from '../../../facebook/models/facebook.model';
import { markFormGroupTouched, isFieldInvalid } from '../../../../shared/utils/form.utils';
import { extractErrorMessage } from '../../../../shared/utils/error.utils';
import { getFieldError } from '../../../../shared/utils/validation.utils';

@Component({
  selector: 'app-create-post-plan-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './create-post-plan-form.component.html',
  styleUrl: './create-post-plan-form.component.scss'
})
export class CreatePostPlanFormComponent implements OnInit, OnDestroy {
  @Input() initialDate?: string; // Fecha inicial desde el calendario (ISO string)
  @Output() success = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  postPlanForm!: FormGroup;
  pages: FacebookPage[] = [];
  loadingPages = true;
  isLoading = false;
  errorMessage = '';
  private subscriptions = new Subscription();

  // Timezones comunes
  timezones = [
    { value: 'America/Bogota', label: 'Bogotá (GMT-5)' },
    { value: 'America/Mexico_City', label: 'Ciudad de México (GMT-6)' },
    { value: 'America/Argentina/Buenos_Aires', label: 'Buenos Aires (GMT-3)' },
    { value: 'America/Santiago', label: 'Santiago (GMT-3)' },
    { value: 'America/Lima', label: 'Lima (GMT-5)' },
    { value: 'America/Caracas', label: 'Caracas (GMT-4)' },
    { value: 'America/New_York', label: 'Nueva York (GMT-5)' },
    { value: 'America/Los_Angeles', label: 'Los Ángeles (GMT-8)' },
    { value: 'Europe/Madrid', label: 'Madrid (GMT+1)' },
    { value: 'UTC', label: 'UTC (GMT+0)' }
  ];

  constructor(
    private fb: FormBuilder,
    private postPlanService: PostPlanService,
    private facebookService: FacebookOAuthService
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.loadPages();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  initForm(): void {
    // Preparar fecha inicial
    let initialDateTime = '';
    if (this.initialDate) {
      const date = new Date(this.initialDate);
      // Formato para input datetime-local: YYYY-MM-DDTHH:mm
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      initialDateTime = `${year}-${month}-${day}T${hours}:${minutes}`;
    } else {
      // Si no hay fecha inicial, usar ahora + 1 hora
      const now = new Date();
      now.setHours(now.getHours() + 1);
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      initialDateTime = `${year}-${month}-${day}T${hours}:${minutes}`;
    }

    this.postPlanForm = this.fb.group({
      scheduledAt: [initialDateTime, [Validators.required]],
      timezone: ['America/Bogota', [Validators.required]],
      message: ['', [Validators.required, Validators.minLength(1), Validators.maxLength(5000)]],
      linkUrl: [''],
      imageUrl: [''],
      pageIds: [[]],
      dedupeKey: ['']
    });
  }

  loadPages(): void {
    this.loadingPages = true;
    const pagesSubscription = this.facebookService.getConnectedPages().subscribe({
      next: (pages) => {
        // Filtrar solo páginas que pueden publicar (isActive AND canPublish)
        this.pages = pages.filter(page => page.isActive && page.canPublish);
        this.loadingPages = false;
      },
      error: (error) => {
        console.error('Error al cargar páginas:', error);
        this.loadingPages = false;
        this.errorMessage = 'Error al cargar las páginas de Facebook. Por favor, intenta nuevamente.';
      }
    });
    this.subscriptions.add(pagesSubscription);
  }

  togglePageSelection(pageId: string): void {
    const pageIdsControl = this.postPlanForm.get('pageIds');
    if (!pageIdsControl) return;

    const currentIds: string[] = pageIdsControl.value || [];
    const index = currentIds.indexOf(pageId);

    if (index > -1) {
      currentIds.splice(index, 1);
    } else {
      currentIds.push(pageId);
    }

    pageIdsControl.setValue(currentIds);
  }

  isPageSelected(pageId: string): boolean {
    const pageIds: string[] = this.postPlanForm.get('pageIds')?.value || [];
    return pageIds.includes(pageId);
  }

  selectAllPages(): void {
    const allPageIds = this.pages.map(page => page.facebookPageId);
    this.postPlanForm.get('pageIds')?.setValue(allPageIds);
  }

  deselectAllPages(): void {
    this.postPlanForm.get('pageIds')?.setValue([]);
  }

  onSubmit(): void {
    if (this.postPlanForm.invalid) {
      markFormGroupTouched(this.postPlanForm);
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    const formValue = this.postPlanForm.value;
    
    // Convertir datetime-local a ISO string
    const scheduledAtDate = new Date(formValue.scheduledAt);
    const scheduledAtISO = scheduledAtDate.toISOString();

    // Preparar request
    const request: any = {
      scheduledAt: scheduledAtISO,
      timezone: formValue.timezone,
      message: formValue.message.trim()
    };

    // Agregar campos opcionales solo si tienen valor
    if (formValue.linkUrl?.trim()) {
      request.linkUrl = formValue.linkUrl.trim();
    }
    if (formValue.imageUrl?.trim()) {
      request.imageUrl = formValue.imageUrl.trim();
    }
    if (formValue.dedupeKey?.trim()) {
      request.dedupeKey = formValue.dedupeKey.trim();
    }
    // Solo incluir pageIds si se seleccionaron páginas específicas
    if (formValue.pageIds && formValue.pageIds.length > 0) {
      request.pageIds = formValue.pageIds;
    }

    const createSubscription = this.postPlanService.createPostPlan(request).subscribe({
      next: (response) => {
        this.isLoading = false;
        // Mostrar mensaje de éxito
        alert(`Plan creado exitosamente!\n${response.data.message}\nTargets creados: ${response.data.targetsCreated}\nTargets omitidos: ${response.data.targetsSkipped}`);
        this.success.emit();
      },
      error: (error) => {
        this.isLoading = false;
        this.errorMessage = extractErrorMessage(
          error,
          'Error al crear el plan de publicación. Por favor, intenta nuevamente.'
        );
      }
    });

    this.subscriptions.add(createSubscription);
  }

  onCancel(): void {
    this.cancel.emit();
  }

  getFieldError(fieldName: string): string {
    return getFieldError(this.postPlanForm, fieldName);
  }

  isFieldInvalid(fieldName: string): boolean {
    return isFieldInvalid(this.postPlanForm, fieldName);
  }
}
