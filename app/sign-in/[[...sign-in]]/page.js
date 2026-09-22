import { SignIn } from "@clerk/nextjs";
import AccessBoundary from "@/app/nouveau/_components/AccessBoundary";
import { isClerkConfigured } from "@/lib/auth-config";

export const dynamic = "force-dynamic";

export default function Page() {
  if (!isClerkConfigured()) {
    return <AccessBoundary reason="configuration_required"/>;
  }

  return (
    <main className="am-container" style={{ padding: "70px 0" }}>
      <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" fallbackRedirectUrl="/nouveau"/>
    </main>
  );
}
