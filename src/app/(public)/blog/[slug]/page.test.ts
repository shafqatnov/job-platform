import { describe, expect, it } from "vitest";
import { buildBlogBreadcrumbItems } from "@/app/(public)/blog/[slug]/page";

describe("buildBlogBreadcrumbItems", () => {
  it("includes the category breadcrumb when the category slug is real", () => {
    const items = buildBlogBreadcrumbItems({
      title: "Example Article",
      categorySlug: "drilling-oilfield-careers",
    });
    expect(items).toEqual([
      { label: "Home", href: "/" },
      { label: "Blog", href: "/blog" },
      { label: "Drilling & Oilfield Careers", href: "/blog/category/drilling-oilfield-careers" },
      { label: "Example Article" },
    ]);
  });

  it("omits the category breadcrumb when the category slug doesn't match a real category", () => {
    const items = buildBlogBreadcrumbItems({
      title: "Example Article",
      categorySlug: "not-a-real-category",
    });
    expect(items).toEqual([
      { label: "Home", href: "/" },
      { label: "Blog", href: "/blog" },
      { label: "Example Article" },
    ]);
  });
});
