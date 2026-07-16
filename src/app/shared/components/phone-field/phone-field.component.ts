import { Component, HostListener, Input, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { PhoneCatalogService } from '../../../core/services/phone-catalog.service';
import { PhoneCountryDto } from '../../../core/models/phone-catalog.model';
import {
  filterPhoneCountries,
  findCountry,
  getExamplePlaceholder,
  handlePhoneInput,
  handlePhonePaste,
  resolveInitialPhoneCountry,
  USE_SVG_FLAGS
} from '../../utils/phone.utils';
import { PhoneCountryFlagComponent } from './phone-country-flag.component';

@Component({
  selector: 'app-phone-field',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule, PhoneCountryFlagComponent],
  templateUrl: './phone-field.component.html',
  styleUrl: './phone-field.component.scss'
})
export class PhoneFieldComponent implements OnInit, OnDestroy {
  @Input({ required: true }) formGroup!: FormGroup;
  @Input() countryControlName = 'telephoneCountry';
  @Input() nationalControlName = 'phoneNational';
  @Input() labelKey = 'PHONE_FIELD.LABEL';
  @Input() showLabel = true;
  /** Activar banderas SVG (flagcdn) si los emojis se ven mal en QA. */
  @Input() useSvgFlags = USE_SVG_FLAGS;

  countries: PhoneCountryDto[] = [];
  filteredCountries: PhoneCountryDto[] = [];
  loading = true;
  countryOpen = false;
  countrySearch = '';

  private subscriptions = new Subscription();

  constructor(private phoneCatalog: PhoneCatalogService) {}

  get selectedIsoCode(): string {
    return String(this.formGroup?.get(this.countryControlName)?.value || '').toUpperCase();
  }

  get selectedCountry(): PhoneCountryDto | undefined {
    return findCountry(this.countries, this.selectedIsoCode);
  }

  get placeholder(): string {
    return getExamplePlaceholder(this.countries, this.selectedIsoCode);
  }

  ngOnInit(): void {
    const sub = this.phoneCatalog.getPhoneCountries().subscribe(countries => {
      this.countries = countries;
      this.filteredCountries = countries;
      this.loading = false;
      this.ensureCountrySelected();
    });
    this.subscriptions.add(sub);
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  toggleCountryList(): void {
    if (this.loading) {
      return;
    }
    this.countryOpen = !this.countryOpen;
    if (this.countryOpen) {
      this.countrySearch = '';
      this.filteredCountries = this.countries;
    }
  }

  onCountrySearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.countrySearch = value;
    this.filteredCountries = filterPhoneCountries(this.countries, value);
  }

  selectCountry(isoCode: string): void {
    this.formGroup.get(this.countryControlName)?.setValue(isoCode);
    this.countryOpen = false;
    this.countrySearch = '';
    this.filteredCountries = this.countries;
    this.onCountryChange();
    this.formGroup.updateValueAndValidity();
  }

  onNationalInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!this.formGroup) {
      return;
    }

    const currentIso = this.selectedIsoCode;
    const result = handlePhoneInput(input.value, currentIso, this.countries);
    this.applyPhoneInputResult(result);
    input.value = result.nationalDisplay;
  }

  onNationalPaste(event: ClipboardEvent): void {
    const text = event.clipboardData?.getData('text') || '';
    const result = handlePhonePaste(text, this.selectedIsoCode, this.countries);
    if (!result) {
      return;
    }
    event.preventDefault();
    this.applyPhoneInputResult(result);
  }

  onCountryChange(): void {
    if (!this.formGroup) {
      return;
    }
    const national = String(this.formGroup.get(this.nationalControlName)?.value || '');
    if (!national.trim() || national.trim().startsWith('+')) {
      return;
    }
    const result = handlePhoneInput(national, this.selectedIsoCode, this.countries);
    this.applyPhoneInputResult(result);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.phone-country-picker')) {
      this.closeCountryList();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeCountryList();
  }

  private closeCountryList(): void {
    this.countryOpen = false;
    this.countrySearch = '';
    this.filteredCountries = this.countries;
  }

  private applyPhoneInputResult(result: {
    isoCode: string;
    nationalDisplay: string;
    changedCountry: boolean;
  }): void {
    if (result.changedCountry) {
      this.formGroup.get(this.countryControlName)?.setValue(result.isoCode);
    }
    this.formGroup.get(this.nationalControlName)?.setValue(result.nationalDisplay, { emitEvent: false });
    this.formGroup.get(this.nationalControlName)?.markAsDirty();
    this.formGroup.updateValueAndValidity();
  }

  private ensureCountrySelected(): void {
    const control = this.formGroup?.get(this.countryControlName);
    if (!control) {
      return;
    }
    const current = String(control.value || '').trim().toUpperCase();
    if (current && this.countries.some(c => c.isoCode === current)) {
      control.setValue(current, { emitEvent: false });
      return;
    }
    control.setValue(resolveInitialPhoneCountry(null, this.countries), { emitEvent: false });
  }
}
