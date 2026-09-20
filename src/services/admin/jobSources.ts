import { prisma } from "@/lib/prisma";
import type { JobSourceType, JobSourceAuthorizationStatus } from "@/generated/prisma/enums";
import { detectJobSource, type JobSourceProvider } from "@/services/discovery/detectJobSource";

/**
 * Read/write access to the Authorized Job Source registry — the
 * foundation step of the future AI Job Acquisition Engine (Source
 * Registry -> Connector -> Raw Job -> Validation -> ... -> Publish).
 * This module ONLY manages configuration rows; it never fetches from an
 * external API, never imports a job, and never contains provider-specific
 * logic. A future connector layer will read this registry — it must
 * never be extended with fetching logic itself.
 */

export type JobSourceRow = {
  id: string;
  name: string;
  sourceType: JobSourceType;
  baseEndpoint: string | null;
  enabled: boolean;
  attributionRequired: boolean;
  refreshIntervalMinutes: number | null;
  status: string;
  /**
   * Derived, never the raw env var name or its value: whether a
   * credential is currently configured for this source. The actual
   * secret (if any) lives only in process.env, keyed by
   * credentialEnvVarName, which is intentionally never returned here.
   */
  hasCredentialConfigured: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  /**
   * Derived at read time from baseEndpoint via detectJobSource — never
   * persisted, never provider-specific logic living in this file. Purely
   * a display aid so the registry's rows are understandable at a glance;
   * this field has no effect on enable/disable or any connector.
   */
  provider: JobSourceProvider;
  /**
   * Whether the source owner has explicitly authorized Jobnura to use/
   * redistribute their job data — never inferred from technical facts
   * like "the endpoint is public". See setJobSourceEnabled: a source can
   * never become `enabled: true` while this is "unverified".
   */
  authorizationStatus: JobSourceAuthorizationStatus;
  authorizationVerifiedAt: string | null;
  authorizationReference: string | null;
};

export async function listJobSources(): Promise<JobSourceRow[]> {
  const sources = await prisma.authorizedJobSource.findMany({ orderBy: { name: "asc" } });

  return sources.map((source) => ({
    id: source.id,
    name: source.name,
    sourceType: source.sourceType,
    baseEndpoint: source.baseEndpoint,
    enabled: source.enabled,
    attributionRequired: source.attributionRequired,
    refreshIntervalMinutes: source.refreshIntervalMinutes,
    status: source.status,
    hasCredentialConfigured: Boolean(source.credentialEnvVarName && process.env[source.credentialEnvVarName]),
    notes: source.notes,
    createdAt: source.createdAt.toISOString(),
    updatedAt: source.updatedAt.toISOString(),
    provider: source.baseEndpoint ? detectJobSource(source.baseEndpoint).provider : "unknown",
    authorizationStatus: source.authorizationStatus,
    authorizationVerifiedAt: source.authorizationVerifiedAt?.toISOString() ?? null,
    authorizationReference: source.authorizationReference,
  }));
}

export type SetJobSourceEnabledResult = { success: true } | { success: false; error: string };

/**
 * Toggles enabled/disabled — the only other editable state on this
 * Phase-1 registry surface is authorizationStatus (see
 * setJobSourceAuthorization below). Enabling a row here does not itself
 * trigger any import; no connector currently reads this flag at all.
 *
 * HARD GATE: a source can never transition to `enabled: true` unless
 * its authorizationStatus is already "verified" — re-checked here, on
 * the server, on every call, regardless of what any UI button shows or
 * disables. Disabling (`enabled: false`) is always allowed regardless
 * of authorization state, since turning a source off can never be
 * unsafe. This is deliberately NOT bypassable by any caller: nothing
 * about a source's technical configuration (a public endpoint, a
 * working connector) can substitute for this explicit, human-recorded
 * authorization decision.
 */
export async function setJobSourceEnabled(sourceId: string, enabled: boolean): Promise<SetJobSourceEnabledResult> {
  try {
    const existing = await prisma.authorizedJobSource.findUnique({
      where: { id: sourceId },
      select: { id: true, authorizationStatus: true },
    });
    if (!existing) {
      return { success: false, error: "Job source not found." };
    }

    if (enabled && existing.authorizationStatus !== "verified") {
      return {
        success: false,
        error: "This source's usage authorization has not been verified yet. Mark it as verified before enabling it.",
      };
    }

    await prisma.authorizedJobSource.update({ where: { id: sourceId }, data: { enabled } });
    return { success: true };
  } catch (error) {
    console.error("setJobSourceEnabled failed", error);
    return { success: false, error: "We couldn't update this source right now. Please try again." };
  }
}

export type SetJobSourceAuthorizationResult = { success: true } | { success: false; error: string };

/**
 * Records (or clears) the explicit authorization decision for a source.
 * Never called automatically by anything in this codebase — an admin
 * must take this action deliberately. `reference` is a short,
 * non-sensitive note only (e.g. "Employer provided approved RaaS feed")
 * — never a credential, legal document, or email content; callers must
 * not pass anything sensitive here.
 *
 * Marking a source "unverified" (revoking authorization) also disables
 * it immediately in the same transaction — an unauthorized source must
 * never remain enabled, even for a moment.
 */
export async function setJobSourceAuthorization(
  sourceId: string,
  verified: boolean,
  reference: string | null
): Promise<SetJobSourceAuthorizationResult> {
  try {
    const existing = await prisma.authorizedJobSource.findUnique({ where: { id: sourceId }, select: { id: true } });
    if (!existing) {
      return { success: false, error: "Job source not found." };
    }

    const trimmedReference = reference?.trim() || null;

    await prisma.authorizedJobSource.update({
      where: { id: sourceId },
      data: verified
        ? {
            authorizationStatus: "verified",
            authorizationVerifiedAt: new Date(),
            authorizationReference: trimmedReference,
          }
        : {
            authorizationStatus: "unverified",
            authorizationVerifiedAt: null,
            authorizationReference: trimmedReference,
            enabled: false,
          },
    });
    return { success: true };
  } catch (error) {
    console.error("setJobSourceAuthorization failed", error);
    return { success: false, error: "We couldn't update this source's authorization right now. Please try again." };
  }
}
