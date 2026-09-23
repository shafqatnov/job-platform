import { describe, expect, it } from "vitest";
import AdminDashboardPage from "@/app/(dashboard)/admin/page";
import { listPendingLocationReviews } from "@/services/admin/locationReviews";

type Loose = { type?: unknown; props?: Record<string, unknown> };

/**
 * Covers the discoverability fix (Jobnura — Fix Imported Job Review
 * Discoverability and Silent Location-Stuck Workflow): the Admin
 * Dashboard must link to /admin/unknown-locations, and the count shown
 * there must come from the same real query the unknown-locations page
 * itself already uses (listPendingLocationReviews) — never a hardcoded
 * or invented number. Calls the Server Component function directly and
 * inspects the returned element tree, mirroring the existing pattern in
 * src/app/(public)/category/[slug]/page.test.ts — no DOM/jsdom involved.
 */
describe("AdminDashboardPage (real dev database)", () => {
  it("links to /admin/unknown-locations, with a count matching the real listPendingLocationReviews() query", async () => {
    const [element, expectedReviews] = await Promise.all([AdminDashboardPage(), listPendingLocationReviews()]);

    const cards = (element.props.children as Loose[])[1].props?.children as Loose[];
    const unknownLocationsCard = cards.find((card) => {
      const cardChildren = card.props?.children as Loose[];
      const heading = cardChildren?.[0];
      return (heading?.props?.children as string) === "Unknown locations";
    });

    expect(unknownLocationsCard).toBeDefined();
    const cardChildren = unknownLocationsCard!.props!.children as Loose[];

    const countParagraph = cardChildren[1];
    const countText = countParagraph.props?.children as unknown[];
    expect(countText[0]).toBe(expectedReviews.length);

    const link = cardChildren[2];
    expect(link.props?.href).toBe("/admin/unknown-locations");
  });

  it("does not change the existing 'Imported jobs' card's own link or presence", async () => {
    const element = await AdminDashboardPage();
    const cards = (element.props.children as Loose[])[1].props?.children as Loose[];

    const importedJobsCard = cards.find((card) => {
      const cardChildren = card.props?.children as Loose[];
      return (cardChildren?.[0]?.props?.children as string) === "Imported jobs";
    });

    expect(importedJobsCard).toBeDefined();
    const link = (importedJobsCard!.props!.children as Loose[])[2];
    expect(link.props?.href).toBe("/admin/imported-jobs");
  });
});
