"use client";

import { useEffect, useRef, type ReactNode } from "react";

interface RevealProps {
  children: ReactNode;
  className?: string;
  delayMs?: number;
  as?: "div" | "section" | "li" | "article";
}

/**
 * Scroll-reveal wrapper: fades + slides content up the first time it enters
 * the viewport. Falls back to fully visible when JS is unavailable or the
 * user prefers reduced motion (handled in CSS).
 */
export function Reveal({
  children,
  className = "",
  delayMs = 0,
  as = "div",
}: RevealProps) {
  const elementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = elementRef.current;
    if (!el) return;

    if (typeof IntersectionObserver === "undefined") {
      el.classList.add("is-visible");
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            el.classList.add("is-visible");
            observer.disconnect();
          }
        }
      },
      { threshold: 0.12 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const Tag = as;

  return (
    <Tag
      ref={(node: HTMLElement | null) => {
        elementRef.current = node;
      }}
      className={`reveal ${className}`}
      style={delayMs ? { transitionDelay: `${delayMs}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}
