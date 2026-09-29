import { AuthPanel } from "@/components/auth/AuthPanel";
import { PrivacySettings } from "@/components/settings/PrivacySettings";

export const metadata = { title: "Privacy & settings", robots: { index: false, follow: false } };

export default function SettingsPage() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-12 md:px-10 md:py-20">
      <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--muted-text)]">Your ARTE</p>
      <h1 className="display-serif mt-4 text-5xl leading-[1.08] md:text-7xl">Privacy & settings</h1>
      <p className="mt-6 max-w-2xl text-base leading-8 text-[var(--secondary-ink)]">A gallery at your pace, with choices that stay in your hands.</p>
      <section aria-labelledby="settings-account-heading" className="mt-12 border-t border-[var(--hairline)] pt-8">
        <h2 id="settings-account-heading" className="display-serif mb-6 text-3xl">Your account</h2>
        <AuthPanel compact />
      </section>
      <div className="mt-12 border-t border-[var(--hairline)] pt-8"><PrivacySettings /></div>
    </section>
  );
}
