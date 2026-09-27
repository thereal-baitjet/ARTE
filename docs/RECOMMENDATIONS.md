# Recommendations and attention

The engine in `lib/recommendations` builds affinity maps for artists, movement/category, medium, palette, mood, composition, subject, and tags. Explicit likes and saves are stronger than passive dwell signals. Hides suppress works; impressions mark a work seen without pretending the viewer liked it. Ranking weights and dwell thresholds live in configuration.

Rankings are deterministic for a fixed event snapshot and catalog. The diversity scheduler avoids adjacent artist repetition when feasible. Pagination preserves the ranking snapshot through a browsing session; hidden cards are removed from display without removing the cursor from that snapshot. A refresh uses the newest preference history.

Why This explanations expose the actual scoring components used. More Like This compares declared metadata and format; it is not a visual embedding model. Museum metadata does not acquire invented palette, mood, movement, or biography claims merely to fill a field.

Art DNA normalizes actual positive affinity. It discloses its local-history scope and limited sample. Shared cards exclude private saved-work lists and personal identifiers. Pausing passive signals does not disable explicit likes/saves; the UI explains that distinction.

Attention trends deduplicate repeated actions and apply recency limits. Device-only data is labeled accordingly. Global trend rankings and anti-fraud infrastructure require a hosted ingestion/aggregation system before they can be advertised as platform-wide results.

Cross-device recommendation history hydration is not complete. A hosted event write must not be cited as proof of cross-device personalization.
