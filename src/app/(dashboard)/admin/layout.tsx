import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/services/auth/getSessionUser";

/**
 * Admin-only guard, nested inside the shared dashboard layout (which
 * already confirmed a valid, active session). Mirrors
 * src/app/(dashboard)/employer/layout.tsx exactly — only the role check
 * differs. A signed-in candidate/employer landing on /admin is
 * redirected home rather than seeing moderation data. Role always comes
 * from the server-side session, never from client input.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();

  if (!user || user.role !== "admin") {
    redirect("/");
  }

  return <>{children}</>;
}
