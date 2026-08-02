"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";

function BloodDrop() {
  return (
    <svg viewBox="0 0 24 24" className="size-6" aria-hidden="true" fill="currentColor">
      <path d="M12 2.6c2.4 3.2 7 8.6 7 13.1A7 7 0 0 1 5 15.7C5 11.2 9.6 5.8 12 2.6Z" />
    </svg>
  );
}

const NAV_ITEMS = [
  { href: "/search", label: "Find blood" },
  { href: "/register", label: "Become a donor" },
  { href: "/manage", label: "My dashboard" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const isSignedIn = status === "authenticated";

  return (
    <header className="sticky top-0 z-50 border-b border-border-hairline bg-surface-base/85 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-8">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-md text-ink-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
        >
          <span className="flex size-9 items-center justify-center rounded-full bg-accent text-accent-on shadow-glow">
            <BloodDrop />
          </span>
          <span className="text-body-large font-bold tracking-tight">
            Lifeline Lahore
          </span>
        </Link>

        <nav className="flex items-center gap-1" aria-label="Primary">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-md px-3 py-2 text-body transition-colors motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring ${
                  active
                    ? "font-semibold text-accent"
                    : "text-ink-secondary hover:bg-surface-overlay hover:text-ink-primary"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center">
          {isSignedIn ? (
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/" })}
              className="rounded-md px-3 py-2 text-body font-semibold text-ink-secondary transition-colors motion-reduce:transition-none hover:bg-surface-overlay hover:text-ink-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
            >
              Sign out
            </button>
          ) : (
            <Link
              href="/auth/signin"
              className="rounded-md px-4 py-2 text-body font-semibold text-accent transition-colors motion-reduce:transition-none hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
