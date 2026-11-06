import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseBlogMarkdown } from "@/lib/blog/parseMarkdown";
import { getBlogCategoryBySlug } from "@/constants/blogCategories";

/**
 * Strict validation of every real article in src/content/blog/.
 *
 * At runtime, getBlogPosts.ts deliberately skips a malformed file so it can
 * never break the site-wide Header/Footer, job pages or sitemap.xml. This
 * test is the counterweight: it parses each file WITHOUT that tolerance, so
 * a malformed article fails the test suite instead of silently disappearing.
 */
const CONTENT_DIR = path.join(process.cwd(), "src/content/blog");
const files = fs.readdirSync(CONTENT_DIR).filter((name) => name.endsWith(".md"));

describe("blog content files (strict validation)", () => {
  it("finds the blog content files", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)("%s parses strictly and uses a real category", (filename) => {
    const raw = fs.readFileSync(path.join(CONTENT_DIR, filename), "utf8");
    const post = parseBlogMarkdown(raw);
    expect(post.slug).toBe(filename.replace(/\.md$/, ""));
    expect(getBlogCategoryBySlug(post.categorySlug)).toBeDefined();
    expect(Number.isNaN(new Date(post.publishedAt).getTime())).toBe(false);
  });

  it("every slug is unique", () => {
    const slugs = files.map((filename) =>
      parseBlogMarkdown(fs.readFileSync(path.join(CONTENT_DIR, filename), "utf8")).slug
    );
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
