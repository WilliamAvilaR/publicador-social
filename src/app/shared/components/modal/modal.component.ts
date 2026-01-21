import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, OnChanges, SimpleChanges, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './modal.component.html',
  styleUrl: './modal.component.scss'
})
export class ModalComponent implements OnInit, OnDestroy, OnChanges {
  @Input() title: string = '';
  @Input() show: boolean = false;
  @Input() size: 'small' | 'medium' | 'large' = 'medium';
  @Input() closable: boolean = true;
  @Output() close = new EventEmitter<void>();

  ngOnInit(): void {
    this.updateBodyOverflow();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['show']) {
      this.updateBodyOverflow();
    }
  }

  ngOnDestroy(): void {
    document.body.style.overflow = '';
  }

  private updateBodyOverflow(): void {
    if (this.show) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }

  @HostListener('document:keydown.escape', ['$event'])
  handleEscapeKey(event: KeyboardEvent): void {
    if (this.show && this.closable) {
      this.closeModal();
    }
  }

  closeModal(): void {
    if (this.closable) {
      document.body.style.overflow = '';
      this.close.emit();
    }
  }

  onBackdropClick(event: MouseEvent): void {
    if (this.closable && (event.target as HTMLElement).classList.contains('modal-backdrop')) {
      this.closeModal();
    }
  }
}
