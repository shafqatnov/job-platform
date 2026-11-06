import fs from "node:fs";
import path from "node:path";
import { cache } from "react";
import { parseBlogMarkdown } from "@/lib/blog/parseMarkdown";
import type { BlogPost } from "@/lib/blog/types";

const BLOG_CONTENT_DIR = path.join(process.cwd(), "src/content/blog");

type ErrorLogger = (message: string, error: unknown) => void;

const logToConsole: ErrorLogger = (message, error) => console.error(message, error);

/**
 * Reads and parses every .md file in `dir`, fault-tolerantly.
 *
 * This feeds the site-wide Header/Footer (via hasPublishedBlogPosts) and
 * sitemap.xml, so a single malformed article must never take down every
 * public page — including job pages — or the whole sitemap. Instead:
 *  - a missing content directory yields no posts;
 *  - a file that fails to parse is skipped (never shown, never listed —
 *    i.e. it fails closed) and the error is logged with its filename.
 *
 * Strict validation still happens in src/lib/blog/content.test.ts, which
 * parses every real article without this tolerance, so a malformed file
 * is caught by the test suite rather than silently ignored.
 */
export function loadBlogPostsFromDir(dir: string, logError: ErrorLogger = logToConsole): BlogPost[] {
  let filenames: string[];
  try {
    filenames = fs.readdirSync(dir).filter((name) => name.endsWith(".md"));
  } catch (error) {
    logError(`[blog] Could not read blog content directory ${dir}; treating it as empty.`, error);
    return [];
  }

  const posts: BlogPost[] = [];
  for (const filename of filenames) {
    try {
      const raw = fs.readFileSync(path.join(dir, filename), "utf8");
      posts.push(parseBlogMarkdown(raw));
    } catch (error) {
      logError(`[blog] Skipping malformed blog post ${filename}.`, error);
    }
  }

  return posts.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
}

/**
 * Every post in src/content/blog/, once per request (React cache()),
 * matching getOilAndGasHubData's own per-request caching convention.
 * File-system reads are cheap here (a handful of small Markdown files,
 * not a database) and this runs server-side only.
 */
export const getAllBlogPosts = cache((): BlogPost[] => loadBlogPostsFromDir(BLOG_CONTENT_DIR));

/** Posts eligible for public listing/indexing — excludes draft: true. */
export function getPublishedBlogPosts(): BlogPost[] {
  return getAllBlogPosts().filter((post) => !post.draft);
}

/** Whether the Blog nav/footer link should be shown (see src/constants/navigation.ts). */
export function hasPublishedBlogPosts(): boolean {
  return getPublishedBlogPosts().length > 0;
}

/**
 * Looks up a post by slug regardless of draft status. The detail page
 * (blog/[slug]/page.tsx) decides what to do with a draft: a 404 in any
 * production build, or the "DRAFT" banner under `next dev` for internal
 * review. A draft is never linked from a listing page and never indexed.
 */
export function getBlogPostBySlug(slug: string): BlogPost | undefined {
  return getAllBlogPosts().find((post) => post.slug === slug);
}

export function getPublishedBlogPostsByCategory(categorySlug: string): BlogPost[] {
  return getPublishedBlogPosts().filter((post) => post.categorySlug === categorySlug);
}
