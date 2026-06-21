import { type PaginatedResponse } from '@/models/paginated-response.model';

export type { PaginatedResponse };

/**
 * FE adapter — maps a PaginatedResponse from the BE model onto ArtData props.
 * `total` is always a number (ArtData server-side mode). Use without `total` spread for client-side mode.
 *
 * Usage:
 *   <ArtData columns={...} {...createPaginatedProps(response)} onPageChange={...} />
 */
export function createPaginatedProps<T>(response: PaginatedResponse<T>) {
  return { data: response.data, total: response.total, page: response.page };
}
