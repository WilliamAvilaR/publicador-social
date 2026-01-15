import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FullCalendarModule } from '@fullcalendar/angular';
import { CalendarOptions, EventInput, DatesSetArg } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import esLocale from '@fullcalendar/core/locales/es';
import { FullCalendarComponent } from '@fullcalendar/angular';
import { Subscription } from 'rxjs';
import { SchedulerService } from '../../services/scheduler.service';
import { ScheduledPostEvent } from '../../models/scheduled-post.model';
import { ProgramadorHeaderComponent } from '../programador-header/programador-header.component';
import { ScheduledPostCardComponent } from '../scheduled-post-card/scheduled-post-card.component';

@Component({
  selector: 'app-programador',
  standalone: true,
  imports: [
    CommonModule,
    FullCalendarModule,
    ProgramadorHeaderComponent,
    ScheduledPostCardComponent
  ],
  templateUrl: './programador.component.html',
  styleUrls: ['./programador.component.scss']
})
export class ProgramadorComponent implements OnInit, OnDestroy {
  @ViewChild('calendar') calendarComponent!: FullCalendarComponent;

  currentView: 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay' = 'dayGridMonth';
  currentDateDisplay: string = '';
  scheduledPosts: ScheduledPostEvent[] = [];
  loading = false;
  private subscriptions = new Subscription();

  calendarOptions: CalendarOptions = {
    initialView: 'dayGridMonth',
    plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
    headerToolbar: false, // Usamos nuestro header personalizado
    locale: esLocale,
    firstDay: 1, // Lunes
    editable: true, // Permite drag & drop
    selectable: true, // Permite seleccionar rangos
    selectMirror: true,
    dayMaxEvents: true,
    weekends: true,
    height: 'auto',
    events: [],
    dateClick: (arg) => this.handleDateClick(arg),
    eventClick: (arg) => this.handleEventClick(arg),
    eventDrop: (arg) => this.handleEventDrop(arg),
    eventResize: (arg) => this.handleEventResize(arg),
    datesSet: (arg) => this.handleDatesSet(arg),
    // eventContent se manejará en el template usando ng-template si es necesario
  };

  constructor(private schedulerService: SchedulerService) {}

  ngOnInit(): void {
    this.updateDateDisplay();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  /**
   * Maneja el click en una fecha del calendario
   */
  handleDateClick(arg: any): void {
    console.log('Date clicked:', arg.dateStr);
    // TODO: Abrir modal para crear nueva publicación
    // this.openNewPostModal(arg.dateStr);
  }

  /**
   * Maneja el click en un evento/publicación
   */
  handleEventClick(arg: any): void {
    console.log('Event clicked:', arg.event);
    // TODO: Abrir modal para editar publicación
    // this.openEditPostModal(arg.event.extendedProps.postId);
  }

  /**
   * Maneja el arrastre de un evento (cambiar fecha)
   */
  handleEventDrop(arg: any): void {
    const postId = arg.event.extendedProps.postId;
    const newDate = arg.event.start;
    
    console.log('Event dropped:', postId, newDate);
    
    // TODO: Actualizar fecha de publicación
    // this.updatePostDate(postId, newDate);
  }

  /**
   * Maneja el redimensionamiento de un evento (cambiar hora)
   */
  handleEventResize(arg: any): void {
    const postId = arg.event.extendedProps.postId;
    const newStart = arg.event.start;
    const newEnd = arg.event.end;
    
    console.log('Event resized:', postId, newStart, newEnd);
    
    // TODO: Actualizar hora de publicación
    // this.updatePostTime(postId, newStart, newEnd);
  }

  /**
   * Maneja el cambio de rango de fechas visible
   */
  handleDatesSet(arg: DatesSetArg): void {
    this.loading = true;
    this.updateDateDisplay(arg);
    
    // Cargar publicaciones para el rango visible
    const loadSubscription = this.schedulerService
      .getScheduledPosts(arg.start, arg.end)
      .subscribe({
        next: (events) => {
          this.scheduledPosts = events;
          this.updateCalendarEvents(events);
          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading scheduled posts:', error);
          this.loading = false;
        }
      });
    
    this.subscriptions.add(loadSubscription);
  }

  /**
   * Actualiza los eventos del calendario
   */
  private updateCalendarEvents(events: ScheduledPostEvent[]): void {
    const calendarApi = this.calendarComponent.getApi();
    calendarApi.removeAllEvents();
    calendarApi.addEventSource(events);
  }

  /**
   * Actualiza el display de la fecha actual
   */
  private updateDateDisplay(arg?: DatesSetArg): void {
    const calendarApi = this.calendarComponent?.getApi();
    
    if (!calendarApi && !arg) {
      // Fecha inicial
      const now = new Date();
      this.currentDateDisplay = this.formatDateDisplay(now, this.currentView);
      return;
    }

    const view = calendarApi?.view || arg?.view;
    const start = view?.activeStart || new Date();
    
    this.currentDateDisplay = this.formatDateDisplay(start, this.currentView);
  }

  /**
   * Formatea la fecha según la vista actual
   */
  private formatDateDisplay(date: Date, view: string): string {
    const options: Intl.DateTimeFormatOptions = {};
    
    switch (view) {
      case 'dayGridMonth':
        options.month = 'long';
        options.year = 'numeric';
        return date.toLocaleDateString('es-ES', options);
      
      case 'timeGridWeek':
        const weekStart = new Date(date);
        const weekEnd = new Date(date);
        weekEnd.setDate(weekEnd.getDate() + 6);
        return `Semana del ${weekStart.getDate()} al ${weekEnd.getDate()} de ${weekStart.toLocaleDateString('es-ES', { month: 'long' })}`;
      
      case 'timeGridDay':
        options.weekday = 'long';
        options.day = 'numeric';
        options.month = 'long';
        options.year = 'numeric';
        return date.toLocaleDateString('es-ES', options);
      
      default:
        return date.toLocaleDateString('es-ES');
    }
  }

  /**
   * Navegación: Ir a hoy
   */
  goToToday(): void {
    const calendarApi = this.calendarComponent.getApi();
    calendarApi.today();
    this.updateDateDisplay();
  }

  /**
   * Navegación: Anterior
   */
  goToPrevious(): void {
    const calendarApi = this.calendarComponent.getApi();
    calendarApi.prev();
    this.updateDateDisplay();
  }

  /**
   * Navegación: Siguiente
   */
  goToNext(): void {
    const calendarApi = this.calendarComponent.getApi();
    calendarApi.next();
    this.updateDateDisplay();
  }

  /**
   * Cambiar vista del calendario
   */
  changeView(view: 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay'): void {
    const calendarApi = this.calendarComponent.getApi();
    calendarApi.changeView(view);
    this.currentView = view;
    this.updateDateDisplay();
  }

  /**
   * Abrir modal para nueva publicación
   */
  openNewPostModal(date?: string): void {
    console.log('Open new post modal', date);
    // TODO: Implementar modal de nueva publicación
  }
}
