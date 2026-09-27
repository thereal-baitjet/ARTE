import type { Artwork } from "../artworks/types.ts";
import { embeddingInputFor, inputFingerprint } from "./metadata.ts";
import type { EmbeddingDescriptor, EmbeddingIndex, EmbeddingProvider, EmbeddingRecord } from "./types.ts";

export function validEmbeddingVector(value: unknown, dimensions: number): value is number[] {
  return Array.isArray(value) && value.length === dimensions && value.every((item) => typeof item === "number" && Number.isFinite(item)) && value.some((item) => item !== 0);
}

function descriptorValid(value: unknown): value is EmbeddingDescriptor {
  if (!value || typeof value !== "object") return false;
  const descriptor = value as EmbeddingDescriptor;
  return typeof descriptor.id === "string" && descriptor.id.length > 0 && typeof descriptor.version === "string" && descriptor.version.length > 0 && descriptor.dimensions === 512 && ["metadata", "text", "image", "multimodal"].includes(descriptor.modality);
}

export function parseEmbeddingIndex(value: unknown): EmbeddingIndex {
  if (!value || typeof value !== "object") throw new Error("Invalid embedding index.");
  const candidate = value as EmbeddingIndex;
  if (candidate.schemaVersion !== 1 || !descriptorValid(candidate.provider) || !Array.isArray(candidate.records)) throw new Error("Unsupported embedding index format or dimensions.");
  const ids = new Set<string>();
  for (const record of candidate.records) {
    if (!record || typeof record.artworkId !== "string" || !record.artworkId || ids.has(record.artworkId) || typeof record.inputHash !== "string" || !/^[a-f0-9]{64}$/.test(record.inputHash) || !validEmbeddingVector(record.vector, candidate.provider.dimensions)) throw new Error("Invalid or duplicate embedding record.");
    ids.add(record.artworkId);
  }
  return candidate;
}

function sameProvider(left: EmbeddingDescriptor, right: EmbeddingDescriptor) {
  return left.id === right.id && left.version === right.version && left.dimensions === right.dimensions && left.modality === right.modality;
}

export async function buildEmbeddingIndex(artworks: Artwork[], provider: EmbeddingProvider, previous?: EmbeddingIndex, rebuild = false) {
  if (!descriptorValid(provider.descriptor)) throw new Error("Embedding providers must declare an ID, version, supported modality, and 512 dimensions.");
  if (previous) parseEmbeddingIndex(previous);
  const cache = new Map(!rebuild && previous && sameProvider(previous.provider, provider.descriptor) ? previous.records.map((record) => [record.artworkId, record]) : []);
  const records: EmbeddingRecord[] = [];
  const artworkIds = new Set<string>();
  let generated = 0;
  let reused = 0;
  for (const artwork of [...artworks].sort((a, b) => a.id.localeCompare(b.id))) {
    if (artworkIds.has(artwork.id)) throw new Error(`Duplicate artwork ID: ${artwork.id}`);
    artworkIds.add(artwork.id);
    const input = embeddingInputFor(artwork);
    const inputHash = inputFingerprint(input);
    const existing = cache.get(artwork.id);
    if (existing?.inputHash === inputHash) { records.push(existing); reused += 1; continue; }
    const vector = await provider.embed(input);
    if (!validEmbeddingVector(vector, provider.descriptor.dimensions)) throw new Error(`Provider returned an invalid vector for ${artwork.id}.`);
    records.push({ artworkId: artwork.id, inputHash, vector });
    generated += 1;
  }
  const removed = previous?.records.filter((record) => !artworkIds.has(record.artworkId)).length ?? 0;
  const index: EmbeddingIndex = { schemaVersion: 1, provider: { ...provider.descriptor }, records };
  return { index, stats: { generated, reused, removed, total: records.length } };
}
