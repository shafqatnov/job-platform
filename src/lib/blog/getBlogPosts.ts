import fs from "node:fs";
import path from "node:path";
import { cache } from "react";
import { parseBlogMarkdown } from "@/lib/blog/parseMarkdown";
import type { BlogPost } from "@/lib/blog/types";

const BLOG_CONTENT_DIR = path.join(process.cwd(), "src/content/blog");

/**
 * Reads and parses every .md file in src/content/blog/ once per request
 * (React cache()), matching getOilAndGasHubData's own per-request caching
 * convention. File-system reads are cheap here (a handful of small
 * Markdown files, not a database) and this runs server-side only.
 */
export const getAllBlogPosts = cache((): BlogPost[] => {
  const filenames = fs.readdirSync(BLOG_CONTENT_DIR).filter((name) => name.endsWith(".md"));
  const posts = filenames.map((filename) => {
    const raw = fs.readFileSync(path.join(BLOG_CONTENT_DIR, filename), "utf8");
    return parseBlogMarkdown(raw);
  });
  return posts.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
});

/** Posts eligible for public listing/indexing — excludes draft: true. */
export function getPublishedBlogPosts(): BlogPost[] {
  return getAllBlogPosts().filter((post) => !post.draft);
}

/**
 * Looks up a post by slug regardless of draft status — the detail page
 * itself is what renders the "DRAFT" banner (see blog/[slug]/page.tsx),
 * so a draft is still directly reachable for internal review by its own
 * URL, just never linked from a listing page and never indexed.
 */
export function getBlogPostBySlug(slug: string): BlogPost | undefined {
  return getAllBlogPosts().find((post) => post.slug === slug);
}

export function getPublishedBlogPostsByCategory(categorySlug: string): BlogPost[] {
  return getPublishedBlogPosts().filter((post) => post.categorySlug === categorySlug);
}
