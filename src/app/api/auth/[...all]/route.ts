import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

/**
 * The single catch-all route Better Auth requires to serve its own
 * endpoints (sign-up, sign-in, sign-out, session lookup, etc.). No
 * business logic lives here — it only delegates to the Better Auth
 * instance configured in src/lib/auth.ts.
 */
export const { GET, POST } = toNextJsHandler(auth);
