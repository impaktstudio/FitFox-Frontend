import { CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function BillingPage() {
  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center gap-6 px-6 py-10">
        <CreditCard className="size-9 text-primary" aria-hidden="true" />
        <div className="grid max-w-3xl gap-3">
          <h1 className="text-4xl font-semibold tracking-normal text-foreground md:text-6xl">Billing</h1>
          <p className="text-base leading-7 text-muted-foreground">
            Checkout and portal actions live behind Stripe-backed APIs; subscription state controls protected product access.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <a href="/api/billing/checkout">Checkout contract</a>
          </Button>
          <Button asChild variant="outline">
            <a href="/api/billing/portal">Portal contract</a>
          </Button>
        </div>
      </section>
    </main>
  );
}
