'use client';

import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import type { ArtComboBoxOption } from '@/components/ui/ArtComboBox';
import { queryKeys } from '@/lib/queryKeys';
import fetchClient from "@/lib/fetchClient";
import { API } from '@/lib/apiUrl';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// ==== Currency options ====

export function useCurrencyOptions(): ArtComboBoxOption[] {
  const { data } = useSuspenseQuery<ArtComboBoxOption[]>({
    queryKey: queryKeys.currency.list(),
    queryFn: async () => {
      const json = await fetchClient.get<Record<string, string>>(API.currency.list());
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

  return data;
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

  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  const { data, isLoading } = useQuery<number | null>({
    queryKey: queryKeys.currency.rate(fromKey, toKey),
    queryFn: async () => {
      const json = await fetchClient.get<Record<string, Record<string, number>>>(
        API.currency.rate(fromKey),
      );
      return json[fromKey]?.[toKey] ?? null;
    },
    enabled,
    staleTime: ONE_DAY_MS,
    gcTime: ONE_DAY_MS,
  });

  return { rate: enabled ? (data ?? null) : null, isLoading: enabled && isLoading };
}
