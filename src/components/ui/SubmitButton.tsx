"use client";
import type { ButtonHTMLAttributes } from "react";
import { useFormStatus } from "react-dom";
import { buttonClass, type ButtonVariant } from "./Button";

export function SubmitButton({
  variant,
  className,
  disableWhilePending = false,
  ...props
}: {
  variant?: ButtonVariant;
  disableWhilePending?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      aria-busy={pending}
      disabled={disableWhilePending && pending}
      className={buttonClass(variant, className)}
      {...props}
    />
  );
}
