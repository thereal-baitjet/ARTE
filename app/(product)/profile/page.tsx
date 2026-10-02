import { AccountOverview } from "@/components/auth/AccountOverview";
import { PUBLIC_ARTWORKS } from "@/lib/artworks/publicCatalog";

export const metadata = { title: "Your ARTE", robots: { index: false, follow: false } };

export default function ProfilePage() {
  const { id, slug } = PUBLIC_ARTWORKS[0];
  return <AccountOverview corridorArtwork={{ id, slug }} />;
}
