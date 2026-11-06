import { describe, expect, it } from "vitest";
import { visibleNavItems } from "@/constants/navigation";

describe("visibleNavItems", () => {
  const items = [
    { label: "Home", href: "/" },
    { label: "Blog", href: "/blog" },
    { label: "About", href: "/about" },
  ];

  it("keeps the Blog link when showBlogLink is true", () => {
    expect(visibleNavItems(items, true)).toEqual(items);
  });

  it("removes only the Blog link when showBlogLink is false", () => {
    expect(visibleNavItems(items, false)).toEqual([
      { label: "Home", href: "/" },
      { label: "About", href: "/about" },
    ]);
  });

  it("is a no-op on a list with no Blog link", () => {
    const noBlog = [{ label: "Home", href: "/" }];
    expect(visibleNavItems(noBlog, false)).toEqual(noBlog);
  });
});
