/**
 * Minimal environment/configuration validation — checks that the env
 * vars this app actually needs are PRESENT (never inspects or logs
 * their values). This intentionally does not validate format/shape
 * (e.g. "is DATABASE_URL a well-formed postgres URL") — that would
 * duplicate what the consuming library (pg, Better Auth) already
 * checks itself, with a worse error message.
 *
 * REQUIRED_ENV_VARS are load-bearing for the app to function at all:
 * DATABASE_URL (src/lib/prisma.ts) and BETTER_AUTH_SECRET. Verified
 * directly against Better Auth's own source
 * (node_modules/better-auth/dist/context/create-context.mjs): if
 * BETTER_AUTH_SECRET is missing/default, Better Auth's own
 * validateSecret() throws whenever NODE_ENV === "production" — so this
 * app cannot start in production without it either way.
 *
 * BETTER_AUTH_URL is deliberately NOT in REQUIRED_ENV_VARS, even though
 * an earlier version of this file listed it there. Verified against the
 * same source: when it's unset, Better Auth only logs its own warning
 * ("Base URL is not set... callbacks and redirects may not work
 * correctly") and falls back to deriving the origin from the incoming
 * request for trusted-origin/CSRF checks — it never throws. Treating it
 * as required here was stricter than the library it wraps, and caused a
 * real first-deployment failure when BETTER_AUTH_URL was correctly left
 * unset (no production domain existed yet). It belongs in
 * RECOMMENDED_ENV_VARS instead: worth warning about, not a reason to
 * crash the app.
 *
 * RECOMMENDED_ENV_VARS are NOT load-bearing:
 *  - JOB_EXPIRY_CRON_SECRET / AI_MODERATION_TRIGGER_SECRET: both
 *    consuming routes (src/app/api/cron/expire-jobs,
 *    src/app/api/moderation/process-pending-jobs) already fail closed
 *    (401) when their secret is unset, per
 *    src/lib/security/secureTrigger.ts.
 *  - BETTER_AUTH_URL: see above — Better Auth degrades gracefully, it
 *    does not fail.
 * Missing any of these is a real gap worth surfacing, but not a reason
 * to crash the whole app.
 */
const REQUIRED_ENV_VARS = ["DATABASE_URL", "BETTER_AUTH_SECRET"] as const;
const RECOMMENDED_ENV_VARS = ["BETTER_AUTH_URL", "JOB_EXPIRY_CRON_SECRET", "AI_MODERATION_TRIGGER_SECRET"] as const;

export type EnvCheckResult = {
  missingRequired: string[];
  missingRecommended: string[];
};

export function checkEnv(env: NodeJS.ProcessEnv = process.env): EnvCheckResult {
  return {
    missingRequired: REQUIRED_ENV_VARS.filter((name) => !env[name]),
    missingRecommended: RECOMMENDED_ENV_VARS.filter((name) => !env[name]),
  };
}

let hasValidated = false;

/**
 * Called once from src/lib/prisma.ts (the shared module every
 * server-side code path already imports). Warns on a missing
 * recommended var in every environment. On a missing REQUIRED var:
 * throws in production (fail fast, before serving any real traffic
 * with a broken configuration) and only warns in development, so local
 * setup with an incomplete .env never becomes a hard crash mid-task.
 */
export function validateEnvOnce(env: NodeJS.ProcessEnv = process.env): void {
  if (hasValidated) {
    return;
  }
  hasValidated = true;

  const { missingRequired, missingRecommended } = checkEnv(env);

  if (missingRecommended.length > 0) {
    console.warn(
      `[env] Missing recommended environment variable(s): ${missingRecommended.join(", ")}. The application will still start; the specific behavior each one affects (BETTER_AUTH_URL: auth callback/redirect URLs; JOB_EXPIRY_CRON_SECRET / AI_MODERATION_TRIGGER_SECRET: those automation endpoints safely reject every request until configured) may be degraded until it is set — this is not a functional break.`
    );
  }

  if (missingRequired.length > 0) {
    const message = `[env] Missing required environment variable(s): ${missingRequired.join(", ")}`;
    if (env.NODE_ENV === "production") {
      throw new Error(message);
    }
    console.warn(message);
  }
}

/** Test-only: allows re-running validateEnvOnce's one-shot check within a fresh test. */
export function __resetEnvValidationForTests(): void {
  hasValidated = false;
}
