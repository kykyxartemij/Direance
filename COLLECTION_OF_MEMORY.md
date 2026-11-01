# ConnectionFormPage secret/mapping rework

Fixed: Mapping select couldn't be cleared (bug was in shared ArtComboBox, affects any non-searchable select). Added "use previous settings" toggle so editing a connection doesn't force re-entering secrets. Fixed reportType change not resetting mappingId (stale mapping could get saved silently). Removed "(optional)" label clutter.

Not changed: backend (connection.service.ts / connection.models.ts). Checked it multiple times against user's rule and it already does the right thing (verified with an actual test run, not just reading code) — but this went back and forth a lot and user was frustrated, so worth a second human look before trusting it fully.

Needs check before publish: no full build / react-doctor run done this session, only per-file tsc+eslint. Unrelated files also show modified in git status (ArtCut, DataRow, ArtPagination, art.style.css, seed.ts, .gitignore) and FormSection.tsx shows deleted — none touched in this chat, confirm intentional.

# Merit Eesti mappings + ArtCut/ArtTooltip truncation fix

Fixed: Mappings table Name column wrapped to multiple lines instead of ellipsis-truncating (DataRow.tsx passed `text={!col.render && ...}` — disabled ellipsis for any column with a custom render, which is most of them). Root cause was also in ArtCut itself: ellipsis was applied to a flex container, which doesn't work (flex items ignore text-overflow) — moved ellipsis onto an inner block-level span.

Added: hover-to-see-full-text on truncated cells, reusing the existing ArtTooltip singleton (no new tooltip system) — truncation is detected lazily via DOM scrollWidth/clientWidth check on first mouseenter, no React state/effect per cell (perf concern raised by user, addressed). Tooltip singleton also had a real bug: 1000ms fade was way too slow, and moving hover between adjacent triggers with no gap never replayed the fade-in (shared DOM node stayed at opacity:1). Fixed via forced reflow with transition:none toggle, plus made the tooltip itself hoverable (pointer-events:auto + a small hit-area bridge) so users can select/copy the tooltip text without it closing.

Added: real Merit Eesti global FieldMapping seeds (P&L + Financial Position) in prisma/seed.ts, built from actual live API responses (not translated from the English xlsx export) — sourceName values are the exact Estonian strings Merit's getprofitrep/getbalancerep return. Verified 13/13 and 33/33 rows match live data with a script, not just eyeballing. Seeded successfully against the dev DB.

Not done: Merit Poland and Odoo global mappings — same flow needed (live fetch → build seed), not started this session. Old orphaned "Merit.ee — P&L" / "Merit.ee — Financial Position" rows still in the DB from before the seed IDs were randomized — never cleaned up, still sitting in the Mappings table.

CLAUDE.md updated twice this session for real violations I made: added a comment-style example after writing a 4-line comment above the character limit, then had to correct it again after also violating "bug fixes get zero comments" (I wrote a 1-line NOTE justifying the fix mechanism, which the rule already prohibited — I'd misread it as only covering "explaining the old bug"). Rule text tightened to close that reading gap. Worth checking CLAUDE.md's current wording holds up in a fresh session — this was fixed via user correction twice in one chat, not caught by self-review.

# ConnectionFormPage comments cleanup + FormSection → ArtDivider

Fixed: removed several comments that violated Comment Style rules (field-behavior comments duplicated at the field and at the code using it, a bug-fix comment narrating the old mistake, per-file "stable reference" comments repeating the same jsx-no-jsx-as-prop explanation 5x across list pages). CLAUDE.md updated with concrete bad/good examples for each so it doesn't recur.

Refactored: reportType→mappingId reset was a useEffect+useRef with an eslint-disable. react-doctor rejected both the effect and a render-time state/ref write as unsound. Replaced with an event-driven fix — bypassed ArtFormSelect for reportType, wired Controller+ArtSelect directly so onChange resets mappingId in the same handler. No effect, no ref, no suppression. Documented as "Pattern D" in docs/UncontrolledInputsGuide.md.

Removed: `FormSection` component entirely, replaced all 10 usages across 4 files with `ArtDivider label=...` (already existed, did the same job). Fixed 2 "(optional)" labels — required is already a prop, redundant text.

Needs check before publish: same as previous entry above — no full build/react-doctor run this session, only per-file tsc+eslint on touched files. The Controller-based reportType field is new pattern (first use in codebase) — worth a second look that it matches ArtFormSelect's validation/error display behavior exactly.

# CLAUDE.md/docs restructure + earlier UX/backend fixes

Fixed (earlier in session): reports pages had no loading skeleton (flashed "Nothing here yet" during fetch) — added `loading` prop to ReportView. Replaced `—` empty-value fallback with `''` across Connections/Export Settings/Profile/Users tables. Removed browser autocomplete leakage on Connection API credential fields. Commented out unused InviteLimitsSection (Resend-specific, app uses SMTP now). Fixed Navbar showing email — now shows name, but the underlying `session.user.name` was never populated after initial sign-in (JWT strategy never re-reads DB); fixed in `auth.ts` jwt callback. Fixed permissions `+N` badge having no pointer cursor/hover state. Fixed "blinky" filter-count badge (was conditionally mounted, now always shown, neutral gray at 0). Added advanced filters (type/reportType, hasTotalColumn) to Connections + Export Settings list pages, full stack (validator→route→service→cache/query key→hook→FE). Fixed `computeUserDbConsumption` — only summed a few hand-picked columns, missed Connection/User/Invite/Account/Session entirely; switched to `pg_column_size(t.*)` per table so future columns can't silently escape the quota. Simplified `withFts` — `userId` was threaded through every call site just for cache-key tagging; now read internally via `getAuthOptional()`.

Found via user pushback, not self-caught: Export Settings `hasTotalColumn` filter compared against `undefined` but `useUrlFilters` returns `null` for absent params — "no filter" was silently sending `hasTotalColumn=false` to the API. Caught by user reading the actual network request, not by review.

Restructured (this message): CLAUDE.md had grown to include implementation-level architecture rules (navigation, interactive states, page metadata, validation architecture, raw SQL defaults) — moved all of it into `docs/*.md` since docs are for every developer, not just Claude. Added a new rule: docs never reference back to CLAUDE.md. Added a rule for uncovered-or-conflicting cases (stop, explain, update docs — don't silently decide). Softened Comment Style (`/** */` now on every export, not just "complex" ones; added a short-label allowance like "Helper:"/"Errors:" when a name alone isn't explanatory). Dropped caveman intensity-level line from Working With Claude (that's the skill's own user-switchable mechanic, not something CLAUDE.md should restate) in favor of a "default short + explanatory, not `ultra`-terse" nudge.

Needs check before publish: no full build/react-doctor run this session, only per-file tsc+eslint on touched files. Theme docs were rewritten as dark-only per user instruction, but the actual `theme-light`/`theme-contrast` CSS and switching code in `art.style.css`/`globals.css`/`src/app/ui/page.tsx` was explicitly NOT touched (deferred) — docs and code are now inconsistent until that cleanup happens. `auth.ts` jwt callback change (forwarding `name` into the token) means every currently-logged-in user's session still has the stale/missing name until they re-login — not a bug, but worth knowing before calling it "fixed" for existing sessions.

# User notes:

Make that ui page accessible only for Admin

create and apply 404 page 

Finish the odoo and other Merit mappings

Test exportability (if not solving, probably soft remove it in FE code, needs to have working product)

Deploy on Vercel

