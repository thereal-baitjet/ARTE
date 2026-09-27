import { link, mkdir, open, readFile, rename, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { DEMO_ARTWORKS } from "../lib/artworks/demoArtworks.ts";
import { buildEmbeddingIndex, parseEmbeddingIndex } from "../lib/embeddings/index.ts";
import { MetadataHashProvider } from "../lib/embeddings/metadata.ts";
import type { EmbeddingIndex } from "../lib/embeddings/types.ts";

async function main() {
  const args = process.argv.slice(2);
  const mode = args.shift();
  if (!mode || !["generate", "update", "rebuild"].includes(mode) || args.length !== 2 || args[0] !== "--out" || !args[1]) throw new Error("Usage: node --experimental-strip-types scripts/embeddings.ts <generate|update|rebuild> --out /path/to/embeddings.json");
  const destination = resolve(args[1]);
  let previous: EmbeddingIndex | undefined;
  let existing = false;
  try {
    const raw = await readFile(destination, "utf8");
    existing = true;
    if (mode === "update") previous = parseEmbeddingIndex(JSON.parse(raw));
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
  }
  if (mode === "generate" && existing) throw new Error("The output already exists. Use update to reuse unchanged records, or rebuild to regenerate it.");
  const result = await buildEmbeddingIndex(DEMO_ARTWORKS, new MetadataHashProvider(), previous, mode === "rebuild");
  const serialized = `${JSON.stringify(result.index)}\n`;
  await mkdir(dirname(destination), { recursive: true });
  const temporary = `${destination}.${randomUUID()}.tmp`;
  try {
    await writeExclusive(temporary, serialized);
    // Linking is atomic and refuses to replace a destination created during generation.
    if (mode === "generate") await link(temporary, destination);
    else await rename(temporary, destination);
  } finally { await rm(temporary, { force: true }); }
  process.stdout.write(`${JSON.stringify({ mode, output: destination, provider: result.index.provider, ...result.stats })}\n`);
}

async function writeExclusive(path: string, contents: string) {
  const file = await open(path, "wx");
  try { await file.writeFile(contents, "utf8"); }
  finally { await file.close(); }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : "Embedding generation failed."}\n`);
  process.exitCode = 1;
});
