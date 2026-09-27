export type AdminMutation =
  | { action: "archive_artwork"; id: string }
  | { action: "set_listing_status"; id: string; status: "sold" | "inactive" };

export function parseAdminMutation(value: unknown): AdminMutation | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (typeof input.id !== "string" || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(input.id)) return null;
  if (input.action === "archive_artwork") return { action: input.action, id: input.id };
  if (input.action === "set_listing_status" && (input.status === "sold" || input.status === "inactive")) {
    return { action: input.action, id: input.id, status: input.status };
  }
  return null;
}

export function bearerToken(header: string | null): string | null {
  const match = header?.match(/^Bearer ([A-Za-z0-9._-]{20,8192})$/);
  return match?.[1] ?? null;
}
