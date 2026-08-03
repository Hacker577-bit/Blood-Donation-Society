interface AvatarProps {
  name: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const SIZES: Record<NonNullable<AvatarProps["size"]>, string> = {
  sm: "size-8 text-meta",
  md: "size-10 text-body",
  lg: "size-14 text-body-large",
  xl: "size-20 text-heading",
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0].slice(0, 1)}${parts[parts.length - 1].slice(0, 1)}`.toUpperCase();
}

export function Avatar({ name, size = "md", className = "" }: AvatarProps) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent to-blood-deep font-bold text-accent-on shadow-glow ${SIZES[size]} ${className}`}
    >
      {initials(name)}
    </span>
  );
}
