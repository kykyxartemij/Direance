import type { AxiosError } from 'axios';

export class ApiError extends Error {
  status?: number;
  code?: string;
  details?: unknown;

  constructor(message: string, status?: number, code?: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
    this.name = 'ApiError';
  }

  static fromAxios(err: AxiosError) {
    const data = (err.response?.data as any) ?? undefined;
    const message = data?.error ?? err.message ?? 'Request failed';
    const status = err.response?.status;
    const code = data?.code;
    const details = data?.details ?? data;
    return new ApiError(message, status, code, details);
  }
}

export type ParsedApiError = {
  message: string;
  status?: number;
  code?: string;
  details?: unknown;
};
