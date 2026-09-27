import { canDraftInquiry, type Listing } from "./listings.ts";

export const INQUIRY_DRAFT_KEY = "arte:market:inquiry-drafts:v1";
export const MAX_INQUIRY_LENGTH = 2000;
export type InquiryDraft = { listingId: string; message: string; status: "draft"; updatedAt: string };

export function parseInquiryDrafts(raw: string | null): InquiryDraft[] {
  try {
    const parsed: unknown = JSON.parse(raw ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((draft): draft is InquiryDraft => Boolean(draft && typeof draft === "object" && typeof draft.listingId === "string" && typeof draft.message === "string" && draft.message.trim().length > 0 && draft.message.length <= MAX_INQUIRY_LENGTH && draft.status === "draft" && typeof draft.updatedAt === "string" && Number.isFinite(Date.parse(draft.updatedAt))));
  } catch {
    return [];
  }
}

export function createInquiryDraft(listing: Listing, message: string, now = Date.now()): InquiryDraft {
  if (!canDraftInquiry(listing, now)) throw new Error("This listing is no longer available for an inquiry draft. Check its availability and freshness.");
  const trimmed = message.trim();
  if (!trimmed) throw new Error("Add a message before saving your draft.");
  if (trimmed.length > MAX_INQUIRY_LENGTH) throw new Error(`Keep your message within ${MAX_INQUIRY_LENGTH} characters.`);
  return { listingId: listing.id, message: trimmed, status: "draft", updatedAt: new Date(now).toISOString() };
}
