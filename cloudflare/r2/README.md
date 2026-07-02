# R2 buckets for KAIS Invitaciones

This folder documents the Cloudflare R2 target for replacing Supabase Storage.
No application code is connected to R2 yet.

## Buckets

- `kais-event-photos`
  - Supabase equivalent: `event-photos`
  - Uses: event covers, guest photos, Canvas assets and visual decorations.
- `kais-event-audio`
  - Supabase equivalent: `event-audio`
  - Uses: invitation music files.
- `kais-live-photos`
  - Supabase equivalent: `live-photos`
  - Uses: live album guest uploads.

## Suggested object keys

```text
events/{eventId}/covers/{variant}/{fileName}
events/{eventId}/photos/{fileName}
events/{eventId}/canvas/{fileName}
events/{eventId}/audio/{fileName}
events/{eventId}/live/{fileName}
```

## Wrangler binding target

Add these bindings only after the buckets exist in Cloudflare:

```jsonc
"r2_buckets": [
  { "binding": "EVENT_PHOTOS", "bucket_name": "kais-event-photos" },
  { "binding": "EVENT_AUDIO", "bucket_name": "kais-event-audio" },
  { "binding": "LIVE_PHOTOS", "bucket_name": "kais-live-photos" }
]
```

Do not add them to `wrangler.jsonc` before creating the buckets, otherwise deploy can fail.
