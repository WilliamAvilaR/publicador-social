import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnDestroy,
  OnChanges,
  SimpleChanges,
  HostListener
} from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './modal.component.html',
  styleUrl: './modal.component.scss'
})
export class ModalComponent implements OnInit, OnDestroy, OnChanges {
  @Input() title = '';
  @Input() show = false;
  @Input() size: 'small' | 'medium' | 'large' | 'composer' = 'medium';
  @Input() closable = true;
  /** Clic fuera del panel; desactivar si hay datos sin guardar. */
  @Input() allowBackdropClose = true;
  @Input() zIndex = 1000;
  @Input() bodyPadding: 'default' | 'none' = 'default';
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
    document.body.style.overflow = this.show ? 'hidden' : '';
  }

  @HostListener('document:keydown.escape', ['$event'])
  handleEscapeKey(event: KeyboardEvent): void {
    if (this.show && this.closable) {
      event.preventDefault();
      this.closeModal();
    }
  }

  closeModal(): void {
    if (!this.closable) {
      return;
    }
    document.body.style.overflow = '';
    this.close.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if (!this.closable || !this.allowBackdropClose) {
      return;
    }
    if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
      this.closeModal();
    }
  }
}
