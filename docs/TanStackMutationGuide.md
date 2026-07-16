# TanStack Mutation — Prototype Pattern

How mutations are wired in Direance. Centralises error reporting in the hook,
keeps the call site focused on success behaviour.

## Rule: all BE calls go through hooks

`fetchClient` must only be imported inside `src/hooks/`. Components, pages, and
providers must never call `fetchClient` directly — they call a `useQuery` or
`useMutation` hook instead. Enforced by the `local/hooks-only-fetch-client` lint rule.

```ts
// ❌ Bad — fetchClient in a component/page/provider
import fetchClient from '@/lib/fetchClient';
const { data } = await fetchClient.get(API.connection.byId(id));

// ✅ Good — hook in src/hooks/, component imports the hook
// src/hooks/connection.hooks.ts:
export function useGetConnection(id: string) {
  return useQuery({ queryKey: queryKeys.connection.byId(id), queryFn: () => fetchClient.get(API.connection.byId(id)) });
}
// src/page/dashboard/MyPage.tsx:
const { data } = useGetConnection(id);
```

This rule exists because raw `fetchClient` calls in components bypass TanStack
Query's caching, deduplication, loading/error state, and cache invalidation.
Every BE roundtrip that skips the query layer is invisible to the rest of the app.

## Hook owns error reporting

Every mutation hook calls `useArtSnackbar()` and wires `onError` to
`enqueueError(...)` with a sensible fallback title. Call sites never wrap
`mutate` / `mutateAsync` in `try/catch`.

```ts
// src/hooks/invite.hooks.ts
'use client';

import { useMutation, useQueryClient, type UseMutationOptions } from '@tanstack/react-query';
import fetchClient from '@/lib/fetchClient';
import { API } from '@/lib/apiUrl';
import { queryKeys } from '@/lib/queryKeys';
import { useArtSnackbar } from '@/components/ui/ArtSnackbar';
import type { SendInviteModel } from '@/models/invite.models';
import type { ApiError } from '@/models/api-error';

export function useSendInvite(
  options?: Omit<UseMutationOptions<void, ApiError, SendInviteModel>, 'mutationFn'>
) {
  const queryClient = useQueryClient();
  const { enqueueError } = useArtSnackbar();
  return useMutation<void, ApiError, SendInviteModel>({
    ...options,
    mutationFn: async (body) => {
      await fetchClient.post(API.invite.send(), body);
    },
    onSuccess: (data, ...rest) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invite.limits() });
      options?.onSuccess?.(data, ...rest);
    },
    onError: (err, ...rest) => {
      enqueueError(err, 'Failed to send invite');
      options?.onError?.(err, ...rest);
    },
  });
}
```

## Hook-level `options` — configure the hook itself, not one call

Every hook in `src/hooks/*.hooks.ts` accepts an optional trailing `options` param
(`Omit<UseQueryOptions<...>, 'queryKey' | 'queryFn'>` for queries, `Omit<UseMutationOptions<...>, 'mutationFn'>`
for mutations) that spreads into the underlying TanStack call. This is different from
the per-call `mutate(vars, { onSuccess })` pattern below — `options` configures things
TanStack only reads from the hook definition itself: `meta`, `enabled`, `staleTime`,
`retry`, or a *default* `onSuccess`/`onError` that should apply to every call of that
hook, not just one.

The reason it's a param and not baked into the hook body: hooks get reused across
pages with different needs. `useGetExportSettingById` backs a full-page edit form (own
`isLoading` gate), a dialog, and a background reflow with no loading affordance of its
own — only the last two want `meta: { waitForLoading: true }` (see
`docs/InstantNavigationAndLoadingState.md`). Baking `meta` into the hook would force
the same behavior on every caller.

```ts
export function useGetExportSettingById(
  id: string | undefined,
  options?: Omit<UseQueryOptions<ExportSettingModel, ApiError>, 'queryKey' | 'queryFn'>
) {
  return useQuery<ExportSettingModel, ApiError>({
    queryKey: queryKeys.exportSetting.byId(id!),
    queryFn: async () => { /* ... */ },
    enabled: !!id,
    ...options, // caller-provided options win — spread last
  });
}
```

```tsx
useGetExportSettingById(id, { meta: { waitForLoading: true } });
```

**Mutations spread `options` first, not last** — the opposite order from queries.
A mutation hook's `onSuccess` usually does real work (cache invalidation,
`setQueryData`) that must never silently disappear because a caller passed their own
`onSuccess`. Spread `options` first, then define `mutationFn`/`onSuccess`/`onError`
explicitly afterward, calling `options?.onSuccess?.(...)` inside so both run:

```ts
export function useCreateMapping(
  options?: Omit<UseMutationOptions<MappingModel, ApiError, CreateMappingModel>, 'mutationFn'>
) {
  const queryClient = useQueryClient();
  return useMutation<MappingModel, ApiError, CreateMappingModel>({
    ...options, // spread first — mutationFn/onSuccess below always win
    mutationFn: async (body) => { /* ... */ },
    onSuccess: (data, ...rest) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.mapping.invalidate.lists() });
      queryClient.setQueryData<MappingModel>(queryKeys.mapping.byId(data.id), data);
      options?.onSuccess?.(data, ...rest); // caller's callback still runs
    },
  });
}
```

`onSuccess` in TanStack Query v5 is 4-arity (`data, variables, onMutateResult, context`).
Use `(...rest)` instead of naming all four params — it forwards correctly regardless
of arity and doesn't need updating if TanStack adds a param in a later version.

## Update the cache from the response — don't just invalidate

Most create/update endpoints already return the full resource. `invalidateQueries`
alone throws that away and pays for a second round trip to get back data you already
have. Use the response directly:

| Mutation | Do this |
|---|---|
| Create / update | `setQueryData(byId(data.id), data)` — the byId cache is now correct, no refetch needed |
| Delete | `removeQueries({ queryKey: byId(id) })` — the resource is gone, evict it, don't leave it to fail a refetch |
| Either | `invalidateQueries({ queryKey: invalidate.lists() })` — light/paged list views have no cheap way to patch in place, so they still refetch normally |

```ts
export function useDeleteExportSetting(
  options?: Omit<UseMutationOptions<void, ApiError, string>, 'mutationFn'>
) {
  const queryClient = useQueryClient();
  return useMutation<void, ApiError, string>({
    ...options,
    mutationFn: async (id) => { await fetchClient.delete(API.exportSetting.byId(id)); },
    onSuccess: (data, id, ...rest) => {
      queryClient.removeQueries({ queryKey: queryKeys.exportSetting.byId(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.exportSetting.invalidate.lists() });
      options?.onSuccess?.(data, id, ...rest);
    },
  });
}
```

**Must invalidate `lists()`, never `all()`, when you also `setQueryData` the byId key.**
`queryKeys.<entity>.invalidate.all()` returns a bare `[entity]` prefix — TanStack's
`invalidateQueries` does prefix matching, so it matches `byId(...)` too, not just the
list queries. With the default `refetchType: 'active'`, that fires a real background
refetch for any currently-mounted byId observer *immediately*, racing right past the
`setQueryData` call that follows it — you get the redundant network/DB call anyway,
even though the code looks correct. `invalidate.lists()` returns `[entity, 'list']`,
which structurally excludes `[entity, 'single', 'byId', ...]` (see key shapes in
`src/lib/queryKeys.ts`) — the byId query is never touched by invalidation at all, so
`setQueryData` is the only thing that runs. Reserve `invalidate.all()` for mutations
that don't return fresh single-resource data to seed anywhere (e.g. a bulk/silent
side-effect where you genuinely just want everything to refetch).

## Call site uses `mutate` + `onSuccess`

Success messages live at the call site because they typically need request-time
data (the invited email, the created entity's id) that the hook can't formulate
generically. Pass them through the per-call `onSuccess` option.

```tsx
// src/page/invite/InvitePage.tsx
function onSubmit(data: FormValues) {
  sendInvite.mutate(
    { email: data.email, permissions: data.permissions },
    {
      onSuccess: () => {
        enqueueSuccess(`Invite sent to ${data.email}`);
        router.push('/admin');
      },
    },
  );
}
```

## What this gives us

- **No `try/catch` in components.** The hook handles the error path.
- **One source of truth for error copy.** "Failed to send invite" lives next to
  the mutation, not scattered across pages.
- **Success stays local.** Pages that need different copy / navigation per
  context don't have to fight a generic hook contract.
- **Loading state is automatic.** `mutation.isPending` drives the submit button
  — no manual `loading` state.

## When you need both `await` and error handling

Use `mutateAsync` only when the next step *must* run before the function
returns (e.g. handing off to `signIn`). The hook's `onError` still fires, but
`mutateAsync` also rejects — keep the call inside `onSuccess` of a `mutate`
instead, so the rejection doesn't surface as an unhandled promise.

```tsx
acceptInvite.mutate(
  { token, name, password },
  {
    onSuccess: async () => {
      const result = await signIn('credentials', { email, password, redirect: false });
      if (result?.error) router.push('/auth/sign-in');
      else router.push('/');
    },
  },
);
```

## Queries follow the same rule

Read hooks (`useQuery`) don't need a snackbar default — they expose
`isError` / `error` for the component to render inline (typical for "Invalid
invite" pages, "Couldn't load" states, etc.).

```ts
export function useLookupInvite(
  token: string,
  options?: Omit<UseQueryOptions<{ email: string }, ApiError>, 'queryKey' | 'queryFn'>
) {
  return useQuery<{ email: string }, ApiError>({
    queryKey: queryKeys.invite.lookup(token),
    queryFn: async () => (await fetchClient.get(API.invite.lookup(token))).data,
    enabled: !!token,
    retry: false,
    ...options,
  });
}
```

Use a snackbar only if the failure isn't visible in the UI — by default an
inline error message is better UX for queries.
