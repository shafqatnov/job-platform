import type { ReactNode } from "react";

export type PolicySectionProps = {
  title: string;
  children: ReactNode;
};

/**
 * One numbered section of a long-form policy page (Privacy Policy,
 * Terms of Service) — heading + prose, reused so both pages share
 * exactly one visual shape instead of hand-repeating it per section.
 * Presentational only, no business logic.
 */
export function PolicySection({ title, children }: PolicySectionProps) {
  return (
    <section className="flex flex-col gap-3 border-t border-border pt-8 first:border-t-0 first:pt-0">
      <h2 className="text-lg font-semibold text-foreground sm:text-xl">{title}</h2>
      <div className="flex flex-col gap-3 text-muted-foreground [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-2 [&_ul]:pl-5">
        {children}
      </div>
    </section>
  );
}
