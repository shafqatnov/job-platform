import { prisma } from "@/lib/prisma";

/**
 * Resolves the "Adzuna" AuthorizedJobSource row's id, or null if it
 * doesn't exist — the one signal that decides whether the mandatory
 * Adzuna attribution ("Jobs by Adzuna", see AdzunaAttribution.tsx)
 * renders for a given public Job. Job has no real foreign-key relation
 * to AuthorizedJobSource (importedSourceId is a plain string — see
 * detectImportedJobDuplicates.ts's own doc comment on this same schema
 * limitation), so callers compare a Job's own importedSourceId against
 * this id directly, e.g. `job.importedSourceId === adzunaSourceId`.
 * AuthorizedJobSource.name is @unique, so this is a single cheap,
 * indexed lookup — call it once per page/request, not once per job.
 *
 * Deliberately narrow: attribution must stay tied specifically to
 * Adzuna-sourced listings, never shown for a Greenhouse-imported or
 * employer-direct job just because it happens to be "imported" too.
 */
export async function findAdzunaSourceId(): Promise<string | null> {
  const adzunaSource = await prisma.authorizedJobSource.findUnique({
    where: { name: "Adzuna" },
    select: { id: true },
  });
  return adzunaSource?.id ?? null;
}
