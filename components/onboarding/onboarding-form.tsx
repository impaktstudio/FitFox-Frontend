"use client";

import { Check, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { billingPlans, type BillingPlanId } from "@/lib/billing/plans";
import { cn } from "@/lib/utils";

async function parseResponse(response: Response) {
  const payload = await response.json();
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error?.message ?? "Request failed");
  }

  return payload.data as { next: string };
}

export function OnboardingForm() {
  const [selectedPlanId, setSelectedPlanId] = useState<BillingPlanId>("trial");
  const [fullName, setFullName] = useState("");
  const [rfc, setRfc] = useState("");
  const [requiresCFDI, setRequiresCFDI] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const selectedIndex = billingPlans.findIndex((plan) => plan.id === selectedPlanId);
  const selectedPlan = billingPlans[selectedIndex] ?? billingPlans[0];

  function movePlan(direction: -1 | 1) {
    const nextIndex = (selectedIndex + direction + billingPlans.length) % billingPlans.length;
    setSelectedPlanId(billingPlans[nextIndex].id);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const data = await parseResponse(
        await fetch("/api/onboarding", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            fullName: fullName || undefined,
            billingPlanId: selectedPlan.id,
            rfc: rfc || undefined,
            requiresCFDI
          })
        })
      );
      window.location.assign(data.next);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to save onboarding.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="grid gap-5 rounded-lg border bg-card p-5 shadow-sm" onSubmit={submit}>
      <label className="grid gap-2 text-sm font-medium">
        Name
        <input
          autoComplete="name"
          className="h-11 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          onChange={(event) => setFullName(event.target.value)}
          placeholder="Maya Ellis"
          type="text"
          value={fullName}
        />
      </label>

      <div className="grid gap-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium">Plan</span>
          <div className="flex gap-2">
            <Button onClick={() => movePlan(-1)} size="icon" type="button" variant="outline">
              <ChevronLeft className="size-4" />
            </Button>
            <Button onClick={() => movePlan(1)} size="icon" type="button" variant="outline">
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>

        <div className="rounded-md border bg-muted/40 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-medium">{selectedPlan.name}</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{selectedPlan.description}</p>
            </div>
            <span className="text-sm font-medium">
              {selectedPlan.priceLabel} {selectedPlan.cadence}
            </span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {selectedPlan.features.map((feature) => (
              <span className="inline-flex items-center gap-1 rounded-md border bg-background px-2 py-1 text-xs" key={feature}>
                <Check className="size-3 text-primary" />
                {feature}
              </span>
            ))}
          </div>
        </div>
      </div>

      <label className="grid gap-2 text-sm font-medium">
        RFC
        <input
          className="h-11 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          onChange={(event) => setRfc(event.target.value)}
          placeholder="ABCD010101A12"
          type="text"
          value={rfc}
        />
      </label>

      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          checked={requiresCFDI}
          className="size-4 rounded border"
          onChange={(event) => setRequiresCFDI(event.target.checked)}
          type="checkbox"
        />
        Require CFDI
      </label>

      <Button disabled={loading} type="submit">
        {loading ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
        Save setup
      </Button>

      {error ? (
        <p className={cn("rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-foreground")}>
          {error}
        </p>
      ) : null}
    </form>
  );
}
