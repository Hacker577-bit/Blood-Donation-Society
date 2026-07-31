import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { GoogleSignInButton } from "@/app/components/ui/GoogleSignInButton";
import { findDonorByGoogleId } from "@/lib/infra/repositories/donorRepository";

export default async function ManagePage() {
  const session = await auth();

  if (session?.user?.id) {
    const donor = await findDonorByGoogleId(session.user.id);

    if (donor && donor.isVerified) {
      redirect("/manage/dashboard");
    }

    redirect("/register");
  }

  return (
    <main className="mx-auto flex w-full max-w-140 flex-col gap-6 px-4 py-8 sm:px-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-heading text-ink-primary">Manage your registration</h1>
        <p className="text-body text-ink-secondary">
          Sign in with the Google account you registered with to view your donor dashboard.
        </p>
      </div>

      <GoogleSignInButton />

      <p className="text-meta text-ink-secondary">
        Haven&apos;t registered yet?{" "}
        <a href="/register" className="text-accent underline-offset-2 hover:underline">
          Register as a donor
        </a>
      </p>
    </main>
  );
}
