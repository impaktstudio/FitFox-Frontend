import { Activity, Database, Flag, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const items = [
  {
    icon: Activity,
    label: "API routes",
    detail: "/api/health, /api/ready",
    status: "configured"
  },
  {
    icon: ShieldCheck,
    label: "Test auth",
    detail: "AUTH_MODE=test with UUID identity",
    status: "configured"
  },
  {
    icon: Flag,
    label: "Feature flags",
    detail: "PostHog first, env fallback",
    status: "configured"
  },
  {
    icon: Database,
    label: "Drizzle schema",
    detail: "Epic 1 plus downstream table contracts",
    status: "configured"
  }
];

export function FoundationStatus() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center gap-8 px-6 py-10">
      <section className="grid gap-5">
        <Badge variant="success" className="w-fit">
          Epic 1 foundation
        </Badge>
        <div className="grid max-w-3xl gap-3">
          <h1 className="text-4xl font-semibold tracking-normal text-foreground">FitFox backend foundation</h1>
          <p className="text-base leading-7 text-muted-foreground">
            Next.js API routes, typed responses, test auth, PostHog feature flags, provider readiness, and Drizzle
            schema contracts are ready for Sprint 1 backend work.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <a href="/api/health">Health</a>
          </Button>
          <Button variant="outline" asChild>
            <a href="/api/ready">Ready</a>
          </Button>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <article className="rounded-lg border bg-card p-5 text-card-foreground" key={item.label}>
              <div className="flex items-start justify-between gap-4">
                <Icon className="mt-1 size-5 text-primary" aria-hidden="true" />
                <Badge variant="outline">{item.status}</Badge>
              </div>
              <h2 className="mt-5 text-lg font-medium">{item.label}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.detail}</p>
            </article>
          );
        })}
      </section>
    </main>
  );
}
