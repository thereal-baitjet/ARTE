import Image from "next/image";
import type { Artwork } from "@/lib/artworks/types";

const widthClasses = {
  portrait: "max-w-[34rem]",
  landscape: "max-w-[64rem]",
  square: "max-w-[44rem]",
} as const;

const primaryShapeClasses = {
  orb: "left-[18%] top-[14%] h-[54%] w-[54%] rounded-full blur-[1px]",
  bands: "left-[12%] top-[18%] h-[64%] w-[18%] rotate-[8deg]",
  frame: "left-[18%] top-[16%] h-[62%] w-[58%] border-[clamp(1rem,3vw,2.5rem)] bg-transparent",
  veil: "left-[30%] top-[-8%] h-[116%] w-[32%] rotate-[18deg] blur-md",
} as const;

export function ArtworkVisual({ artwork, compact = false }: { artwork: Pick<Artwork, "visual">; compact?: boolean }) {
  const widthClass = compact ? "max-w-full" : widthClasses[artwork.visual.aspect];

  if (artwork.visual.kind === "image") {
    // NGA already serves a bounded 843px image; direct delivery avoids the optimizer's upstream timeout.
    const isBoundedNgaImage = artwork.visual.src.startsWith("https://api.nga.gov/iiif/");
    return (
      <div className={`${widthClass} relative flex w-full items-center justify-center overflow-hidden border border-black/10`} style={{ aspectRatio: artwork.visual.aspectRatio, background: artwork.visual.background }}>
        <Image src={artwork.visual.src} alt={artwork.visual.alt} fill unoptimized={isBoundedNgaImage} sizes={compact ? "(max-width: 767px) 100vw, (max-width: 1279px) 45vw, 30vw" : "(max-width: 767px) 100vw, (max-width: 1279px) 75vw, 65vw"} className="object-contain" />
      </div>
    );
  }

  if (artwork.visual.kind === "missing") {
    return (
      <div
        role="img"
        aria-label={artwork.visual.alt}
        data-testid="artwork-visual-missing"
        className={`${widthClass} relative flex w-full items-center justify-center overflow-hidden border border-[var(--hairline)]`}
        style={{ aspectRatio: artwork.visual.aspectRatio, background: artwork.visual.background }}
      >
        <div className="max-w-xs px-8 text-center">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted-text)]">Image unavailable</p>
          <p className="display-serif mt-4 text-2xl text-[var(--secondary-ink)]">Rights review in progress</p>
          <p className="mt-4 text-xs leading-6 text-[var(--muted-text)]">Metadata remains visible; ARTE will not display an image without a clear rights state.</p>
        </div>
      </div>
    );
  }

  return (
    <div
      role="img"
      aria-label={artwork.visual.alt}
      className={`${widthClass} relative w-full overflow-hidden border border-black/10`}
      style={{ aspectRatio: artwork.visual.aspectRatio, background: artwork.visual.background }}
    >
      <span
        aria-hidden="true"
        className={`absolute ${primaryShapeClasses[artwork.visual.shape]}`}
        style={{ background: artwork.visual.shape === "frame" ? "transparent" : artwork.visual.accent, borderColor: artwork.visual.accent, opacity: 0.76 }}
      />
      <span
        aria-hidden="true"
        className="absolute bottom-[10%] right-[9%] h-[18%] w-[28%] border border-white/35 bg-white/10 backdrop-blur-sm"
      />
      <span
        aria-hidden="true"
        className="absolute inset-x-[7%] bottom-[6%] h-px bg-white/45"
      />
    </div>
  );
}
