"use client";

import { Check, ChevronLeft, ChevronRight, Loader2, LogIn, LogOut, Sparkles, UserPlus } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { billingPlans, type BillingPlanId } from "@/lib/billing/plans";
import { cn } from "@/lib/utils";

type AuthMode = "signup" | "signin";
type AuthResult = {
  ok: boolean;
  message: string;
};

async function authRequest(path: string, body?: Record<string, unknown>) {
  const response = await fetch(path, {
    method: body ? "POST" : "GET",
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  const payload = await response.json();

  if (!response.ok || !payload.ok) {
    throw new Error(payload.error?.message ?? "Request failed");
  }

  return payload.data;
}

export function AuthShowcase() {
  const [mode, setMode] = useState<AuthMode>("signup");
  const [selectedPlanId, setSelectedPlanId] = useState<BillingPlanId>("trial");
  const [email, setEmail] = useState("maya@example.com");
  const [password, setPassword] = useState("password123");
  const [fullName, setFullName] = useState("Maya Ellis");
  const [result, setResult] = useState<AuthResult | null>(null);
  const [loading, setLoading] = useState(false);

  const selectedIndex = billingPlans.findIndex((plan) => plan.id === selectedPlanId);
  const selectedPlan = billingPlans[selectedIndex] ?? billingPlans[0];
  const visiblePlans = useMemo(() => {
    const previous = billingPlans[(selectedIndex - 1 + billingPlans.length) % billingPlans.length];
    const current = billingPlans[selectedIndex] ?? billingPlans[0];
    const next = billingPlans[(selectedIndex + 1) % billingPlans.length];

    return [previous, current, next];
  }, [selectedIndex]);

  function movePlan(direction: -1 | 1) {
    const nextIndex = (selectedIndex + direction + billingPlans.length) % billingPlans.length;
    setSelectedPlanId(billingPlans[nextIndex].id);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const path = mode === "signup" ? "/api/auth/signup" : "/api/auth/signin";
      const data = await authRequest(path, {
        email,
        password,
        fullName,
        billingPlanId: selectedPlan.id
      });
      const suffix = mode === "signup" && data.emailConfirmationRequired ? " Check email confirmation settings." : "";
      setResult({
        ok: true,
        message: `${mode === "signup" ? "Signed up" : "Signed in"} as ${data.user.email ?? email}.${suffix}`
      });
    } catch (error) {
      setResult({
        ok: false,
        message: error instanceof Error ? error.message : "Auth request failed"
      });
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    setLoading(true);
    setResult(null);

    try {
      await authRequest("/api/auth/signout", {});
      setResult({ ok: true, message: "Signed out and cleared the local auth cookies." });
    } catch (error) {
      setResult({
        ok: false,
        message: error instanceof Error ? error.message : "Sign out failed"
      });
    } finally {
      setLoading(false);
    }
  }

  async function checkSession() {
    setLoading(true);
    setResult(null);

    try {
      const data = await authRequest("/api/auth/session");
      setResult({ ok: true, message: `Active session: ${data.user.email ?? data.user.id}` });
    } catch (error) {
      setResult({
        ok: false,
        message: error instanceof Error ? error.message : "Session check failed"
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <section className="border-b bg-[linear-gradient(135deg,rgba(18,122,96,0.12),rgba(218,140,42,0.16))]">
        <div className="mx-auto grid min-h-[54vh] max-w-7xl gap-8 px-5 py-10 md:grid-cols-[1fr_420px] md:px-8 lg:px-10">
          <div className="flex flex-col justify-center">
            <Badge className="mb-5 w-fit" variant="secondary">
              Auth billing throwaway
            </Badge>
            <h1 className="max-w-3xl text-4xl font-semibold tracking-normal text-foreground md:text-6xl">
              FitFox account setup
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
              Supabase Auth sign in and sign up connected to a billing choice: 7-day free trial, weekly,
              monthly, or annual access.
            </p>
          </div>

          <form className="self-center rounded-lg border bg-card p-5 shadow-sm" onSubmit={submit}>
            <div className="mb-4 flex rounded-md border bg-muted p-1">
              <button
                className={cn(
                  "h-9 flex-1 rounded-sm text-sm font-medium",
                  mode === "signup" ? "bg-background shadow-sm" : "text-muted-foreground"
                )}
                onClick={() => setMode("signup")}
                type="button"
              >
                Sign up
              </button>
              <button
                className={cn(
                  "h-9 flex-1 rounded-sm text-sm font-medium",
                  mode === "signin" ? "bg-background shadow-sm" : "text-muted-foreground"
                )}
                onClick={() => setMode("signin")}
                type="button"
              >
                Sign in
              </button>
            </div>

            <label className="mb-3 block text-sm font-medium">
              Email
              <input
                className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                value={email}
              />
            </label>
            <label className="mb-3 block text-sm font-medium">
              Password
              <input
                className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                value={password}
              />
            </label>
            {mode === "signup" ? (
              <label className="mb-4 block text-sm font-medium">
                Name
                <input
                  className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                  onChange={(event) => setFullName(event.target.value)}
                  type="text"
                  value={fullName}
                />
              </label>
            ) : null}

            <div className="mb-4 rounded-md border bg-muted/50 p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium">{selectedPlan.name}</span>
                <span className="text-sm text-muted-foreground">
                  {selectedPlan.priceLabel} {selectedPlan.cadence}
                </span>
              </div>
            </div>

            <Button className="w-full" disabled={loading} type="submit">
              {loading ? <Loader2 className="size-4 animate-spin" /> : mode === "signup" ? <UserPlus className="size-4" /> : <LogIn className="size-4" />}
              {mode === "signup" ? "Create account" : "Sign in"}
            </Button>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button disabled={loading} onClick={checkSession} type="button" variant="outline">
                <Sparkles className="size-4" />
                Session
              </Button>
              <Button disabled={loading} onClick={signOut} type="button" variant="outline">
                <LogOut className="size-4" />
                Sign out
              </Button>
            </div>

            {result ? (
              <p className={cn("mt-4 rounded-md border p-3 text-sm", result.ok ? "border-status-success text-status-success" : "border-destructive text-destructive")}>
                {result.message}
              </p>
            ) : null}
          </form>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-8 md:px-8 lg:px-10">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold">Payment carousel</h2>
            <p className="mt-1 text-sm text-muted-foreground">Choose the billing match used during sign up.</p>
          </div>
          <div className="flex gap-2">
            <Button aria-label="Previous plan" onClick={() => movePlan(-1)} size="icon" type="button" variant="outline">
              <ChevronLeft className="size-4" />
            </Button>
            <Button aria-label="Next plan" onClick={() => movePlan(1)} size="icon" type="button" variant="outline">
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {visiblePlans.map((plan) => {
            const selected = plan.id === selectedPlan.id;

            return (
              <article
                className={cn(
                  "rounded-lg border bg-card p-5 text-card-foreground shadow-sm transition",
                  selected ? "border-primary ring-2 ring-primary/25" : "opacity-80"
                )}
                key={plan.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-semibold">{plan.name}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
                  </div>
                  {selected ? <Badge>Selected</Badge> : null}
                </div>
                <div className="mt-5 flex items-end gap-2">
                  <span className="text-4xl font-semibold">{plan.priceLabel}</span>
                  <span className="pb-1 text-sm text-muted-foreground">{plan.cadence}</span>
                </div>
                <ul className="mt-5 space-y-3 text-sm">
                  {plan.features.map((feature) => (
                    <li className="flex gap-2" key={feature}>
                      <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className="mt-5 w-full"
                  onClick={() => setSelectedPlanId(plan.id)}
                  type="button"
                  variant={selected ? "default" : "outline"}
                >
                  Match this tier
                </Button>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
