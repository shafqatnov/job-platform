import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { processPendingJobs } from "@/services/moderation/processPendingJobs";

/**
 * Scheduler-agnostic trigger for the AI moderation pipeline — mirrors
 * src/app/api/cron/expire-jobs/route.ts exactly (same reasoning: no
 * scheduler technology is assumed or configured, so this is a plain
 * authenticated HTTP endpoint any future scheduler can be pointed at).
 * Uses its own dedicated secret (AI_MODERATION_TRIGGER_SECRET) rather
 * than reusing JOB_EXPIRY_CRON_SECRET, so the two independent
 * background jobs stay separately authorized.
 *
 * Authorization: constant-time comparison, fails closed on any missing/
 * incorrect secret or missing env var. Never returns the secret, and
 * never returns AI explanation text, job title/description, or any
 * other sensitive content in the response — only aggregate counts.
 */
function isAuthorizedRequest(request: Request): boolean {
  const expectedSecret = process.env.AI_MODERATION_TRIGGER_SECRET;
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

  const summary = await processPendingJobs();

  return NextResponse.json({ success: true, ...summary });
}
