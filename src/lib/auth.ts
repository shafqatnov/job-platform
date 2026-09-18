import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/prisma";
import { resolveSignUpRole } from "@/services/auth/resolveSignUpRole";
import { deliverAuthEmail } from "@/lib/email/authEmailPlaceholder";

/**
 * Better Auth server configuration — Phase 1 scope only, per
 * docs/19-authentication-strategy.md:
 *   - email/password only (no OAuth, no magic link)
 *   - database-backed sessions, delivered as secure HTTP-only cookies
 *   - no MFA, no organization/multi-seat plugin, no mobile/bearer-token
 *     features
 *
 * Better Auth owns identity/session only — the User.name/emailVerified/
 * image fields plus the Session/Account/Verification tables added in the
 * add_better_auth_tables migration. It never decides authorization:
 * User.role and User.status remain ours, consulted from src/services,
 * never from a Better Auth plugin (docs/06-user-boundaries.md,
 * docs/11-security-principles.md).
 *
 * Reuses the single shared Prisma client from src/lib/prisma.ts — this
 * file must never construct a second PrismaClient.
 */
export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    // minPasswordLength/maxPasswordLength are left at Better Auth's own
    // defaults (8/128) — not an invented policy; the existing sign-up
    // form's minLength={8} already matches this.
    //
    // No real email provider is configured for this project yet (see
    // src/lib/email/authEmailPlaceholder.ts). Better Auth requires this
    // callback to be set for /request-password-reset to work at all —
    // leaving it unset makes the endpoint throw, not "do nothing safely".
    // This callback never fabricates delivery; it only logs safe
    // metadata. The url/token are intentionally never logged or printed
    // anywhere.
    sendResetPassword: async ({ user }) => {
      await deliverAuthEmail({ event: "password_reset_requested", userId: user.id });
    },
    // A resolved reset necessarily proves the requester controlled the
    // account (via the emailed link) — revoking any other active
    // sessions at that point is a real, low-risk security improvement,
    // not a redesign of the session architecture.
    revokeSessionsOnPasswordReset: true,
  },
  emailVerification: {
    // Same reasoning as sendResetPassword above: required for
    // /send-verification-email to be callable at all, without
    // fabricating delivery. Deliberately NOT paired with
    // requireEmailVerification or sendOnSignUp/sendOnSignIn — enabling
    // those without real delivery would lock every new sign-up out of
    // the product, which is exactly the "regress existing functionality"
    // this task forbids. This wires the real Better Auth mechanism
    // (Verification table, real token) without changing sign-up/sign-in
    // behavior at all.
    sendVerificationEmail: async ({ user }) => {
      await deliverAuthEmail({ event: "verification_email_requested", userId: user.id });
    },
  },
  user: {
    // Exposes our EXISTING User.role/User.status columns (no schema
    // change) to Better Auth's own request validation and session
    // response. `role` is settable by the sign-up request body so our
    // form can pass "candidate"/"employer" — but see the create hook
    // below, which is the actual security boundary, not this alone.
    // `status` is never client-settable at all.
    additionalFields: {
      role: {
        type: "string",
        required: false,
        input: true,
        defaultValue: "candidate",
      },
      status: {
        type: "string",
        required: false,
        input: false,
        defaultValue: "active",
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        // Server-side enforcement — holds even for a request that
        // bypasses our sign-up form and calls this API directly with a
        // crafted body. "admin" can never be self-assigned (see
        // resolveSignUpRole / docs/06-user-boundaries.md), and status is
        // always forced to "active" regardless of any submitted value.
        before: async (user) => {
          return {
            data: {
              ...user,
              role: resolveSignUpRole((user as { role?: unknown }).role),
              status: "active",
            },
          };
        },
      },
    },
  },
  // Explicitly forced on in every environment (not left to Better
  // Auth's own "production only" default) so this is verifiable in
  // development and never silently inactive in production regardless of
  // how NODE_ENV ends up set at deploy time.
  //
  // Storage is the DEFAULT "memory" — genuinely NOT safe for a
  // multi-instance/serverless production deployment (each instance
  // would count independently, so a determined attacker could get
  // effectively `max * instanceCount` attempts). Better Auth also
  // supports `storage: "database"` using this same Prisma connection,
  // which would fix that without needing new infrastructure (no Redis) —
  // but it requires a new `RateLimit` Prisma model + migration, which
  // this task's constraints do not authorize without a separate,
  // explicit decision. See this task's final report.
  rateLimit: {
    enabled: true,
    window: 60,
    max: 30,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60, max: 3 },
      "/request-password-reset": { window: 300, max: 3 },
      "/reset-password": { window: 300, max: 5 },
      "/send-verification-email": { window: 300, max: 3 },
    },
  },
});
