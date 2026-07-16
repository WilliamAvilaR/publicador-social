export interface PhoneCountryDto {
  isoCode: string;
  name: string;
  callingCode: string;
  flag: string;
  exampleNumber?: string | null;
}

export interface PhoneCountriesResponse {
  data: PhoneCountryDto[];
}

export interface PhonePayload {
  telephone: string | null;
  telephoneCountry: string | null;
}
