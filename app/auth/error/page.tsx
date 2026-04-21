import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AuthErrorPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center px-6 py-10">
      <div className="grid gap-5">
        <AlertTriangle className="size-9 text-destructive" aria-hidden="true" />
        <div className="grid gap-3">
          <h1 className="text-4xl font-semibold tracking-normal">Sign-in link expired</h1>
          <p className="text-base leading-7 text-muted-foreground">
            Request a new link to continue into FitFox.
          </p>
        </div>
        <Button asChild className="w-fit">
          <a href="/auth">Return to sign in</a>
        </Button>
      </div>
    </main>
  );
}
