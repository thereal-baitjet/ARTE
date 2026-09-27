export default function DemoSourcePage() {
  return (
    <section className="mx-auto max-w-3xl px-6 py-16 md:px-10 md:py-24">
      <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--oxblood)]">Data source</p>
      <h1 className="display-serif mt-5 text-5xl font-medium md:text-7xl">ARTE deterministic demo set</h1>
      <div className="mt-8 space-y-5 text-sm leading-7 text-[var(--secondary-ink)]">
        <p>Every work and artist identity in this source is synthetic and exists only to validate ARTE’s interface, pagination, interaction, attribution, and failure states.</p>
        <p>No displayed demo record represents real inventory, ownership, gallery representation, valuation, provenance, or historical interpretation.</p>
        <p>The visual compositions are rendered by the application with CSS rather than copied from an external artwork image.</p>
      </div>
    </section>
  );
}
