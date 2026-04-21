import { TopologyPage } from "@/components/topology/topology-page";

export default function RecommendationsPage() {
  return (
    <TopologyPage
      badge="BE-20"
      description="Start the recommendation workflow and return ranked looks with scores and refinement targets."
      endpoint="/api/recommendations"
      title="Recommendations"
    />
  );
}
