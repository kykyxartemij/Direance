## Bulk connection fetch endpoint

Add `POST /api/connection/fetch-bulk` accepting `[{ connectionId, filters }][]` and returning all results in one response.

Currently `useRefreshConnectionReports` fans out N parallel requests — one per active connection report. A bulk endpoint eliminates N−1 roundtrips and reduces per-connection auth + middleware overhead. `useFetchFromConnection` (single-connection query) stays as-is for the `DefaultConnectionLoader` flow.

---

## Use ArtSnackbar for every hook, on catching errors, and etc.

create meta props: successMessage, errorMessage, invalidateQuery, and auto use it everywhere.
onSuccess: SuccessMessage via ArtSnackbar + invalidateQuery
onError: ErrorMessage via ArtSnackbar

no onSettled functionality. OnError we do not invalidateQuery for less BE calls.

---

