/**
 * Normalizes a raw string for use as a text search term.
 * Trims whitespace, lowercases, and caps at 100 chars to prevent
 * unbounded FTS queries from untrusted input.
 */
export function normalizeText(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .slice(0, 100)
    .trim();
}

/**
 * Extracts and normalizes the `freeText` search param from URL search params.
 * Use in service/route handlers instead of raw searchParams.get('freeText').
 */
export function parseFreeTextFromUrl(searchParams: URLSearchParams): string {
  return normalizeText(searchParams.get('freeText') ?? '');
}
