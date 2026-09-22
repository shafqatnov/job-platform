import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/services/auth/getSessionUser";
import { EmployerNav } from "@/features/employers/EmployerNav";

/**
 * Employer-only guard, nested inside the shared dashboard layout (which
 * already confirmed a valid, active session). This layer only adds the
 * role check — a signed-in candidate landing on /employer is redirected
 * home rather than seeing employer data, and future candidate/admin
 * areas can each add their own equivalent nested layout following the
 * same pattern.
 *
 * Also renders the persistent employer portal navigation (Employer
 * Portal 2.0) above every page in this section — mirrors
 * (dashboard)/candidate/layout.tsx's identical role for Candidate
 * Portal 2.0, added here once rather than duplicated into each page.
 */
export default async function EmployerLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();

  if (!user || user.role !== "employer") {
    redirect("/");
  }

  return (
    <>
      <EmployerNav />
      {children}
    </>
  );
}
