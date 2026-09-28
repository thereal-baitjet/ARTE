import { CollectionsWorkspace } from "@/components/collections/CollectionsWorkspace";

export default async function CollectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CollectionsWorkspace key={id} initialCollectionId={id} />;
}
