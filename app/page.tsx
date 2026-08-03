import Link from "next/link";
import { BloodDrop } from "@/app/components/ui/BloodGroupBadge";
import { Card } from "@/app/components/ui/Card";
import { Reveal } from "@/app/components/ui/Reveal";

const forkBase =
  "inline-flex w-full min-h-[48px] items-center justify-center gap-2 rounded-lg px-6 text-button font-semibold transition-all duration-200 motion-reduce:transition-none hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring";

const primaryFork = `${forkBase} bg-white text-accent shadow-lift hover:bg-white/90`;
const secondaryFork = `${forkBase} border border-white/60 text-white hover:bg-white/10 hover:border-white`;

const STATS = [
  { value: "8", label: "Blood types", tone: "brand" as const },
  { value: "10", label: "Areas in Lahore", tone: "success" as const },
  { value: "90 days", label: "Safety window", tone: "info" as const },
  { value: "1 tap", label: "Google sign-in", tone: "warning" as const },
];

const STEPS = [
  {
    number: "01",
    title: "Sign in with Google",
    body: "No OTP, no phone codes. One tap with your Google account — fast and secure.",
    icon: (
      <svg viewBox="0 0 24 24" className="size-6" fill="none" aria-hidden="true">
        <path d="M3 12h4l3-8 4 16 3-8h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    number: "02",
    title: "Find a match",
    body: "Tell us the blood type you need and your area. We instantly match eligible donors nearby.",
    icon: (
      <svg viewBox="0 0 24 24" className="size-6" fill="none" aria-hidden="true">
        <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
        <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    number: "03",
    title: "Reach out & save a life",
    body: "Every matched donor is notified and can be called directly. That's it — you save a life.",
    icon: (
      <svg viewBox="0 0 24 24" className="size-6" fill="none" aria-hidden="true">
        <path d="M12 2.6c2.4 3.2 7 8.6 7 13.1A7 7 0 0 1 5 15.7C5 11.2 9.6 5.8 12 2.6Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      </svg>
    ),
  },
];

const WHY = [
  {
    title: "Verified & trustworthy",
    body: "Donors sign in with Google, so every profile is backed by a real, verified identity.",
    tone: "text-accent bg-accent-soft",
    icon: (
      <svg viewBox="0 0 24 24" className="size-6" fill="none" aria-hidden="true">
        <path d="M12 3 5 6v5c0 5 3.1 8.6 7 10 3.9-1.4 7-5 7-10V6l-7-3Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <path d="m9 12 2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: "Your safety first",
    body: "A 90-day cooldown after each donation keeps recipients and donors safe by design.",
    tone: "text-status-success bg-status-success-bg",
    icon: (
      <svg viewBox="0 0 24 24" className="size-6" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
        <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: "Free for everyone",
    body: "No subscription, no hidden cost. Blood donation is a gift — the platform is too.",
    tone: "text-sky bg-sky-soft",
    icon: (
      <svg viewBox="0 0 24 24" className="size-6" fill="none" aria-hidden="true">
        <path d="M12 21s-7-4.5-9-9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c-2 4.5-9 9-9 9Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: "Built for Lahore",
    body: "Ten neighbourhoods, matched locally so help is always close when it matters.",
    tone: "text-status-caution bg-status-caution-bg",
    icon: (
      <svg viewBox="0 0 24 24" className="size-6" fill="none" aria-hidden="true">
        <path d="M12 21s7-6.5 7-11a7 7 0 1 0-14 0c0 4.5 7 11 7 11Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="2" />
      </svg>
    ),
  },
];

const TESTIMONIALS = [
  {
    name: "Ayesha R.",
    role: "Donor · Johar Town",
    quote:
      "I registered in under a minute. A few weeks later, someone two streets away needed my blood type — I was there in fifteen minutes.",
  },
  {
    name: "Bilal S.",
    role: "Donor · Gulberg",
    quote:
      "The Google sign-in made it effortless. No forms to dig through, just my type, my area, and a clear 'eligible now'.",
  },
  {
    name: "Fatima K.",
    role: "Donor · Model Town",
    quote:
      "It's the first donation platform that feels designed around donors. Trustworthy, clean, and genuinely fast.",
  },
];

const FAQS = [
  {
    q: "How long does it take to register?",
    a: "About a minute. Sign in with Google, add your blood type and area, and you're discoverable. No OTP, no verification wait.",
  },
  {
    q: "Who can register as a donor?",
    a: "Anyone with a Google account who is willing to donate blood and is eligible to do so. You keep your last donation date updated from your dashboard.",
  },
  {
    q: "Is my information kept private?",
    a: "Yes. Only searchers who specifically need your blood type in your area can see your name and phone number. Your Google identity is never shared publicly.",
  },
  {
    q: "How does the 90-day safety window work?",
    a: "After a donation, you become 'eligible again' once 90 days pass. Searchers only reach donors who are currently eligible — keeping everyone safe.",
  },
];

export default function Home() {
  return (
    <main>
      {/* ============ Hero ============ */}
      <section className="hero-gradient relative overflow-hidden text-white">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-24 top-10 size-72 rounded-full bg-white/10 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 bottom-0 size-80 rounded-full bg-accent-on/10 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute right-8 top-8 hidden animate-float lg:block"
        >
          <span className="flex size-20 items-center justify-center rounded-full bg-white/10 backdrop-blur">
            <BloodDrop className="size-10 text-white/90" />
          </span>
        </div>

        <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-16 sm:px-8 sm:py-24">
          <div className="flex max-w-2xl flex-col gap-5">
            <p className="animate-fade-up inline-flex w-fit items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-meta font-semibold backdrop-blur">
              <span className="size-2 rounded-full bg-white animate-pulse-soft" aria-hidden="true" />
              Fast · Free · Verified with Google
            </p>
            <h1 className="animate-fade-up text-balance text-4xl font-extrabold leading-tight tracking-tight sm:text-6xl">
              Give blood. <span className="text-white/90">Give hope.</span>
            </h1>
            <p className="animate-fade-up text-body-large text-white/90 sm:max-w-xl" style={{ animationDelay: "60ms" }}>
              Lifeline Lahore connects people who need blood with verified donors
              nearby — in under a minute, with no OTP and no sign-up friction.
            </p>
          </div>

          <div
            className="animate-fade-up grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
            style={{ animationDelay: "120ms" }}
          >
            {STATS.map((stat) => (
              <div
                key={stat.label}
                className={`flex flex-col gap-1 rounded-xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur transition-transform duration-200 hover:-translate-y-0.5`}
              >
                <span className="text-2xl font-bold">{stat.value}</span>
                <span className="text-meta text-white/85">{stat.label}</span>
              </div>
            ))}
          </div>

          <nav
            className="animate-fade-up flex max-w-xl flex-col gap-3 sm:flex-row"
            aria-label="Get started"
            style={{ animationDelay: "180ms" }}
          >
            <Link href="/search" className={`${primaryFork} sm:flex-none sm:flex-1`}>
              I need blood
            </Link>
            <Link href="/register" className={`${secondaryFork} sm:flex-1`}>
              I want to help
            </Link>
            <Link href="/manage" className={`${secondaryFork} sm:flex-1`}>
              Manage my registration
            </Link>
          </nav>
        </div>
      </section>

      {/* ============ How it works ============ */}
      <section className="tint-gradient">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-16 sm:px-8">
          <Reveal className="flex max-w-xl flex-col gap-2">
            <p className="text-label font-semibold uppercase tracking-wide text-accent">
              How it works
            </p>
            <h2 className="text-balance text-heading text-ink-primary sm:text-3xl">
              From tap to life saved in three steps
            </h2>
            <p className="text-body text-ink-secondary">
              A donation platform built around speed and trust.
            </p>
          </Reveal>

          <ol className="grid gap-5 md:grid-cols-3">
            {STEPS.map((step, index) => (
              <Reveal key={step.title} as="li" delayMs={index * 90}>
                <Card hover padding="lg" className="flex h-full flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <span className="flex size-11 items-center justify-center rounded-xl bg-accent-soft text-accent">
                      {step.icon}
                    </span>
                    <span className="text-meta font-bold tracking-wider text-ink-disabled">
                      {step.number}
                    </span>
                  </div>
                  <h3 className="text-body-large font-semibold text-ink-primary">
                    {step.title}
                  </h3>
                  <p className="text-meta text-ink-secondary">{step.body}</p>
                </Card>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* ============ Why donate ============ */}
      <section>
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-16 sm:px-8">
          <Reveal className="flex max-w-xl flex-col gap-2">
            <p className="text-label font-semibold uppercase tracking-wide text-accent">
              Why donate
            </p>
            <h2 className="text-balance text-heading text-ink-primary sm:text-3xl">
              One donation can save three lives
            </h2>
            <p className="text-body text-ink-secondary">
              It takes courage and a few minutes. It changes everything.
            </p>
          </Reveal>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {WHY.map((item, index) => (
              <Reveal key={item.title} delayMs={index * 70}>
                <Card hover padding="lg" className="flex h-full flex-col gap-4">
                  <span className={`flex size-11 items-center justify-center rounded-xl ${item.tone}`}>
                    {item.icon}
                  </span>
                  <h3 className="text-body-large font-semibold text-ink-primary">
                    {item.title}
                  </h3>
                  <p className="text-meta text-ink-secondary">{item.body}</p>
                </Card>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ============ Impact stats band ============ */}
      <section className="hero-gradient">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-8 px-4 py-14 text-white sm:px-8 lg:grid-cols-4">
          {[
            { value: "3", label: "lives saved per donation" },
            { value: "10", label: "neighbourhoods covered" },
            { value: "90", label: "days between donations" },
            { value: "100%", label: "free, always" },
          ].map((stat, index) => (
            <Reveal key={stat.label} delayMs={index * 70} className="flex flex-col gap-1">
              <span className="text-3xl font-bold sm:text-4xl">{stat.value}</span>
              <span className="text-meta text-white/85">{stat.label}</span>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ============ Testimonials ============ */}
      <section className="tint-gradient">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-16 sm:px-8">
          <Reveal className="flex max-w-xl flex-col gap-2">
            <p className="text-label font-semibold uppercase tracking-wide text-accent">
              Community stories
            </p>
            <h2 className="text-balance text-heading text-ink-primary sm:text-3xl">
              Donors who answered the call
            </h2>
          </Reveal>

          <div className="grid gap-5 md:grid-cols-3">
            {TESTIMONIALS.map((t, index) => (
              <Reveal key={t.name} as="li" delayMs={index * 90}>
                <Card hover padding="lg" className="flex h-full flex-col gap-4">
                  <svg viewBox="0 0 24 24" className="size-7 text-accent" fill="currentColor" aria-hidden="true">
                    <path d="M10 7H6a3 3 0 0 0-3 3v3a3 3 0 0 0 3 3h2a3 3 0 0 0 3-3v-6a4 4 0 0 0-4-4 1 1 0 0 0 0 2 2 2 0 0 1 2 2Zm11 0h-4a3 3 0 0 0-3 3v3a3 3 0 0 0 3 3h2a3 3 0 0 0 3-3v-6a4 4 0 0 0-4-4 1 1 0 0 0 0 2 2 2 0 0 1 2 2Z" />
                  </svg>
                  <blockquote className="text-body text-ink-secondary">
                    &ldquo;{t.quote}&rdquo;
                  </blockquote>
                  <div className="mt-auto flex items-center gap-3">
                    <span className="flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-accent to-blood-deep text-meta font-bold text-accent-on">
                      {t.name.split(" ").map((n) => n[0]).join("")}
                    </span>
                    <div className="flex flex-col">
                      <span className="text-body font-semibold text-ink-primary">{t.name}</span>
                      <span className="text-meta text-ink-secondary">{t.role}</span>
                    </div>
                  </div>
                </Card>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ============ FAQ ============ */}
      <section>
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-4 py-16 sm:px-8">
          <Reveal className="flex flex-col gap-2 text-center">
            <p className="text-label font-semibold uppercase tracking-wide text-accent">
              FAQ
            </p>
            <h2 className="text-balance text-heading text-ink-primary sm:text-3xl">
              Questions, answered
            </h2>
          </Reveal>

          <div className="flex flex-col gap-3">
            {FAQS.map((faq, index) => (
              <Reveal key={faq.q} delayMs={index * 60}>
                <details className="card group overflow-hidden">
                  <summary className="flex min-h-[56px] cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-body font-semibold text-ink-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring [&::-webkit-details-marker]:hidden">
                    {faq.q}
                    <svg
                      viewBox="0 0 24 24"
                      className="size-5 shrink-0 text-ink-secondary transition-transform duration-200 group-open:rotate-45"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </summary>
                  <p className="border-t border-border-hairline px-5 py-4 text-body text-ink-secondary">
                    {faq.a}
                  </p>
                </details>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ============ Closing CTA ============ */}
      <section className="tint-gradient">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-6 px-4 py-16 text-center sm:px-8">
          <Reveal className="flex flex-col items-center gap-4">
            <span className="flex size-14 items-center justify-center rounded-full bg-accent text-accent-on shadow-glow">
              <BloodDrop className="size-7" />
            </span>
            <h2 className="max-w-2xl text-balance text-heading text-ink-primary sm:text-3xl">
              Ready to make the difference?
            </h2>
            <p className="max-w-lg text-body text-ink-secondary">
              Whether you&apos;re searching for a match or offering your own blood,
              every minute counts. Join your neighbours today — the buttons above
              are all it takes.
            </p>
          </Reveal>
        </div>
      </section>
    </main>
  );
}
