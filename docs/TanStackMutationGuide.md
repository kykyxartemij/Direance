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

import { useMutation } from '@tanstack/react-query';
import fetchClient from '@/lib/fetchClient';
import { API } from '@/lib/apiUrl';
import { useArtSnackbar } from '@/components/ui/ArtSnackbar';
import type { SendInviteModel } from '@/models/invite.models';
import type { ApiError } from '@/models/api-error';

export function useSendInvite() {
  const { enqueueError } = useArtSnackbar();
  return useMutation<void, ApiError, SendInviteModel>({
    mutationFn: async (body) => {
      await fetchClient.post(API.invite.send(), body);
    },
    onError: (err) => enqueueError(err, 'Failed to send invite'),
  });
}
```

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
export function useLookupInvite(token: string) {
  return useQuery<{ email: string }, ApiError>({
    queryKey: queryKeys.invite.lookup(token),
    queryFn: async () => (await fetchClient.get(API.invite.lookup(token))).data,
    enabled: !!token,
    retry: false,
  });
}
```

Use a snackbar only if the failure isn't visible in the UI — by default an
inline error message is better UX for queries.
