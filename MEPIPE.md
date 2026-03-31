# Architecture Rules & Decisions

This document defines the architecture, technical decisions, and patterns used across projects built on this stack. It serves as the single source of truth for how code is structured, why each decision was made, and what the rules are.

**Reference implementation:** MePipe — a YouTube-style video platform. All examples throughout this document use MePipe as the concrete case. The patterns apply to any project using this stack.

---

## Stack

Chosen for scalability, type safety, and production readiness.

| Layer        | Technology                                |
| ------------ | ----------------------------------------- |
| Frontend     | Next.js 15 (App Router), React 19, TypeScript |
| Backend      | Next.js API Routes (Route Handlers)       |
| ORM          | Prisma 7 + pg adapter (connection pooling) |
| Database     | PostgreSQL (Neon — serverless Postgres)    |
| Styling      | Tailwind CSS 4 + CSS custom properties    |
| Validation   | Yup 1.7 (runtime) + TypeScript (compile-time) |
| Data Fetching| React Query 5 (client) + unstable_cache (server) |
| Forms        | React Hook Form 7 + @hookform/resolvers   |
| Images       | `next/image` — optimization, lazy loading, responsive sizing |

## Project Structure

```
src/
  app/                        # Next.js App Router
    layout.tsx                 #   Root layout (QueryProvider, Navbar)
    page.tsx                   #   Homepage entry
    Navbar.tsx                 #   Global navigation bar
    upload/
      page.tsx                 #   Upload page entry
      loading.tsx              #   Upload page skeleton
    video/
      [id]/page.tsx            #   Video page (SSR)
      [id]/loading.tsx         #   Video page skeleton
    api/                       # API Route Handlers
      genre/route.ts           #   GET /api/genre, POST /api/genre
      video/route.ts           #   GET /api/video, POST /api/video
      video/[id]/route.ts      #   GET /api/video/:id
      video/[id]/comments/route.ts  # GET, POST /api/video/:id/comments
      video/[id]/similar/route.ts   # GET /api/video/:id/similar
      video/search/route.ts    #   GET /api/video/search

  page/                        # Page-level components (co-located by feature)
    homepage/
      Homepage.tsx             #   Homepage wrapper
      VideoGrid.tsx            #   Infinite-scroll video grid
      SearchField.tsx          #   Search with autocomplete
    video/
      VideoCard.tsx            #   Video card + skeleton
      components/
        VideoPlayer.tsx        #   Custom HTML5 video player
        CommentSection.tsx     #   Comments list + form
        SimilarVideos.tsx      #   Related videos sidebar
    upload/
      components/
        UploadForm.tsx         #   Video upload form
        GenrePopover.tsx       #   Genre multi-select modal

  components/                  # Reusable UI components ("Art" component library)
    ui/
      ArtInput.tsx             #   Input with icon, clear button, helper text
      ArtTextarea.tsx          #   Textarea with helper text
      ArtDebounceInput.tsx     #   Input with debounced onChange
      ArtComboBox.tsx          #   Combobox (input + dropdown list)
      ArtIcon.tsx              #   Icon wrapper that maps name -> SVG
      ArtSnackbar.tsx          #   (Planned) Custom snackbar
      ArtDialog.tsx            #   (Planned) Custom dialog
    icons/                     #   SVG icon components
      index.ts                 #   Barrel export for all icons

  hooks/                       # React Query hooks (one file per domain)
    video.hooks.ts             #   usePagedVideos, useById, useSimilarVideos, useSearchField, useCreateVideo
    comment.hooks.ts           #   usePagedCommentsByVideoId, useCreateComment
    genre.hooks.ts             #   useGenres, useCreateGenre

  services/                    # Server-side business logic (one file per domain)
    video.service.ts           #   getPagedVideos, getVideoById, getSimilarVideos, getSearchSuggestions, createVideo
    comment.service.ts         #   getPagedCommentsByVideoId, createComment
    genre.service.ts           #   getGenres, createGenre

  models/                      # Types + Yup validation schemas
    index.ts                   #   IdValidator, parseIdFromRoute (shared)
    video.models.ts            #   VideoModel, VideoLightModel, VideoWriteModel, VideoCreateValidator
    comment.models.ts          #   CommentModel, CommentCreateValidator
    genre.models.ts            #   GenreModel, GenreCreateValidator
    api-error.ts               #   ApiError class (client + server)
    paginated-response.model.ts #  PaginatedResponse<T>, pagination validator + helpers

  lib/                         # Infrastructure utilities
    prisma.ts                  #   Prisma client singleton (pg Pool adapter)
    serverCache.ts             #   cached() and invalidateCache() wrappers
    cacheKeys.ts               #   Server-side cache key factories
    queryKeys.ts               #   Client-side React Query key factories
    apiUrl.ts                  #   API URL builders (one per endpoint)
    axiosClient.ts             #   Axios instance with ApiError interceptor
    errorHandler.ts            #   handleApiError() -- maps errors to HTTP responses
    freeText.ts                #   normalizeText() utility

  providers/
    QueryProvider.tsx          #   React Query client + devtools

  styles/
    globals.css                #   Tailwind directives, CSS variables, component classes

prisma/
  schema.prisma                # Database schema
  seed.ts                      # Database seeder
```

## Architecture

### Data Flow Overview

```
Browser (React)                     Server (Next.js)                  Database (PostgreSQL)
    |                                     |                                  |
    |--- React Query hook ------>         |                                  |
    |    (video.hooks.ts)                 |                                  |
    |                                     |                                  |
    |--- axios GET /api/video ----------> |                                  |
    |    (apiUrl.ts builds URL)           |                                  |
    |                                     |--- route.ts delegates -------->  |
    |                                     |    to video.service.ts           |
    |                                     |                                  |
    |                                     |--- cached() wraps query ------>  |
    |                                     |    (serverCache.ts)              |
    |                                     |                                  |
    |                                     |    prisma.video.findMany() ---> |
    |                                     |                                  |
    |                                     | <--- PaginatedResponse -------- |
    |                                     |                                  |
    | <--- JSON response ---------------- |                                  |
    |                                     |                                  |
    |--- React Query caches result        |                                  |
    |    (queryKeys.ts)                   |                                  |
```

### Layer Responsibilities

**Route Handlers** (`app/api/**/route.ts`) -- Thin routing layer. Each file exports HTTP method functions (`GET`, `POST`) that delegate to the corresponding service function. No business logic here.

**Services** (`services/*.service.ts`) -- All server-side business logic lives here. Each function:
1. Validates input (Yup schemas from `models/`)
2. Queries the database via Prisma (wrapped in `cached()`)
3. Returns a `NextResponse`
4. Catches errors via `handleApiError()`

**Hooks** (`hooks/*.hooks.ts`) -- Client-side data layer. Each hook wraps a React Query `useQuery`/`useMutation`/`useInfiniteQuery` call. Hooks:
- Use `queryKeys.ts` for cache key consistency
- Use `apiUrl.ts` for URL building
- Type responses with models from `models/`
- Handle optimistic cache updates on mutations

**Models** (`models/`) -- Shared between client and server. Each model file contains:
- **BE Model**: interface extending Prisma's generated type
- **FE Model**: interface representing what the client receives
- **Validator**: Yup schema for runtime validation
- **Inferred Type**: `yup.InferType<typeof Validator>` for type safety

### Art Component Library

Custom reusable UI components prefixed with `Art`. All components:
- Use `forwardRef` for ref forwarding (compatible with React Hook Form)
- Accept standard HTML attributes via `extends React.InputHTMLAttributes`
- Use CSS classes defined in `globals.css` (under `@layer components`)
- Support `helperText` for validation error display

| Component         | Purpose                                          | Key Props                                        |
| ----------------- | ------------------------------------------------ | ------------------------------------------------ |
| `ArtButton`       | Button (default/outlined/ghost)                  | `variant`, `color`, `size`, `icon`, `loading`    |
| `ArtIconButton`   | Square icon-only button                          | `icon: ArtIconName`, `tooltip`, `color`, `size`  |
| `ArtIconToggle`   | Stateful icon toggle (on/off)                    | `icon`, `pressedIcon` (both `ArtIconName`), `pressed`, `color`, `size` |
| `ArtIconCycle`    | Cycles through N states on each click            | `options: { value, icon: ArtIconName, tooltip?, color? }[]`, `value`, `onChange` |
| `ArtInput`        | Text input                                       | `icon`, `clearable`, `helperText`, `debounce`    |
| `ArtTextarea`     | Auto-growing textarea                            | `rows`, `maxRows`, `helperText`                  |
| `ArtComboBox`     | Input + filtered dropdown                        | `options`, `selected`, `clearable`, `debounceMs` |
| `ArtSelect`       | Pick-only dropdown (no search)                   | `options`, `selected`, `onChange`                |
| `ArtIcon`         | SVG icon by name                                 | `name: ArtIconName`, `size`                      |
| `ArtTooltip`      | Hover tooltip wrapper                            | `label`                                          |
| `ArtBadge`        | Status/label badge                               | `variant`, `color`, `size`, `icon`               |
| `ArtSlider`       | Range slider                                     | `value`, `onChange`, `color`, `size`             |
| `ArtProgress`     | Progress bar (display-only)                      | `value`, `color`, `size`                         |
| `ArtSkeleton`     | Shimmer loading placeholder                      | `className` (Tailwind sizing)                    |
| `ArtTitle`        | Page/section heading                             | `size` (`sm`/`md`/`lg`), `badge`, `actions`      |
| `ArtForm`         | Form wrapper with submit handling                | `onSubmit`, `loading`                            |
| `ArtMenu`         | Dropdown action menu                             | `items: ArtMenuItemDef[]`, `onSelect`, trigger (child) |
| `ArtPopover`      | Floating panel anchored to a trigger             | `trigger`, `placement`                           |
| `ArtTabs`         | Tab navigation                                   | `tabs: ArtTab[]`, `value`, `onChange`            |
| `ArtRadio`        | Radio group                                      | `options`, `value`, `onChange`                   |
| `ArtSwitch`       | Toggle switch                                    | `checked`, `onChange`, `color`                   |
| `ArtPagination`   | Page number controls                             | `page`, `totalPages`, `onChange`                 |
| `ArtDataTable`    | Table with sorting + empty state                 | `columns`, `rows`, `onSort`                      |
| `ArtEmptyState`   | Empty/zero-data placeholder                      | `icon`, `title`, `description`, `action`         |
| `ArtSnackbar`     | Toast notifications (Provider + hook)            | `useArtSnackbar()` — `enqueue`, `enqueueSuccess`, `enqueueError`, `close` |
| `ArtDialog`       | Modal dialog (Provider + hook + trigger)         | `useArtDialog()` — `show`, `close`; `<ArtDialog>`, `<ArtConfirmDialog>` |

### How ArtInput Works (Example)

```tsx
// ArtInput uses forwardRef so React Hook Form's register() can attach a ref
const ArtInput = forwardRef<HTMLInputElement, ArtInputProps>((props, ref) => {
  const { icon, clearable, helperText, onChange, ...rest } = props;

  // Merge forwarded ref with internal ref (needed for clear button)
  const inputRef = useRef<HTMLInputElement | null>(null);
  const setRef = (el: HTMLInputElement | null) => {
    inputRef.current = el;
    typeof ref === 'function' ? ref(el) : (ref.current = el);
  };

  // Clear button programmatically sets value and dispatches events
  // so React Hook Form detects the change
  const handleClear = () => {
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, 'value'
    )?.set;
    setter?.call(el, '');
    el.dispatchEvent(new Event('input', { bubbles: true }));
  };

  return (
    <div className="art-input-wrapper">
      <div className="art-input-inner">
        {icon && <span className="art-input-icon"><ArtIcon {...icon} /></span>}
        <input ref={setRef} className="art-input" onChange={handleChange} {...rest} />
        {clearable && hasValue && (
          <button className="art-input-clear" onClick={handleClear}>
            <ArtIcon name="Close" size={14} />
          </button>
        )}
      </div>
      {helperText && <p className="art-field-helper">{helperText}</p>}
    </div>
  );
});
```

Key techniques:
- **Dual ref**: merging `forwardRef` + internal `useRef` so clear logic works alongside form libraries
- **Native setter**: using `Object.getOwnPropertyDescriptor` to programmatically set value and trigger React's synthetic events
- **CSS structure**: wrapper -> inner (relative) -> icon (absolute) + input + clear button (absolute)

## Frontend Architecture & Page Structure

MePipe follows a three-tier separation for frontend code:

### 1. **App Layer** (`src/app/`) — Thin Routing

Files in `app/` are **thin entry points** that:
- Handle Next.js routing and dynamic route params (`[id]`)
- Load search params and pass them to feature components
- Provide `loading.tsx` for immediate skeleton UI via Suspense streaming
- Are **NOT** React `"use client"` by default (Server Components when possible)

**Example: Video page routing**
```tsx
// app/video/[id]/page.tsx (Server Component) — just passes the id down
import VideoPage from '@/page/video/VideoPage';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <VideoPage videoId={id} />;
}

// app/video/[id]/loading.tsx — shown instantly while page.tsx streams
import VideoPage from '@/page/video/VideoPage';

export default function Loading() {
  return <VideoPage loading />;
}
```

### 2. **Page Components** (`src/page/`) — Feature-Specific Logic

Files in `page/` are **feature-complete, reusable components**:
- Handle all state management via React Query hooks
- Compose lower-level components from `components/ui/`
- Are always `"use client"` (Client Components)
- Co-located by feature (`homepage/`, `video/`, `upload/`)

**Example: VideoPage component**
```tsx
// page/video/VideoPage.tsx (Client Component)
'use client';

import { useById } from '@/hooks/video.hooks';
import VideoPlayer from './components/VideoPlayer';
import CommentSection from './components/CommentSection';

export default function VideoPage({ videoId }: { videoId: string }) {
  const { data: video, isLoading } = useById(videoId);

  if (isLoading) return <VideoPageSkeleton />;
  if (!video) return <p>Video not found</p>;

  return (
    <div className="video-page">
      <VideoPlayer src={video.videoUrl} />
      <CommentSection videoId={videoId} />
    </div>
  );
}
```

### 3. **Component Library** (`src/components/ui/`) — Reusable UI Building Blocks

The "Art" library provides buttons, inputs, overlays, and feedback components. All components:
- Use `forwardRef` for React Hook Form compatibility
- Share base styling via `@layer components` in `globals.css`
- Accept Tailwind classes for customization
- No `React.memo` / `useMemo` on feature components — only inside Art library components

---

## Navigation & Loading Strategy

The full navigation lifecycle, from click to content:

```
User clicks <Link prefetch>
        │
        ▼  (route shell was pre-cached on viewport entry)
loading.tsx skeleton — appears in 0ms
        │
        ▼  (React Query fetches data client-side)
        │
        ▼
Real content replaces skeleton
```

### Step 1 — `<Link prefetch>`: Instant Response to Clicks

**Rule: every `<Link>` with an internal `href` must have explicit `prefetch`.**

Next.js 15 changed the default to *hover-only* prefetch. Without it, a quick click (before hover) makes the browser wait for the server before showing anything — a visible blank gap before the skeleton.

With `prefetch`, Next.js fetches the route shell (just `loading.tsx` — pure JSX, no data, tiny payload) when the link scrolls into viewport. Click → skeleton in 0ms.

```tsx
// ❌ Next.js 15 default — hover-only, blank gap on quick clicks
<Link href={`/video/${video.id}`}>…</Link>

// ✅ Prefetch on viewport entry — skeleton appears instantly on click
<Link href={`/video/${video.id}`} prefetch>…</Link>
```

**Overhead:** ~20 small requests for a grid of 20 cards, fired as they enter the viewport. Each fetches only the skeleton markup (no DB queries). This is intentional — a small bandwidth trade for instant perceived navigation. Enforced by ESLint rule `local/require-link-prefetch`.

### Step 2 — `loading.tsx`: Skeleton While Data Loads

`loading.tsx` is a Next.js file convention that wraps the route in a Suspense boundary. It is what gets pre-cached by `prefetch` — so it must be cheap (no data fetching, pure JSX).

**Pattern: components own their skeleton via a `loading` prop.** `loading.tsx` is one line; no duplication.

```tsx
// page/video/VideoPage.tsx — owns both the real render and the skeleton
export default function VideoPage({ videoId = '', loading = false }) {
  const { data } = useById(videoId, { enabled: !loading });
  if (loading || !data) return <Skeleton />;
  return <div>…real content…</div>;
}

function Skeleton() {
  return (
    <div className="flex gap-6 max-lg:flex-col">
      <ArtSkeleton className="w-full rounded-xl aspect-video" />
      …
    </div>
  );
}

// app/video/[id]/loading.tsx — one line
export default function Loading() { return <VideoPage loading />; }

// app/video/[id]/page.tsx — one line
export default async function Page({ params }) {
  const { id } = await params;
  return <VideoPage videoId={id} />;
}
```

Change the layout once in `VideoPage` — both the real page and the skeleton update together.

### Step 3 — Skeleton Strategy: What to Skeleton

**Rule: skeleton only where unknown dimensions would cause layout shift.** Static structure renders immediately.

```tsx
// ✅ CommentSection — heading and input visible instantly, only the list skeletons
return (
  <div>
    <h3>Comments</h3>
    <ArtInput placeholder="Add a comment..." disabled={isLoading} />
    <ArtButton disabled={isLoading}>Send</ArtButton>
    {isLoading
      ? <ArtSkeleton className="h-10 w-full" />
      : comments.map(c => <Comment key={c.id} comment={c} />)
    }
  </div>
);
```

### `ArtSkeleton` — The Shimmer Component

Pass any Tailwind sizing to match the shape of the real element:

```tsx
<Image src={url} alt={title} className="w-full aspect-video rounded-lg" />
// ↓ skeleton equivalent
<ArtSkeleton className="w-full aspect-video rounded-lg" />
```

### `next/dynamic` — Rarely Needed

Next.js auto code-splits every route. Only use `next/dynamic` for genuine edge cases:
- A **heavy library** used in one place (code editor, 3D viewer, chart)
- A component rendered **only on user interaction** (e.g., a rich-text modal)

For standard feature components, `loading.tsx` + direct imports is always sufficient.

---

## Styling Strategy

### Tailwind v4 with `@import "tailwindcss"`

MePipe uses Tailwind CSS 4's new unified import syntax:
```css
/* globals.css */
@import "tailwindcss";
```

This single import loads all Tailwind layers (preflight, components, utilities) without requiring a build configuration.

### CSS Custom Properties for Theming

A dark theme is defined via CSS custom properties in `:root`:
```css
:root {
  --bg: #0f0f0f;           /* Page background */
  --surface: #1a1a1a;      /* Cards, inputs, buttons */
  --border: #333;          /* Borders */
  --text: #f1f1f1;         /* Primary text */
  --text-muted: #aaa;      /* Secondary text, hints */
  --primary: #646cff;      /* Accent color (links, focused inputs) */
}
```

**Usage:**
```css
body {
  background: var(--bg);
  color: var(--text);
}

input:focus {
  border-color: var(--primary);
}
```

**To customize globally**, edit one file:
- Change `--bg: #000` → all backgrounds update
- Change `--primary: #ff0000` → all accents turn red

### Art Component Styling Model

Art components have three layers of styling, applied in order:

1. **Base class** — structural CSS from `globals.css` (e.g. `.art-field`, `.btn-ghost`)
2. **Variant/color props** — `variant`, `color`, `size` select predefined modifier classes
3. **`className` override** — Tailwind classes passed by the caller, merged last via `cn()`

```tsx
// Base: art-field (border, bg, padding, radius)
// Color: art-primary (accent tint on border + bg)
// Override: w-full added by caller
<ArtInput color="primary" className="w-full" />

// Base: btn-ghost art-icon-btn
// Override: opacity-50 dims the button in context
<ArtIconButton icon="Close" className="opacity-50" />
```

All 13 components accept `className` and merge it at the root element. For `ArtInput` and `ArtTextarea`, `className` applies to the `<input>`/`<textarea>` itself — not the outer wrapper. Use the `color` prop for tinting and `className` for layout/spacing overrides that depend on the call site.

**Rule: never reach into `globals.css` to override a component's appearance in feature code.** Use `className` instead.

### `@layer utilities` — Custom Utility Classes

Utilities extend Tailwind's utility layer for reuse:
```css
@layer utilities {
  .text-muted { color: var(--text-muted); }
  .bg-muted { background: var(--surface); }
  .border-muted { border-color: var(--border); }

  .shimmer {
    background: linear-gradient(90deg, #1a1a1a 25%, #333 50%, #1a1a1a 75%);
    background-size: 200% 100%;
    animation: shimmer 1.4s ease-in-out infinite;
    border-radius: 6px;
  }
}
```

### `@layer components` — Component Classes

Components define reusable element styles:

**Button components:**
```css
@layer components {
  .btn {
    @apply rounded-lg border px-4 py-2 text-sm transition-colors cursor-pointer;
    border-color: var(--border);
    background: var(--surface);
    color: var(--text);
  }
  .btn:hover { border-color: var(--primary); }

  .btn-primary {
    background: var(--primary);
    border-color: var(--primary);
    color: #fff;
  }
  .btn-primary:hover { opacity: 0.9; }
}
```

**Art field base (shared by inputs & textareas):**
```css
@layer components {
  .art-field-wrapper { @apply flex flex-col w-full; }
  .art-field-inner { @apply relative flex w-full; }

  .art-field {
    @apply w-full min-w-[10rem] min-h-[2.25rem] text-sm rounded-md px-3 py-2;
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text);
  }

  .art-field-icon {
    @apply absolute left-3 top-1/2 -translate-y-1/2;
    color: var(--text-muted);
    pointer-events: none;
  }

  /* Pad input away from icon/clear button using :has() */
  .art-field-inner:has(.art-field-icon) .art-field { padding-left: 2.25rem; }
  .art-field-inner:has(.art-field-clear) .art-field { padding-right: 2.25rem; }

  .art-field-clear {
    @apply absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full;
    background: transparent;
    border: none;
    cursor: pointer;
    color: var(--text-muted);
  }
  .art-field-clear:hover { color: var(--text); background: var(--border); }
}
```

**Page layout components:**
```css
@layer components {
  /* Video page: main content + sidebar */
  .video-page { @apply flex gap-6; }
  .video-main { @apply flex-1 min-w-0; }
  .video-sidebar { @apply w-[400px] min-w-[340px]; }
  @media (max-width: 1024px) {
    .video-page { @apply flex-col; }
    .video-sidebar { @apply w-full; }
  }

  /* Video grid: responsive columns */
  .video-grid { @apply grid grid-cols-4 gap-6; }
  @media (max-width: 1024px) { .video-grid { @apply grid-cols-3; } }
  @media (max-width: 768px) { .video-grid { @apply grid-cols-2; } }
  @media (max-width: 480px) { .video-grid { @apply grid-cols-1; } }
}
```

---

## Component Library Design

### How Art Components Work

Art components are **input/form primitives** that combine:
1. **HTML elements** (`<input>`, `<textarea>`)
2. **Ref forwarding** (compatibility with React Hook Form)
3. **CSS classes** from `@layer components`
4. **Enhanced behavior** (clear button, debounce, combobox dropdown)

### ArtInput Example

```tsx
const ArtInput = forwardRef<HTMLInputElement, ArtInputProps>((props, ref) => {
  const {
    icon,
    clearable,
    helperText,
    debounce: debounceMs = false,
    onDebouncedChange,
    onChange,
    ...rest
  } = props;

  const inputRef = useRef<HTMLInputElement | null>(null);
  const [hasValue, setHasValue] = useState(false);

  // Forward ref to both internal and external consumers
  const setRef = (el: HTMLInputElement | null) => {
    inputRef.current = el;
    if (!ref) return;
    typeof ref === 'function' ? ref(el) : (ref.current = el);
  };

  // Programmatic clear: set value and fire events
  const handleClear = () => {
    const el = inputRef.current;
    if (!el) return;
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    )?.set;
    setter?.call(el, '');
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    setHasValue(false);
  };

  return (
    <div className="art-field-wrapper">
      <div className="art-field-inner">
        {icon && <span className="art-field-icon"><ArtIcon {...icon} /></span>}
        <input ref={setRef} className="art-field" onChange={handleChange} {...rest} />
        {clearable && hasValue && (
          <button className="art-field-clear" onClick={handleClear}>
            <ArtIcon name="Close" size={14} />
          </button>
        )}
      </div>
      {helperText && <p className="art-field-helper">{helperText}</p>}
    </div>
  );
});
```

**Key techniques:**
- **Dual ref merging**: forwards both to React Hook Form and internal logic
- **Native setter hack**: uses `Object.getOwnPropertyDescriptor` to set value and trigger synthetic events
- **CSS positioning**: wrapper → inner (relative) → icon/clear (absolute) + input

### ArtComboBox Design

Composes `ArtInput` with a dropdown list:
```tsx
const ArtComboBox = forwardRef<HTMLInputElement, ArtComboBoxProps>(
  ({
    options,
    value,
    onChange,
    onSubmit,
    debounceMs = false,
    onDebouncedChange,
    noOptionsMessage,
  }, ref) => {
    const [open, setOpen] = useState(false);
    const [activeIdx, setActiveIdx] = useState(-1);

    // Keyboard navigation
    const handleKeyDown = (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setActiveIdx((i) => (i < options.length - 1 ? i + 1 : 0));
          break;
        case 'Enter':
          e.preventDefault();
          select(activeIdx >= 0 ? options[activeIdx].value : value);
          break;
        case 'Escape':
          setOpen(false);
          break;
      }
    };

    return (
      <div className="art-combobox" ref={wrapperRef}>
        <ArtInput
          ref={ref}
          value={value}
          debounce={debounceMs}
          onDebouncedChange={onDebouncedChange}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => hasOptions && setOpen(true)}
        />
        {open && hasOptions && (
          <ul className="art-combobox-list">
            {options.map((opt, i) => (
              <li
                key={opt.value}
                className={`art-combobox-option ${i === activeIdx ? 'art-combobox-option--active' : ''}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  select(opt.value);
                }}
              >
                {opt.label}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }
);
```

### Why Shared Base Styling Works

All Art components inherit from `.art-field-*` classes:
```css
@layer components {
  /* Inputs inherit .art-field base */
  .art-field {
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text);
  }
}
```

This means:
- Change `.art-field` border color → all inputs update
- Add focus styles to `.art-field` → all inputs get consistent behavior
- Add padding → all inputs adjust without component changes

### Customization via Tailwind Classes

Components accept `className` prop (merged with base):
```tsx
<ArtInput
  className="text-xs"  // Override size
  icon={{ name: 'Search', size: 16 }}
  clearable
  placeholder="Search..."
/>
```

### ArtSnackbar & ArtDialog

Both use a **Provider + hook** pattern. Providers are mounted once in `app/layout.tsx`.

**ArtSnackbar:**
```ts
const { enqueueSuccess, enqueueError, enqueue, close } = useArtSnackbar();
enqueueSuccess('Video uploaded!');
enqueueError(err, 'Upload failed');
```

**ArtDialog — three ways to open:**
```tsx
// 1. Declarative trigger
<ArtDialog title="Delete?" color="danger" cancelButton
  buttons={[{ label: 'Delete', variant: 'default', color: 'danger', onClick: () => deleteVideo(id) }]}>
  <ArtButton color="danger">Delete</ArtButton>
</ArtDialog>

// 2. Pre-configured yes/no
<ArtConfirmDialog title="Delete comment?" onConfirm={() => deleteComment(id)}>
  <ArtIconButton icon="Close" tooltip="Delete" />
</ArtConfirmDialog>

// 3. Imperative (from hooks, event handlers)
const { show, close } = useArtDialog();
show({ title: 'Hello', cancelButton: true });
```

---

## Data Fetching Patterns

### React Query Hooks Layer

All client data fetching goes through React Query hooks in `src/hooks/`:

**Example: usePagedVideos hook**
```tsx
export const usePagedVideos = (page: number, pageSize: number, freeText?: string) => {
  return useInfiniteQuery<PaginatedResponse<VideoLightModel>, ApiError>({
    queryKey: queryKeys.video.paged(page, pageSize, freeText),
    queryFn: async () => {
      const res = await axios.get<PaginatedResponse<VideoLightModel>>(
        API.video.paged(page, pageSize, freeText)
      );
      return res.data;
    },
    initialPageParam: 1,
    getNextPageParam: getNextPage,  // Infinite scroll helper
  });
};
```

**Hook responsibilities:**
- Wrap React Query methods (`useQuery`, `useInfiniteQuery`, `useMutation`)
- Use centralized `queryKeys.ts` for cache key consistency
- Use `apiUrl.ts` for URL building
- Type responses with models from `models/`
- Handle optimistic updates on mutations

**Three hook patterns:**

| Pattern | Use Case | Example |
| ------- | -------- | ------- |
| `useQuery` | Single resource | `useById(videoId)` → fetches one video |
| `useInfiniteQuery` | Paginated lists | `usePagedVideos(page, pageSize)` → infinite scroll |
| `useMutation` | Create/update/delete | `useCreateVideo()` → upload with progress |

### Server-Side Caching with `cached()`

**The problem:** Every request to the database costs network transfer. On Neon free tier (5 GB public transfer/month), frequent queries against large result sets can exhaust the budget quickly.

**The solution:** `cached()` wrapper from `serverCache.ts`:

```ts
export async function cached<T>(
  queryFn: () => Promise<T>,
  cacheKey: string[],
  ttl: number = 90,  // 90 seconds default
): Promise<T> {
  const cachedFn = unstable_cache(async () => queryFn(), cacheKey, {
    revalidate: ttl,
    tags: cacheKey,   // tags always equal cacheKey — no separate tags param
  });
  return cachedFn();
}
```

**Used in service functions:**
```ts
// getPagedVideos in video.service.ts
// page is already 0-based — parsePaginationFromUrl subtracts 1 when parsing the URL param
const videos = await cached(
  () =>
    prisma.video.findMany({
      where: { /* ... */ },
      skip: page * pageSize,
      take: pageSize,
      orderBy: { publishedAt: 'desc' },
    }),
  CACHE_KEYS.video.paged(page, pageSize, freeText)
);
```

**Key points:**
- Shared across ALL users and serverless instances (not per-browser)
- Time-based invalidation (TTL) or tag-based (after mutations)
- Connection pooling handled by `pg.Pool` in `prisma.ts`

### Why No `COUNT(*)` Queries

Pagination endpoints return `total` but **the client doesn't use it**:

```tsx
// PaginatedResponse includes total, but...
export interface PaginatedResponse<T> {
  data: T[];
  total: number;  // ← Included but not used by frontend
  page: number;
  pageSize: number;
}

// Frontend detects "last page" via data.length
export function getNextPage(lastPage: PaginatedResponse<unknown>): number | undefined {
  // Primary source: if current page is not full, there is no next page
  if (lastPage.data.length < lastPage.pageSize) return undefined;

  // If backend provides a positive total, use it to verify
  if (lastPage.total > 0) {
    return lastPage.page * lastPage.pageSize < lastPage.total ? lastPage.page + 1 : undefined;
  }

  // No total available but page was full — assume there is a next page
  return lastPage.page + 1;
}
```

**Why?** A separate `COUNT(*)` query doubles DB operations. With infinite scroll, it's unnecessary:
- Request page 1: get 10 items → show "load more"
- Request page 2: get 10 items → show "load more"
- Request page 3: get 5 items → last page detected (5 < pageSize)

**Cost savings:** Infinite scroll = N fetches. With COUNT = 2N database operations.

### Infinite Scroll with useInfiniteQuery

```tsx
const usePagedVideos = (page: number, pageSize: number, freeText?: string) => {
  return useInfiniteQuery<PaginatedResponse<VideoLightModel>, ApiError>({
    queryKey: queryKeys.video.paged(page, pageSize, freeText),
    queryFn: async ({ pageParam }) => {
      const res = await axios.get<PaginatedResponse<VideoLightModel>>(
        API.video.paged(pageParam, pageSize, freeText)
      );
      return res.data;
    },
    initialPageParam: 1,
    getNextPageParam: getNextPage,  // Returns next page or undefined
  });
};
```

**Component usage:**
```tsx
const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = usePagedVideos(
  page, pageSize, search
);

return (
  <>
    {data?.pages.map((page) =>
      page.data.map((video) => <VideoCard key={video.id} video={video} />)
    )}

    {hasNextPage && (
      <button onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
        {isFetchingNextPage ? 'Loading...' : 'Load More'}
      </button>
    )}
  </>
);
```

---

## Database Schema

```prisma
generator client {
  provider = "prisma-client"
  output   = "../generated/prisma"
}

datasource db {
  provider = "postgresql"
}

model Genre {
  id     String  @id @default(uuid())
  name   String  @unique
  videos Video[]
}

model Video {
  id              String    @id @default(uuid())
  title           String
  description     String    @default("")
  thumbnailUrl    String
  videoUrl        String
  durationSeconds Int
  publishedAt     DateTime  @default(now())
  ageRating       AgeRating @default(G_0)
  genres          Genre[]       // implicit many-to-many
  comments        Comment[]     // one-to-many
}

model Comment {
  id        String   @id @default(uuid())
  text      String
  createdAt DateTime @default(now())
  videoId   String
  video     Video    @relation(fields: [videoId], references: [id], onDelete: Cascade)
}

enum AgeRating {
  G_0
  G_12
  G_16
  G_18
}
```

**Key decisions:**
- **Implicit many-to-many** (`Genre <-> Video`): Prisma auto-creates a join table. No manual join model needed.
- **Cascade delete**: deleting a Video deletes all its Comments.
- **UUIDs** for all IDs: globally unique, no sequential leaking.
- **Generated client** output to `generated/prisma/` (gitignored).

## Model Layer Pattern

Each domain has a model file that serves both client and server. The pattern:

```ts
// 1. BE Model -- extends Prisma's generated type (used in services)
export interface VideoPrismaModel extends PrismaVideo {}

// 2. FE Model -- what the client receives from the API
export interface VideoModel {
  id: string;
  title: string;
  // ... only the fields the frontend needs
}

// 3. Light Model -- minimal fields for lists/cards
export interface VideoLightModel {
  id: string;
  title: string;
  thumbnailUrl: string;
}

// 4. Write Model -- what the client sends to create/update
export interface VideoWriteModel {
  title: string;
  videoFile: File;
  // ...
}

// 5. Validator -- Yup schema for runtime validation
export const VideoCreateValidator = yup.object({
  title: yup.string().required().min(1).max(200),
  // ...
});

// 6. Inferred Type -- auto-generated from the Yup schema
export type VideoCreateRequest = yup.InferType<typeof VideoCreateValidator>;
```

**Why separate FE and BE models?**
- The database model may have fields the client should never see.
- The frontend model may include computed fields (e.g., `totalComments` from `_count`).
- Light models reduce payload size for list views.

## Validation Strategy

Yup validates on **both** sides:

| Where         | What                     | How                                         |
| ------------- | ------------------------ | ------------------------------------------- |
| API routes    | Route params (`:id`)     | `IdValidator.validateSync(params)`          |
| API routes    | Request body             | `CommentCreateValidator.validate(body)`     |
| API routes    | Query params (pagination)| `PaginatedResponseValidator.validate(data)` |
| Client forms  | Form fields              | `yupResolver(schema)` with React Hook Form  |

The `handleApiError()` function in `errorHandler.ts` catches Yup `ValidationError` and returns structured 400 responses with per-field errors.

## Caching Architecture

MePipe uses **two caching layers** that work together:

### Server-Side: `unstable_cache` (Next.js)

The `cached()` wrapper in `serverCache.ts`:

```ts
export async function cached<T>(
  queryFn: () => Promise<T>,
  cacheKey: string[],
  ttl: number = DEFAULT_TTL,  // 90 seconds — override only for special cases
): Promise<T> {
  const cachedFn = unstable_cache(async () => queryFn(), cacheKey, {
    revalidate: ttl,
    tags: cacheKey,  // tags always equal cacheKey — no separate param
  });
  return cachedFn();
}
```

- Wraps any async function with Next.js server cache.
- Shared across all users and serverless instances (not per-browser).
- `invalidateCache()` uses `revalidateTag()` for targeted invalidation after mutations.
- Cache keys are centralized in `cacheKeys.ts` to prevent key drift.

### Pattern: `cached()` + `findUniqueOrThrow`

When caching a by-ID query, always use `findUniqueOrThrow`, never `findUnique`:

```ts
// ✅ Correct
const video = await cached(
  () => prisma.video.findUniqueOrThrow({ where: { id } }),
  CACHE_KEYS.video.byId(id)
);

// ❌ Wrong — caches null for 90 seconds
const video = await cached(
  () => prisma.video.findUnique({ where: { id } }),
  CACHE_KEYS.video.byId(id)
);
```

**Why it matters:** `findUnique` returns `null` when a record doesn't exist. `cached()` stores that `null` in the server cache. For the next 90 seconds every request returns cached `null` — even after the record is created. `findUniqueOrThrow` throws instead of returning `null`, so `cached()` never stores the result, and the Prisma error propagates to `handleApiError()` which maps `P2025` → 404.

**Exception:** Use `findUnique` without `cached()` when `null` is a valid expected result (e.g., checking if a username already exists).

### Client-Side: React Query

- `QueryProvider` configures a global `QueryClient` with 15s `staleTime`.
- Each hook uses keys from `queryKeys.ts` (structured as `[resource, kind, subtype, ...args]`).
- Mutations invalidate list queries and optimistically set single-item cache.

### Why Two Layers?

| Concern            | Server Cache (unstable_cache) | Client Cache (React Query) |
| ------------------ | ----------------------------- | -------------------------- |
| Scope              | All users, all instances      | Single browser tab         |
| Reduces DB queries | Yes                           | No (reduces HTTP requests) |
| Invalidation       | Tag-based (`revalidateTag`)   | Key-based (`invalidateQueries`) |
| Cost               | Free (built into Next.js)     | Free (client library)      |

## Error Handling

### Server Side (`errorHandler.ts`)

`handleApiError()` is a centralized error mapper. It handles:

1. **`ApiError`** (custom) -- returns structured `{ error, code, details }` with the correct status.
2. **Axios errors** -- when the server proxies requests. Extracts status, message, details.
3. **Yup `ValidationError`** -- maps `inner` array to per-field errors, returns 400.
4. **Prisma `PrismaClientKnownRequestError`** -- maps error codes to HTTP statuses:
   - `P2025` (not found) -> 404
   - `P2002` (unique constraint) -> 409
   - `P2003` (foreign key) -> 404
5. **Everything else** -> 500 `Internal server error`.

### Client Side (`ApiError` class)

`ApiError.fromAxios(err)` normalizes Axios errors into a consistent shape:

```ts
class ApiError extends Error {
  status?: number;
  code?: string;
  details?: unknown;

  static fromAxios(err: AxiosError) {
    // Extracts message, status, code, details from response
  }
}
```

The `axiosClient.ts` interceptor automatically converts all Axios errors to `ApiError` instances.

## API Endpoints

| Method | Endpoint                        | Description              | Pagination | Cache |
| ------ | ------------------------------- | ------------------------ | ---------- | ----- |
| GET    | `/api/video`                    | List videos (filterable) | Yes        | Yes   |
| POST   | `/api/video`                    | Upload new video         | --         | Invalidates |
| GET    | `/api/video/:id`                | Get video by ID          | --         | Yes   |
| GET    | `/api/video/:id/similar`        | Similar videos by genre  | Yes        | Yes   |
| GET    | `/api/video/:id/comments`       | Comments for a video     | Yes        | Yes   |
| POST   | `/api/video/:id/comments`       | Add a comment            | --         | Invalidates |
| GET    | `/api/video/search`             | Autocomplete suggestions | --         | Yes   |
| GET    | `/api/genre`                    | List all genres          | --         | Yes   |
| POST   | `/api/genre`                    | Create a genre           | --         | Invalidates |

**Pagination**: all paginated endpoints accept `?page=1&pageSize=10` and return `PaginatedResponse<T>`:
```ts
{ data: T[], total: number, page: number, pageSize: number }
```

**Why no `total` count?** Intentional design -- a separate `COUNT(*)` query doubles the number of queries, each producing a result set that travels over the network. On Neon's free tier (5 GB/month transfer), minimizing unnecessary round-trips is important. The client detects the last page via `data.length < pageSize` instead. Prisma relations with `_count` handle counts where needed (e.g., `totalComments` on a video detail) without a separate query.

## Key Libraries

### React Query (TanStack Query v5)

Used for all client-side data fetching. Patterns in use:
- `useQuery` -- single resource fetching (video by ID, genres list)
- `useInfiniteQuery` -- infinite scroll (video grid)
- `useMutation` -- create operations with cache invalidation
- `useQueryClient` -- manual cache manipulation on mutation success

### Yup

Runtime validation library. Used for:
- API request body validation (server)
- Route parameter validation (server)
- Form field validation (client, via `@hookform/resolvers`)
- Type inference (`yup.InferType<typeof Schema>`)

### Prisma + Neon + pg adapter

- **Prisma ORM**: type-safe database queries, schema-driven development.
- **Neon**: serverless PostgreSQL (Frankfurt region). Scales to zero when idle — no charges when not in use.
- **`@prisma/adapter-pg`**: Prisma 7 requires an explicit driver adapter. Uses `pg.Pool` for connection pooling in serverless environments (prevents connection exhaustion from a new connection per request).
- **Singleton pattern** in `prisma.ts`: reuses the client across hot reloads in development.

### React Hook Form

Used in `UploadForm.tsx` for form state management:
- `useForm` with `yupResolver` for Yup-based validation
- `register()` attaches to Art components via `forwardRef`
- `formState.errors` passed as `helperText` to Art components

## Styling Approach

- **CSS custom properties** (`--bg`, `--surface`, `--border`, `--text`, `--text-muted`, `--primary`) define the dark theme.
- **Tailwind CSS 4** used for utility classes.
- **`@layer components`** in `globals.css` defines Art component classes (`.art-input`, `.btn`, `.navbar`, etc.).
- **`@layer utilities`** defines custom utilities (`.shimmer` skeleton animation).
- **Inline styles** used in page-level components for layout (grid, flex) that is page-specific.

## Prisma Client Setup

```ts
// lib/prisma.ts
import { PrismaClient } from '../../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

function makePrisma() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

type ExtendedPrisma = ReturnType<typeof makePrisma>;
const globalForPrisma = globalThis as unknown as { prisma: ExtendedPrisma };
export const prisma = globalForPrisma.prisma || makePrisma();
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
```

**Why singleton?** In development, Next.js hot-reloads modules. Without the global cache, each reload creates a new `PrismaClient` and `pg.Pool`, exhausting Neon's connection limit.

**Why `PrismaPg` with config instead of a `Pool` instance?** Passing a `PoolConfig` object lets `PrismaPg` create the pool internally, avoiding a `@types/pg` version conflict between the top-level `pg` package and the one bundled inside `@prisma/adapter-pg`. Behavior is identical — `PrismaPg` still maintains a connection pool.

## Query Key Strategy

Both `queryKeys.ts` (client) and `cacheKeys.ts` (server) follow a structured factory pattern:

```ts
// Client (React Query)
export const queryKeys = {
  video: {
    invalidate: {
      all:    () => ["video"],           // invalidate everything video-related
      list:   () => ["video", "list"],   // invalidate only lists
      single: () => ["video", "single"], // invalidate only singles
    },
    paged: (page, pageSize, freeText?) =>
      ["video", "list", "paged", { freeText, page, pageSize }],
    byId: (id) => ["video", "single", "byId", id],
  },
};
```

**Format**: `[resource, kind, subtype, ...args]`
- `resource` -- top-level invalidation target
- `kind` -- `"list"` or `"single"` for granular invalidation
- `subtype` -- identifies the cache shape
- `args` -- query-specific parameters

## Development Setup

```bash
# Install dependencies
npm install

# Generate Prisma client
npm run db:generate

# Sync database schema
npm run db:push

# Seed database with sample data
npm run db:seed

# Start development server
npm run dev           # -> localhost:3000

# Other commands
npm run db:studio     # Prisma Studio (visual DB editor)
npm run lint          # ESLint
npm run format        # Prettier
```

## Deployment

### Free Tier

- **Database**: Neon (serverless Postgres — 5 GB transfer/month, always-on)
- **Hosting**: Vercel Hobby (free)
- **Connection pooling**: Prisma pg adapter (`@prisma/adapter-pg` + `pg.Pool`)

### Production

- **Database**: Neon (paid tier — more compute, higher transfer limit)
- **Hosting**: Vercel Pro ($20/mo)
- **Connection pooling**: Prisma pg adapter (`@prisma/adapter-pg` + `pg.Pool`)
