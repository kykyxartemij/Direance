import 'server-only';
import { NextResponse } from 'next/server';

const CACHE_CONTROL = 'private, immutable, max-age=31536000';

function metaToHeaders(meta: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(meta)) {
    const xKey = 'X-' + key
      .replace(/([A-Z])/g, '-$1')
      .split('-')
      .map(s => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
      .join('-');
    out[xKey] = value;
  }
  return out;
}

export class BytesResponse<T extends Record<string, string> = Record<string, string>> extends NextResponse {
  constructor(
    data: ArrayBufferView | ArrayBuffer,
    mime: string,
    meta?: T,
    status = 200,
  ) {
    super(data as BodyInit, {
      status,
      headers: {
        'Content-Type': mime,
        'Cache-Control': CACHE_CONTROL,
        ...(meta ? metaToHeaders(meta) : {}),
      },
    });
  }
}
