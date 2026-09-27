"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArtworkVisual } from "@/components/artwork/ArtworkVisual";
import { canDraftInquiry, DEFAULT_FILTERS, DEMO_LISTINGS, filterListings, formatListingDate, formatListingPrice, listingFreshness, type Listing, type MarketFilters } from "@/lib/market/listings";
import { createInquiryDraft, INQUIRY_DRAFT_KEY, MAX_INQUIRY_LENGTH, parseInquiryDrafts } from "@/lib/market/drafts";

const inputClass = "focus-ring mt-2 min-h-11 w-full border border-[var(--hairline)] bg-[var(--soft-white)] px-3 text-sm";

function InquiryForm({ listing }: { listing: Listing }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const textArea = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (open) textArea.current?.focus(); }, [open]);

  function editDraft() {
    if (!canDraftInquiry(listing)) { setError("This listing is no longer current. Inquiry drafts are unavailable."); return; }
    setError("");
    setFeedback("");
    try { setMessage(parseInquiryDrafts(localStorage.getItem(INQUIRY_DRAFT_KEY)).find((draft) => draft.listingId === listing.id)?.message ?? ""); }
    catch { setError("Browser storage is unavailable. You can write a message here, but it cannot be saved."); }
    setOpen(true);
  }

  function saveDraft(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback("");
    setError("");
    let draft;
    try { draft = createInquiryDraft(listing, message); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "This draft could not be saved."); return; }
    try {
      const existing = parseInquiryDrafts(localStorage.getItem(INQUIRY_DRAFT_KEY));
      localStorage.setItem(INQUIRY_DRAFT_KEY, JSON.stringify([...existing.filter((item) => item.listingId !== listing.id), draft]));
      setMessage(draft.message);
      setFeedback("Draft saved on this browser. Nothing was sent to a gallery.");
    } catch { setError("Your draft could not be saved because browser storage is unavailable. Your message is still here to copy."); }
  }

  function deleteDraft() {
    setFeedback("");
    setError("");
    try {
      const existing = parseInquiryDrafts(localStorage.getItem(INQUIRY_DRAFT_KEY));
      localStorage.setItem(INQUIRY_DRAFT_KEY, JSON.stringify(existing.filter((item) => item.listingId !== listing.id)));
      setMessage("");
      setFeedback("Draft deleted from this browser.");
    } catch { setError("The saved draft could not be deleted. Browser storage is unavailable."); }
  }

  return (
    <div className="mt-5">
      {!open ? <button type="button" onClick={editDraft} className="focus-ring min-h-11 w-full border border-[var(--primary-ink)] px-4 text-xs uppercase tracking-[0.12em]">Write / edit inquiry draft</button> : (
        <form onSubmit={saveDraft} className="border-t border-[var(--hairline)] pt-5" aria-label={`Inquiry draft for ${listing.artwork.title}`}>
          <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--oxblood)]">Private draft · never sent</p>
          <label htmlFor={`inquiry-${listing.id}`} className="mt-4 block text-sm">Your message</label>
          <textarea ref={textArea} id={`inquiry-${listing.id}`} value={message} onChange={(event) => { setMessage(event.target.value); setFeedback(""); }} maxLength={MAX_INQUIRY_LENGTH} rows={4} required aria-describedby={`inquiry-note-${listing.id}`} className={`${inputClass} py-3`} placeholder="What would you like to know about the work?" />
          <p id={`inquiry-note-${listing.id}`} className="mt-2 text-xs leading-5 text-[var(--muted-text)]">Saved only on this device; visible to anyone using this browser. No email, payment, or contact details needed. This demo gallery has no contact service.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="submit" className="focus-ring min-h-11 bg-[var(--primary-ink)] px-4 text-xs text-white">Save draft locally</button>
            <button type="button" onClick={deleteDraft} className="focus-ring min-h-11 px-2 text-xs underline underline-offset-4">Delete draft</button>
            <button type="button" onClick={() => { setOpen(false); setFeedback(""); setError(""); }} className="focus-ring min-h-11 px-2 text-xs">Close</button>
          </div>
        </form>
      )}
      {feedback ? <p role="status" className="mt-3 text-sm leading-6">{feedback}</p> : null}
      {error ? <p role="alert" className="mt-3 text-sm leading-6 text-[var(--oxblood)]">{error}</p> : null}
    </div>
  );
}

function ListingCard({ listing, now }: { listing: Listing; now: number }) {
  const freshness = listingFreshness(listing, now);
  const available = canDraftInquiry(listing, now);
  const stateLabel = freshness === "expired" ? "Expired" : listing.status === "reserved" ? "Reserved" : "Available";
  return (
    <article data-listing-id={listing.id} className="min-w-0 border-b border-[var(--hairline)] pb-8">
      <Link href={`/artwork/${listing.artwork.slug}`} aria-label={`View ${listing.artwork.title}`} className="focus-ring block">
        <ArtworkVisual artwork={listing.artwork} compact />
      </Link>
      <div className="mt-5 flex flex-wrap justify-between gap-2 text-[10px] uppercase tracking-[0.13em]">
        <span className="text-[var(--oxblood)]">{listing.isDemo ? "Demo listing · not for sale" : freshness === "current" ? "Verified listing" : "Verification needed"}</span>
        <span className="text-[var(--muted-text)]">{stateLabel}{listing.isDemo ? " · sample" : ""}</span>
      </div>
      <h2 className="display-serif mt-3 text-3xl leading-tight"><Link className="focus-ring" href={`/artwork/${listing.artwork.slug}`}>{listing.artwork.title}</Link></h2>
      <p className="mt-2 text-xs leading-6 text-[var(--muted-text)]">{listing.artwork.artist.name} / {listing.artwork.year}</p>
      <p className="mt-1 text-xs leading-6 text-[var(--muted-text)]">{listing.artwork.medium} · {listing.artwork.dimensions}</p>
      <p className="mt-4 text-lg">{formatListingPrice(listing)} <span className="text-xs text-[var(--muted-text)]">{listing.currency} {listing.isDemo ? "· illustrative price" : ""}</span></p>
      <details className="mt-5 border-y border-[var(--hairline)] py-3">
        <summary className="focus-ring cursor-pointer text-xs leading-6">{listing.gallery.name}</summary>
        <p className="mt-3 text-xs uppercase tracking-wider text-[var(--muted-text)]">{listing.gallery.location}</p>
        <p className="mt-2 text-sm leading-6">{listing.gallery.description}</p>
        <Link href={listing.sourceUrl} className="focus-ring mt-3 inline-flex min-h-11 items-center text-xs underline underline-offset-4">View listing source &amp; image rights</Link>
      </details>
      <div className="mt-4 text-xs leading-6 text-[var(--muted-text)]">
        <p>{listing.isDemo ? "Sample checked date" : "Last verified"}: {formatListingDate(listing.checkedAt)}</p>
        <p>{freshness === "expired" ? "Expired" : "Expires"}: {formatListingDate(listing.expiresAt)}</p>
        {freshness === "stale" ? <p className="text-[var(--oxblood)]">Needs rechecking · more than 30 days old or unverified.</p> : null}
      </div>
      {available ? <InquiryForm listing={listing} /> : <p className="mt-5 border border-[var(--hairline)] p-3 text-xs leading-6">{freshness === "expired" ? "Inquiry unavailable: listing expired." : listing.status === "reserved" ? "Inquiry unavailable: listing reserved." : "Inquiry unavailable until this listing is rechecked."}</p>}
    </article>
  );
}

export function MarketExplorer() {
  const [filters, setFilters] = useState<MarketFilters>(DEFAULT_FILTERS);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const update = () => setNow(Date.now());
    const initial = window.setTimeout(update, 0);
    const timer = window.setInterval(update, 60_000);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); };
  }, []);
  const listings = now === null ? [] : filterListings(DEMO_LISTINGS, filters, now);
  function updateFilter<K extends keyof MarketFilters>(key: K, value: MarketFilters[K]) { setFilters((previous) => ({ ...previous, [key]: value, ...(key === "currency" && value === "all" ? { price: "all" as const } : {}) })); }

  return (
    <section className="px-6 py-12 md:px-10 lg:px-14 lg:py-16">
      <div className="grid gap-6 border-b border-[var(--hairline)] pb-9 lg:grid-cols-[1fr_24rem] lg:items-end">
        <div><p className="text-[10px] uppercase tracking-[0.22em] text-[var(--oxblood)]">ARTE / Market study</p><h1 className="display-serif mt-4 text-6xl leading-none md:text-8xl">A place for<br /><em>your next piece.</em></h1></div>
        <p className="max-w-lg text-sm leading-7 text-[var(--secondary-ink)]">Explore price, provenance, and the gallery behind a work. This is a demo market: all artwork and prices are synthetic. Nothing here is for sale, and inquiry drafts stay in your browser.</p>
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5" aria-label="Market filters">
        <label className="text-xs">Listing type<select value={filters.trust} onChange={(event) => updateFilter("trust", event.target.value as MarketFilters["trust"])} className={inputClass}><option value="all">All listing types</option><option value="verified">Verified only</option><option value="demo">Demo only</option></select></label>
        <label className="text-xs">Currency<select value={filters.currency} onChange={(event) => updateFilter("currency", event.target.value as MarketFilters["currency"])} className={inputClass}><option value="all">All currencies</option><option value="USD">USD — US dollar</option><option value="EUR">EUR — Euro</option><option value="GBP">GBP — British pound</option></select></label>
        <label className="text-xs">Price<select value={filters.price} onChange={(event) => updateFilter("price", event.target.value as MarketFilters["price"])} className={inputClass}><option value="all">All prices</option><option value="under1000" disabled={filters.currency === "all"}>Under 1,000</option><option value="1000to5000" disabled={filters.currency === "all"}>1,000 – 5,000</option><option value="over5000" disabled={filters.currency === "all"}>Over 5,000</option><option value="request">Price on request</option></select></label>
        <label className="text-xs">Availability<select value={filters.availability} onChange={(event) => updateFilter("availability", event.target.value as MarketFilters["availability"])} className={inputClass}><option value="all">All states</option><option value="available">Available</option><option value="reserved">Reserved</option><option value="expired">Expired</option></select></label>
        <label className="flex min-h-11 items-center gap-3 self-end text-xs"><input type="checkbox" checked={filters.currentOnly} onChange={(event) => updateFilter("currentOnly", event.target.checked)} className="focus-ring size-4 accent-[var(--oxblood)]" />Checked within 30 days</label>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--hairline)] pb-5 text-xs text-[var(--muted-text)]"><p role="status">{now === null ? "Checking listing dates…" : `${listings.length} ${listings.length === 1 ? "listing" : "listings"} · 0 verified listings connected`}</p><p>Choose a currency to filter a budget. No currency conversion.</p><button type="button" onClick={() => setFilters(DEFAULT_FILTERS)} className="focus-ring min-h-11 underline underline-offset-4">Reset filters</button></div>
      {now === null ? <p className="py-20 text-center text-sm text-[var(--muted-text)]">Checking listing availability…</p> : listings.length ? <div className="mt-8 grid items-start gap-x-8 gap-y-12 md:grid-cols-2 xl:grid-cols-3">{listings.map((listing) => <ListingCard key={listing.id} listing={listing} now={now} />)}</div> : <div className="py-20 text-center"><h2 className="display-serif text-4xl">{filters.trust === "verified" ? "Verified inventory is not connected yet." : "No listings match these filters."}</h2><p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-[var(--muted-text)]">{filters.trust === "verified" ? "ARTE will show real listings only after their source, rights, availability, and gallery have been verified. Explore the clearly labeled demo to try the experience." : "Try another currency, widen the price range, or include older sample listings."}</p><button type="button" onClick={() => setFilters(DEFAULT_FILTERS)} className="focus-ring mt-6 min-h-11 border border-[var(--hairline)] px-6 text-xs">Explore demo listings</button></div>}
    </section>
  );
}
