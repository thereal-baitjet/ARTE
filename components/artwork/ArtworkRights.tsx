export type ArtworkRightsData = {
  imageSource: string;
  rightsHolder?: string | null;
  license?: string | null;
  usageNotes?: string | null;
  sourceUrl: string;
};

export function ArtworkRights({ rights }: { rights: ArtworkRightsData }) {
  return (
    <section aria-labelledby="artwork-rights-title" className="border-t border-[var(--hairline)] pt-6">
      <h2 id="artwork-rights-title" className="text-[11px] uppercase tracking-[0.18em] text-[var(--muted-text)]">
        Image rights & attribution
      </h2>
      <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
        <div><dt className="text-[var(--muted-text)]">Image source</dt><dd>{rights.imageSource}</dd></div>
        <div><dt className="text-[var(--muted-text)]">Rights holder</dt><dd>{rights.rightsHolder ?? "Not supplied"}</dd></div>
        <div><dt className="text-[var(--muted-text)]">License</dt><dd>{rights.license ?? "Not supplied"}</dd></div>
        <div><dt className="text-[var(--muted-text)]">Usage notes</dt><dd>{rights.usageNotes ?? "None supplied"}</dd></div>
      </dl>
      <a href={rights.sourceUrl} className="focus-ring mt-5 inline-block border-b border-[var(--primary-ink)] pb-1 text-xs uppercase tracking-[0.12em]">
        View source record
      </a>
    </section>
  );
}
