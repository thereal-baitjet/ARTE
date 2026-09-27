import { createHash } from "node:crypto";
import type { Artwork } from "../artworks/types.ts";
import type { EmbeddingInput, EmbeddingProvider } from "./types.ts";

function values(input: string[]) {
  return [...new Set(input.map((value) => value.normalize("NFKC").trim().toLowerCase()).filter(Boolean))].sort();
}

export function embeddingInputFor(artwork: Artwork): EmbeddingInput {
  return {
    artworkId: artwork.id,
    metadata: {
      title: values([artwork.title]),
      description: values([artwork.description]),
      artist: values([artwork.artist.name]),
      movement: values([artwork.movement]),
      medium: values([artwork.medium, artwork.features.mediumCategory]),
      year: values([artwork.year]),
      palette: values(artwork.features.palette),
      mood: values(artwork.features.mood),
      composition: values(artwork.features.composition),
      subjects: values(artwork.features.subjects),
      period: values([artwork.features.period]),
      geography: values([artwork.features.geography]),
      tags: values(artwork.tags),
    },
    imageUrl: artwork.visual.kind === "image" ? artwork.visual.src : null,
  };
}

/** Canonical field and value ordering prevents spurious updates after catalog reordering. */
export function inputFingerprint(input: EmbeddingInput) {
  const metadata = Object.fromEntries(Object.entries(input.metadata).sort(([a], [b]) => a.localeCompare(b)).map(([key, entries]) => [key, values(entries)]));
  return createHash("sha256").update(JSON.stringify({ artworkId: input.artworkId, metadata, imageUrl: input.imageUrl })).digest("hex");
}

export class MetadataHashProvider implements EmbeddingProvider {
  readonly descriptor = { id: "metadata-hash", version: "1.0.0", dimensions: 512, modality: "metadata" as const };

  async embed(input: EmbeddingInput): Promise<number[]> {
    const vector = Array<number>(this.descriptor.dimensions).fill(0);
    const tokens = new Set<string>();
    for (const [field, entries] of Object.entries(input.metadata)) {
      for (const entry of values(entries)) {
        for (const token of entry.match(/[\p{L}\p{N}]+/gu) ?? []) tokens.add(`${field}:${token}`);
      }
    }
    if (!tokens.size) tokens.add("metadata:empty");
    for (const token of [...tokens].sort()) {
      const hash = createHash("sha256").update(token).digest();
      const position = hash.readUInt32BE(0) % vector.length;
      vector[position] += (hash[4] & 1) === 0 ? 1 : -1;
    }
    const norm = Math.hypot(...vector);
    // Extremely unlikely exact cancellation still produces a valid deterministic vector.
    if (norm === 0) { vector[0] = 1; return vector; }
    return vector.map((value) => Number((value / norm).toFixed(10)));
  }
}
