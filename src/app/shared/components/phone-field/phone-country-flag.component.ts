import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PhoneCountryDto } from '../../../core/models/phone-catalog.model';
import { getFlagEmoji, getFlagSrc } from '../../utils/phone.utils';

@Component({
  selector: 'app-phone-country-flag',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span class="phone-flag" aria-hidden="true">
      <img
        *ngIf="useSvgFlags"
        class="phone-flag-img"
        [src]="flagSrc"
        width="24"
        height="18"
        alt=""
        loading="lazy"
      />
      <span *ngIf="!useSvgFlags" class="phone-flag-emoji">{{ flagEmoji }}</span>
    </span>
  `,
  styles: [`
    .phone-flag {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      line-height: 1;
    }

    .phone-flag-img {
      display: block;
      border-radius: 2px;
      object-fit: cover;
    }

    .phone-flag-emoji {
      font-size: 1.15rem;
    }
  `]
})
export class PhoneCountryFlagComponent {
  @Input({ required: true }) country!: PhoneCountryDto;
  @Input() useSvgFlags = false;

  get flagEmoji(): string {
    return getFlagEmoji(this.country);
  }

  get flagSrc(): string {
    return getFlagSrc(this.country.isoCode);
  }
}
