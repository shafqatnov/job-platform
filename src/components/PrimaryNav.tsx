import Link from "next/link";
import { cn } from "@/utils/cn";
import type { NavItem } from "@/constants/navigation";

export type PrimaryNavProps = {
  items: NavItem[];
  className?: string;
};

/** Desktop primary navigation. Hidden on small screens by the caller. */
export function PrimaryNav({ items, className }: PrimaryNavProps) {
  return (
    <nav aria-label="Primary" className={cn("flex items-center gap-8", className)}>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="relative py-1 text-sm font-medium text-muted-foreground transition-colors after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:origin-left after:scale-x-0 after:rounded-full after:bg-brand-600 after:transition-transform after:duration-200 hover:text-foreground hover:after:scale-x-100"
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
