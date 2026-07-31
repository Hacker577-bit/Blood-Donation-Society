import Link from "next/link";

const primaryFork =
  "flex w-full min-h-[48px] items-center justify-center rounded-md bg-accent text-accent-on text-body font-semibold hover:bg-accent-hover transition-colors motion-reduce:transition-none";

const secondaryFork =
  "flex w-full min-h-[48px] items-center justify-center rounded-md border border-border-hairline bg-surface-raised text-ink-primary text-body font-semibold hover:bg-surface-base transition-colors motion-reduce:transition-none";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-140 flex-col gap-6 px-4 py-8 sm:px-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-display text-ink-primary">Lifeline Lahore</h1>
        <p className="text-body text-ink-secondary">
          Connecting people who need blood with donors nearby.
        </p>
      </div>

      <nav className="flex flex-col gap-4">
        <Link href="/search" className={primaryFork}>
          I need blood
        </Link>
        <Link href="/register" className={secondaryFork}>
          I want to help
        </Link>
        <Link href="/manage" className={secondaryFork}>
          Manage my registration
        </Link>
      </nav>
    </main>
  );
}
