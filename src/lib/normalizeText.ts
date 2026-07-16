/** Caps at 100 chars to prevent unbounded FTS queries from untrusted input. */
function normalizeText(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .slice(0, 100)
    .trim();
}

/** Use instead of raw searchParams.get('freeText') — applies normalizeText. */
export function parseFreeTextFromUrl(searchParams: URLSearchParams): string {
  return normalizeText(searchParams.get('freeText') ?? '');
}
