import { prisma } from "@/lib/prisma";
import type { JobSourceType } from "@/generated/prisma/enums";

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
  }));
}

export type SetJobSourceEnabledResult = { success: true } | { success: false; error: string };

/**
 * Toggles enabled/disabled only — no other field is editable through
 * this Phase-1 registry surface. Enabling a row here does not trigger
 * any import; no connector currently reads this flag at all.
 */
export async function setJobSourceEnabled(sourceId: string, enabled: boolean): Promise<SetJobSourceEnabledResult> {
  try {
    const existing = await prisma.authorizedJobSource.findUnique({ where: { id: sourceId }, select: { id: true } });
    if (!existing) {
      return { success: false, error: "Job source not found." };
    }

    await prisma.authorizedJobSource.update({ where: { id: sourceId }, data: { enabled } });
    return { success: true };
  } catch (error) {
    console.error("setJobSourceEnabled failed", error);
    return { success: false, error: "We couldn't update this source right now. Please try again." };
  }
}
