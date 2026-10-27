import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary" | "danger";

export const buttonClass = (variant: ButtonVariant = "primary", extra = "") =>
  `inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors pointer-coarse:min-h-11 aria-busy:opacity-60 ${
    {
      primary: "bg-brand text-white hover:bg-brand-hover",
      secondary: "border border-field bg-surface text-ink hover:bg-neutral-soft",
      danger: "bg-danger-ink text-white hover:opacity-90",
    }[variant]
  } ${extra}`;

export function Button({
  variant,
  type = "button",
  className,
  ...props
}: { variant?: ButtonVariant } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type={type} className={buttonClass(variant, className)} {...props} />;
}
