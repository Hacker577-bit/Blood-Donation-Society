import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border-hairline bg-surface-raised">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-4 px-4 py-8 sm:flex-row sm:justify-between sm:px-8">
        <p className="text-body font-semibold text-ink-primary">Lifeline Lahore</p>
        <p className="text-meta text-ink-secondary">
          Every drop counts. One-tap Google sign-in, no OTP needed.
        </p>
        <nav className="flex items-center gap-4 text-meta" aria-label="Footer">
          <Link
            href="/search"
            className="text-ink-secondary underline-offset-2 hover:text-ink-primary hover:underline"
          >
            Find blood
          </Link>
          <Link
            href="/register"
            className="text-ink-secondary underline-offset-2 hover:text-ink-primary hover:underline"
          >
            Become a donor
          </Link>
          <Link
            href="/manage"
            className="text-ink-secondary underline-offset-2 hover:text-ink-primary hover:underline"
          >
            Dashboard
          </Link>
          <Link
            href="/admin"
            className="text-ink-secondary underline-offset-2 hover:text-ink-primary hover:underline"
          >
            Admin
          </Link>
        </nav>
      </div>
    </footer>
  );
}
