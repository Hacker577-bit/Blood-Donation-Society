import Link from "next/link";

const forkBase =
  "flex w-full min-h-[48px] items-center justify-center gap-2 rounded-lg px-6 text-body font-semibold transition-transform motion-reduce:transition-none hover:-translate-y-0.5";

const primaryFork = `${forkBase} bg-accent text-accent-on shadow-glow hover:bg-accent-hover`;
const secondaryFork = `${forkBase} border border-white/30 bg-white/95 text-ink-primary hover:bg-white`;

const STATS = [
  { value: "8", label: "Blood types" },
  { value: "10", label: "Areas in Lahore" },
  { value: "90 days", label: "Safety window" },
  { value: "1 tap", label: "Google sign-in" },
];

const STEPS = [
  {
    title: "Sign in with Google",
    body: "No OTP, no phone codes. One tap with your Google account — fast and secure.",
  },
  {
    title: "Find a match",
    body: "Tell us the blood type you need and your area. We instantly match eligible donors nearby.",
  },
  {
    title: "Reach out & save a life",
    body: "Every matched donor is notified and can be called directly. That's it — you save a life.",
  },
];

export default function Home() {
  return (
    <main>
      <section className="hero-gradient text-white">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-14 sm:px-8 sm:py-20">
          <div className="flex max-w-2xl flex-col gap-4">
            <p className="inline-flex w-fit items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-meta font-semibold backdrop-blur">
              <span className="size-2 rounded-full bg-white" aria-hidden="true" />
              Fast · Free · Verified with Google
            </p>
            <h1 className="text-balance text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
              Lifeline Lahore
            </h1>
            <p className="text-balance text-body-large text-white/90">
              Connecting people who need blood with donors nearby — in under a
              minute, with no OTP and no sign-up friction.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            {STATS.map((stat) => (
              <div
                key={stat.label}
                className="flex flex-col gap-1 rounded-lg bg-white/10 px-4 py-3 backdrop-blur"
              >
                <span className="text-2xl font-bold">{stat.value}</span>
                <span className="text-meta text-white/85">{stat.label}</span>
              </div>
            ))}
          </div>

          <nav className="flex max-w-xl flex-col gap-3" aria-label="Get started">
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
        </div>
      </section>

      <section className="tint-gradient">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-12 sm:px-8">
          <div className="flex flex-col gap-2">
            <h2 className="text-heading text-ink-primary">How it works</h2>
            <p className="text-body text-ink-secondary">
              A donation platform built around speed and trust.
            </p>
          </div>

          <ol className="grid gap-4 sm:grid-cols-3">
            {STEPS.map((step, index) => (
              <li key={step.title} className="card flex flex-col gap-2 p-5">
                <span className="flex size-8 items-center justify-center rounded-full bg-accent-soft text-body font-bold text-accent">
                  {index + 1}
                </span>
                <h3 className="text-body-large font-semibold text-ink-primary">
                  {step.title}
                </h3>
                <p className="text-meta text-ink-secondary">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </main>
  );
}
