import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ScheduledPost, ScheduledPostEvent, CreateScheduledPostRequest, UpdateScheduledPostRequest } from '../models/scheduled-post.model';

@Injectable({
  providedIn: 'root'
})
export class SchedulerService {
  private readonly apiUrl = '/api/ScheduledPosts';

  constructor(private http: HttpClient) {}

  /**
   * Obtiene las publicaciones programadas en un rango de fechas
   */
  getScheduledPosts(start: Date, end: Date): Observable<ScheduledPostEvent[]> {
    const params = new HttpParams()
      .set('start', start.toISOString())
      .set('end', end.toISOString());

    return this.http.get<ScheduledPost[]>(`${this.apiUrl}`, { params })
      .pipe(
        map(posts => this.mapToCalendarEvents(posts))
      );
  }

  /**
   * Obtiene una publicación programada por ID
   */
  getScheduledPost(id: string): Observable<ScheduledPost> {
    return this.http.get<ScheduledPost>(`${this.apiUrl}/${id}`);
  }

  /**
   * Crea una nueva publicación programada
   */
  createScheduledPost(post: CreateScheduledPostRequest): Observable<ScheduledPost> {
    return this.http.post<ScheduledPost>(`${this.apiUrl}`, post);
  }

  /**
   * Actualiza una publicación programada
   */
  updateScheduledPost(id: string, post: UpdateScheduledPostRequest): Observable<ScheduledPost> {
    return this.http.put<ScheduledPost>(`${this.apiUrl}/${id}`, post);
  }

  /**
   * Elimina una publicación programada
   */
  deleteScheduledPost(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  /**
   * Convierte ScheduledPost a ScheduledPostEvent para FullCalendar
   */
  private mapToCalendarEvents(posts: ScheduledPost[]): ScheduledPostEvent[] {
    return posts.map(post => ({
      id: post.id,
      title: this.getEventTitle(post),
      start: post.scheduledDate,
      allDay: false,
      backgroundColor: this.getColorForSocialNetwork(post.socialNetwork),
      borderColor: this.getColorForSocialNetwork(post.socialNetwork),
      textColor: '#ffffff',
      extendedProps: {
        postId: post.id,
        planId: post.planId, // Incluir planId si existe
        content: post.content,
        mediaUrl: post.mediaUrl,
        socialNetwork: post.socialNetwork,
        accountId: post.accountId,
        accountName: post.accountName,
        pageId: post.pageId,
        pageName: post.pageName,
        status: post.status
      }
    }));
  }

  /**
   * Genera un título para el evento basado en el contenido
   */
  private getEventTitle(post: ScheduledPost): string {
    const preview = post.content.length > 50 
      ? post.content.substring(0, 50) + '...' 
      : post.content;
    return `${post.accountName} - ${preview}`;
  }

  /**
   * Obtiene el color según la red social
   */
  private getColorForSocialNetwork(network: string): string {
    const colors: Record<string, string> = {
      facebook: '#1877f2',
      instagram: '#e4405f',
      twitter: '#1da1f2'
    };
    return colors[network] || '#6b7280';
  }
}
