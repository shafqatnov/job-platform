import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/services/auth/getSessionUser";

/**
 * Employer-only guard, nested inside the shared dashboard layout (which
 * already confirmed a valid, active session). This layer only adds the
 * role check — a signed-in candidate landing on /employer is redirected
 * home rather than seeing employer data, and future candidate/admin
 * areas can each add their own equivalent nested layout following the
 * same pattern.
 */
export default async function EmployerLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();

  if (!user || user.role !== "employer") {
    redirect("/");
  }

  return <>{children}</>;
}
