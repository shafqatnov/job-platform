import { describe, expect, it, vi } from "vitest";
import type { BlogPost } from "@/lib/blog/types";

// Real implementations (the real Markdown files — all 8 still drafts) unless
// a test overrides once with mockReturnValueOnce to simulate a published post.
vi.mock("@/lib/blog/getBlogPosts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/blog/getBlogPosts")>();
  return {
    ...actual,
    getPublishedBlogPosts: vi.fn(actual.getPublishedBlogPosts),
    getPublishedBlogPostsByCategory: vi.fn(actual.getPublishedBlogPostsByCategory),
  };
});

import { getPublishedBlogPosts, getPublishedBlogPostsByCategory } from "@/lib/blog/getBlogPosts";
import { generateMetadata as generateBlogHomeMetadata } from "@/app/(public)/blog/page";
import { generateMetadata as generateCategoryMetadata } from "@/app/(public)/blog/category/[slug]/page";

const publishedFixture: BlogPost = {
  title: "Published Fixture",
  slug: "published-fixture",
  description: "Fixture",
  categorySlug: "certifications-training",
  author: "Jobnura",
  publishedAt: "2026-11-01",
  bodyHtml: "<p>Body</p>",
  readingTimeMinutes: 1,
};

const categoryParams = (slug: string) => ({ params: Promise.resolve({ slug }) });

describe("/blog indexing", () => {
  it("is noindex (follow) with no canonical while zero articles are published", async () => {
    const metadata = await generateBlogHomeMetadata();
    expect(metadata.robots).toEqual({ index: false, follow: true });
    expect(metadata.alternates).toBeUndefined();
  });

  it("becomes indexable once an article is published", async () => {
    vi.mocked(getPublishedBlogPosts).mockReturnValueOnce([publishedFixture]);
    const metadata = await generateBlogHomeMetadata();
    expect(metadata.robots).toBeUndefined();
    expect(metadata.title).toBe("Oil & Gas Career Blog");
  });
});

describe("/blog/category/[slug] indexing", () => {
  it("an empty category is noindex (follow) with no canonical", async () => {
    const metadata = await generateCategoryMetadata(categoryParams("certifications-training"));
    expect(metadata.robots).toEqual({ index: false, follow: true });
    expect(metadata.alternates).toBeUndefined();
    expect(metadata.title).toBe("Certifications & Training Articles");
  });

  it("a category with a published article stays indexable", async () => {
    vi.mocked(getPublishedBlogPostsByCategory).mockReturnValueOnce([publishedFixture]);
    const metadata = await generateCategoryMetadata(categoryParams("certifications-training"));
    expect(metadata.robots).toBeUndefined();
  });

  it("an unknown category is unaffected (page itself returns 404)", async () => {
    const metadata = await generateCategoryMetadata(categoryParams("not-a-category"));
    expect(metadata).toEqual({ title: "Blog" });
  });
});
