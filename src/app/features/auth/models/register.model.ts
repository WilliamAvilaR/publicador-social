// Modelos para el registro de usuario

export interface RegisterRequest {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  telephone: string;
  rol: string;
}

export interface RegisterResponse {
  data: {
    idUsuario: number;
    email: string;
    fullName: string;
    rol: string;
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

export interface ApiError {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  [key: string]: string | number;
}
