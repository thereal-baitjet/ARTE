/** Offline embedding contract. Metadata hashing is a fallback, not image understanding. */
export type EmbeddingDescriptor = {
  id: string;
  version: string;
  dimensions: number;
  modality: "metadata" | "text" | "image" | "multimodal";
};

export type EmbeddingInput = {
  artworkId: string;
  metadata: Record<string, string[]>;
  imageUrl: string | null;
};

export interface EmbeddingProvider {
  readonly descriptor: EmbeddingDescriptor;
  embed(input: EmbeddingInput): Promise<number[]>;
}

export type EmbeddingRecord = {
  artworkId: string;
  inputHash: string;
  vector: number[];
};

export type EmbeddingIndex = {
  schemaVersion: 1;
  provider: EmbeddingDescriptor;
  records: EmbeddingRecord[];
};
