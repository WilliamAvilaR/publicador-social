// Modelos para UserSettings

export interface UserSettings {
  language: string;
  timezone: string;
  dateFormat: string;
  firstDayOfWeek: number; // 0 = Domingo, 1 = Lunes, etc.
  theme: string;
}

export interface UserSettingsResponse {
  data: UserSettings;
  meta: {
    totalCount: number;
    pageSize: number;
    currentPage: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviusPage: boolean;
    nextPageUrl: string;
    previusPageUrl: string;
  };
}

export interface UpdateUserSettingsRequest {
  language?: string | null;
  timezone?: string | null;
  dateFormat?: string | null;
  firstDayOfWeek?: number | null;
  theme?: string | null;
}
