import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { expireDueJobs } from "@/services/jobs/expireJobs";

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
 * Authorization: a constant-time comparison against
 * JOB_EXPIRY_CRON_SECRET (a server-side-only secret, never committed,
 * never returned in any response). Fails closed — a missing/incorrect
 * secret, or a missing env var, is always rejected as 401, never
 * silently treated as authorized.
 */
function isAuthorizedRequest(request: Request): boolean {
  const expectedSecret = process.env.JOB_EXPIRY_CRON_SECRET;
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

  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}

export async function POST(request: Request) {
  if (!isAuthorizedRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await expireDueJobs();

  // Observability per docs/09's "failures are observable, not silent"
  // recommendation — no user is watching a background trigger run.
  console.log(`[job-expiry] transitioned ${result.expiredCount} job(s) to expired`);

  return NextResponse.json({ success: true, expiredCount: result.expiredCount });
}
