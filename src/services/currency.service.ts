import 'server-only';
import { NextResponse } from 'next/server';
import { cached } from '@/lib/serverCache';
import { CACHE_KEYS } from '@/lib/cacheKeys';
import { handleApiError } from '@/lib/errorHandler';
import { API } from '@/lib/apiUrl';

// ==== Constants ====

const CUSTOM_TTL = 12 * 60 * 60;

const CDN_LIST_URL =
  'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies.json';

const CDN_RATE_URL = (from: string) =>
  `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${from}.json`;

// ==== Fetchers ====

async function fetchCurrencyList(): Promise<Record<string, string>> {
  // eslint-disable-next-line local/use-fetch-client
  const res = await fetch(CDN_LIST_URL);
  if (!res.ok) throw new Error(`Currency list fetch failed: ${res.status}`);
  return res.json() as Promise<Record<string, string>>;
}

async function fetchCurrencyRate(from: string): Promise<Record<string, Record<string, number>>> {
  // eslint-disable-next-line local/use-fetch-client
  const res = await fetch(CDN_RATE_URL(from));
  if (!res.ok) throw new Error(`Currency rate fetch failed for ${from}: ${res.status}`);
  return res.json() as Promise<Record<string, Record<string, number>>>;
}

// ==== HTTP handlers ====

export async function getCurrencyList(): Promise<NextResponse> {
  try {
    const data = await cached(fetchCurrencyList, CACHE_KEYS.currency.list(), CUSTOM_TTL);
    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error, 'GET', API.currency.list());
  }
}

export async function getCurrencyRate(from: string): Promise<NextResponse> {
  try {
    const key = from.toLowerCase();
    const data = await cached(
      () => fetchCurrencyRate(key),
      CACHE_KEYS.currency.rate(key),
      CUSTOM_TTL,
    );
    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error, 'GET', API.currency.rate(from));
  }
}
