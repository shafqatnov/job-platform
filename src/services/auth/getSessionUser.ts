import { cache } from "react";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: "candidate" | "employer" | "admin";
  status: "active" | "suspended";
};

/**
 * Server-side session + user lookup — the only sanctioned way for app/
 * code to know who's signed in (pages/layouts must go through this, never
 * import src/lib/auth directly). Returns null when there is no valid
 * session; never throws for "not signed in."
 *
 * Wrapped in React's cache() so multiple nested layouts/pages rendered in
 * the same request (e.g. the shared dashboard layout plus a role-specific
 * nested layout) share one session lookup instead of querying twice.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    return null;
  }

  const { user } = session;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    // Better Auth's additionalFields type these as plain strings; the
    // actual values are constrained to our Prisma enums by
    // resolveSignUpRole() at creation time and by our own future
    // admin-status-change logic — never by external input.
    role: user.role as SessionUser["role"],
    status: user.status as SessionUser["status"],
  };
});
