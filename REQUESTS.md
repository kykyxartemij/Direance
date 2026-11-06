# Request log

Every request and bug report from the developer, newest first. `[x]` = done (commit hash),
`[ ]` = open (detail lives in `TODO.md`). Entries before 2026-11-06 were reconstructed from
session notes, so they are grouped, not dated one by one.

## 2026-11-06

- [x] Report table: period headers right-aligned over their numbers (`ArtColumn.align`). `b61f412`
- [x] Invite resend cooldown: first send = invite email; again within 3 days = 429, nothing sent; after 3 days = "extended" email, same token, expiry restarts (14 days). `b61f412`
- [x] Periods input fetching per keystroke: confirmed fixed by the date-picker work.
- [x] Check saved mappings for With/Only Total: not needed, old field is ignored and drops on next edit.
- [x] Test-connection rate limit: `withHandler` limits are enough, skipped.
- [x] Export: "Total …" rows got `=SUM(...)` guessed from row names (wrong for nested totals). Values now plain, formula only in Σ Total column. `b61f412`
- [x] ArtDataTable: empty extra column on the right when some columns have no width (report with 2+ periods). `b61f412`
- [x] Header: four groups evenly spread (home+reports, mapping/export/connections, invite/admin, profile). `b61f412`
- [x] Header: Invite + Admin in their own group, separated like the other nav groups. `b61f412`
- [ ] Improve invalidate-by-connection-ids for global mappings (list of ids may cause issues). Low priority, in `TODO.md` → Security and state.
- [x] Mapping: remove "Regular / With Total / Only Total" per sheet, rely on Export Setting and the report toggle. `b61f412`
- [x] Export: Σ Total not calculated in the file. Total is now computed by the writer with a cached result, so it works for any table position and for combined reports. `b61f412`
- [x] P&L and Financial Position: drop the collapsible filter panel, show fields directly. `b61f412`
- [x] Report page: a Σ Total switch instead of choosing an Export Setting. `b61f412`
- [x] Export dialog: show all three options (Σ Total, include original sheets, apply header to all sheets). `b61f412`
- [x] Include original sheets: leave out skipped sheets, plus inactive and unmapped reports. `b61f412`
- [x] Report pages: hide the Excel view for now (commented out); TODO to bring it back. `b61f412`
- [x] Keep a log of every request as todo/done. → this file + rule in `CLAUDE.md`. `b61f412`
- [x] TODO: remove the Upload page, drop files anywhere, snackbar on invalid type. `532dc56`
- [x] Dialog can't be closed (infinite loop in `handleClose`). `532dc56`
- [x] Tooltip shown under dialogs, and stays visible after click or navigation. `532dc56`
- [x] Pagination input: broken arrows/Escape logic, unused branches. `532dc56`
- [x] RHF validation doesn't scroll to the invalid field (Select, DatePicker). `532dc56`
- [x] Logo turned purple. `532dc56`
- [x] Connections table: Delete button cut off. `532dc56`
- [ ] A connection is missing from the list until reload. Created in UI a week ago; seen after opening Edit, renaming without saving, navigating back and forth. Not reproduced, reload fixes it. In `TODO.md`.
- [x] Merit error `PA-645 10/1/2026 1562` explained (document PA-645, account 1562). Friendlier error text not done.

## Before 2026-11-06

- [x] Vercel env: missing `CRON_SECRET`, how to bulk upload and override vars.
- [x] Mapping not applied to connection report; double Description column. `fddfeb4`
- [x] Skill: create a global mapping from a connection id (`create-mapping-from-connection`).
- [x] Export dialog combobox not clickable inside the dialog; show "No options". `fddfeb4`
- [x] Cache TTL 60s FE / 180s BE; invalidate by connection id, not everything. `fddfeb4`
- [x] Value color, With Total / Only Total checked. `fddfeb4`
- [x] Invite form: browser saves email + password. `fddfeb4`
- [x] Row mapping: hidden row disables the whole row. `fddfeb4`
- [x] Page descriptions in plain English for financial directors. `fddfeb4`
- [x] Date filter fetches only on a chosen date; custom date picker. `fddfeb4`
- [x] Periods explained; mapping no longer cuts the second period. `fddfeb4`
- [x] Period column labels from real dates. `fddfeb4`
- [x] Secret fields don't trigger password-manager suggestions. `fddfeb4`
- [x] Roadmap in `TODO.md`; old BACKLOG / TODO-* / COLLECTION_OF_MEMORY files merged and removed.
- [x] Error boundary demo on `/ui`.
- [x] Rows per page does nothing. `1608fea`
- [x] Remove unused Art props and dead branches. `b9beacf`
- [x] Tailwind: none inside the Art library, pages keep it for layout; `art-text-*` color classes; ArtText/ArtStack primitives removed. `532dc56`
- [x] Helper/error text icons through one sub-component. `532dc56`
- [x] ComboBox: no browser autocomplete suggestions. `532dc56`
- [x] Art component rules and folder structure written as current thoughts in `TODO.md`.
- [ ] Auth security, `useState` overuse, lodash/uuid/crypto: opinions given, items in `TODO.md`.
- [ ] Odoo connection end to end (in `TODO.md`).
