import type { CorridorCursor } from "./types.ts";

export const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export function parseCursor(value: string | null): CorridorCursor | null {
  if (value === null) return null;
  if (value.length > 256) throw new Error("Invalid cursor.");
  const parsed: unknown = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
  if (!parsed || typeof parsed !== "object" || !("id" in parsed) || !("createdAt" in parsed)
    || typeof parsed.id !== "string" || !isUuid(parsed.id) || typeof parsed.createdAt !== "string"
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|\+00:00)$/.test(parsed.createdAt)
    || !Number.isFinite(Date.parse(parsed.createdAt))) throw new Error("Invalid cursor.");
  return { id: parsed.id, createdAt: parsed.createdAt };
}
export function noteText(body: Record<string, unknown>): string {
  if (Object.keys(body).length !== 1 || typeof body.noteText !== "string") throw new Error("Please enter a short note.");
  const text = body.noteText.normalize("NFKC").replace(/\s+/gu, " ").trim();
  if (!text || Array.from(text).length > 140) throw new Error("Please keep your note between 1 and 140 characters.");
  return text;
}
