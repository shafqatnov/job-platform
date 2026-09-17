import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/prisma";
import { resolveSignUpRole } from "@/services/auth/resolveSignUpRole";

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
});
