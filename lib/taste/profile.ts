import type { AnalyticsEvent } from "../analytics/types.ts";
import type { Artwork } from "../artworks/types.ts";
import { buildTasteProfile } from "../recommendations/engine.ts";
import type { AffinityMap } from "../recommendations/types.ts";

export type TasteSignal = { label: string; strength: number };
export type TasteDimension = { label: string; signals: TasteSignal[] };
export type TasteSummary = {
  dimensions: TasteDimension[];
  eventCount: number;
  artworkCount: number;
  hasPositiveSignals: boolean;
  headline: string;
};

function positiveSignals(map: AffinityMap, names?: Map<string, string>): TasteSignal[] {
  const entries = Object.entries(map).filter(([, value]) => value > 0).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const maximum = entries[0]?.[1] ?? 1;
  return entries.slice(0, 3).map(([key, value]) => ({ label: names?.get(key) ?? key, strength: Math.round((value / maximum) * 100) }));
}

export function summarizeTaste(events: AnalyticsEvent[], artworks: Artwork[]): TasteSummary {
  const profile = buildTasteProfile(events, artworks);
  const names = new Map(artworks.map((artwork) => [artwork.artist.id, artwork.artist.name]));
  const dimensions = [
    { label: "Movements", signals: positiveSignals(profile.movements) },
    { label: "Palettes", signals: positiveSignals(profile.palettes) },
    { label: "Moods", signals: positiveSignals(profile.moods) },
    { label: "Composition", signals: positiveSignals(profile.compositions) },
    { label: "Media", signals: positiveSignals(profile.media) },
    { label: "Artists", signals: positiveSignals(profile.artists, names) },
  ];
  const mood = dimensions.find((dimension) => dimension.label === "Moods")?.signals[0]?.label;
  const palette = dimensions.find((dimension) => dimension.label === "Palettes")?.signals[0]?.label;
  return {
    dimensions,
    eventCount: profile.eventCount,
    artworkCount: profile.seenArtworkIds.filter((id) => artworks.some((artwork) => artwork.id === id)).length,
    hasPositiveSignals: dimensions.some((dimension) => dimension.signals.length > 0),
    headline: mood && palette ? `Drawn to ${mood} worlds and ${palette} tones.` : "Your eye is still exploring.",
  };
}

export function tasteShareText(summary: TasteSummary): string {
  const lines = summary.dimensions.filter((dimension) => dimension.signals.length).map((dimension) => `${dimension.label}: ${dimension.signals.map((signal) => signal.label).join(", ")}`);
  return ["My ARTE Art DNA", summary.headline, ...lines, `An evolving estimate from ${summary.eventCount} activity signals across ${summary.artworkCount} artworks on this device.`, "Based on ARTE’s current artwork catalog, not a fixed identity."].join("\n");
}
