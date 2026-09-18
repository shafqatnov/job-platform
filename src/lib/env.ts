/**
 * Minimal environment/configuration validation — checks that the env
 * vars this app actually needs are PRESENT (never inspects or logs
 * their values). This intentionally does not validate format/shape
 * (e.g. "is DATABASE_URL a well-formed postgres URL") — that would
 * duplicate what the consuming library (pg, Better Auth) already
 * checks itself, with a worse error message.
 *
 * REQUIRED_ENV_VARS are load-bearing for the app to function at all:
 * DATABASE_URL (src/lib/prisma.ts), BETTER_AUTH_SECRET/BETTER_AUTH_URL
 * (read implicitly by Better Auth itself — see src/lib/auth.ts).
 *
 * RECOMMENDED_ENV_VARS are NOT load-bearing — both consuming routes
 * (src/app/api/cron/expire-jobs, src/app/api/moderation/process-pending-jobs)
 * already fail closed (401) when their secret is unset, per
 * src/lib/security/secureTrigger.ts. Missing them is a real operational
 * gap (those endpoints are permanently unusable) worth surfacing, but
 * not a reason to crash the whole app.
 */
const REQUIRED_ENV_VARS = ["DATABASE_URL", "BETTER_AUTH_SECRET", "BETTER_AUTH_URL"] as const;
const RECOMMENDED_ENV_VARS = ["JOB_EXPIRY_CRON_SECRET", "AI_MODERATION_TRIGGER_SECRET"] as const;

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
      `[env] Missing recommended environment variable(s): ${missingRecommended.join(", ")}. The corresponding automation endpoint(s) will safely reject every request (fail-closed) until configured — this is not a functional break.`
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
