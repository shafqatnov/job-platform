export type PublicSignUpRole = "candidate" | "employer";

const ALLOWED_PUBLIC_SIGNUP_ROLES: readonly PublicSignUpRole[] = ["candidate", "employer"];

/**
 * Determines the User.role to actually persist for a new public sign-up,
 * regardless of what a client claims. Only "candidate" or "employer" are
 * ever accepted — "admin" (or any other value) can never be self-assigned
 * through public sign-up, per docs/06-user-boundaries.md ("Do not provide
 * Admin signup").
 *
 * Called from the `databaseHooks.user.create.before` hook in
 * src/lib/auth.ts, not from UI code, so this holds even for a request
 * that bypasses our sign-up form entirely and calls the Better Auth API
 * directly with a crafted payload.
 */
export function resolveSignUpRole(requestedRole: unknown): PublicSignUpRole {
  if (
    typeof requestedRole === "string" &&
    (ALLOWED_PUBLIC_SIGNUP_ROLES as string[]).includes(requestedRole)
  ) {
    return requestedRole as PublicSignUpRole;
  }
  return "candidate";
}
