import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type TopologyPageProps = {
  title: string;
  badge: string;
  description: string;
  endpoint: string;
};

export function TopologyPage({ title, badge, description, endpoint }: TopologyPageProps) {
  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center gap-6 px-6 py-10">
        <Badge className="w-fit" variant="secondary">
          {badge}
        </Badge>
        <div className="grid max-w-3xl gap-3">
          <h1 className="text-4xl font-semibold tracking-normal text-foreground md:text-6xl">{title}</h1>
          <p className="text-base leading-7 text-muted-foreground">{description}</p>
        </div>
        <Button asChild className="w-fit" variant="outline">
          <a href={endpoint}>
            API contract
            <ArrowRight className="size-4" />
          </a>
        </Button>
      </section>
    </main>
  );
}
