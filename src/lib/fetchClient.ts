import { ApiError } from '@/models/api-error';

// ==== Config ====

const TIMEOUT_MS = 10_000;

// ==== Core ====

type FetchResponse<T> = { data: T };

async function request<T>(method: string, url: string, body?: unknown): Promise<FetchResponse<T>> {
  const isFormData = body instanceof FormData;

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: !isFormData && body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: isFormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'TimeoutError') {
      throw new ApiError('Request timed out', 408);
    }
    throw err;
  }

  if (!res.ok) {
    const isJson = res.headers.get('content-type')?.includes('application/json');
    const payload = isJson ? await res.json().catch(() => ({})) : {};
    throw new ApiError(
      payload?.error ?? res.statusText ?? 'Request failed',
      res.status,
      payload?.code,
      payload?.details,
    );
  }

  if (res.status === 204) return { data: undefined as T };
  const data: T = await res.json();
  return { data };
}

// ==== Client ====

const fetchClient = {
  get:    <T>(url: string)                 => request<T>('GET',    url),
  post:   <T>(url: string, body?: unknown) => request<T>('POST',   url, body),
  patch:  <T>(url: string, body?: unknown) => request<T>('PATCH',  url, body),
  put:    <T>(url: string, body?: unknown) => request<T>('PUT',    url, body),
  delete: <T = void>(url: string)          => request<T>('DELETE', url),
};

export default fetchClient;
