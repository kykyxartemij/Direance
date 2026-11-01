---
name: create-mapping-from-connection
description: Create a Direance mapping (global by default) from a connection id. Fetches the connection's live report, translates every row name, previews it, and writes it to the DB after approval. Use when asked to create or generate a mapping from a connection.
---

# Create mapping from connection

Input: connection id. Optional: mapping name, target language (default English), global or user-owned (default global), whether to link the connection.

Run commands from the repo root. The script loads `.env` itself: never read `.env`, and never print `secret` or env values. It writes to the database in `DATABASE_URL`.

## 1. Read the report

```bash
npx tsx --conditions=react-server .claude/skills/create-mapping-from-connection/mapping-from-connection.ts read <connectionId>
```

`--conditions=react-server` is required: it lets the `server-only` imports load outside Next.

Output gives the connection, its linked mapping, the detected `sourceLayout` and every `sourceNames` entry. `sourceNames` are the real strings from the driver. Never retype them from memory or an English UI export.

If `linkedMapping.sourceNamesNotInMapping` is empty, a working mapping already exists. Say so and ask before making another.

## 2. Draft the mapping

Write `draft.json` to the scratchpad, never into the repo:

```json
{
  "name": "Merit Eesti Financial Position -> Merit.ee English",
  "currency": "EUR",
  "isGlobal": true,
  "linkConnection": false,
  "rowMappings": [
    { "sourceName": "Varad", "displayName": "Assets" },
    { "sourceName": "Kokku käibevarad", "displayName": "Total current assets", "nameColor": "primary" },
    { "sourceName": "Kokku varad", "displayName": "Total assets", "nameColor": "success" }
  ]
}
```

Rules:
- One entry per `sourceNames` value, same order, `sourceName` copied exactly.
- Name format: `<Provider> <Country> <Report> -> <Target>`.
- Translate with standard accounting terms. Reuse wording from global mappings in `prisma/seed.ts` when the same row exists there.
- Subtotal rows (`Kokku …`, or the source language's "total"): `nameColor: "primary"`.
- Grand totals and the final result row: `nameColor: "success"`.
- Other rows: no color. Set `hidden` only when the user asks.

## 3. Dry run

```bash
npx tsx --conditions=react-server .claude/skills/create-mapping-from-connection/mapping-from-connection.ts create <connectionId> <draft.json> --dry-run
```

Writes nothing. Fails on unmapped or unknown rows, a validator error, duplicate output headers, or an existing mapping with that name. Fix the draft and rerun.

## 4. Approve, then create

Show the user the name, scope, whether the connection gets linked, and the full `sourceName -> displayName` list. Create only after they approve:

```bash
npx tsx --conditions=react-server .claude/skills/create-mapping-from-connection/mapping-from-connection.ts create <connectionId> <draft.json>
```

## 5. Report

Give the new mapping id. Mapping lists can stay cached for up to 4 minutes (180s server + 60s browser), because this script runs outside the app and can't invalidate its cache.

To keep a global mapping across environments, add it to `prisma/seed.ts` with the returned id. Don't run `db:seed` for this without asking: it overwrites both existing global mappings with the seed's config.
