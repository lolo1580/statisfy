import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-border bg-surface/70 p-5 backdrop-blur ${className}`}
    >
      {children}
    </div>
  );
}

export function SectionTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {subtitle ? (
          <p className="mt-0.5 text-sm text-muted">{subtitle}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wider text-muted">
        {label}
      </span>
      <span className="text-2xl font-semibold tracking-tight">{value}</span>
      {hint ? <span className="text-xs text-muted">{hint}</span> : null}
    </Card>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "accent" | "danger" | "violet";
}) {
  const tones: Record<string, string> = {
    neutral: "bg-surface-2 text-muted border-border",
    accent: "bg-accent-soft text-accent border-accent/30",
    danger: "bg-danger/10 text-danger border-danger/30",
    violet: "bg-violet/10 text-violet border-violet/30",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted">
      {children}
    </div>
  );
}

export function Cover({
  src,
  alt,
  size = 44,
  rounded = "rounded-lg",
}: {
  src: string | null;
  alt: string;
  size?: number;
  rounded?: string;
}) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        width={size}
        height={size}
        className={`${rounded} object-cover`}
        style={{ width: size, height: size }}
        loading="lazy"
      />
    );
  }
  return (
    <div
      className={`${rounded} flex items-center justify-center bg-surface-2 text-muted`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg
        viewBox="0 0 24 24"
        width={size * 0.5}
        height={size * 0.5}
        fill="none"
      >
        <path
          d="M9 18V6l10-2v12"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle
          cx="6.5"
          cy="18"
          r="2.5"
          stroke="currentColor"
          strokeWidth="1.6"
        />
        <circle
          cx="16.5"
          cy="16"
          r="2.5"
          stroke="currentColor"
          strokeWidth="1.6"
        />
      </svg>
    </div>
  );
}
