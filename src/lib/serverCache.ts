import { unstable_cache, revalidateTag } from 'next/cache';

export const DEFAULT_TTL = 90; // 90 seconds

export async function cached<T>(
  queryFn: () => Promise<T>,
  cacheKey: string[],
  ttl: number = DEFAULT_TTL
): Promise<T> {
  const cachedFn = unstable_cache(async () => queryFn(), cacheKey, {
    revalidate: ttl,
    tags: cacheKey,
  });
  return cachedFn();
}

export function invalidateCache(...tags: string[]): void {
  for (const tag of tags) {
    revalidateTag(tag);
  }
}
