import { Badge } from "@/components/ui/badge";
import { OnboardingForm } from "@/components/onboarding/onboarding-form";

export default function OnboardingPage() {
  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto grid min-h-screen max-w-6xl gap-8 px-5 py-10 md:grid-cols-[1fr_460px] md:px-8 lg:px-10">
        <div className="flex flex-col justify-center">
          <Badge className="mb-5 w-fit" variant="secondary">
            Account setup
          </Badge>
          <h1 className="max-w-3xl text-4xl font-semibold tracking-normal text-foreground md:text-6xl">
            Choose your FitFox plan
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
            Profile and billing metadata are attached after authentication, so OTP and provider sign-ins use the same setup path.
          </p>
        </div>
        <div className="self-center">
          <OnboardingForm />
        </div>
      </section>
    </main>
  );
}
