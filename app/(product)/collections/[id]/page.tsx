import { CollectionsWorkspace } from "@/components/collections/CollectionsWorkspace";
import { getArtworkCatalog } from "@/lib/artworks/feed";

export default async function CollectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CollectionsWorkspace key={id} artworks={getArtworkCatalog()} initialCollectionId={id} />;
}
