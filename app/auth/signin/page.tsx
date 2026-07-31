import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { GoogleSignInButton } from "@/app/components/ui/GoogleSignInButton";

interface SignInPageProps {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const session = await auth();
  const { callbackUrl, error } = await searchParams;

  if (session?.user) {
    redirect(callbackUrl && callbackUrl.startsWith("/") ? callbackUrl : "/");
  }

  return (
    <main className="mx-auto flex w-full max-w-105 flex-col gap-6 px-4 py-8 sm:px-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-display text-ink-primary">Sign in</h1>
        <p className="text-body text-ink-secondary">
          Use your Google account to register as a donor or search for blood.
        </p>
      </div>

      {error ? (
        <p className="rounded-xl border border-border-critical bg-surface-critical px-4 py-3 text-body text-ink-critical">
          Sign-in failed. Please try again.
        </p>
      ) : null}

      <GoogleSignInButton />
    </main>
  );
}
