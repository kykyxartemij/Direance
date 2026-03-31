import * as yup from 'yup';

export const IdValidator = yup.object({
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
