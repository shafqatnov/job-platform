import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/services/auth/getSessionUser";

/**
 * Candidate-only guard, nested inside the shared dashboard layout (which
 * already confirmed a valid, active session). Mirrors
 * src/app/(dashboard)/employer/layout.tsx exactly — only the role check
 * differs. An employer/admin landing on /candidate is redirected home
 * rather than seeing candidate-only pages.
 */
export default async function CandidateLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();

  if (!user || user.role !== "candidate") {
    redirect("/");
  }

  return <>{children}</>;
}
