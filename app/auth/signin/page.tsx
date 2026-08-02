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
    <main className="tint-gradient flex min-h-[70vh] items-center justify-center px-4 py-10 sm:px-8">
      <div className="card flex w-full max-w-105 flex-col gap-6 p-6 sm:p-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-display text-ink-primary">Sign in</h1>
          <p className="text-body text-ink-secondary">
            Use your Google account to register as a donor or search for blood.
            No OTP, no phone codes — just one tap.
          </p>
        </div>

        {error ? (
          <p className="rounded-lg border border-status-error/40 bg-status-error-bg px-4 py-3 text-body text-status-error">
            Sign-in failed. Please try again.
          </p>
        ) : null}

        <GoogleSignInButton />

        <p className="text-meta text-ink-secondary">
          Your Google name and email are prefilled automatically so registration
          takes seconds, not minutes.
        </p>
      </div>
    </main>
  );
}
