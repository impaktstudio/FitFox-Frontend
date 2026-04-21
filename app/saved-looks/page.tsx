import { TopologyPage } from "@/components/topology/topology-page";

export default function SavedLooksPage() {
  return (
    <TopologyPage
      badge="BE-23"
      description="List saved looks in reverse chronological order for repeat use and memory."
      endpoint="/api/saved-looks"
      title="Saved Looks"
    />
  );
}
