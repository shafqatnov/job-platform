import { NextResponse } from "next/server";
import { expireDueJobs } from "@/services/jobs/expireJobs";
import { checkSecureTrigger } from "@/lib/security/secureTrigger";

/**
 * Scheduler-agnostic trigger for the documented active->expired job
 * lifecycle automation (docs/09-automation-architecture.md,
 * docs/18-job-lifecycle.md). No specific scheduler technology is
 * assumed or configured here — this project has no confirmed hosting
 * platform yet (docs/14-deployment-environment-strategy.md) and no
 * existing scheduler/queue infrastructure, so this is the smallest
 * production-safe surface: a single authenticated HTTP endpoint any
 * external scheduler (Vercel Cron, GitHub Actions, an OS cron via curl,
 * a third-party pinger, etc.) can be pointed at later without this
 * route or its logic changing.
 *
 * Authorization + abuse protection: src/lib/security/secureTrigger.ts —
 * constant-time secret comparison (fails closed on any missing/
 * incorrect secret or missing env var) plus a shared in-memory rate
 * limit, documented there as not multi-instance-safe. Never returns the
 * secret in any response.
 *
 * Also exported as GET (same handler, identical checks): Vercel's own
 * native Cron Jobs feature (a `crons` entry in vercel.json) always
 * invokes its configured path with an HTTP GET request — it has no way
 * to send a POST. The original POST export is preserved unchanged for
 * any other external scheduler (GitHub Actions, a third-party pinger,
 * etc.) that can send POST, exactly as this route already documented.
 */
export async function POST(request: Request) {
  const check = checkSecureTrigger(request, {
    secretEnvVar: "JOB_EXPIRY_CRON_SECRET",
    bucketKey: "cron:expire-jobs",
  });
  if (!check.ok) {
    const message = check.status === 429 ? "Too many requests" : "Unauthorized";
    return NextResponse.json({ error: message }, { status: check.status });
  }

  const result = await expireDueJobs();

  // Observability per docs/09's "failures are observable, not silent"
  // recommendation — no user is watching a background trigger run.
  console.log(`[job-expiry] transitioned ${result.expiredCount} job(s) to expired`);

  return NextResponse.json({ success: true, expiredCount: result.expiredCount });
}

export { POST as GET };
