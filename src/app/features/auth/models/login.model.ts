// Modelos para el login de usuario

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  data: {
    token: string;
    idUsuario: number;
    email: string;
    rol: string;
    fullName: string;
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

// Tipo auxiliar para los datos del usuario
export type UserData = LoginResponse['data'];
