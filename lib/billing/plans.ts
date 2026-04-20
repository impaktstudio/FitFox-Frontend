export type BillingPlanId = "trial" | "weekly" | "monthly" | "annually";

export type BillingPlan = {
  id: BillingPlanId;
  name: string;
  cadence: string;
  priceLabel: string;
  trialDays: number;
  planTier: "free" | "pro";
  description: string;
  features: string[];
};

export const billingPlans = [
  {
    id: "trial",
    name: "Free trial",
    cadence: "7 days",
    priceLabel: "$0",
    trialDays: 7,
    planTier: "pro",
    description: "Start with the complete styling workflow before choosing a paid cadence.",
    features: ["Full closet upload", "Outfit generation", "Export previews"]
  },
  {
    id: "weekly",
    name: "Weekly",
    cadence: "per week",
    priceLabel: "$4",
    trialDays: 0,
    planTier: "pro",
    description: "Short-cycle access for active trip, shoot, or wardrobe planning weeks.",
    features: ["Priority look refreshes", "Weekly style reports", "Share links"]
  },
  {
    id: "monthly",
    name: "Monthly",
    cadence: "per month",
    priceLabel: "$12",
    trialDays: 0,
    planTier: "pro",
    description: "A steady plan for everyday outfit decisions and seasonal closet work.",
    features: ["Unlimited saved looks", "Trend-aware recommendations", "Closet insights"]
  },
  {
    id: "annually",
    name: "Annually",
    cadence: "per year",
    priceLabel: "$96",
    trialDays: 0,
    planTier: "pro",
    description: "Best value for ongoing wardrobe intelligence and long-term style history.",
    features: ["Two months included", "Annual closet audit", "Founder-style export priority"]
  }
] as const satisfies readonly BillingPlan[];

export function getBillingPlan(planId: string): BillingPlan | null {
  return billingPlans.find((plan) => plan.id === planId) ?? null;
}
