# Direance — Architecture Guide

A reference for how auth, database, and client-server communication work in this project.

---

## Table of Contents

1. [The Big Picture](#the-big-picture)
2. [Neon DB + Prisma](#neon-db--prisma)
3. [Auth.js v5](#authjs-v5)
4. [Axios + Data Flow](#axios--data-flow)
5. [Making Routes Public](#making-routes-public)

---

## The Big Picture

```
Browser
  │
  ├── Next.js Middleware (runs on every request, Edge runtime)
  │     Checks JWT cookie → allow or redirect to /auth/sign-in
  │
  ├── Next.js Page (Server Component)
  │     Can call auth() to get current user session
  │
  ├── React Hook (Client Component)
  │     Calls axios → Next.js API Route → Service → Prisma → Neon DB
  │
  └── Auth UI (/auth/sign-in, /auth/sign-up)
        Excluded from middleware protection
```

---

## Neon DB + Prisma

### What is Neon?

Neon is a **serverless PostgreSQL** database. "Serverless" means:
- No always-on server you pay for — it scales to zero when idle
- Connections are pooled via a proxy (the `-pooler` URL in your `.env`)
- Works perfectly with Next.js serverless functions on Vercel/similar

Your database lives at the connection string in `.env`:
```
DATABASE_URL="postgresql://...@ep-holy-sky-...-pooler.c-2.eu-central-1.aws.neon.tech/neondb?..."
```

The `-pooler` part is Neon's connection pooler — important because serverless functions open many short-lived connections that would exhaust a regular Postgres server.

### What is Prisma?

Prisma is the **ORM** (Object-Relational Mapper) — it sits between your code and the database.

```
Your TypeScript code
    ↓
Prisma Client (generated TypeScript types + query builder)
    ↓
@prisma/adapter-pg (translates Prisma queries to pg driver calls)
    ↓
pg driver (talks to Neon via TCP/TLS)
    ↓
Neon PostgreSQL
```

**Why Prisma over raw SQL?**
- Fully type-safe: `prisma.user.findUnique(...)` returns a typed `User | null`
- Schema is the single source of truth (`prisma/schema.prisma`)
- Migrations are just `npm run db:push`
- No SQL strings that could have typos or injection

### The User Model

```prisma
// prisma/schema.prisma
model User {
  id            String    @id @default(cuid())
  email         String    @unique
  password      String?   // hashed with bcrypt — null for OAuth users
  name          String?

  // Merit.ee integration stored directly on the user
  meritApiId    String?
  meritApiKey   String?

  // Auth.js internal relations (needed even if you don't use OAuth/sessions)
  accounts      Account[]
  sessions      Session[]
}
```

Everything about a user — auth credentials AND integration tokens — lives in one row. No separate "integrations" table needed at this stage.

### Key Commands

```bash
npm run db:push        # sync schema changes to Neon (dev — no migration files)
npm run db:generate    # regenerate Prisma TypeScript client after schema changes
npm run db:studio      # open Prisma Studio (visual DB browser) at localhost:5555
```

> **Rule of thumb:** every time you change `prisma/schema.prisma`, run both `db:push` then `db:generate`.

### Prisma Singleton (`src/lib/prisma.ts`)

```typescript
const prisma = globalForPrisma.prisma || makePrisma();
```

In development, Next.js hot-reloads modules on every save. Without the singleton pattern, each reload would open a new database connection until the pool is exhausted. The `globalThis` trick ensures only one Prisma instance exists per Node.js process.

---

## Auth.js v5

### What is Auth.js?

Auth.js (also called NextAuth v5) is an authentication library for Next.js. It handles:
- Session management (JWT cookies)
- Sign-in / sign-out flows
- The `/api/auth/...` route handlers

### How a Sign-In Works (Full Flow)

```
1. User submits email + password on /auth/sign-in
2. signIn('credentials', { email, password }) is called (next-auth/react)
3. POST /api/auth/callback/credentials (Auth.js internal)
4. authorize() function in src/auth.ts runs:
   a. prisma.user.findUnique({ where: { email } })
   b. bcrypt.compare(password, user.password)
   c. Returns { id, email, name } if valid, null if not
5. Auth.js creates a JWT containing { id, email, name }
6. JWT is stored in an httpOnly cookie (tamper-proof, not readable by JS)
7. Browser redirects to / (the dashboard)
8. Every subsequent request: middleware reads the JWT cookie, confirms valid,
   allows the request through
```

### The Split Config Pattern

Auth.js runs in **two different runtimes** in Next.js:

| File | Runtime | Why |
|---|---|---|
| `src/auth.config.ts` | **Edge** (Cloudflare Workers-like, very restricted) | Used by middleware — must be lean |
| `src/auth.ts` | **Node.js** (full access) | Used by API routes and server components |

The problem: Prisma and bcrypt use Node.js APIs (`crypto`, `Buffer`, native bindings) that don't exist in the Edge runtime. If middleware imported them, the build would fail.

**Solution: two files.**

```typescript
// src/auth.config.ts — EDGE SAFE, no Prisma, no bcrypt
export const authConfig: NextAuthConfig = {
  pages: { signIn: '/auth/sign-in' },
  callbacks: {
    authorized({ auth }) {
      return !!auth?.user; // just check if JWT exists
    },
  },
  providers: [],
};

// src/auth.ts — NODE.JS, full Prisma + bcrypt
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,               // spread the edge-safe config
  adapter: PrismaAdapter(prisma),
  providers: [Credentials({ authorize: ... })],
});

// src/middleware.ts — uses ONLY the edge-safe config
export default NextAuth(authConfig).auth;
```

### JWT Sessions (Why Not Database Sessions?)

Auth.js supports two session strategies:

| Strategy | How it works | Pros | Cons |
|---|---|---|---|
| `jwt` (used here) | Session data encoded in a signed cookie | No DB reads on every request | Can't invalidate a specific session without changing the secret |
| `database` | Session stored in `Session` table, cookie holds only a session ID | Instant revocation | DB hit on every request |

For this app, `jwt` is the right choice: no need to revoke sessions instantly, and we avoid a DB round-trip on every page load.

The JWT is **signed** with `AUTH_SECRET`. Without knowing the secret, nobody can forge a valid token. This is why `AUTH_SECRET` must be long, random, and kept private.

### Using Auth in Your Code

**Server Component (page.tsx, layout.tsx):**
```typescript
import { auth } from '@/auth';

export default async function DashboardPage() {
  const session = await auth(); // reads JWT from cookie — NO DB call
  const userId = session?.user?.id;
  // ...
}
```

**API Route (route.ts):**
```typescript
import { auth } from '@/auth';

export async function GET() {
  const session = await auth();
  if (!session?.user) return new Response('Unauthorized', { status: 401 });
  // ...
}
```

**Client Component:**
```typescript
'use client';
import { signIn, signOut, useSession } from 'next-auth/react';

const { data: session } = useSession(); // reads from context, no network call
```

> Note: `useSession()` requires wrapping the app in `<SessionProvider>`. If you need the user object client-side, add `SessionProvider` to `src/app/layout.tsx`. For now, we pass user data from server components as props.

### The `Account` and `Session` Models in Prisma

Even though we use JWT sessions, the schema has `Account` and `Session` models. These exist because:
- `Account` is needed if you ever add **OAuth providers** (Google, GitHub, etc.) — each OAuth connection is one Account row
- `Session` would be used only if you switch to `strategy: 'database'`

They're harmless now and ready for future use.

---

## Axios + Data Flow

### What is Axios?

Axios is an HTTP client. In this project it runs **in the browser** and calls our own Next.js API routes.

The full data flow for client-side data:

```
React component
    ↓ calls hook
React Query hook (src/hooks/*.hooks.ts)
    ↓ calls
axiosClient (src/lib/axiosClient.ts)
    ↓ HTTP GET/POST to /api/...
Next.js API Route (src/app/api/**/route.ts)
    ↓ calls
Service (src/services/*.service.ts)
    ↓ calls
Prisma → Neon DB
    ↑ returns data back up the chain
```

### Why axios instead of fetch?

The `axiosClient` in `src/lib/axiosClient.ts` adds two things that raw `fetch` doesn't have:

1. **FormData handling** — if you POST a file upload, axios would incorrectly set `Content-Type: application/json`. The interceptor deletes the header so the browser sets it correctly with the multipart boundary.

2. **Error normalization** — HTTP errors (4xx, 5xx) become `ApiError` instances with a consistent shape `{ message, status, code, details }`. Without this, every hook would need its own error parsing logic.

```typescript
// axiosClient.ts
axiosClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error)) {
      throw ApiError.fromAxios(error); // normalized error
    }
    throw error;
  }
);
```

### When is axios used vs direct DB access?

| Scenario | Use |
|---|---|
| Client component needs data | axios → API route → service → Prisma |
| Server component needs data | call service directly (no HTTP round-trip) |
| Server action | call service directly |
| Merit.ee API (client-side) | axios → Merit.ee's API directly |

Axios is **only** for client→server communication. Server-side code (services, server components, API routes) talks to the DB through Prisma directly — no HTTP involved.

### The `ApiError` Class

Every API error in the system uses this shape:

```typescript
class ApiError {
  message: string;   // human-readable ("Resource not found")
  status?: number;   // HTTP status (404, 409, 500...)
  code?: string;     // machine-readable code ("P2025")
  details?: unknown; // field-level validation errors etc.
}
```

`handleApiError()` in `src/lib/errorHandler.ts` catches any error in an API route and converts it to the right HTTP response — whether it came from Prisma, Yup validation, or your own `throw new ApiError(...)`.

---

## Making Routes Public

Currently the middleware blocks **all** unauthenticated requests and redirects to `/auth/sign-in`. Here's how to change that.

### Option 1 — Make a specific route public

Edit `src/auth.config.ts`:

```typescript
export const authConfig: NextAuthConfig = {
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const publicRoutes = ['/about', '/pricing', '/api/webhook'];
      const isPublic = publicRoutes.some(r => nextUrl.pathname.startsWith(r));

      if (isPublic) return true;           // always allow
      if (!isLoggedIn) return false;       // redirect to sign-in
      return true;
    },
  },
  // ...
};
```

### Option 2 — Invert to opt-in protection (most routes public)

If most of the app is public and only certain routes need auth (e.g., `/dashboard`, `/settings`):

```typescript
authorized({ auth, request: { nextUrl } }) {
  const protectedRoutes = ['/dashboard', '/settings', '/reports'];
  const needsAuth = protectedRoutes.some(r => nextUrl.pathname.startsWith(r));

  if (needsAuth && !auth?.user) return false; // redirect to sign-in
  return true; // everything else is public
},
```

### Option 3 — Remove auth entirely (fully public app)

Delete `src/middleware.ts`. The app becomes fully public. Individual API routes can still protect themselves by checking `const session = await auth()` and returning 401 if null.

### Option 4 — Mixed: public read, protected write

Common pattern for the Merit.ee data — public dashboard view, protected settings:

```typescript
authorized({ auth, request: { nextUrl } }) {
  const isLoggedIn = !!auth?.user;

  // Settings and account management always require login
  if (nextUrl.pathname.startsWith('/settings')) return isLoggedIn;
  if (nextUrl.pathname.startsWith('/auth/sign-in')) return true;
  if (nextUrl.pathname.startsWith('/auth/sign-up')) return true;

  // Everything else: allow if logged in, redirect otherwise
  return isLoggedIn;
},
```

---

## Environment Variables

| Variable | Used by | What it does |
|---|---|---|
| `DATABASE_URL` | Prisma | PostgreSQL connection string (Neon pooler URL) |
| `AUTH_SECRET` | Auth.js | Signs and verifies JWT tokens — keep this secret |
| `AUTH_URL` | Auth.js | Base URL of the app (needed in production for redirects) |

Never commit `.env` to git. The `.env.example` documents what's needed without exposing real values.
