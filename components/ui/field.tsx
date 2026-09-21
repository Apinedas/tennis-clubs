import type { ComponentProps } from "react";

// Etiqueta arriba (12px/500, secundaria) + input de 40px, según DESIGN.md.
export function Field({
  label,
  id,
  ...props
}: ComponentProps<"input"> & { label: string; id: string }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-label-sm text-on-surface-variant">
        {label}
      </label>
      <input
        id={id}
        name={id}
        className="h-10 rounded-lg border border-border bg-surface-container-lowest px-3 text-body-md text-on-surface placeholder:text-on-surface-variant focus:border-primary"
        {...props}
      />
    </div>
  );
}
