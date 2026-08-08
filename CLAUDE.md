# Direance — Project Conventions for Claude

## ==== Project Philosophy ====

This project is about **architecture and rules**, not shipping fast. Every decision should account for:

- **React re-renders** — uncontrolled inputs, memoization in Art lib only, no inline objects as props
- **Network transfer** — minimal select projections, bytes on dedicated endpoints, no over-fetching
- **Storage space** — compress images before store, per-user DB limits, lazy cleanup instead of accumulation
- **Reusability & extendability** — design everything as if it will grow infinitely. It won't, but the assumption forces shared helpers/extensions over one-offs, generic over special-cased, and a new model/route to drop into existing patterns with no rewrite

**No dev/prod separation.** There is one environment — treat every change as production. No "fix it later", no hardcoded test data, no skipped validation.

**Exception: `src/app/ui/**`.** This is the Art component showcase/dev page, not shipped product surface. It's ok for it to be lint-dirty or break convention (metadata, console.log, em dashes, etc.). Don't "fix" warnings here unless asked.

This is an ecosystem project, not a single website. Rules and reusability apply on both BE and FE. A quick solution that doesn't fit the pattern is wrong even if it works.

---

## ==== Known Lint False Positives ====

- **`react-doctor/nextjs-no-use-search-params-without-suspense`** — false positive project-wide. Every page that calls `useSearchParams()` renders under `<ArtPage>`, which provides the Suspense boundary (see `docs/InstantNavigationAndLoadingState.md`). Leave the warning visible, do not suppress or refactor around it.
- **`react-doctor/async-parallel`** / **`react-doctor/server-sequential-independent-await`** — false positive on BE handler files. Sequential awaits there are a gate chain (validate → rate limit → DB limit → write); `Promise.all` would bypass gates. Already config-disabled for BE files in `eslint.config.mjs` — this is the one sanctioned config-level suppression, not a silent inline disable.
- **`react-doctor/exhaustive-deps`** — NOT a blanket false positive, mostly accurate. The rule's own docs name one narrow exception: a captured value intentionally excluded (mount-only effect, or a function known to be referentially stable) that the static check can't prove safe. Only in that exact case is a justified `// eslint-disable-next-line` + `// NOTE:` acceptable, matching the Comment Style policy below. Anywhere else, a missing-dep warning is a real bug — fix it, don't suppress it.

---

## ==== Architecture Docs ====

CLAUDE.md covers how Claude should work in this repo. Everything about *how the system is
built* — for Claude and every other developer — lives in `docs/`. Read the relevant guide
before working in that area:

| Area | Guide |
|------|-------|
| Backend services, `withHandler`, Prisma queries, caching, auth | `docs/BackendGuide.md` |
| Raw SQL, DB-level defaults, full-text search (`withFts`) | `docs/PrismaGuide.md` |
| Models & validators — yup field-once pattern, Prisma-derived response models, Json column typing | `docs/ModelsAndValidationGuide.md` |
| Images, binary storage, `BytesResponse` | `docs/ImagesGuide.md` |
| Forms, uncontrolled inputs, RHF | `docs/UncontrolledInputsGuide.md` |
| TanStack Query mutations, optimistic updates | `docs/TanStackMutationGuide.md` |
| Navigation, links, loading states, `ArtPage`, URL filters | `docs/InstantNavigationAndLoadingState.md` |
| Tailwind CSS reference (lookup cheat-sheet) | `docs/LayoutGuide.md` |
| UI consistency, theme, CSS architecture, interactive states, page metadata & layout convention | `docs/UIConsistencyGuide.md` |

**Before writing code in an area covered above, read that guide first — don't rely on
memory of it from earlier in the conversation or a prior session.** Docs get edited; a
remembered version can be stale. Match the guide's stated pattern, not just something that
looks similar to it.

**When a task doesn't fit any guide, or the right approach conflicts with what's written:**
stop and say so before writing code. Two cases:
- **Uncovered** — no guide addresses this. Propose an approach, flag that it's new ground, and
  say which doc should gain a section once the developer confirms the pattern.
- **Conflicting** — the correct fix here would break a stated rule. Don't silently follow the
  rule into a worse outcome, and don't silently override it either. Explain the conflict, let
  the developer decide, then update the doc to match whatever was decided — a rule that's been
  knowingly overridden once and left undocumented will just get violated silently next time.

A rule or pattern is only real once it's written down. Anything decided in conversation that
should hold going forward belongs in the relevant `docs/*.md` (or this file, if it's about how
Claude should behave, not how the system is built) — not left to be remembered from chat
history.

---

## ==== Backend Handler Rule ====

Every API handler is wrapped in `withHandler` (or `withPublicHandler` for public routes) —
never a hand-written `try/catch`. See `docs/BackendGuide.md` for the full pipeline. The one
thing to know before opening that doc: sequential awaits inside a handler body are
intentional — they're a gate chain (validate → rate limit → DB limit → write), never
parallelize them with `Promise.all`.

---

## ==== Comment Style ====

Section headers: `// ==== Title ====` exactly, no other decoration (`─`, `*`, `-`). Bare —
no trailing explanation unless it's one line of genuine "why."

**Every comment says why, never what.** The code already says what it is. Skip anything that
restates a type, a name, or an obvious prop (`isLoading`, `disabled`, a self-describing name
like `onlyFetchActiveByMappingBasedOnExportSetting`). Only comment when the name can't carry
the reason — a non-obvious default, a unit, a cross-file contract, a driver-specific quirk
(see the Odoo/Merit fields in `connection.models.ts`).

**Max 1–2 lines.** If the why needs a paragraph, fix the code instead (better name, smaller
function) — don't write more prose. Never stack 4+ line blocks: no API-spec trivia, no
restating a pattern already established elsewhere in the file, no justifying a choice nobody
questioned.

**`/** */` vs `//`:** audience split, not style pick. `/** */` on everything exported —
callers don't open the source, so even a small exported helper gets one. `//` for everything
internal — logic, locals, section headers. Either form stays short: a line or two, why over
what, never an essay.

**Naming beats commenting.** If a better name fits the why, rename — don't comment. Comment
is fallback for stuff no name can carry (external quirk, magic number, cross-file contract) —
or, on exports, for the one-line summary callers shouldn't have to open the file to get.

**What goes in a comment, roughly:**
- Ask *why is this here* — if a rename would answer that just as well, rename instead.
- Keep it to one line. Drop articles/filler, say it caveman-short.
- If the name doesn't already say what the thing is, a short label ("Errors:", "Helper:",
  "Merit quirk:") before the why is fine — better a labeled one-liner than a vague one.

```ts
// bad — restates name, no why
// gets user id by auth token
function getUserIdByAuthToken(token: string) { ... }

// bad — name could just say this, comment is a crutch
// verifies token from merit
function verifyMeritToken(token: string) { ... }

// good — no name fixes this, external system quirk
// Merit hashes token before send; hashing again here breaks auth silently.
function verifyMeritToken(token: string) { ... }

/** Central error → HTTP response mapper. Callers outside this file don't read impl. */
export function handleApiError(err: unknown) { ... }

/** Helper: dedupes ids while preserving first-seen order. */
export function uniqueInOrder(ids: string[]) { ... }
```

**`// NOTE:`** flags something surprising the code can't show itself — e.g. `ArtListbox`
using `role="option"` on `<li>` instead of a native `<option>` (custom widget, no native
equivalent), or a genuine catch-22 with no clean fix. Write it once, on first occurrence —
not repeated on every sibling that follows the same pattern.

**Never use `// NOTE:` to excuse a fixable lint warning.** Fix exists → fix it. No fix and a
genuine false positive → leave the warning visible and flag it, don't hide it behind a NOTE.
Same for an existing `// eslint-disable`: if you know the fix, propose it instead of leaving
the suppression.

---

## ==== Working With Claude ====

- **Use caveman mode** (`/caveman`). Be short. Don't over-complicate a task. When real
  complexity appears, validate the approach with the developer before building.
  - **Drop:** articles (a/an/the), filler (just/really/basically/actually/simply),
    pleasantries (sure/certainly/happy to), hedging.
  - **Keep:** technical terms exact, error text quoted exact, code blocks unchanged.
  - **Style:** fragments OK, short synonyms (big > extensive, fix > implement a solution for).
    Pattern: `[thing] [action] [reason]. [next step].`
  - **Default to short and explanatory, not maximally compressed.** Lead with the real
    substance in as few words as it actually takes — not `ultra`-terse by default, that
    trades clarity for token count. Add detail after the short answer only if it's actually
    needed, never pad the first line to sound thorough.
  - **Drop caveman (write normal) for:** code / commits / PRs, security warnings,
    irreversible-action confirmations, and any multi-step sequence where clipped wording
    risks a misread. Resume after.
- **Never disable eslint rules.** A blocked rule should be **fixed** — even if the fix means
  a small refactor or separating concerns into a new component. Only when there is genuinely
  no fix (a true false positive, or no native/clean alternative) do you validate with the
  developer and, if agreed, leave it visible with a `// NOTE:`. Config-level scoping is a
  developer decision, never a silent inline `// eslint-disable`.
- **Never delete hooks or helpers because a linter flags them as "unused".** This project follows one-API-one-hook: every API route has a matching hook, and infrastructure helpers (`withPublicHandler`, `getAuthOptional`, etc.) exist before their callers do. "No current imports" is not a reason to delete. Only delete when you can confirm there is no corresponding API route AND no planned use — and even then, ask first.
- **Answer format:** start with a short answer that explains your thinking, using real
  code for the explanation. After the short summary, describe whatever else needs detail.
- **Docs describe the system as it should be built right now, not a timeline.** Never write
  "in future", "in a real implementation", "currently we don't do this", "eventually", or
  similar hedging in any doc or `CLAUDE.md`. If something isn't implemented, either implement
  it or leave it out of the doc — don't narrate a future or hypothetical state as if it were
  a caveat on the present one.
- **Docs never reference `CLAUDE.md`.** `CLAUDE.md` is Claude-facing only; `docs/*.md` are for
  every developer, Claude included. A doc that needs to point at a rule points at the doc that
  owns it, never back at this file.
- **Narrate mid-task, not just at the end.** During longer work, check in periodically with a
  short status, not raw tool output: what's been done, any moment that looked risky or
  surprising, what you concluded from it, what's next. Not a transcript of every command run —
  the developer's mental model of progress, in a few sentences. Skip this for single-step tasks;
  it's for multi-step work where silently moving from step to step hides the reasoning.

---

## ==== How to Validate Your Code ====

After **every** change:
- **Types:** `npx tsc --noEmit` — no new errors (ignore pre-existing unrelated ones).
- **Lint:** `npx eslint <changed files>` — real-time, per-file. Runs the React Doctor *lint
  rules*, so a clean eslint pass covers those for normal edits.
- **Security:** run the `vibe-security` skill on any backend or Vercel/deployment work —
  always, regardless of which files changed — and on anything touching auth, payments, DB
  access, API keys, secrets, or user data.

Only after a **big change** (new feature, cross-file refactor, multiple files):
- **React Doctor (full codebase):** `npx react-doctor` or `npx react-doctor@latest --verbose`. This is **not** the same as eslint —
  the CLI analyses the whole codebase: lint + dead code (unused files/exports/deps, circular
  imports) + a health score. eslint is the per-file helper; this is the full diagnosis.
- **Build:** `npm run build` — also a full-codebase analysis (types + bundle).

Both are expensive — don't run them on every small edit. For local changes, per-file eslint +
tsc is enough.
