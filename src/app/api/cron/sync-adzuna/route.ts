import { NextResponse } from "next/server";
import { syncAdzunaJobs } from "@/services/sync/syncAdzunaJobs";
import { checkSecureTrigger } from "@/lib/security/secureTrigger";

/**
 * Scheduler-agnostic trigger for the Adzuna import sync — mirrors
 * src/app/api/cron/expire-jobs/route.ts and
 * src/app/api/moderation/process-pending-jobs/route.ts exactly (same
 * reasoning: no scheduler technology is assumed or configured here).
 * Uses its own dedicated secret (ADZUNA_SYNC_TRIGGER_SECRET) so this
 * background job stays separately authorized from the other two, and
 * its own rate-limit bucket so a flood against one endpoint never
 * affects the others.
 *
 * DELIBERATELY INERT until a human configures ADZUNA_SYNC_TRIGGER_SECRET:
 * checkSecureTrigger fails closed whenever the named env var is unset
 * (see secureTrigger.ts's own isValidSecret), so this route 401s on
 * every request until that secret exists — no separate "scheduler
 * enabled" flag is needed to keep this off by default. syncAdzunaJobs()
 * itself is a second, independent gate: even once this route is
 * reachable, it still refuses to call Adzuna or publish anything unless
 * the "Adzuna" AuthorizedJobSource row is both authorizationStatus ===
 * "verified" and enabled === true.
 *
 * Authorization + abuse protection: src/lib/security/secureTrigger.ts —
 * constant-time comparison, fails closed on any missing/incorrect
 * secret. Never returns the secret, and never returns raw job
 * title/description/company content — only aggregate counts.
 *
 * Also exported as GET (same handler, identical checks): Vercel's own
 * native Cron Jobs feature always invokes its configured path with an
 * HTTP GET request — it has no way to send a POST. The original POST
 * export is preserved for any other external scheduler that can send
 * POST.
 */
export async function POST(request: Request) {
  const check = checkSecureTrigger(request, {
    secretEnvVar: "ADZUNA_SYNC_TRIGGER_SECRET",
    bucketKey: "cron:sync-adzuna",
  });
  if (!check.ok) {
    const message = check.status === 429 ? "Too many requests" : "Unauthorized";
    return NextResponse.json({ error: message }, { status: check.status });
  }

  const result = await syncAdzunaJobs();

  if (!result.ok) {
    console.log(`[adzuna-sync] stopped safely: ${result.reason}`);
    return NextResponse.json({ success: true, ranSync: false, reason: result.reason });
  }

  return NextResponse.json({ success: true, ranSync: true, ...result });
}

export { POST as GET };
