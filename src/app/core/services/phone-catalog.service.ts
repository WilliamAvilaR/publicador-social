import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, shareReplay, tap, catchError, map } from 'rxjs';
import { PhoneCountryDto, PhoneCountriesResponse } from '../models/phone-catalog.model';

const FALLBACK_COUNTRIES: PhoneCountryDto[] = [
  { isoCode: 'CO', name: 'Colombia', callingCode: '+57', flag: '🇨🇴', exampleNumber: '300 123 4567' },
  { isoCode: 'MX', name: 'México', callingCode: '+52', flag: '🇲🇽', exampleNumber: '55 1234 5678' },
  { isoCode: 'US', name: 'Estados Unidos', callingCode: '+1', flag: '🇺🇸', exampleNumber: '201 555 0123' },
  { isoCode: 'ES', name: 'España', callingCode: '+34', flag: '🇪🇸', exampleNumber: '612 34 56 78' },
  { isoCode: 'AR', name: 'Argentina', callingCode: '+54', flag: '🇦🇷', exampleNumber: '11 2345 6789' },
  { isoCode: 'PE', name: 'Perú', callingCode: '+51', flag: '🇵🇪', exampleNumber: '912 345 678' },
  { isoCode: 'CL', name: 'Chile', callingCode: '+56', flag: '🇨🇱', exampleNumber: '9 1234 5678' }
];

@Injectable({ providedIn: 'root' })
export class PhoneCatalogService {
  private readonly url = '/api/catalogs/phone-countries';
  private cache$: Observable<PhoneCountryDto[]> | null = null;
  private memory: PhoneCountryDto[] | null = null;

  constructor(private http: HttpClient) {}

  getPhoneCountries(): Observable<PhoneCountryDto[]> {
    if (this.memory) {
      return of(this.memory);
    }
    if (!this.cache$) {
      this.cache$ = this.http.get<PhoneCountriesResponse | PhoneCountryDto[]>(this.url).pipe(
        map(response => this.normalize(response)),
        tap(countries => {
          this.memory = countries;
        }),
        catchError(() => {
          this.memory = FALLBACK_COUNTRIES;
          return of(FALLBACK_COUNTRIES);
        }),
        shareReplay(1)
      );
    }
    return this.cache$;
  }

  getCachedCountries(): PhoneCountryDto[] {
    return this.memory ?? FALLBACK_COUNTRIES;
  }

  private normalize(response: PhoneCountriesResponse | PhoneCountryDto[]): PhoneCountryDto[] {
    const raw = Array.isArray(response) ? response : response?.data ?? [];
    const countries = raw
      .map(item => ({
        isoCode: String(item.isoCode || '').trim().toUpperCase(),
        name: String(item.name || '').trim(),
        callingCode: this.normalizeCallingCode(item.callingCode),
        flag: String(item.flag || '').trim() || '🏳️',
        exampleNumber: item.exampleNumber?.trim() || null
      }))
      .filter(item => item.isoCode.length === 2 && item.callingCode);

    return countries.length ? countries : FALLBACK_COUNTRIES;
  }

  private normalizeCallingCode(value: unknown): string {
    const raw = String(value ?? '').trim();
    if (!raw) {
      return '';
    }
    const digits = raw.replace(/[^\d]/g, '');
    return digits ? `+${digits}` : '';
  }
}
