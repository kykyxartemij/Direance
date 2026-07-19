import * as yup from 'yup';

// TODO(ai-generated): reviewed by AI, not yet by a human. Author has further improvements in
// mind for this helper (see TODO.md) — treat as a working first pass, not a settled API.
/**
 * Parses + validates URL query params against a yup object schema — one field per schema key,
 * read via `searchParams.get(key)`. Mirrors parsePaginationFromUrl's parse-at-the-boundary
 * pattern for arbitrary list filters (report type, permission, etc.) instead of hand-rolling
 * an unchecked `searchParams.get(x) as T` cast per service.
 */
export async function parseFiltersFromUrl<S extends yup.ObjectSchema<yup.AnyObject>>(
  searchParams: URLSearchParams,
  validator: S,
): Promise<yup.InferType<S>> {
  const raw: Record<string, string | undefined> = {};
  for (const key of Object.keys(validator.fields)) {
    raw[key] = searchParams.get(key) ?? undefined;
  }
  return validator.validate(raw, { abortEarly: false });
}

const IdValidator = yup.object({
  id: yup.string().required('ID is required').uuid('ID must be a valid UUID'),
});

export type IdParams = yup.InferType<typeof IdValidator>;

export function parseIdFromRoute(params: { id: string }): string {
  const validated = IdValidator.validateSync(params);
  return validated.id;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function tryParseUuid(value: string): string | null {
  return UUID_REGEX.test(value) ? value : null;
}
