/**
 * Frontmatter fields every blog Markdown file in src/content/blog/ must
 * declare (see parseMarkdown.ts). Deliberately a flat, small set of real
 * fields only — no invented statistics/author-credential fields.
 */
export type BlogPostFrontmatter = {
  title: string;
  slug: string;
  description: string;
  categorySlug: string;
  author: string;
  publishedAt: string;
  updatedAt?: string;
  /** Marks a post as not ready for public listing/indexing (see getBlogPosts.ts). */
  draft?: boolean;
};

export type BlogPost = BlogPostFrontmatter & {
  bodyHtml: string;
  readingTimeMinutes: number;
};
