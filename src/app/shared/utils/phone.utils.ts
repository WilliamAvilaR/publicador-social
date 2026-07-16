import {
  AsYouType,
  CountryCode,
  parsePhoneNumberFromString,
  isValidPhoneNumber
} from 'libphonenumber-js';
import { PhoneCountryDto, PhonePayload } from '../../core/models/phone-catalog.model';

export const DEFAULT_PHONE_COUNTRY = 'CO';

/** Activar SVG (flagcdn) si QA reporta emojis rotos en Windows. */
export const USE_SVG_FLAGS = true;

export function getFlagEmoji(country: PhoneCountryDto): string {
  return country.flag?.trim() || '🏳️';
}

export function getFlagSrc(isoCode: string): string {
  return `https://flagcdn.com/24x18/${isoCode.toLowerCase()}.png`;
}

export function resolveInitialPhoneCountry(
  profileCountry: string | null | undefined,
  countries: PhoneCountryDto[]
): string {
  const fromProfile = normalizeIso(profileCountry);
  if (fromProfile && countries.some(c => c.isoCode === fromProfile)) {
    return fromProfile;
  }

  const fromLocale = localeToIso(typeof navigator !== 'undefined' ? navigator.language : '');
  if (fromLocale && countries.some(c => c.isoCode === fromLocale)) {
    return fromLocale;
  }

  if (countries.some(c => c.isoCode === DEFAULT_PHONE_COUNTRY)) {
    return DEFAULT_PHONE_COUNTRY;
  }

  return countries[0]?.isoCode || DEFAULT_PHONE_COUNTRY;
}

export function resolveDefaultCountry(
  countries: PhoneCountryDto[],
  savedIso?: string | null
): PhoneCountryDto | undefined {
  const iso = resolveInitialPhoneCountry(savedIso, countries);
  return findCountry(countries, iso);
}

export function findCountry(
  countries: PhoneCountryDto[],
  isoCode: string | null | undefined
): PhoneCountryDto | undefined {
  const iso = normalizeIso(isoCode);
  return countries.find(c => c.isoCode === iso);
}

export function getExamplePlaceholder(
  countries: PhoneCountryDto[],
  isoCode: string | null | undefined
): string {
  return findCountry(countries, isoCode)?.exampleNumber?.trim() || '';
}

export function filterPhoneCountries(
  countries: PhoneCountryDto[],
  query: string
): PhoneCountryDto[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return countries;
  }
  const digits = q.replace(/[^\d]/g, '');
  const withPlus = q.startsWith('+') ? q : digits ? `+${digits}` : '';

  return countries.filter(country => {
    if (country.name.toLowerCase().includes(q)) {
      return true;
    }
    if (country.isoCode.toLowerCase().includes(q)) {
      return true;
    }
    if (country.callingCode.toLowerCase().includes(q)) {
      return true;
    }
    if (withPlus && country.callingCode.includes(withPlus)) {
      return true;
    }
    if (digits && country.callingCode.replace(/\D/g, '').includes(digits)) {
      return true;
    }
    return false;
  });
}

/** Formatea para UI (con espacios). */
export function formatNationalDisplay(
  nationalOrRaw: string,
  isoCode: string
): string {
  const iso = normalizeIso(isoCode) as CountryCode;
  if (!iso || !nationalOrRaw?.trim()) {
    return nationalOrRaw || '';
  }

  const trimmed = nationalOrRaw.trim();
  if (trimmed.startsWith('+')) {
    const parsed = parsePhoneNumberFromString(trimmed);
    return parsed ? parsed.formatNational() : trimmed;
  }

  try {
    return new AsYouType(iso).input(trimmed);
  } catch {
    return trimmed;
  }
}

export function formatInternationalDisplay(
  e164: string | null | undefined,
  isoCode?: string | null
): string {
  if (!e164?.trim()) {
    return '';
  }
  const parsed = parsePhoneNumberFromString(e164.trim(), normalizeIso(isoCode) as CountryCode | undefined);
  if (parsed) {
    return parsed.formatInternational();
  }
  return e164.trim();
}

/**
 * Si el usuario pega un número con +, detecta país y nacional.
 * Si no hay +, no cambia el país (solo limpia/formatea nacional).
 */
export function handlePhoneInput(
  rawValue: string,
  currentIso: string,
  countries: PhoneCountryDto[]
): { isoCode: string; nationalDisplay: string; changedCountry: boolean } {
  const value = rawValue ?? '';
  const current = normalizeIso(currentIso) || DEFAULT_PHONE_COUNTRY;

  if (value.trim().startsWith('+')) {
    const parsed = parsePhoneNumberFromString(value.trim());
    if (parsed?.country && countries.some(c => c.isoCode === parsed.country)) {
      return {
        isoCode: parsed.country,
        nationalDisplay: parsed.formatNational(),
        changedCountry: parsed.country !== current
      };
    }
  }

  return {
    isoCode: current,
    nationalDisplay: formatNationalDisplay(value, current),
    changedCountry: false
  };
}

/** Solo cuando el texto pegado empieza con +. */
export function handlePhonePaste(
  pastedValue: string,
  currentIso: string,
  countries: PhoneCountryDto[]
): { isoCode: string; nationalDisplay: string; changedCountry: boolean } | null {
  if (!pastedValue.trim().startsWith('+')) {
    return null;
  }
  return handlePhoneInput(pastedValue, currentIso, countries);
}

export function toE164(
  national: string,
  isoCode: string
): string | null {
  const trimmed = (national || '').trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith('+')) {
    const parsed = parsePhoneNumberFromString(trimmed);
    return parsed?.isValid() ? parsed.format('E.164') : null;
  }

  const digits = trimmed.replace(/[^\d]/g, '');
  if (!digits) {
    return null;
  }

  const iso = normalizeIso(isoCode) as CountryCode;
  if (!iso) {
    return null;
  }

  const parsed = parsePhoneNumberFromString(digits, iso);
  return parsed?.isValid() ? parsed.format('E.164') : null;
}

export function buildPhonePayload(
  nationalDisplay: string,
  isoCode: string,
  countries: PhoneCountryDto[] = []
): PhonePayload {
  return buildPhonePayloadWithCountries(nationalDisplay, isoCode, countries);
}

export function buildPhonePayloadWithCountries(
  nationalDisplay: string,
  isoCode: string,
  countries: PhoneCountryDto[]
): PhonePayload {
  const iso = normalizeIso(isoCode);
  const nationalDigits = (nationalDisplay || '').replace(/[^\d]/g, '');

  if (!nationalDigits) {
    return { telephone: null, telephoneCountry: null };
  }

  if (!iso) {
    return { telephone: null, telephoneCountry: null };
  }

  const e164 = toE164(nationalDisplay, iso);
  if (e164) {
    const parsed = parsePhoneNumberFromString(e164);
    return {
      telephone: e164,
      telephoneCountry: (parsed?.country || iso) as string
    };
  }

  const calling = findCountry(countries, iso)?.callingCode?.replace(/\D/g, '') || '';
  return {
    telephone: calling ? `+${calling}${nationalDigits}` : `+${nationalDigits}`,
    telephoneCountry: iso
  };
}

export function isPhoneValidForCountry(
  nationalDisplay: string,
  isoCode: string
): boolean {
  const digits = (nationalDisplay || '').replace(/[^\d]/g, '');
  if (!digits) {
    return true; // vacío = válido (opcional) en perfil; registro usará required
  }
  const iso = normalizeIso(isoCode) as CountryCode;
  if (!iso) {
    return false;
  }
  return isValidPhoneNumber(digits, iso);
}

/** Hidrata el formulario desde GET /api/me. */
export function hydrateFromProfile(
  telephone: string | null | undefined,
  telephoneCountry: string | null | undefined,
  countries: PhoneCountryDto[]
): { isoCode: string; nationalDisplay: string } {
  return splitStoredPhone(telephone, telephoneCountry, countries);
}

export function splitStoredPhone(
  telephone: string | null | undefined,
  telephoneCountry: string | null | undefined,
  countries: PhoneCountryDto[]
): { isoCode: string; nationalDisplay: string } {
  const isoHint = normalizeIso(telephoneCountry);
  const raw = (telephone || '').trim();

  if (raw) {
    const parsed = parsePhoneNumberFromString(
      raw,
      isoHint ? (isoHint as CountryCode) : undefined
    );
    if (parsed) {
      const iso =
        (parsed.country && countries.some(c => c.isoCode === parsed.country)
          ? parsed.country
          : isoHint) || resolveInitialPhoneCountry(isoHint, countries);
      return {
        isoCode: iso,
        nationalDisplay: parsed.formatNational()
      };
    }
  }

  return {
    isoCode: resolveInitialPhoneCountry(isoHint, countries),
    nationalDisplay: raw.replace(/^\+\d{1,3}/, '').trim()
  };
}

function normalizeIso(value: string | null | undefined): string | null {
  if (!value?.trim()) {
    return null;
  }
  return value.trim().toUpperCase();
}

function localeToIso(locale: string): string | null {
  if (!locale) {
    return null;
  }
  const parts = locale.replace('_', '-').split('-');
  if (parts.length >= 2 && parts[1].length === 2) {
    return parts[1].toUpperCase();
  }
  // es-CO already handled; for "es" alone don't guess
  return null;
}
