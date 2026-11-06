import { afterEach, describe, expect, it, vi } from "vitest";
import type { BlogPost } from "@/lib/blog/types";

// getBlogPostBySlug keeps its real implementation (the real Markdown files)
// unless a test overrides it once with mockReturnValueOnce — needed because
// every real article is still draft: true, so a published post must be a
// fixture.
vi.mock("@/lib/blog/getBlogPosts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/blog/getBlogPosts")>();
  return { ...actual, getBlogPostBySlug: vi.fn(actual.getBlogPostBySlug) };
});

import { getAllBlogPosts, getBlogPostBySlug } from "@/lib/blog/getBlogPosts";
import BlogPostPage, {
  buildBlogBreadcrumbItems,
  generateMetadata,
  isDraftHiddenFromPublic,
} from "@/app/(public)/blog/[slug]/page";

const publishedFixture: BlogPost = {
  title: "Published Fixture Article",
  slug: "published-fixture-article",
  description: "A published fixture used only by this test.",
  categorySlug: "drilling-oilfield-careers",
  author: "Jobnura",
  publishedAt: "2026-01-01",
  bodyHtml: "<p>Body</p>",
  readingTimeMinutes: 1,
};

const params = (slug: string) => ({ params: Promise.resolve({ slug }) });

afterEach(() => {
  vi.unstubAllEnvs();
});

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

describe("blog draft protection", () => {
  it("every real article is still draft: true (none published by this change)", () => {
    const posts = getAllBlogPosts();
    expect(posts).toHaveLength(8);
    expect(posts.every((post) => post.draft === true)).toBe(true);
  });

  it("isDraftHiddenFromPublic hides drafts only in a production build", () => {
    expect(isDraftHiddenFromPublic({ draft: true }, "production")).toBe(true);
    expect(isDraftHiddenFromPublic({ draft: true }, "development")).toBe(false);
    expect(isDraftHiddenFromPublic({ draft: false }, "production")).toBe(false);
    expect(isDraftHiddenFromPublic({}, "production")).toBe(false);
  });

  it("draft metadata is noindex/nofollow", async () => {
    const metadata = await generateMetadata(params("bosiet-explained"));
    expect(metadata.robots).toEqual({ index: false, follow: false });
    expect(metadata.alternates).toBeUndefined();
    expect(metadata.openGraph).toBeUndefined();
  });

  it("published article metadata stays indexable (no robots restriction)", async () => {
    vi.mocked(getBlogPostBySlug).mockReturnValueOnce(publishedFixture);
    const metadata = await generateMetadata(params(publishedFixture.slug));
    expect(metadata.robots).toBeUndefined();
    expect(metadata.title).toBe(publishedFixture.title);
    expect(metadata.description).toBe(publishedFixture.description);
  });

  it("a draft article route throws notFound() (404) in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await expect(BlogPostPage(params("bosiet-explained"))).rejects.toMatchObject({
      digest: "NEXT_HTTP_ERROR_FALLBACK;404",
    });
  });

  it("a published article route still renders in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.mocked(getBlogPostBySlug).mockReturnValueOnce(publishedFixture);
    await expect(BlogPostPage(params(publishedFixture.slug))).resolves.toBeTruthy();
  });

  it("an unknown slug throws notFound() (404)", async () => {
    await expect(BlogPostPage(params("definitely-not-a-real-post"))).rejects.toMatchObject({
      digest: "NEXT_HTTP_ERROR_FALLBACK;404",
    });
  });
});
