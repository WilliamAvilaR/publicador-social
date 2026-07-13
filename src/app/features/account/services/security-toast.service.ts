import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type SecurityToastTone = 'success' | 'error';

export interface SecurityToastState {
  message: string;
  tone: SecurityToastTone;
}

@Injectable({ providedIn: 'root' })
export class SecurityToastService {
  private readonly defaultDurationMs = 4000;
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private readonly stateSubject = new BehaviorSubject<SecurityToastState | null>(null);

  readonly state$ = this.stateSubject.asObservable();

  showSuccess(message: string, durationMs = this.defaultDurationMs): void {
    this.show(message, 'success', durationMs);
  }

  showError(message: string, durationMs = this.defaultDurationMs): void {
    this.show(message, 'error', durationMs);
  }

  clear(): void {
    this.clearTimeout();
    this.stateSubject.next(null);
  }

  private show(message: string, tone: SecurityToastTone, durationMs: number): void {
    this.clearTimeout();
    this.stateSubject.next({ message, tone });
    this.timeoutId = setTimeout(() => this.clear(), durationMs);
  }

  private clearTimeout(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }
}
