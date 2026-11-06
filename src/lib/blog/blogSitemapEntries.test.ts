import { describe, expect, it } from "vitest";
import { buildBlogSitemapEntries } from "@/lib/blog/blogSitemapEntries";
import { getPublishedBlogPosts } from "@/lib/blog/getBlogPosts";
import type { BlogPost } from "@/lib/blog/types";

const BASE = "https://example.test";
const NOW = new Date("2026-11-06T00:00:00Z");

const post = (slug: string, categorySlug: string): BlogPost => ({
  title: slug,
  slug,
  description: "Fixture",
  categorySlug,
  author: "Jobnura",
  publishedAt: "2026-11-01",
  bodyHtml: "<p>Body</p>",
  readingTimeMinutes: 1,
});

const urls = (posts: BlogPost[]) => buildBlogSitemapEntries(posts, BASE, NOW).map((entry) => entry.url);

describe("buildBlogSitemapEntries", () => {
  it("lists nothing for the blog — not even /blog — while there are zero published posts", () => {
    expect(urls([])).toEqual([]);
  });

  it("the real content currently produces no blog sitemap entries (all 8 articles are drafts)", () => {
    expect(urls(getPublishedBlogPosts())).toEqual([]);
  });

  it("lists /blog, the post, and only its populated category once a post is published", () => {
    expect(urls([post("first-post", "certifications-training")])).toEqual([
      `${BASE}/blog`,
      `${BASE}/blog/first-post`,
      `${BASE}/blog/category/certifications-training`,
    ]);
  });

  it("lists each populated category once, even with several posts in it", () => {
    const entries = urls([
      post("a", "certifications-training"),
      post("b", "certifications-training"),
      post("c", "cv-interview-prep"),
    ]);
    expect(entries.filter((url) => url.includes("/blog/category/"))).toEqual([
      `${BASE}/blog/category/certifications-training`,
      `${BASE}/blog/category/cv-interview-prep`,
    ]);
  });
});
