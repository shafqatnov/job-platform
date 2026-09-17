import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Container } from "@/components/Container";
import { SignOutButton } from "@/features/auth/SignOutButton";
import { getSessionUser } from "@/services/auth/getSessionUser";

/**
 * Shared guard + minimal chrome for every authenticated dashboard area
 * (employer today; candidate/admin in future phases). Confirms a valid,
 * active session server-side — this is the security boundary, not any
 * client-side check. Role-specific authorization (e.g. "must be an
 * employer") happens one level down, in each role's own nested layout
 * (see src/app/(dashboard)/employer/layout.tsx), so future dashboards
 * can follow the same pattern.
 */
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();

  if (!user || user.status !== "active") {
    redirect("/sign-in");
  }

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-border bg-surface">
        <Container className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white"
            >
              J
            </span>
            <span className="text-lg font-semibold tracking-tight text-foreground">Job Platform</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">{user.name}</span>
            <SignOutButton />
          </div>
        </Container>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
