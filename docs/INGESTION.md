# Administration and ingestion

`/admin` is a public locked shell. Privileged data loads only after `/api/admin` verifies the bearer token with Supabase `auth.getUser`, reads the caller's profile role, and requires `admin`. The database client uses the same caller token, so database RLS independently enforces authorization. There is no service-role key or browser role override. Responses are `private, no-store`. Authentication changes clear the dashboard immediately; a session-generation guard prevents older requests from restoring the previous account's records. `/admin/artworks`, `/admin/artists`, `/admin/listings`, `/admin/sources` and `/admin/recommendations` show focused views behind the same authorization. Artist records are read-only.

The dashboard reads the latest 100 catalog/listing/rights-queue records, 30 synchronization runs, 50 audit entries and a bounded sample of 1,000 analytics events. It can archive database artworks, mark a listing sold/inactive, and rerun the internal synthetic catalog adapter. No mutation accepts arbitrary table names, URLs, SQL, role changes, or uploads. Failed writes do not return a success state.

The current public catalog is bundled in source control. Database archival and listing changes do not rewrite those bundled public fixtures. A production live catalog needs the public retrieval layer moved to the database before admin publication changes can drive it. This limitation is visible in the dashboard.

## Source contract

`lib/ingestion/adapters.ts` defines fetch, normalize, validate and rights-mapping methods. `synchronize` owns per-record upsert and failure reporting. The enabled `arte-demo-v1` adapter selects only `isDemo` records, even when the bundled catalog also contains real public-domain art. It makes no external requests. New museum or licensed gallery adapters must retain their actual source and rights rather than passing through the demo adapter.

Each sync first creates a `source_sync_runs` running row. The importer rejects invalid identifiers, missing source identity, unsafe source URLs and non-displayable rights, and continues through per-record errors. The authenticated `admin_upsert_demo_artwork` database RPC atomically stores the artist, artwork and source record. Repeating the import updates the same IDs and preserves a manually archived artwork. A demo record cannot overwrite a real artwork. The sync's final state and rejection reasons are stored; a failed final write returns an error and leaves an observable running row for inspection.

No external source credentials, commercial feed agreements or live embeddings are configured. Artist submission, rights approval, add/edit artwork forms and complete product-health reporting remain future administration work. Unclear/restricted records are read-only in the queue; a label in the UI cannot grant publication rights.

## Database release protections

Migration `20260927220000_release_security.sql` adds:

- Guest activity stays on the device: anonymous direct inserts into hosted events, impressions and feed sessions are disabled. Authenticated event payloads are bounded. Hosted events still require production rate monitoring; the demo never presents them as a manipulation-resistant global trend score.
- Publication requires source, image source, attribution and license; demo publication requires a synthetic record.
- Active real listings require verification and expiration. Public reads require verification within 30 days, no future verification date and unexpired status.
- User inquiries require a fresh active non-demo listing. The database limits authenticated submissions to ten per hour and prevents callers from backdating submissions.
- Catalog, artist, gallery, listing, source and synchronization writes create transactional audit records. If auditing fails, the write fails. Application admins can read but cannot insert, update or delete audit rows.
- `reset_my_personalization(expected_user_id uuid)` requires the authenticated caller to match the originally selected account atomically, and deletes only that caller's analytics, impressions, recommendation profile/events and feed sessions. Likes, saves, follows, collections, inquiries and audit records remain intact.

An account must be promoted to `admin` through the trusted Supabase SQL console by the project owner. There is intentionally no self-service promotion endpoint. Hosted verification still requires Supabase configuration and application of all migrations; local unit/API tests alone do not prove hosted RLS.
