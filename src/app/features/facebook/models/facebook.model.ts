export interface FacebookConnectResponse {
  data: {
    authorizationUrl: string;
  };
}

export interface FacebookCallbackResponse {
  data: {
    pagesImported: number;
    errors: number;
    message: string;
    pages?: FacebookPage[];
  };
}

export interface FacebookPage {
  facebookPageId: string;
  name: string;
  pictureUrl?: string;
  isActive: boolean;
}

export interface FacebookPagesMeta {
  totalCount: number;
  pageSize: number;
  currentPage: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviusPage: boolean;
  nextPageUrl: string | null;
  previusPageUrl: string | null;
}

export interface FacebookPagesResponse {
  data: FacebookPage[];
  meta: FacebookPagesMeta;
}
