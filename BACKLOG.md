# Direance — Backlog & Notes

Single-person graduation project. No Jira. This file is the backlog.

**Format:**
- `[x]` done
- `[ ]` todo
- `[~]` partially done / in progress
- `[?]` maybe — needs decision

---

## Auth System

### Done
- [x] Sign up (email + password, bcrypt hashed)
- [x] Sign in (JWT cookie, 30-day expiry by default)
- [x] Sign out
- [x] Route protection via middleware (all routes → redirect to /auth/sign-in)
- [x] Navbar shows current user email + sign out button
- [x] Register API route (`POST /api/auth/register`)

### Todo
- [ ] **Remember me checkbox on sign-in**
  > Without "remember me": session expires when browser closes (session cookie).
  > With "remember me": JWT lives for 30 days.
  > Implementation: pass `rememberMe: true` as a credential → capture in `authorize()` →
  > set `token.exp` in the `jwt()` callback based on that flag.
  > Not hard, just not done yet.

- [ ] **Change password** (settings page)
  > Flow: user enters current password + new password → verify old → bcrypt.hash(new) → update DB.
  > Needs a `PATCH /api/user/password` route.

- [ ] **Update profile** (name, email)
  > Simple: `PATCH /api/user` → update User row → refresh session.

- [ ] **Save / update Merit.ee API keys** (settings page)
  > Same route as above or separate `PATCH /api/user/merit`.
  > The fields `meritApiId` and `meritApiKey` already exist on the User model.

### Maybe
- [?] **Forgot password / password reset**
  > Flow:
  > 1. User enters email on /auth/forgot-password
  > 2. Generate a random token, store in `VerificationToken` table with 1-hour expiry
  > 3. Send email with link: `/auth/reset-password?token=abc123`
  > 4. User opens link → enters new password → verify token valid + not expired → update password → delete token
  >
  > Requires: an email sending service (Resend, SendGrid, Nodemailer).
  > `VerificationToken` model is already in the DB schema — zero schema changes needed.
  > Skip this until you actually need it.

- [?] **Email verification on sign-up**
  > Same mechanism as forgot password: generate token → email link → user clicks → mark `emailVerified` on User.
  > `emailVerified DateTime?` is already on the User model.
  > Useful for production to prevent fake accounts. Not needed for graduation demo.

- [?] **OAuth login (Google / GitHub)**
  > One-click sign-in via Google. Zero password needed.
  > Auth.js supports this natively: add `Google({ clientId, clientSecret })` to providers in `src/auth.ts`.
  > The `Account` model in DB is already there for this — zero schema changes.
  > Requires creating an OAuth app in Google Cloud Console.

- [?] **Rate limiting on login**
  > Prevent brute-force password attacks: lock account or add delay after N failed attempts.
  > Can be done with Upstash Redis + `@upstash/ratelimit` in the middleware, or a simple
  > failed-attempt counter on the User row.
  > Overkill for a graduation project but worth noting.

- [?] **User roles** (admin / regular user)
  > Add `role: 'admin' | 'user'` to User model.
  > Expose in JWT via `jwt()` callback.
  > Gate certain routes in `auth.config.ts` based on `auth?.user?.role`.

---

## Merit.ee Integration

- [ ] Merit.ee API client setup (`src/lib/meritClient.ts`)
  > Base axios instance pointing at Merit.ee API with the user's apiId + apiKey as auth.
  > Keys fetched from DB (or from session if we add them to the JWT).

- [ ] Connect / disconnect Merit.ee on settings page
  > Save apiId + apiKey to User row.
  > Test connection button: call Merit.ee /ping or similar.

- [ ] Fetch company list from Merit.ee
- [ ] Fetch annual report data per company
- [ ] Display consolidated reports on dashboard

---

## Report System

- [ ] Manual report upload (PDF / Excel)
  > File upload form using `ArtUpload` component.
  > Store file somewhere (local `/public/uploads` for dev, S3/Cloudflare R2 for prod).
  > Save report metadata to DB.

- [ ] Report model in Prisma
  ```
  Report: id, userId, companyName, year, type, fileUrl, createdAt
  ```

- [ ] Report list page
- [ ] Report detail / viewer page
- [ ] Consolidation view (multiple companies side by side)

---

## Dashboard

- [ ] Summary cards (total revenue, profit, etc. across companies)
- [ ] Date range filter (annual: 2022, 2023, 2024...)
- [ ] Company selector (which companies to include in consolidation)
- [ ] Export consolidated report to PDF / Excel

---

## Settings Page

- [ ] `/settings` route
- [ ] Profile section (name, email, change password)
- [ ] Merit.ee connection section (enter/update/remove API keys)
- [ ] Danger zone (delete account)

---

## Infrastructure / Production Readiness

- [ ] Error boundary on dashboard (don't crash the whole page on one bad API call)
- [ ] Proper loading skeletons on all data pages
- [ ] `next.config.ts` — add Content Security Policy headers
- [ ] Deploy to Vercel (it's free and works perfectly with Next.js + Neon)
- [ ] Add `NEXTAUTH_URL` env var in Vercel settings (same as `AUTH_URL`)
- [ ] Neon: enable connection pooling in production (already using pooler URL)

---

## Documentation

- [x] **Limit requests per user + limit DB rows per user** — `src/lib/rateLimiter.ts` (request rate), `src/lib/rowLimits.ts` (row limits + logo storage). Documented in `BackendGuide.md`.

- [?] **Logo reuse — separate `Logo` table**
  > Currently each ExportSetting stores its own logo bytes. If a user wants the same logo on multiple
  > export settings, they upload it N times. Refactor: `Logo { id, userId, data Bytes, mime, name, createdAt }`.
  > `ExportSetting.logoId → Logo`. One upload, reuse across settings. Same `checkLogoSizeLimit` logic,
  > but the count query runs against the `Logo` table instead.
  > Schema migration required — defer until ExportSettings usage patterns are clearer.

- [?] **Read-endpoint rate limiting tied to cache**
  > Idea: add rate limiting to GET endpoints, but bypass the limit when the response is served from cache
  > (no DB hit). This protects DB from hammered GET endpoints while not penalizing normal cache-warm usage.
  > Implementation unclear — `unstable_cache` doesn't expose a cache-hit signal to route handlers.
  > Needs design work before implementation.
- [ ] **Write TanStack Query documentation** — cover: queryKey conventions (`src/lib/queryKeys.ts`), `useQuery` vs `useSuspenseQuery`, `useMutation` + `onSuccess` cache invalidation, infinite queries via `useInfiniteQuery`, `HydrationBoundary` for server prefetch. Separate doc once patterns are tested and stable.
- [ ] **Final site documentation** — when site is feature-complete, produce comprehensive guide covering every architectural decision, pattern, and rule so the full stack can be recreated from scratch. Goal: new developer reads docs, builds equivalent system without needing to reverse-engineer code.

---

## Notes & Decisions

**2026-03-31** — Decided to use Auth.js v5 with JWT sessions + Prisma adapter over Neon Auth
(Stack Auth). Reason: keeps everything in-stack, User model fully controlled by us,
Merit.ee tokens live directly on User row.

**2026-03-31** — Art component library copied from MePipe. `ArtIconButton` type bug fixed
(now accepts both string icon name and `{ name, size, style }` object). Same fix
should be backported to MePipe.

---

## How to Use This File

- Update `[~]` → `[x]` when you finish something
- Add notes under items when you make a decision
- Add dates to the Notes section for anything non-obvious
- Keep it honest — a backlog that reflects reality is more useful than an optimistic one
