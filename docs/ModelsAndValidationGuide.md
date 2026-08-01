# Models & Validation Guide

Read alongside `BackendGuide.md`. Every pattern below traces through
`src/models/mapping.models.ts` — open it side by side.

## Quick reference

| Pattern | Rule |
|---------|------|
| Request contract (Create/Update) | Fields defined once, `yup.object(fields)` → Create, `.partial()` → Update. Never a second hand-duplicated validator |
| Request/response type | `yup.InferType<typeof Validator>` — never a hand-typed duplicate next to the validator |
| Filter model naming | `XFilterYupModel` — `Filter` alone doesn't read as validated, `YupModel` makes it explicit |
| Response model | `Prisma.TableGetPayload<{ select: typeof TABLE_SELECT }>` — never hand-typed |
| Select consts | Live in `models/*.models.ts`, paired with the type they derive — not in the service file |
| Json column | Typed via `prisma-json-types-generator`, not a manual override |
| Literal-union scalar column (e.g. a report type) | Make it a real Prisma `enum` — Prisma then infers the literal union natively |
| Model file layout | Three `#region`s: Prisma's Select, Json Config, Yup |
| An id/uuid field | Reuse `IdFieldValidator` (`src/models/index.ts`) — the one shared validator piece. Everything else is written inline per field, plain yup, no factory layer |
| A shared field needs `.default(x)` | Never in the object passed to both Create and Update — `.partial()` does not strip `.default()`. Add the default only on Create, via `.shape({...})` |
| A shared field is `yup.lazy(...)` (discriminated by a sibling field) | `.partial()` doesn't reach into it either — its resolved schema's own required-ness still applies. Update needs an explicit `.optional()` on the lazy itself |

---

## The three buckets every model type falls into

1. **Validated input** — a request body or query-string filter. Always `yup.InferType<typeof
   Validator>`. Lives in the "Yup" region.
2. **Read/response shape** — a value returned by a Prisma query. Always
   `Prisma.TableGetPayload<{ select: typeof TABLE_SELECT }>`. Lives in the "Prisma's Select"
   region.
3. **Computed / external, no schema behind it** — driver output, runtime-merged data, anything
   with no validator and no Prisma select to derive from (`ConnectionFetchResult`,
   `ExportSettingResolvedModel`). Stays hand-typed — there's nothing to point a generator at.

Every type in a model file should map to exactly one of these. If a type needs manual patching
after being derived, that's a signal something in the bucket above doesn't fully cover it (see
"When derivation isn't clean" below) — not a reason to give up and hand-type the whole thing.

---

## Yup: write fields once, derive Create/Update/Type

```ts
const mappingFields = {
  name: yup.string().trim().min(1, 'Name is required').required('Name is required'),
  reportType: yup.string().oneOf(REPORT_TYPES, 'Invalid report type').required('Report type is required'),
  config: MappingConfigValidator.required('This field is required'),
  exportSettingId: yup.string().nullable().optional(),
  isGlobal: yup.boolean().optional(),
};

export const CreateMappingValidator = yup.object(mappingFields).shape({
  reportType: yup.string().oneOf(REPORT_TYPES, 'Invalid report type').default('pnl'),
});
export const UpdateMappingValidator = yup.object(mappingFields).partial();

export type CreateMappingModel = yup.InferType<typeof CreateMappingValidator>;
export type UpdateMappingModel = yup.InferType<typeof UpdateMappingValidator>;
```

`.partial()` makes every top-level field optional — it does **not** deep-partial a nested
object. If `config` is sent on an update, everything required inside `MappingConfig` is still
required; you can't PATCH a single nested field without resending the whole object. This is a
real constraint of the pattern, not a bug — a shallow required/optional split is normally what
HTTP semantics (`required` for POST, `optional` for PATCH) actually mean anyway.

Fields are written out per model, inline, plain yup — no shared factory layer. A brief attempt
at one (`src/models/validators.ts`, wrapper functions like `nonEmptyString(label)`) was reverted:
it didn't stop duplication (two of its own source patterns went unconverted in the same session
it was built), and reads worse than the plain chain it replaced. The one piece worth sharing is
below.

### The one shared piece — `IdFieldValidator`

```ts
// src/models/index.ts
export const IdFieldValidator = yup.string().required('ID is required').uuid('ID must be a valid UUID');
```

Reuse this wherever a field is a UUID id/FK — required as-is, or `.nullable().optional()` for a
nullable FK (verified: chaining `.nullable().optional()` after `.required()` correctly overrides
presence while the `.uuid()` format check still applies to a value that is actually provided):

```ts
mappingId: IdFieldValidator.nullable().optional(),
```

### `.default()` does not survive `.partial()` — real bug, not theoretical

Verified directly: `yup.object({ isDefault: yup.boolean().default(false) }).partial().validate({})`
still returns `{ isDefault: false }`, not `{}`. `.partial()` only removes `.required()`, it does
nothing to `.default()`. Put a defaulted field straight into the shared `fields` object above and
every update that omits it **silently resets it to the default** instead of leaving the stored
value untouched — this was a live bug in this codebase (`reportType` defaulting to `'pnl'` on
every mapping update that didn't send it, and four boolean/array fields on `ExportSetting` doing
the same) until the field-once refactor caught it by making the behavior explicit enough to
reason about. Fix: never `.default()` a field inside the object `.partial()` is called on —
apply the default only on the Create variant, after the fact:

```ts
export const CreateXValidator = yup.object(fields).shape({
  someFlag: yup.boolean().default(false), // Create-only — Update must leave it untouched if omitted
});
export const UpdateXValidator = yup.object(fields).partial(); // someFlag has no default here
```

### Filter models — `XFilterYupModel`

```ts
export const MappingFilterValidator = yup.object({
  reportType: yup.string().oneOf(REPORT_TYPES, 'Invalid report type').optional(),
});
export type MappingFilterYupModel = yup.InferType<typeof MappingFilterValidator>;
```

`parseFiltersFromUrl<S extends yup.ObjectSchema<yup.AnyObject>>` (`src/models/index.ts`) forces
every filter to have a yup validator behind it — but unlike `Create`/`Update`, the name "Filter"
alone doesn't say that. Hence the explicit `YupModel` suffix, here and nowhere else — `Create`/
`Update` already carry the same meaning in their own name.

### Client-only fields that never reach the server contract

`TotalColumnDef` needs a React list key (`_id`) that the backend has no use for:

```ts
const totalColumnDefFields = {
  _id: yup.string().optional(), // client-side React key
  label: yup.string().required('This field is required'),
  sourceValueIndices: yup.array().of(yup.number().integer().min(0).required('This field is required')).required('This field is required'),
};
```

yup does not strip unrecognized keys during `.validate()` by default — a field like this passes
through either way. Declaring it in the validator costs nothing and means `TotalColumnDef =
yup.InferType<typeof TotalColumnDefValidator>` carries `_id` automatically everywhere the type
is used, instead of a manual `& { _id?: string }` patch that has to be re-applied at every call
site that re-infers the same nested shape.

---

## Prisma: response models derived from `select`

```ts
export const MAPPING_SELECT_LIGHT = { id: true, name: true, reportType: true } as const;
export type MappingLightModel = Prisma.FieldMappingGetPayload<{ select: typeof MAPPING_SELECT_LIGHT }>;

export const MAPPING_SELECT = {
  id: true, name: true, isGlobal: true, reportType: true, config: true,
  exportSetting: { select: { id: true, name: true, mappedValues: true, hasTotalColumn: true } },
} as const;
export type MappingModel = Prisma.FieldMappingGetPayload<{ select: typeof MAPPING_SELECT }>;
```

The select const and the type it derives are declared together — one `==== Mapping X ====`
subsection per tier, not "all the selects, then all the models" split into two disconnected
blocks. `MAPPING_SELECT_LIGHT`/`_PAGED`/`_SELECT` live in the model file, imported by the
service — not defined locally in the service file.

**Make one model per select tier the service actually returns, always.** A paged endpoint that
returns `MAPPING_SELECT_PAGED` needs its own `MappingPagedModel` — reusing the full `MappingModel`
type for a narrower payload compiles today only because nothing in the calling code happens to
touch the missing fields (`config`, in this case). That's an accident of what the code currently
reads, not a guarantee; add a column reference to a field the tier never selected and it fails
at runtime, not compile time.

### When derivation isn't clean

Two known limits, both real, neither a reason to hand-type the whole model:

- **Discriminated unions behind `yup.lazy()`** (`ConnectionConfig = MeritConfig | OdooConfig`,
  picked by a sibling `type` field) — `yup.InferType` can't resolve a `.lazy()` schema to the
  union, it can only see one branch. Hand-type the union, keep the `.lazy()` validator separate.
  A `.lazy()` field also can't go through `.partial()` the normal way — `.partial()` doesn't
  touch it at all, so whatever the resolved branch requires still applies. If that field needs
  to be genuinely optional on Update (e.g. `secret` — empty means "keep existing"), call
  `.optional()` on the lazy schema itself for that variant specifically:

  ```ts
  export const CreateXValidator = yup.object(fields).shape({
    secret: SecretValidator,             // required shape, resolved per `type`
  });
  export const UpdateXValidator = yup.object(fields).partial().shape({
    secret: SecretValidator.optional(),  // verified: this is what actually makes it optional
  });
  ```

  Verified directly (`yup.lazy(...).optional()` on a schema field, then `.validate({ type: 'a' })`
  with the lazy key omitted) — it validates clean instead of throwing the resolved branch's
  required-field error.
- **A relation object nested inside a select, itself containing a `Json` field one level down**
  (e.g. `exportSetting: { select: { mappedValues: true } }` where `mappedValues` is `Json` on
  `ExportSetting`) — `prisma-json-types-generator` (below) fixes this cleanly since it patches
  the type at the schema level, at any nesting depth.

### Literal-union scalar columns — make them real Prisma enums

A column like `reportType` that's only ever `'pnl' | 'financial_position'` needs an actual
`enum` in the schema, not a `String` with an app-level union bolted on:

```prisma
enum ReportType {
  pnl
  financial_position
}

model FieldMapping {
  reportType ReportType @default(pnl)
}
```

With a real enum, `Prisma.FieldMappingGetPayload` infers the literal union natively — no
`Omit<..., 'reportType'> & { reportType: ReportType }` patch needed anywhere it's selected.
Prisma's own generated `ReportType` type (`generated/prisma/enums.ts`) is structurally identical
to an app-level hand-written union of the same literals, so existing code that imports
`ReportType` from a model file keeps working — re-export it instead of hand-declaring it:

```ts
// src/models/mapping.models.ts
import type { ReportType } from '../../generated/prisma/enums';
export type { ReportType };
```

Converting an existing `String` column to an `enum` is a schema migration, not just a TS change
— `prisma db push` refuses it by default (`--accept-data-loss`, drop + recreate). Cast the
column instead of dropping it, via `prisma db execute --file <script>.sql`:

```sql
CREATE TYPE "ReportType" AS ENUM ('pnl', 'financial_position');
ALTER TABLE "FieldMapping"
  ALTER COLUMN "reportType" DROP DEFAULT,
  ALTER COLUMN "reportType" TYPE "ReportType" USING "reportType"::"ReportType",
  ALTER COLUMN "reportType" SET DEFAULT 'pnl';
```

Then `prisma db push` finds the DB already matches the schema — no data loss.

A literal-union scalar not worth converting (e.g. `permissions` — `Permission` is a TS-only
enum with real application logic attached, not just a label list) stays a plain Prisma
`String[]`, narrowed at the model type with the same `Omit<..., 'permissions'> &
{ permissions: Permission[] }` pattern.

---

## Json columns: `prisma-json-types-generator`

Prisma types every `Json` column as `Prisma.JsonValue` — this generator (`generator json` in
`schema.prisma`) patches specific columns to their real app type.

```prisma
generator json {
  provider     = "prisma-json-types-generator"
  namespace    = "PrismaJson"
  clientOutput = "../generated/prisma"
  allowAny     = false
}
```

Annotate the column with `/// [TypeName]`:

```prisma
model FieldMapping {
  /// [MappingConfig]
  config Json @default("{}")
}
```

Point the name at its real type in `src/lib/prisma/prisma-json.d.ts` — this file is pure
indirection, never author a shape here, only point at where it's actually defined:

```ts
export {};
declare global {
  namespace PrismaJson {
    type MappingConfig = import('@/models/mapping.models').MappingConfig;
  }
}
```

`prisma/` holds what the Prisma CLI reads (`.prisma` files, `functions.sql`, `fts.sql`); `src/`
holds what TypeScript reads. This pointer file is 100% TypeScript-consumer-facing — `prisma
generate` never opens it, only the generated client's emitted type references
`PrismaJson.MappingConfig` by name, and TypeScript resolves that via the global `declare global`
augmentation. Hence it lives in `src/lib/prisma/`, next to the Prisma client singleton, not in
`prisma/`.

After adding or changing an annotation: `npx prisma generate` (regenerates both the client and
the json-types output in one run — the `generator json` block hooks into the same command).

Resolution is a plain name lookup inside the `PrismaJson` namespace, never a codebase-wide
search — a type named `MappingConfig` somewhere unrelated in the app can never collide with the
one this namespace points at.

---

## Model file layout: three `#region`s

```
#region Prisma's Select
  ==== <Entity> Light ====     select const + derived Light model
  ==== <Entity> Paged ====     select const + derived Paged model
  ==== <Entity> Full ====      select const + derived full model
#endregion
#region Json Config
  the shape(s) any Json column on this entity actually holds — still validated via yup,
  but the destination is a Json column, not a request body
#endregion
#region Yup
  ==== <Entity> Filter ====    XFilterYupModel
  ==== <Entity> Create / Update ====
#endregion
```

**Physical order can differ from the region list above when a JS declaration-order constraint
requires it.** A `const` referenced inside another `const` (e.g. `mappingFields.config:
MappingConfigValidator.required(...)`) must already exist above that point in the file —
temporal dead zone, not a style choice. In `mapping.models.ts`, `Json Config` sits physically
before `Yup` for exactly this reason, even though it's conceptually the third region. The
`#region` label names the fold, not a mandated file position.

---

## Naming reference

| Name | Derived from | Meaning |
|------|--------------|---------|
| `XModel` | `Prisma.TableGetPayload<{ select: typeof X_SELECT }>` | Full detail-view response |
| `XLightModel` | `Prisma.TableGetPayload<{ select: typeof X_SELECT_LIGHT }>` | Dropdown/lightweight-list response |
| `XPagedModel` | `Prisma.TableGetPayload<{ select: typeof X_SELECT_PAGED }>` | Paged list-row response |
| `CreateXModel` / `UpdateXModel` | `yup.InferType<typeof CreateXValidator/UpdateXValidator>` | Request body |
| `XFilterYupModel` | `yup.InferType<typeof XFilterValidator>` | Query-string filter |

---

## Where this leaves the codebase

Every `*.models.ts` file (`mapping`, `connection`, `export-settings`, `user`, `invite`, `logo`)
now has almost no hand-typed shapes left — a type is either `yup.InferType<...>` (validated
input), `Prisma.TableGetPayload<...>` (validated-by-schema read), or a re-export of a generated
Prisma enum. What remains hand-typed is a short, named list, each with a stated reason it can't
be derived: discriminated unions behind `yup.lazy()` (`ConnectionConfig`/`ConnectionSecret`),
computed/external shapes with no schema at all (`ConnectionFetchResult`, `ExportSettingResolvedModel`,
`LogoBytesModel` — the last one specifically because it's assembled from HTTP headers, not a DB
row, so it can diverge from the DB column's nullability), and the handful of scalar columns not
worth converting to a Prisma enum (`Invite.permissions`/`User.permissions`). `admin.models.ts`
and `report.models.ts` are untouched on purpose — pure external-API/transient shapes, nothing in
either bucket to point a generator at. Fields themselves stay plain inline yup, per-model — the
one shared piece is `IdFieldValidator`.
