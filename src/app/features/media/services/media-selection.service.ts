import { Injectable } from '@angular/core';

export interface PendingMediaSelection {
  mediaId: number | null;
  publicUrl?: string;
  thumbnailUrl?: string;
  mimeType?: string;
  name?: string;
}

@Injectable({
  providedIn: 'root'
})
export class MediaSelectionService {
  private pendingSelection: PendingMediaSelection | null = null;

  setPendingSelection(selection: PendingMediaSelection): void {
    this.pendingSelection = selection;
  }

  peekPendingSelection(): PendingMediaSelection | null {
    return this.pendingSelection;
  }

  consumePendingSelection(): PendingMediaSelection | null {
    const current = this.pendingSelection;
    this.pendingSelection = null;
    return current;
  }

  clear(): void {
    this.pendingSelection = null;
  }
}
