import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/services/auth/getSessionUser";
import { CandidateNav } from "@/features/candidates/CandidateNav";

/**
 * Candidate-only guard, nested inside the shared dashboard layout (which
 * already confirmed a valid, active session). Mirrors
 * src/app/(dashboard)/employer/layout.tsx exactly — only the role check
 * differs. An employer/admin landing on /candidate is redirected home
 * rather than seeing candidate-only pages.
 *
 * Also renders the persistent candidate portal navigation (Candidate
 * Portal 2.0) above every page in this section, so the whole area reads
 * as one consistent dashboard rather than a set of disconnected pages —
 * added here, once, rather than duplicated into each page.
 */
export default async function CandidateLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();

  if (!user || user.role !== "candidate") {
    redirect("/");
  }

  return (
    <>
      <CandidateNav />
      {children}
    </>
  );
}
