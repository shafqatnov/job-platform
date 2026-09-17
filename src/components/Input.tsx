import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "@/utils/cn";

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  /** Keeps the label in the accessibility tree but hides it visually. */
  hideLabel?: boolean;
  error?: string;
  helperText?: string;
  /** Optional decorative leading icon (e.g. a search glyph). Purely visual. */
  icon?: ReactNode;
};

/**
 * Text input with a built-in, implicitly-associated <label> so every
 * usage is accessible by default. Error/helper text is a sibling of the
 * label (not nested inside it) so it never gets folded into the input's
 * accessible name.
 */
export function Input({
  label,
  hideLabel = false,
  error,
  helperText,
  icon,
  className,
  ...rest
}: InputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex flex-col gap-1.5">
        <span className={cn("text-sm font-medium text-foreground", hideLabel && "sr-only")}>
          {label}
        </span>
        <div className="relative">
          {icon ? (
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
              {icon}
            </span>
          ) : null}
          <input
            aria-invalid={Boolean(error) || undefined}
            className={cn(
              "h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground placeholder:text-muted-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              Boolean(icon) && "pl-10",
              error && "border-danger-600",
              className
            )}
            {...rest}
          />
        </div>
      </label>
      {error ? (
        <p className="text-sm text-danger-600">{error}</p>
      ) : helperText ? (
        <p className="text-sm text-muted-foreground">{helperText}</p>
      ) : null}
    </div>
  );
}
