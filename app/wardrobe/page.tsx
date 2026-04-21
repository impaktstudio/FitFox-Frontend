import { TopologyPage } from "@/components/topology/topology-page";

export default function WardrobePage() {
  return (
    <TopologyPage
      badge="BE-06 / BE-07"
      description="Upload, create, and list user-owned wardrobe items through the thin API layer."
      endpoint="/api/wardrobe-items"
      title="Wardrobe"
    />
  );
}
