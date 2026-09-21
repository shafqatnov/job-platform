import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * This project has no jsdom/React-rendering test environment configured
 * (see vitest.config.ts's own doc comment — every existing test
 * exercises pure service-layer logic). Rather than adding that
 * infrastructure just for one button, this verifies the exact wiring
 * and gating conditions structurally, by inspecting the component
 * source directly — the same pattern already used elsewhere in this
 * codebase for verifying wiring without rendering. Manual browser QA
 * (see this task's final report) is the definitive visual/interactive
 * confirmation.
 */
const TABLE_SOURCE = readFileSync(new URL("./JobSourcesTable.tsx", import.meta.url), "utf8");
const BUTTON_SOURCE = readFileSync(new URL("./AdzunaSyncNowButton.tsx", import.meta.url), "utf8");
const ACTION_SOURCE = readFileSync(new URL("./syncAdzunaNowAction.ts", import.meta.url), "utf8");

describe("Adzuna \"Sync Now\" button wiring", () => {
  it("is only rendered for the Adzuna source row, not any other source", () => {
    expect(TABLE_SOURCE).toMatch(/source\.name === ["']Adzuna["']\s*\?\s*<AdzunaSyncNowButton/);
  });

  it("eligibility is exactly (authorization verified) AND (enabled) — never one alone", () => {
    expect(TABLE_SOURCE).toMatch(/isEligible=\{isVerified && source\.enabled\}/);
  });

  it("the button is disabled while pending or when ineligible, never force-enabled", () => {
    expect(BUTTON_SOURCE).toMatch(/disabled=\{isPending \|\| !isEligible\}/);
  });

  it("shows \"Syncing…\" while pending", () => {
    expect(BUTTON_SOURCE).toContain("Syncing…");
  });

  it("never renders raw JSON — only the 6 labeled summary fields", () => {
    expect(BUTTON_SOURCE).not.toMatch(/JSON\.stringify/);
    for (const field of ["imported", "published", "adminReview", "duplicates", "rejected", "durationMs"]) {
      expect(BUTTON_SOURCE).toContain(`state.summary.${field}`);
    }
  });

  it("reuses the existing syncAdzunaJobs() — no second sync/pipeline implementation exists in this action", () => {
    expect(ACTION_SOURCE).toMatch(/import\s*\{\s*syncAdzunaJobs\s*\}\s*from ["']@\/services\/sync\/syncAdzunaJobs["']/);
    expect(ACTION_SOURCE).not.toMatch(/from ["']@\/services\/connectors\/adzunaConnector["']/);
    expect(ACTION_SOURCE).not.toMatch(/from ["']@\/services\/importers\/adzunaImporter["']/);
    expect(ACTION_SOURCE).not.toMatch(/from ["']@\/services\/ai\/normalizeImportedJob["']/);
    expect(ACTION_SOURCE).not.toMatch(/from ["']@\/services\/publishing\/publishImportedJob["']/);
  });

  it("never imports Prisma directly — it can only act through the existing services it calls", () => {
    expect(ACTION_SOURCE).not.toMatch(/from ["']@\/lib\/prisma["']/);
  });
});
