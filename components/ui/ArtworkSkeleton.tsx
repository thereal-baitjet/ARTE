export function ArtworkSkeleton() {
  return (
    <div className="mx-auto flex min-h-[72vh] max-w-5xl animate-pulse items-center justify-center px-6" aria-label="Loading artwork" role="status">
      <div className="aspect-[4/5] max-h-[70vh] w-full max-w-xl bg-[#e6e0d6]" />
      <span className="sr-only">Loading artwork</span>
    </div>
  );
}
