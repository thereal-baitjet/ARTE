import { DEMO_ARTWORKS } from "../artworks/demoArtworks.ts";
import type { Artwork } from "../artworks/types.ts";
import { canPublishArtwork, type RightsCandidate } from "../rights/validateArtworkRights.ts";

export type NormalizedArtwork = {
  id: string; slug: string; title: string; year_display: string; medium: string; dimensions: string;
  description: string; artist: Artwork["artist"]; source_name: string; source_url: string;
  source_artwork_id: string; metadata_source: string; image_source: string; image_license: string;
  image_rights_state: RightsCandidate["state"]; is_synthetic: boolean; source_adapter_version: string;
};

export type SourceAdapter<T> = {
  id: string;
  fetch(): Promise<T[]>;
  normalize(record: T): NormalizedArtwork;
  mapRights(record: NormalizedArtwork): RightsCandidate;
  validate(record: NormalizedArtwork): string[];
};

export function validateSourceRecord(record: NormalizedArtwork): string[] {
  const errors: string[] = [];
  const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
  if (!uuid.test(record.id) || !uuid.test(record.artist.id)) errors.push("Invalid artwork or artist identifier.");
  if (!record.title.trim() || !record.source_artwork_id.trim() || !record.source_name.trim()) errors.push("Missing source identity or artwork title.");
  if (!record.source_url.startsWith("https://") && !(record.is_synthetic && record.source_url === "/sources/demo")) errors.push("Source must be an attributed HTTPS record or the internal demo source.");
  if (!canPublishArtwork({ state: record.image_rights_state, sourceUrl: record.source_url, license: record.image_license, isSynthetic: record.is_synthetic })) errors.push("Image rights do not permit publication.");
  return errors;
}

export const demoSourceAdapter: SourceAdapter<Artwork> = {
  id: "arte-demo-v1",
  async fetch() { return DEMO_ARTWORKS.filter(work => work.isDemo); },
  normalize(artwork) {
    return { id: artwork.id, slug: artwork.slug, title: artwork.title, year_display: artwork.year,
      medium: artwork.medium, dimensions: artwork.dimensions, description: artwork.description,
      artist: artwork.artist, source_name: "ARTE deterministic seed", source_url: artwork.rights.sourceUrl,
      source_artwork_id: `demo-${Number(artwork.id.slice(-12)).toString().padStart(3, "0")}`, metadata_source: "ARTE deterministic synthetic dataset",
      image_source: artwork.rights.imageSource, image_license: artwork.rights.license,
      image_rights_state: "demo", is_synthetic: true, source_adapter_version: "demo-v1" };
  },
  mapRights(record) { return { state: record.image_rights_state, sourceUrl: record.source_url, license: record.image_license, isSynthetic: record.is_synthetic }; },
  validate: validateSourceRecord,
};

export type SyncReport = { status: "success" | "partial" | "failed"; recordsSeen: number; recordsUpserted: number; recordsRejected: number; errors: { record: string; reason: string }[] };

export async function synchronize<T>(adapter: SourceAdapter<T>, upsert: (record: NormalizedArtwork) => Promise<void>): Promise<SyncReport> {
  const report: SyncReport = { status: "success", recordsSeen: 0, recordsUpserted: 0, recordsRejected: 0, errors: [] };
  let records: T[];
  try { records = await adapter.fetch(); } catch {
    return { ...report, status: "failed", errors: [{ record: "source", reason: "Source fetch failed." }] };
  }
  for (const raw of records) {
    report.recordsSeen++;
    let id = `record-${report.recordsSeen}`;
    try {
      const record = adapter.normalize(raw);
      id = record.source_artwork_id;
      const errors = adapter.validate(record);
      if (!canPublishArtwork(adapter.mapRights(record))) errors.push("Rights mapping rejected publication.");
      if (errors.length) {
        report.recordsRejected++;
        report.errors.push({ record: id, reason: errors.join(" ") });
        continue;
      }
      await upsert(record);
      report.recordsUpserted++;
    } catch {
      report.recordsRejected++;
      report.errors.push({ record: id, reason: "Record normalization or database write failed." });
    }
  }
  report.status = report.recordsRejected ? (report.recordsUpserted ? "partial" : "failed") : "success";
  return report;
}
