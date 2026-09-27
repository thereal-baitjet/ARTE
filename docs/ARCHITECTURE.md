# Architecture

## Application

Next.js App Router and React separate route rendering from interactive client components. The bundled catalog provides reproducible browsing and recommendations without a remote database. Artwork metadata, rights, and source URLs travel together. Images preserve their aspect ratio and synthetic studies are visibly distinguished from museum records.

The recommendation API accepts a bounded typed event history, builds a deterministic taste profile, ranks the catalog, and applies diversity constraints. Feed pagination uses an interaction snapshot so live hide actions cannot invalidate its cursor. Likes and saves are optimistic with persistence errors surfaced rather than silently reported as success.

Search is deterministic lexical/metadata retrieval with conservative typo matching, not an image-understanding model. Art DNA is an estimate of recorded positive preferences rather than a psychological diagnosis or permanent identity. Marketplace prices and inventory are demo values; inquiry drafts stay local.

## Data and trust boundaries

Supabase PostgreSQL migrations enable pgvector and define profiles, artworks, artists, sources, rights, events, private collections, listings, inquiries, and audit records. Row-level security is the final ownership boundary. The browser holds only a publishable key. Administrative APIs verify the bearer token with Auth, check administrator role, and use the caller's RLS-scoped client. There is no browser service-role key.

The authenticated admin interface operates on the database. The public experience currently uses the versioned bundled catalog. Connecting live database publication to public discovery is a separate integration requirement, documented rather than hidden behind a false success message.

## Delivery

GitHub Actions runs application validation and a separate local-Supabase workflow for migrations, rights, RLS, and Auth repeatability. Vercel builds the same locked dependency graph using `npm ci`. No paid service is provisioned automatically. Health output includes only safe booleans, never credentials.
