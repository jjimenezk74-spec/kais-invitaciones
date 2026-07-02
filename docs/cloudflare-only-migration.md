# Cloudflare-only migration plan

Goal: move KAIS Invitaciones to Cloudflare for runtime, database, storage and auth-adjacent session handling.

## Current status

- Runtime/deploy: prepared for Cloudflare Workers via OpenNext.
- Database: still Supabase Postgres.
- Auth: still Supabase Auth for dashboard users.
- Storage: still Supabase Storage for photos, audio and live album uploads.

## Target Cloudflare stack

- App runtime: Cloudflare Workers + OpenNext.
- Database: Cloudflare D1.
- File storage: Cloudflare R2.
- Session layer: signed HTTP-only cookies handled in Workers/Next server actions.
- Public asset delivery: R2 public/custom-domain URLs or signed download routes.

## Migration phases

### Phase 1: Cloudflare runtime

Done in this worktree:

- `wrangler.jsonc`
- `open-next.config.ts`
- `npm run cf:build`
- `npm run cf:deploy`
- Node 22 declared through `.node-version`, `.nvmrc` and `engines.node`.

### Phase 2: D1 schema foundation

Added:

- `cloudflare/d1/migrations/0001_initial_schema.sql`

This schema mirrors the current operational tables needed by KAIS:

- users/profiles
- clients/plans
- events
- RSVP and guest lists
- event photos
- event logins
- live album
- Canvas V3 templates

It is not connected to application code yet.

### Phase 3: R2 storage foundation

Added:

- `cloudflare/r2/README.md`

Target buckets:

- `kais-event-photos`
- `kais-event-audio`
- `kais-live-photos`

### Phase 4: Data access adapter

Next implementation step:

1. Create a small DB adapter layer in `lib/cloudflare`.
2. Add D1 query helpers for public event read paths first:
   - `/evento/[slug]`
   - `/e/[slug]`
   - RSVP insert
3. Keep Supabase as fallback until parity is confirmed.

### Phase 5: Auth replacement

Supabase Auth cannot be migrated by only changing SQL. The safe replacement is:

1. Keep internal dashboard users in `profiles`.
2. Store password hashes in D1 for dashboard users.
3. Use signed HTTP-only cookies for dashboard sessions.
4. Keep event-client login flow aligned with the existing `event_logins` approach.

### Phase 6: Storage replacement

Replace Supabase Storage calls with R2:

- event covers
- event audio
- guest photos
- live photos
- Canvas visual assets

Important: uploads should go through server actions or signed upload endpoints so the browser never receives privileged R2 credentials.

## Important compatibility notes

- D1 uses SQLite, not Postgres.
- There is no Supabase RLS in D1. Authorization must move into server code.
- JSON fields are stored as text with `json_valid` checks where useful.
- Booleans are stored as integers `0`/`1`.
- IDs are text. D1 defaults use `lower(hex(randomblob(16)))` unless the app provides ids.
- Storage public URLs must be regenerated or mapped when moving files from Supabase Storage to R2.

## Commands

Create the database:

```powershell
npx.cmd wrangler d1 create kais-invitaciones-db
```

After Cloudflare returns the database id, add a D1 binding to `wrangler.jsonc`:

```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "kais-invitaciones-db",
    "database_id": "REPLACE_WITH_CLOUDFLARE_DATABASE_ID",
    "migrations_dir": "cloudflare/d1/migrations"
  }
]
```

Apply migrations:

```powershell
npx.cmd wrangler d1 migrations apply kais-invitaciones-db --local
npx.cmd wrangler d1 migrations apply kais-invitaciones-db --remote
```

Create R2 buckets:

```powershell
npx.cmd wrangler r2 bucket create kais-event-photos
npx.cmd wrangler r2 bucket create kais-event-audio
npx.cmd wrangler r2 bucket create kais-live-photos
```

## Current blocker

Wrangler 4 requires Node 22 or newer. The current local shell reported Node 20.19.0, so Cloudflare deploy and D1/R2 commands must run after upgrading Node.
