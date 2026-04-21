import { TopologyPage } from "@/components/topology/topology-page";

export default function StyleProfilePage() {
  return (
    <TopologyPage
      badge="BE-16"
      description="Read and update archetype, preference, and trend-placeholder profile data for recommendations."
      endpoint="/api/me/style-profile"
      title="Style Profile"
    />
  );
}
