type EmptyStateProps = {
  eyebrow?: string;
  title: string;
  description: string;
};

export function EmptyState({ eyebrow = "ARTE", title, description }: EmptyStateProps) {
  return (
    <section className="mx-auto flex min-h-[50vh] max-w-xl flex-col justify-center px-6 py-20 text-center">
      <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--muted-text)]">{eyebrow}</p>
      <h1 className="display-serif mt-5 text-4xl font-medium md:text-6xl">{title}</h1>
      <p className="mx-auto mt-5 max-w-md text-sm leading-7 text-[var(--muted-text)]">{description}</p>
    </section>
  );
}
