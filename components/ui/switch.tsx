import type { ComponentProps } from "react";

// Rectangular sliding switch for row-level active/inactive state — not a
// pill (DESIGN.md §7 rules out 9999px radius for switches, same as badges).
export function Switch({
  label,
  id,
  checked,
  disabled,
  className,
  ...props
}: Omit<ComponentProps<"input">, "type"> & {
  label: string;
  id: string;
  checked: boolean;
}) {
  return (
    <label
      htmlFor={id}
      className={`inline-flex cursor-pointer items-center gap-2 text-body-md text-on-surface ${className ?? ""}`}
    >
      <input
        id={id}
        name={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        className="peer sr-only"
        {...props}
      />
      <span
        className={`relative inline-flex h-6 w-10 shrink-0 rounded-md border-[1.5px] transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2 ${
          checked ? "border-primary bg-primary" : "border-on-surface-variant bg-surface-container-lowest"
        } ${disabled ? "opacity-60" : ""}`}
        aria-hidden
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-sm transition-transform ${
            checked ? "translate-x-4 bg-white" : "translate-x-0.5 bg-on-surface-variant"
          }`}
        />
      </span>
      {label}
    </label>
  );
}
