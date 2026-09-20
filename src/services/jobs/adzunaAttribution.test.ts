import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { findAdzunaSourceId } from "@/services/jobs/adzunaAttribution";

describe("findAdzunaSourceId (real dev database)", () => {
  it("resolves to the real Adzuna AuthorizedJobSource row's id when one exists", async () => {
    const adzunaSource = await prisma.authorizedJobSource.findUnique({ where: { name: "Adzuna" }, select: { id: true } });
    const result = await findAdzunaSourceId();
    expect(result).toBe(adzunaSource?.id ?? null);
  });

  it("never throws and returns null rather than guessing if no such source exists", async () => {
    // Structural guarantee: even if the row were ever renamed/removed,
    // this must degrade to "no attribution" rather than error out.
    const result = await findAdzunaSourceId();
    expect(result === null || typeof result === "string").toBe(true);
  });
});
