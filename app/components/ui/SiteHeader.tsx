"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { BloodDrop } from "./BloodGroupBadge";

const NAV_ITEMS = [
  { href: "/search", label: "Find blood" },
  { href: "/register", label: "Become a donor" },
  { href: "/manage", label: "My dashboard" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const isSignedIn = status === "authenticated";
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  return (
    <header className="glass sticky top-0 z-50 border-b border-border-hairline">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-8">
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-md text-ink-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
          aria-label="Lifeline Lahore home"
        >
          <span className="flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-accent to-blood-deep text-accent-on shadow-glow">
            <BloodDrop className="size-5" />
          </span>
          <span className="text-body-large font-bold tracking-tight">
            Lifeline Lahore
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
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

        <div className="hidden items-center gap-2 md:flex">
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

        <button
          type="button"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
          className="flex size-11 items-center justify-center rounded-lg text-ink-primary transition-colors hover:bg-surface-overlay focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring md:hidden"
        >
          {menuOpen ? (
            <svg viewBox="0 0 24 24" className="size-6" fill="none" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="size-6" fill="none" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          )}
        </button>
      </div>

      {menuOpen ? (
        <div className="glass border-t border-border-hairline md:hidden">
          <nav className="mx-auto flex w-full max-w-6xl flex-col gap-1 px-4 py-4 sm:px-8" aria-label="Mobile">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex min-h-[48px] items-center rounded-lg px-4 text-body transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring ${
                    active
                      ? "bg-accent-soft font-semibold text-accent"
                      : "text-ink-primary hover:bg-surface-overlay"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
            <div className="mt-2 border-t border-border-hairline pt-3">
              {isSignedIn ? (
                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="flex min-h-[48px] w-full items-center rounded-lg px-4 text-body font-semibold text-ink-secondary transition-colors hover:bg-surface-overlay focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                >
                  Sign out
                </button>
              ) : (
                <Link
                  href="/auth/signin"
                  className="flex min-h-[48px] w-full items-center justify-center rounded-lg bg-accent px-4 text-body font-semibold text-accent-on shadow-glow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                >
                  Sign in
                </Link>
              )}
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
