import * as yup from 'yup';

export interface PaginatedResponse<T> {
  data: T[];
  total: number | undefined;
  page: number;
  pageSize: number;
}

export const PaginatedResponseValidator = yup.object({
  page: yup
    .number()
    .integer('Page must be an integer')
    .min(0, 'Page must be at least 0')
    .default(0),
  pageSize: yup
    .number()
    .integer('Page size must be an integer')
    .min(1, 'Page size must be at least 1')
    .max(100, 'Page size cannot exceed 100')
    .default(100),
});

export type PaginationResponseParams = yup.InferType<typeof PaginatedResponseValidator>;

export function createPaginatedResponse<T>(
  data: T[],
  page: number,
  pageSize: number,
  total?: number
) {
  return { data, page, pageSize, total: total ?? undefined };
}

export function getNextPage(lastPage: PaginatedResponse<unknown>): number | undefined {
  const nextPage = lastPage.page + 1;
  if (lastPage.total != null) {
    return nextPage * lastPage.pageSize < lastPage.total ? nextPage : undefined;
  }
  return lastPage.data.length < lastPage.pageSize ? undefined : nextPage;
}

export async function parsePaginationFromUrl(
  searchParams: URLSearchParams
): Promise<PaginationResponseParams> {
  const rawParams = {
    page: searchParams.get('page'),
    pageSize: searchParams.get('pageSize'),
  };

  const paginationData = {
    page: rawParams.page ? Math.max(0, Number(rawParams.page) - 1) : 0,
    pageSize: rawParams.pageSize ? Number(rawParams.pageSize) : 100,
  };

  return await PaginatedResponseValidator.validate(paginationData);
}
