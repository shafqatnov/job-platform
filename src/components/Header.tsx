import Link from "next/link";
import { Container } from "@/components/Container";
import { PrimaryNav } from "@/components/PrimaryNav";
import { MobileNav } from "@/components/MobileNav";
import { getButtonClassName } from "@/components/Button";
import { PRIMARY_NAV_ITEMS, EMPLOYER_CTA_ITEM } from "@/constants/navigation";

const MOBILE_NAV_ITEMS = [...PRIMARY_NAV_ITEMS, EMPLOYER_CTA_ITEM];

/** Site-wide header: logo, desktop nav with a standout CTA, and mobile nav toggle. */
export function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/80 backdrop-blur-md">
      <Container className="flex h-16 items-center justify-between gap-4">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span
            aria-hidden="true"
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white"
          >
            J
          </span>
          <span className="text-lg font-semibold tracking-tight text-foreground">Job Platform</span>
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          <PrimaryNav items={PRIMARY_NAV_ITEMS} />
          <Link href={EMPLOYER_CTA_ITEM.href} className={getButtonClassName({ size: "sm" })}>
            {EMPLOYER_CTA_ITEM.label}
          </Link>
        </div>

        <MobileNav items={MOBILE_NAV_ITEMS} className="md:hidden" />
      </Container>
    </header>
  );
}
