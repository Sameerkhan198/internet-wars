import type { ReactNode } from "react";

/** Terminal-style page heading used by the secondary pages. */
export default function PageHeader({
  eyebrow,
  title,
  subtitle,
  aside,
}: {
  eyebrow: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-2 label">{eyebrow}</div>
        <h1 className="text-2xl sm:text-4xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {aside}
    </div>
  );
}
