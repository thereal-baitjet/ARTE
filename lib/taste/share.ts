import type { TasteSummary } from "./profile.ts";

export function tasteShareText(summary: TasteSummary): string {
  const lines = summary.dimensions.filter((dimension) => dimension.signals.length).map((dimension) => `${dimension.label}: ${dimension.signals.map((signal) => signal.label).join(", ")}`);
  return ["My ARTE Art DNA", summary.headline, ...lines, `An evolving estimate from ${summary.eventCount} activity signals across ${summary.artworkCount} artworks on this device.`, "Based on ARTE’s current artwork catalog, not a fixed identity."].join("\n");
}
