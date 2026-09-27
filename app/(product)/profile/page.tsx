import Link from "next/link";
import { AuthPanel } from "@/components/auth/AuthPanel";

export default function ProfilePage() {
  return <section className="mx-auto max-w-5xl px-6 py-12 md:px-10">
    <p className="text-xs uppercase tracking-[0.22em] text-[var(--muted-text)]">Your ARTE</p>
    <h1 className="display-serif mt-4 text-6xl md:text-8xl">A gallery of your own.</h1>
    <p className="mt-6 max-w-2xl text-sm leading-7 text-[var(--secondary-ink)]">Explore as a guest. Collections and preferences on this device are available without an account. Account features require a connected ARTE backend.</p>
    <nav aria-label="Your gallery" className="my-10 grid gap-4 sm:grid-cols-2">
      {[["Your collections", "/collections", "Return to the works you saved."], ["Your Art DNA", "/profile/taste", "See the patterns in your attention."], ["Shape your taste", "/onboarding", "Choose a few works to guide discovery."], ["Privacy & settings", "/settings", "Control signals and reset your history."], ["Attention trends", "/trending", "See attention without confusing it with quality."]].map(([label, href, detail]) => <Link href={href} key={href} className="focus-ring border border-[var(--hairline)] p-6"><h2 className="display-serif text-3xl">{label}</h2><p className="mt-3 text-sm text-[var(--muted-text)]">{detail}</p></Link>)}
    </nav>
    <AuthPanel />
  </section>;
}
