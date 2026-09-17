import type { ReactNode, SelectHTMLAttributes } from "react";
import { cn } from "@/utils/cn";

export type SelectOption = {
  value: string;
  label: string;
};

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  /** Keeps the label in the accessibility tree but hides it visually. */
  hideLabel?: boolean;
  options: SelectOption[];
  placeholder?: string;
  error?: string;
  helperText?: string;
  /** Optional decorative leading icon. Purely visual. */
  icon?: ReactNode;
};

/**
 * Native <select> with a built-in, implicitly-associated <label>, matching
 * Input's accessibility pattern. Uses the native control rather than a
 * custom dropdown so keyboard/screen-reader behavior is correct for free.
 */
export function Select({
  label,
  hideLabel = false,
  options,
  placeholder,
  error,
  helperText,
  icon,
  className,
  ...rest
}: SelectProps) {
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
          <select
            aria-invalid={Boolean(error) || undefined}
            className={cn(
              "h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              Boolean(icon) && "pl-10",
              error && "border-danger-600",
              className
            )}
            {...rest}
          >
            {placeholder ? (
              <option value="" disabled hidden>
                {placeholder}
              </option>
            ) : null}
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
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
