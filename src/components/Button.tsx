import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/utils/cn";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

export type ButtonStyleOptions = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
};

const baseStyles =
  "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background " +
  "disabled:pointer-events-none disabled:opacity-50";

const variantStyles: Record<ButtonVariant, string> = {
  primary: "bg-brand-600 text-white hover:bg-brand-700",
  secondary: "bg-accent-600 text-white hover:bg-accent-700",
  outline: "border border-border bg-transparent text-foreground hover:bg-surface-muted",
  ghost: "bg-transparent text-foreground hover:bg-surface-muted",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-5 text-base",
  lg: "h-12 px-6 text-base",
};

/**
 * Builds the Button's class list so a future Next.js Link that needs to
 * *look* like a button (e.g. a hero CTA) can reuse the exact same styling
 * without duplicating it — call this instead of copying variant/size classes.
 */
export function getButtonClassName({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
}: ButtonStyleOptions = {}): string {
  return cn(baseStyles, variantStyles[variant], sizeStyles[size], fullWidth && "w-full", className);
}

export type ButtonProps = ButtonStyleOptions & ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({ variant, size, fullWidth, className, type = "button", ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={getButtonClassName({ variant, size, fullWidth, className })}
      {...rest}
    />
  );
}
