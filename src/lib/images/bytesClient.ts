/* eslint-disable local/use-fetch-client */
import { ApiError } from '@/models/api-error';

const TIMEOUT_MS = 10_000;

// ==== Helpers ====

function bufferToBase64(buffer: ArrayBuffer): string {
  return btoa(new Uint8Array(buffer).reduce((s, b) => s + String.fromCharCode(b), ''));
}

// Reads all X-* response headers, strips prefix, converts to camelCase.
// Mirrors BytesResponse.metaToHeaders on the BE side.
function metaFromHeaders<T extends Record<string, string>>(headers: Headers): T {
  const meta: Record<string, string> = {};
  headers.forEach((value, key) => {
    if (key.startsWith('x-') && key.length > 2) {
      const camel = key.slice(2).replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
      meta[camel] = value;
    }
  });
  return meta as T;
}

// ==== Types ====

export type BytesResult<T extends Record<string, string> = Record<string, string>> = {
  data: string;
  mime: string | null;
  meta: T;
};

// ==== Client ====

async function request<T extends Record<string, string>>(
  method: string,
  url: string,
  body?: BodyInit,
): Promise<BytesResult<T> | null> {
  let res: Response;
  try {
    res = await fetch(url, { method, signal: AbortSignal.timeout(TIMEOUT_MS), body });
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'TimeoutError') throw new ApiError('Request timed out', 408);
    throw err;
  }
  if (!res.ok) throw new ApiError(res.statusText ?? 'Request failed', res.status);
  if (res.status === 204) return null;
  return {
    data: bufferToBase64(await res.arrayBuffer()),
    mime: res.headers.get('content-type'),
    meta: metaFromHeaders<T>(res.headers),
  };
}

export const bytesClient = {
  get:  <T extends Record<string, string> = Record<string, string>>(url: string)                  => request<T>('GET',  url),
  post: <T extends Record<string, string> = Record<string, string>>(url: string, body?: BodyInit) => request<T>('POST', url, body),
};
