import type { ComponentProps } from "react";

type Tone = "neutral" | "danger";

const TONES: Record<Tone, string> = {
  neutral: "text-on-surface-variant hover:bg-surface-container hover:text-on-surface",
  danger: "text-blocked-fg hover:bg-blocked-bg",
};

// Icon-only row action (Editar/Eliminar) — DESIGN.md §8. Always pass a
// full-verb `label`; it becomes both the a11y name and the tooltip.
export function IconButton({
  icon,
  label,
  tone = "neutral",
  type = "button",
  className,
  ...props
}: ComponentProps<"button"> & { icon: string; label: string; tone?: Tone }) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${TONES[tone]} ${className ?? ""}`}
      {...props}
    >
      <span className="material-symbols-outlined text-[18px]" aria-hidden>
        {icon}
      </span>
    </button>
  );
}
