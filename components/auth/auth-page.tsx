"use client";

import { ArrowRight, Globe2, Loader2, Mail, ShieldCheck } from "lucide-react";
import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type ProviderId = "google" | "facebook" | "apple";

const providers: { id: ProviderId; label: string }[] = [
  { id: "google", label: "Google" },
  { id: "facebook", label: "Facebook" },
  { id: "apple", label: "Apple" }
];

function safeNextFromLocation(): string {
  const params = new URLSearchParams(window.location.search);
  const next = params.get("next");

  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/onboarding";
  }

  return next;
}

async function parseResponse(response: Response) {
  const payload = await response.json();
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error?.message ?? "Request failed");
  }

  return payload.data;
}

export function AuthPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingEmail, setLoadingEmail] = useState(false);
  const [loadingProvider, setLoadingProvider] = useState<ProviderId | null>(null);

  async function requestLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoadingEmail(true);
    setMessage(null);
    setError(null);

    try {
      await parseResponse(
        await fetch("/api/auth/otp", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            email,
            next: safeNextFromLocation()
          })
        })
      );
      setMessage("Check your email for a secure sign-in link.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to send sign-in link.");
    } finally {
      setLoadingEmail(false);
    }
  }

  async function signInWithProvider(provider: ProviderId) {
    setLoadingProvider(provider);
    setMessage(null);
    setError(null);

    const redirectTo = new URL("/auth/callback", window.location.origin);
    redirectTo.searchParams.set("next", safeNextFromLocation());

    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error: providerError } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: redirectTo.toString()
        }
      });

      if (providerError) {
        throw providerError;
      }

      if (data.url) {
        window.location.assign(data.url);
      }
    } catch (providerError) {
      setLoadingProvider(null);
      setError(providerError instanceof Error ? providerError.message : "Unable to start provider sign-in.");
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <section className="border-b bg-[linear-gradient(135deg,rgba(18,122,96,0.12),rgba(218,140,42,0.16))]">
        <div className="mx-auto grid min-h-[76vh] max-w-6xl gap-8 px-5 py-10 md:grid-cols-[1fr_420px] md:px-8 lg:px-10">
          <div className="flex flex-col justify-center">
            <div className="mb-5 flex w-fit items-center gap-2 rounded-md border bg-background px-3 py-1 text-sm text-muted-foreground">
              <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
              Passwordless access
            </div>
            <h1 className="max-w-3xl text-4xl font-semibold tracking-normal text-foreground md:text-6xl">
              FitFox account access
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
              Sign in with a secure email link or your identity provider. Billing and profile setup happen after authentication.
            </p>
          </div>

          <div className="self-center rounded-lg border bg-card p-5 shadow-sm">
            <form className="grid gap-4" onSubmit={requestLink}>
              <label className="grid gap-2 text-sm font-medium">
                Email
                <input
                  autoComplete="email"
                  className="h-11 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  required
                  type="email"
                  value={email}
                />
              </label>
              <Button disabled={loadingEmail || !email} type="submit">
                {loadingEmail ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
                Send secure link
              </Button>
            </form>

            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs uppercase text-muted-foreground">or</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <div className="grid gap-2">
              {providers.map((provider) => (
                <Button
                  disabled={loadingProvider !== null || loadingEmail}
                  key={provider.id}
                  onClick={() => signInWithProvider(provider.id)}
                  type="button"
                  variant="outline"
                >
                  {loadingProvider === provider.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Globe2 className="size-4" />
                  )}
                  Continue with {provider.label}
                  <ArrowRight className="ml-auto size-4" />
                </Button>
              ))}
            </div>

            {message ? (
              <p className="mt-4 rounded-md border border-status-success/40 bg-status-success/10 px-3 py-2 text-sm text-foreground">
                {message}
              </p>
            ) : null}
            {error ? (
              <p className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-foreground">
                {error}
              </p>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}
