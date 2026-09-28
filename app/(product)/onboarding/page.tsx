import { VisualOnboarding } from "@/components/taste/VisualOnboarding";
import { artworkSummary } from "@/lib/artworks/summary";
import { PUBLIC_ARTWORKS } from "@/lib/artworks/publicCatalog";
import { chooseOnboardingWorks } from "@/lib/taste/onboarding";

export default function OnboardingPage() {
  return <VisualOnboarding candidates={chooseOnboardingWorks(PUBLIC_ARTWORKS).map(artworkSummary)} />;
}
