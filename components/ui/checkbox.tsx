import type { ComponentProps } from "react";

// Per DESIGN.md: 16x16px, 4px radius, 1.5px border; checked = primary fill.
// (Not a pill toggle — DESIGN.md rules those out: "los badges y píldoras
// nunca usan radio de 9999px".)
export function Checkbox({
  label,
  id,
  className,
  ...props
}: ComponentProps<"input"> & { label: string; id: string }) {
  return (
    <label
      htmlFor={id}
      className={`flex items-center gap-2 text-body-md text-on-surface ${className ?? ""}`}
    >
      <input
        id={id}
        name={id}
        type="checkbox"
        className="h-4 w-4 shrink-0 rounded border-[1.5px] border-on-surface-variant text-primary accent-primary focus:ring-2 focus:ring-primary"
        {...props}
      />
      {label}
    </label>
  );
}
