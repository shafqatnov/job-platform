"use client";

import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields } from "better-auth/client/plugins";
import type { auth } from "@/lib/auth";

/**
 * Client-side Better Auth instance — the only entry point Client
 * Components (sign-up/sign-in forms, sign-out control, session-aware
 * nav) use to talk to auth. `inferAdditionalFields<typeof auth>()` is a
 * type-only inference plugin: it gives this client correct TypeScript
 * types for the User.role/User.status additional fields configured on
 * the server, WITHOUT importing any server code — the `auth` import
 * here is `import type`, fully erased at build time, so no server
 * secrets or Prisma code ever reach the browser bundle.
 */
export const authClient = createAuthClient({
  plugins: [inferAdditionalFields<typeof auth>()],
});
