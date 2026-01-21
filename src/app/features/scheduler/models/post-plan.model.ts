// Modelos para planes de publicación (PostPlan)

export interface CreatePostPlanRequest {
  scheduledAt: string; // ISO 8601 date string
  timezone: string;
  message: string;
  linkUrl?: string;
  mediaId?: number;
  imageUrl?: string;
  pageIds?: string[]; // Opcional, si no se envía usa todas las publicables
  dedupeKey?: string; // Opcional, para validación de deduplicación
}

export interface CreatePostPlanResponse {
  data: {
    planId: number;
    targetsCreated: number;
    targetsSkipped: number;
    message: string;
  };
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

export enum PostTargetStatus {
  Pending = 0,
  Published = 1,
  Failed = 2,
  Skipped = 3
}

export interface PostTarget {
  facebookPageId: string;
  name: string;
  status: PostTargetStatus;
  lastError?: string;
  attemptCount: number;
  lastAttemptAt?: string;
}

export interface PostPlanDetails {
  id: number;
  message: string;
  linkUrl?: string;
  imageUrl?: string;
  scheduledAt: string;
  timezone: string;
  createdAt: string;
  targets: PostTarget[];
}

export interface PostPlanDetailsResponse {
  data: PostPlanDetails;
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

// Modelo para PostPlan en el calendario (PostPlanCalendarItemDto)
export interface PostPlanTargetsSummary {
  total: number;
  pending: number;
  published: number;
  failed: number;
  skipped: number;
}

export type PostPlanStatus = 'Pending' | 'Published' | 'Failed' | 'Partial' | 'Canceled';

export interface PostPlanListItem {
  id: number;
  scheduledAt: string; // ISO 8601 date string
  timezone: string;
  createdAt: string;
  title: string; // Texto corto visible en el calendario
  status: PostPlanStatus;
  targetsSummary: PostPlanTargetsSummary;
  hasLink: boolean;
  hasImage: boolean;
}

export interface PostPlanListResponse {
  data: PostPlanListItem[];
  meta?: {
    totalCount?: number;
    pageSize?: number;
    currentPage?: number;
    totalPages?: number;
    hasNextPage?: boolean;
    hasPreviusPage?: boolean;
    nextPageUrl?: string;
    previusPageUrl?: string;
  };
}
