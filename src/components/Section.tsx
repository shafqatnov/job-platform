import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";
import { cn } from "@/utils/cn";
import { Container } from "@/components/Container";

export type SectionProps = ComponentPropsWithoutRef<"section"> & {
  /** Render as a different element (e.g. "div", "header"). Defaults to "section". */
  as?: ElementType;
  /** Extra classes applied to the inner Container, not the outer element. */
  containerClassName?: string;
  children: ReactNode;
};

/**
 * Standard vertical rhythm wrapper: consistent section padding around a
 * centered Container. Used to lay out page sections consistently without
 * repeating spacing utilities everywhere.
 */
export function Section({
  as: Tag = "section",
  className,
  containerClassName,
  children,
  ...rest
}: SectionProps) {
  return (
    <Tag className={cn("py-12 sm:py-16 lg:py-20", className)} {...rest}>
      <Container className={containerClassName}>{children}</Container>
    </Tag>
  );
}
