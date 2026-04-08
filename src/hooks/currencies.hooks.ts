'use client';

import { useQuery } from '@tanstack/react-query';
import type { ArtComboBoxOption } from '@/components/ui/ArtComboBox';
import { queryKeys } from '@/lib/queryKeys';

// Returns { "usd": "US Dollar", "eur": "Euro", ... }
const CURRENCIES_LIST_URL =
  'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies.json';

// Returns { "date": "...", "eur": { "usd": 1.08, "gbp": 0.85, ... } }
const CURRENCY_RATE_URL = (from: string) =>
  `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${from.toLowerCase()}.json`;

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// ==== Currency options ====

export function useCurrencyOptions(): { options: ArtComboBoxOption[]; isLoading: boolean } {
  const { data, isLoading } = useQuery<ArtComboBoxOption[]>({
    queryKey: queryKeys.currency.list(),
    queryFn: async () => {
      const res = await fetch(CURRENCIES_LIST_URL);
      const json: Record<string, string> = await res.json();
      return Object.entries(json)
        .map(([code, name]) => ({
          value: code.toUpperCase(),
          label: `${code.toUpperCase()} — ${name}`,
        }))
        .sort((a, b) => a.value.localeCompare(b.value));
    },
    staleTime: ONE_DAY_MS,
    gcTime: ONE_DAY_MS,
  });

  return { options: data ?? [], isLoading };
}

// ==== Exchange rate ====

/**
 * Returns how many `to` units equal 1 `from` unit.
 * e.g. useCurrencyRate('EUR', 'USD') → 1 EUR = {rate} USD
 * Returns null while loading, on error, or when from === to.
 */
export function useCurrencyRate(
  from: string | null,
  to: string | null,
): { rate: number | null; isLoading: boolean } {
  const fromKey = from?.toLowerCase() ?? '';
  const toKey = to?.toLowerCase() ?? '';
  const enabled = !!from && !!to && from !== to;

  const { data, isLoading } = useQuery<number | null>({
    queryKey: queryKeys.currency.rate(fromKey, toKey),
    queryFn: async () => {
      const res = await fetch(CURRENCY_RATE_URL(fromKey));
      const json: Record<string, Record<string, number>> = await res.json();
      return json[fromKey]?.[toKey] ?? null;
    },
    enabled,
    staleTime: ONE_DAY_MS,
    gcTime: ONE_DAY_MS,
  });

  return { rate: enabled ? (data ?? null) : null, isLoading: enabled && isLoading };
}
