import type { CorridorCursor, CorridorNote, CorridorPage } from "./types.ts";
import { isUuid } from "./validation.ts";

export class CorridorContractError extends Error {
  readonly operation: "access" | "page" | "write";
  constructor(operation: "access" | "page" | "write") {
    super("Unexpected Shared Corridor response.");
    this.operation = operation;
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function corridorEligibility(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  // Some hosted installations expose the access result as a one-row RPC table.
  if (Array.isArray(value) && value.length === 1 && record(value[0]) && typeof value[0].has_access === "boolean") {
    return value[0].has_access;
  }
  throw new CorridorContractError("access");
}

function timestamp(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|\+00:00)$/.test(value)
    && Number.isFinite(Date.parse(value));
}

export function corridorNote(value: unknown, operation: "page" | "write" = "write"): CorridorNote {
  if (!record(value) || typeof value.id !== "string" || !isUuid(value.id)
    || typeof value.noteText !== "string" || !value.noteText.trim() || Array.from(value.noteText).length > 140
    || !timestamp(value.createdAt) || !timestamp(value.updatedAt) || typeof value.isOwn !== "boolean") {
    throw new CorridorContractError(operation);
  }
  return { id: value.id, noteText: value.noteText, createdAt: value.createdAt, updatedAt: value.updatedAt, isOwn: value.isOwn };
}

export function corridorPage(value: unknown): CorridorPage {
  if (!record(value) || !Array.isArray(value.notes) || value.notes.length > 6
    || !("ownNote" in value) || !("nextCursor" in value)) throw new CorridorContractError("page");
  const notes = value.notes.map((note) => corridorNote(note, "page"));
  const ownNote = value.ownNote === null ? null : corridorNote(value.ownNote, "page");
  if (ownNote && !ownNote.isOwn) throw new CorridorContractError("page");
  let nextCursor: CorridorCursor | null = null;
  if (value.nextCursor !== null) {
    if (!record(value.nextCursor) || typeof value.nextCursor.id !== "string" || !isUuid(value.nextCursor.id)
      || !timestamp(value.nextCursor.createdAt)) throw new CorridorContractError("page");
    nextCursor = { id: value.nextCursor.id, createdAt: value.nextCursor.createdAt };
  }
  return { notes, ownNote, nextCursor };
}
