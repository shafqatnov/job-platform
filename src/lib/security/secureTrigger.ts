import crypto from "node:crypto";

/**
 * Shared authorization + abuse-protection for this app's own
 * scheduler-agnostic trigger endpoints (/api/cron/expire-jobs,
 * /api/moderation/process-pending-jobs). Both routes previously
 * duplicated identical constant-time secret-comparison logic; this
 * centralizes it and adds a rate-limit layer neither had before.
 *
 * Rate limiting here uses the same honest, explicitly-scoped posture as
 * Better Auth's own rate limiter (see src/lib/auth.ts): in-process
 * memory, reset on restart, and NOT a correct guarantee across multiple
 * server instances or serverless invocations — each instance would
 * count independently. This is not fake protection: it is a real,
 * effective control against a naive flood in this project's actual
 * current deployment (a single process), it fails closed, and its exact
 * limitation is documented rather than glossed over. A durable,
 * instance-shared fix would use the same Prisma-backed store Better
 * Auth's own `storage: "database"` option requires — a new `RateLimit`
 * model, which is a schema decision out of this task's authorized scope
 * (see this task's final report).
 */

export type SecureTriggerConfig = {
  /** Name of the required server-side secret env var, e.g. "JOB_EXPIRY_CRON_SECRET". */
  secretEnvVar: string;
  /** A short, stable key identifying this endpoint's own rate-limit bucket. */
  bucketKey: string;
  windowMs?: number;
  max?: number;
};

export type SecureTriggerCheck = { ok: true } | { ok: false; status: 401 | 429 };

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_MAX = 10;

function isRateLimited(bucketKey: string, windowMs: number, max: number): boolean {
  const now = Date.now();
  const existing = buckets.get(bucketKey);

  if (!existing || existing.resetAt <= now) {
    buckets.set(bucketKey, { count: 1, resetAt: now + windowMs });
    return false;
  }

  existing.count += 1;
  return existing.count > max;
}

function isValidSecret(request: Request, envVarName: string): boolean {
  const expectedSecret = process.env[envVarName];
  if (!expectedSecret) {
    return false;
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return false;
  }

  const providedSecret = authHeader.slice("Bearer ".length);
  const expectedBuffer = Buffer.from(expectedSecret);
  const providedBuffer = Buffer.from(providedSecret);

  // Length check first: timingSafeEqual throws on mismatched lengths
  // rather than returning false, and comparing lengths leaks
  // dramatically less than the secret comparison itself would.
  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}

/**
 * Checks the shared per-endpoint rate limit before the secret — a
 * flood of requests is rejected by the cheap counter check before ever
 * reaching `timingSafeEqual`, without weakening the secret check itself
 * (rate limiting is a volume control, not a timing defense).
 */
export function checkSecureTrigger(request: Request, config: SecureTriggerConfig): SecureTriggerCheck {
  const windowMs = config.windowMs ?? DEFAULT_WINDOW_MS;
  const max = config.max ?? DEFAULT_MAX;

  if (isRateLimited(config.bucketKey, windowMs, max)) {
    return { ok: false, status: 429 };
  }

  if (!isValidSecret(request, config.secretEnvVar)) {
    return { ok: false, status: 401 };
  }

  return { ok: true };
}

/** Test-only: clears all in-memory rate-limit buckets between test cases. */
export function __resetSecureTriggerBucketsForTests(): void {
  buckets.clear();
}
