import { NextResponse } from "next/server";
import { processPendingJobs } from "@/services/moderation/processPendingJobs";
import { checkSecureTrigger } from "@/lib/security/secureTrigger";

/**
 * Scheduler-agnostic trigger for the AI moderation pipeline — mirrors
 * src/app/api/cron/expire-jobs/route.ts exactly (same reasoning: no
 * scheduler technology is assumed or configured, so this is a plain
 * authenticated HTTP endpoint any future scheduler can be pointed at).
 * Uses its own dedicated secret (AI_MODERATION_TRIGGER_SECRET) rather
 * than reusing JOB_EXPIRY_CRON_SECRET, so the two independent
 * background jobs stay separately authorized, and its own rate-limit
 * bucket so a flood against one endpoint never affects the other.
 *
 * Authorization + abuse protection: src/lib/security/secureTrigger.ts —
 * constant-time comparison, fails closed on any missing/incorrect
 * secret or missing env var. Never returns the secret, and never
 * returns AI explanation text, job title/description, or any other
 * sensitive content in the response — only aggregate counts.
 *
 * Also exported as GET (same handler, identical checks): Vercel's own
 * native Cron Jobs feature (a `crons` entry in vercel.json) always
 * invokes its configured path with an HTTP GET request — it has no way
 * to send a POST. The original POST export is preserved unchanged for
 * any other external scheduler that can send POST.
 */
export async function POST(request: Request) {
  const check = checkSecureTrigger(request, {
    secretEnvVar: "AI_MODERATION_TRIGGER_SECRET",
    bucketKey: "moderation:process-pending-jobs",
  });
  if (!check.ok) {
    const message = check.status === 429 ? "Too many requests" : "Unauthorized";
    return NextResponse.json({ error: message }, { status: check.status });
  }

  const summary = await processPendingJobs();

  return NextResponse.json({ success: true, ...summary });
}

export { POST as GET };
