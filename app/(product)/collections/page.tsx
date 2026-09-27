import { CollectionsWorkspace } from "@/components/collections/CollectionsWorkspace";
import { getArtworkCatalog } from "@/lib/artworks/feed";

export default function CollectionsPage() {
  return <CollectionsWorkspace artworks={getArtworkCatalog()} />;
}
