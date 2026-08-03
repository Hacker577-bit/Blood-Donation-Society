import type { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
}

const PADDING: Record<NonNullable<CardProps["padding"]>, string> = {
  none: "",
  sm: "p-4",
  md: "p-5",
  lg: "p-6 sm:p-8",
};

export function Card({
  hover = false,
  padding = "md",
  className = "",
  ...rest
}: CardProps) {
  return (
    <div
      className={`card ${hover ? "card-hover" : ""} ${PADDING[padding]} ${className}`}
      {...rest}
    />
  );
}
