## Use ArtSnackbar for every hook, on catching errors, and etc.

create meta props: successMessage, errorMessage, invalidateQuery, and auto use it everywhere.
onSuccess: SuccessMessage via ArtSnackbar + invalidateQuery
onError: ErrorMessage via ArtSnackbar

no onSettled functionality. OnError we do not invalidateQuery for less BE calls.

---

