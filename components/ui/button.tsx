import type { ComponentProps } from "react";

type Variant = "primary" | "secondary";

const VARIANTS: Record<Variant, string> = {
  primary:
    "border-transparent bg-primary text-on-primary hover:bg-primary-hover",
  secondary:
    "border-border bg-surface-container-lowest text-on-surface hover:border-on-surface-variant hover:bg-background",
};

export function buttonClass(variant: Variant = "primary", extra = "") {
  return `inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-body-md-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]} ${extra}`.trim();
}

export function Button({
  variant = "primary",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: Variant }) {
  return <button className={buttonClass(variant, className)} {...props} />;
}
