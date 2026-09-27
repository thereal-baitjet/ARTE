import { DEMO_ARTWORKS } from "../artworks/demoArtworks.ts";
import type { Artwork } from "../artworks/types.ts";

export type Currency = "USD" | "EUR" | "GBP";
export type Listing = {
  id: string;
  artwork: Artwork;
  isDemo: boolean;
  gallery: { name: string; location: string; description: string };
  status: "active" | "reserved" | "expired";
  priceCents: number | null;
  currency: Currency;
  checkedAt: string | null;
  expiresAt: string | null;
  sourceUrl: string;
};

const gallery = {
  name: "ARTE Study Room — Demo",
  location: "Fictional online gallery",
  description: "A synthetic gallery created to demonstrate art discovery. It does not represent artists, own inventory, or accept orders.",
};

// Fixed dates are intentional: this fixture must age instead of pretending to be refreshed.
export const DEMO_LISTINGS: Listing[] = [
  { id: "demo-quiet-red", artwork: DEMO_ARTWORKS[0], isDemo: true, gallery, status: "active", priceCents: 85000, currency: "USD", checkedAt: "2026-09-27T00:00:00Z", expiresAt: "2027-09-27T00:00:00Z", sourceUrl: "/sources/demo" },
  { id: "demo-night-window", artwork: DEMO_ARTWORKS[1], isDemo: true, gallery, status: "active", priceCents: 240000, currency: "USD", checkedAt: "2026-09-27T00:00:00Z", expiresAt: "2027-09-27T00:00:00Z", sourceUrl: "/sources/demo" },
  { id: "demo-form-three", artwork: DEMO_ARTWORKS[2], isDemo: true, gallery, status: "active", priceCents: null, currency: "EUR", checkedAt: "2026-09-27T00:00:00Z", expiresAt: "2027-09-27T00:00:00Z", sourceUrl: "/sources/demo" },
  { id: "demo-blue-interval", artwork: DEMO_ARTWORKS[4], isDemo: true, gallery, status: "reserved", priceCents: 160000, currency: "GBP", checkedAt: "2026-09-27T00:00:00Z", expiresAt: "2027-09-27T00:00:00Z", sourceUrl: "/sources/demo" },
  { id: "demo-garden", artwork: DEMO_ARTWORKS[5], isDemo: true, gallery, status: "active", priceCents: 640000, currency: "EUR", checkedAt: "2026-08-01T00:00:00Z", expiresAt: "2027-09-27T00:00:00Z", sourceUrl: "/sources/demo" },
  { id: "demo-dust-gold", artwork: DEMO_ARTWORKS[7], isDemo: true, gallery, status: "expired", priceCents: 120000, currency: "USD", checkedAt: "2026-08-01T00:00:00Z", expiresAt: "2026-09-01T00:00:00Z", sourceUrl: "/sources/demo" },
];

export type Freshness = "current" | "stale" | "expired";
export type MarketFilters = {
  trust: "all" | "verified" | "demo";
  currency: "all" | Currency;
  price: "all" | "under1000" | "1000to5000" | "over5000" | "request";
  availability: "all" | "available" | "reserved" | "expired";
  currentOnly: boolean;
};
export const DEFAULT_FILTERS: MarketFilters = { trust: "all", currency: "all", price: "all", availability: "all", currentOnly: false };
export const FRESHNESS_DAYS = 30;

export function listingFreshness(listing: Listing, now = Date.now()): Freshness {
  if (listing.status === "expired" || (listing.expiresAt !== null && (!Number.isFinite(Date.parse(listing.expiresAt)) || Date.parse(listing.expiresAt) <= now))) return "expired";
  const checked = listing.checkedAt ? Date.parse(listing.checkedAt) : NaN;
  return Number.isFinite(checked) && checked <= now && now - checked <= FRESHNESS_DAYS * 86_400_000 ? "current" : "stale";
}

export function canDraftInquiry(listing: Listing, now = Date.now()): boolean {
  return listing.status === "active" && listingFreshness(listing, now) === "current";
}

export function filterListings(listings: Listing[], filters: MarketFilters, now = Date.now()): Listing[] {
  if (filters.currency === "all" && filters.price !== "all" && filters.price !== "request") return [];
  return listings.filter((listing) => {
    const freshness = listingFreshness(listing, now);
    if (filters.trust === "verified" && (listing.isDemo || freshness !== "current" || !listing.checkedAt)) return false;
    if (filters.trust === "demo" && !listing.isDemo) return false;
    if (filters.currency !== "all" && listing.currency !== filters.currency) return false;
    if (filters.currentOnly && freshness !== "current") return false;
    if (filters.availability === "available" && (listing.status !== "active" || freshness === "expired")) return false;
    if (filters.availability === "reserved" && (listing.status !== "reserved" || freshness === "expired")) return false;
    if (filters.availability === "expired" && freshness !== "expired") return false;
    if (filters.price === "request") return listing.priceCents === null;
    // Never compare monetary amounts across currencies without exchange-rate data.
    if (filters.price !== "all" && filters.currency !== "all") {
      if (listing.priceCents === null) return false;
      if (filters.price === "under1000" && listing.priceCents >= 100000) return false;
      if (filters.price === "1000to5000" && (listing.priceCents < 100000 || listing.priceCents > 500000)) return false;
      if (filters.price === "over5000" && listing.priceCents <= 500000) return false;
    }
    return true;
  });
}

export function formatListingPrice(listing: Listing): string {
  return listing.priceCents === null ? "Price on request" : new Intl.NumberFormat("en-US", { style: "currency", currency: listing.currency, maximumFractionDigits: 0 }).format(listing.priceCents / 100);
}

export function formatListingDate(value: string | null): string {
  return value ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(value)) : "Not checked";
}
