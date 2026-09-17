import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";
import { cn } from "@/utils/cn";

export type ContainerProps = ComponentPropsWithoutRef<"div"> & {
  /** Render as a different element (e.g. "main", "article"). Defaults to "div". */
  as?: ElementType;
  children: ReactNode;
};

/**
 * Centers content and applies the site's max-width and horizontal gutter.
 * Purely a layout primitive — no business logic.
 */
export function Container({ as: Tag = "div", className, children, ...rest }: ContainerProps) {
  return (
    <Tag className={cn("mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8", className)} {...rest}>
      {children}
    </Tag>
  );
}
