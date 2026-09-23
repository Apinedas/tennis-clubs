import type { ComponentProps } from "react";

// Same shape as Field, for a <select>. Per DESIGN.md: 40px height, an
// expand_more icon on the right (native appearance removed).
export function Select({
  label,
  id,
  hint,
  children,
  ...props
}: ComponentProps<"select"> & {
  label: string;
  id: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-label-sm text-on-surface-variant">
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          name={id}
          className="h-10 w-full appearance-none rounded-lg border border-border bg-surface-container-lowest px-3 pr-9 text-body-md text-on-surface focus:border-primary"
          {...props}
        >
          {children}
        </select>
        <span
          className="material-symbols-outlined pointer-events-none absolute right-2 top-2 text-on-surface-variant"
          aria-hidden
        >
          expand_more
        </span>
      </div>
      {hint && <span className="text-label-xs text-on-surface-variant">{hint}</span>}
    </div>
  );
}
