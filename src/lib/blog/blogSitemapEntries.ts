import type { MetadataRoute } from "next";
import { BLOG_CATEGORIES } from "@/constants/blogCategories";
import type { BlogPost } from "@/lib/blog/types";

/**
 * Sitemap entries for the blog, built only from PUBLISHED posts (callers
 * pass getPublishedBlogPosts(); drafts are never listed). Pure — no
 * database or file access — so it is unit-testable without the dev
 * database that sitemap.test.ts needs.
 *
 * Same "only when genuinely populated" rule as the job country/category
 * entries in sitemap.ts:
 *  - /blog itself is listed only once at least one post is published;
 *  - a blog category is listed only when it has a published post.
 */
export function buildBlogSitemapEntries(
  publishedPosts: BlogPost[],
  baseUrl: string,
  now: Date
): MetadataRoute.Sitemap {
  if (publishedPosts.length === 0) {
    return [];
  }

  const blogHomeEntry: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/blog`, lastModified: now, changeFrequency: "daily", priority: 0.6 },
  ];

  const postEntries: MetadataRoute.Sitemap = publishedPosts.map((post) => ({
    url: `${baseUrl}/blog/${post.slug}`,
    lastModified: post.updatedAt ?? post.publishedAt,
    changeFrequency: "monthly",
    priority: 0.5,
  }));

  const categorySlugsWithPosts = new Set(publishedPosts.map((post) => post.categorySlug));
  const categoryEntries: MetadataRoute.Sitemap = BLOG_CATEGORIES.filter((category) =>
    categorySlugsWithPosts.has(category.slug)
  ).map((category) => ({
    url: `${baseUrl}/blog/category/${category.slug}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.4,
  }));

  return [...blogHomeEntry, ...postEntries, ...categoryEntries];
}
