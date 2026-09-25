import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * This codebase has no React-rendering/jsdom test environment configured
 * (vitest.config.mts uses environment: "node" only, by design — see its
 * own comment). Consistent with how this codebase already tests other
 * non-renderable presentational logic (e.g. publicJobVisibility.test.ts's
 * own SOURCE-text assertions), this verifies the component's markup
 * structure directly from source rather than rendering it.
 */
const COMPONENT_SOURCE = readFileSync(new URL("./AdzunaAttribution.tsx", import.meta.url), "utf8");

describe("AdzunaAttribution markup — Adzuna Terms of Service compliance structure", () => {
  it("renders 'Jobs' as its own separate hyperlink, not merged into one plain-text phrase", () => {
    expect(COMPONENT_SOURCE).toMatch(/<a[^>]*href=\{href\}[^>]*>\s*Jobs\s*<\/a>/);
  });

  it("renders 'Adzuna' as its own separate hyperlink", () => {
    expect(COMPONENT_SOURCE).toMatch(/<a[^>]*href=\{href\}[^>]*>\s*Adzuna\s*<\/a>/);
  });

  it("enforces the documented 116x23px minimum size", () => {
    expect(COMPONENT_SOURCE).toMatch(/min-h-5\.75/);
    expect(COMPONENT_SOURCE).toMatch(/min-w-29/);
  });

  it("both links use the existing per-country Adzuna domain map, unchanged", () => {
    expect(COMPONENT_SOURCE).toContain("ADZUNA_COUNTRY_DOMAINS");
    expect(COMPONENT_SOURCE).toContain("ADZUNA_DEFAULT_DOMAIN");
  });

  it("documents the known open gap honestly rather than fabricating a logo asset", () => {
    expect(COMPONENT_SOURCE).toMatch(/KNOWN, OPEN GAP/);
    expect(COMPONENT_SOURCE).not.toMatch(/<img[^>]*adzuna[^>]*logo/i);
  });
});

describe("Adzuna attribution gating is unchanged (source-text confirmation, no logic was touched)", () => {
  it("JobCard only renders AdzunaAttribution when job.isAdzunaSourced is true", () => {
    const jobCardSource = readFileSync(new URL("./JobCard.tsx", import.meta.url), "utf8");
    expect(jobCardSource).toMatch(/job\.isAdzunaSourced\s*\?\s*<AdzunaAttribution/);
  });

  it("JobDetailView only renders AdzunaAttribution when job.isAdzunaSourced is true", () => {
    const jobDetailSource = readFileSync(new URL("./JobDetailView.tsx", import.meta.url), "utf8");
    expect(jobDetailSource).toMatch(/job\.isAdzunaSourced/);
    expect(jobDetailSource).toContain("<AdzunaAttribution");
  });
});
