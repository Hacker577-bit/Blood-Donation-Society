import Link from "next/link";
import { BloodDrop } from "./BloodGroupBadge";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border-hairline bg-surface-raised">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 sm:px-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex max-w-sm flex-col gap-3">
            <Link
              href="/"
              className="flex items-center gap-2.5 rounded-md text-ink-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
            >
              <span className="flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-accent to-blood-deep text-accent-on shadow-glow">
                <BloodDrop className="size-5" />
              </span>
              <span className="text-body-large font-bold tracking-tight">
                Lifeline Lahore
              </span>
            </Link>
            <p className="text-meta text-ink-secondary">
              Every drop counts. One-tap Google sign-in, no OTP needed.
            </p>
          </div>

          <nav className="flex flex-col gap-2 text-body" aria-label="Footer">
            <span className="text-label text-ink-secondary">Explore</span>
            <Link
              href="/search"
              className="w-fit text-ink-secondary underline-offset-2 hover:text-ink-primary hover:underline"
            >
              Find blood
            </Link>
            <Link
              href="/register"
              className="w-fit text-ink-secondary underline-offset-2 hover:text-ink-primary hover:underline"
            >
              Become a donor
            </Link>
            <Link
              href="/manage"
              className="w-fit text-ink-secondary underline-offset-2 hover:text-ink-primary hover:underline"
            >
              Dashboard
            </Link>
            <Link
              href="/admin"
              className="w-fit text-ink-secondary underline-offset-2 hover:text-ink-primary hover:underline"
            >
              Admin
            </Link>
          </nav>
        </div>

        <div className="border-t border-border-hairline pt-6">
          <p className="text-meta text-ink-secondary">
            © {new Date().getFullYear()} Lifeline Lahore. Built for the community, with care.
          </p>
        </div>
      </div>
    </footer>
  );
}
