import type { BlogPost, BlogPostFrontmatter } from "@/lib/blog/types";

const FRONTMATTER_BOUNDARY = "---";
const WORDS_PER_MINUTE = 200;

/**
 * Minimal, dependency-free frontmatter parser for this project's own
 * narrow blog-post schema (flat string/boolean key: value pairs only —
 * no nested objects, no lists, no multi-line values). Matches this
 * codebase's existing convention of a small hand-rolled parser over a
 * new dependency for a bounded, known input shape (see the CSV parser
 * used for the ConnectingOilGas competitor analysis).
 *
 * Throws on a structurally invalid file rather than silently producing
 * a half-populated post — a malformed content file should fail the
 * build, not publish a broken page.
 */
export function parseFrontmatter(raw: string): { frontmatter: BlogPostFrontmatter; body: string } {
  const trimmed = raw.replace(/^﻿/, "");
  if (!trimmed.startsWith(FRONTMATTER_BOUNDARY)) {
    throw new Error("Blog post is missing its frontmatter block (must start with ---).");
  }

  const closingIndex = trimmed.indexOf(`\n${FRONTMATTER_BOUNDARY}`, FRONTMATTER_BOUNDARY.length);
  if (closingIndex === -1) {
    throw new Error("Blog post frontmatter block has no closing ---.");
  }

  const frontmatterBlock = trimmed.slice(FRONTMATTER_BOUNDARY.length, closingIndex).trim();
  const body = trimmed.slice(closingIndex + `\n${FRONTMATTER_BOUNDARY}`.length).replace(/^\s*\n/, "");

  const fields: Record<string, string | boolean> = {};
  for (const line of frontmatterBlock.split("\n")) {
    if (!line.trim()) continue;
    const separatorIndex = line.indexOf(":");
    if (separatorIndex === -1) {
      throw new Error(`Invalid frontmatter line (expected "key: value"): ${line}`);
    }
    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    fields[key] = value === "true" ? true : value === "false" ? false : value;
  }

  for (const requiredKey of ["title", "slug", "description", "categorySlug", "author", "publishedAt"]) {
    if (!fields[requiredKey]) {
      throw new Error(`Blog post frontmatter is missing required field "${requiredKey}".`);
    }
  }

  // Fail closed: a present-but-unrecognized draft value ("yes", "True", a
  // typo) must never be silently dropped, because an absent draft field
  // means "published". Only the exact literals true/false are accepted.
  if ("draft" in fields && typeof fields.draft !== "boolean") {
    throw new Error(
      `Invalid draft value "${String(fields.draft)}" in blog post frontmatter (expected true or false).`
    );
  }

  return {
    frontmatter: {
      title: String(fields.title),
      slug: String(fields.slug),
      description: String(fields.description),
      categorySlug: String(fields.categorySlug),
      author: String(fields.author),
      publishedAt: String(fields.publishedAt),
      ...(fields.updatedAt ? { updatedAt: String(fields.updatedAt) } : {}),
      ...(typeof fields.draft === "boolean" ? { draft: fields.draft } : {}),
    },
    body,
  };
}

/**
 * Escapes &, <, > for text nodes, and also " / ' so the same escaped
 * string stays safe when a markdown link's URL capture group (see
 * renderInline below) is interpolated straight into an href="..."
 * attribute — a literal quote in a URL can otherwise close the
 * attribute early and inject markup.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Applies inline markdown (bold, italic, links) to already-HTML-escaped
 * text. Order matters: bold before italic so "**x**" isn't first read as
 * two adjacent italics.
 */
function renderInline(escapedText: string): string {
  return escapedText
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" rel="noopener">$1</a>');
}

/**
 * Minimal Markdown -> HTML conversion covering exactly what this
 * project's draft articles use: paragraphs, ## / ### headings, "- "
 * bullet lists, bold/italic, and links. Not a general-purpose Markdown
 * engine — unsupported syntax (tables, code blocks, nested lists) is
 * rendered as a plain paragraph rather than silently mis-parsed.
 */
export function markdownToHtml(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const htmlBlocks: string[] = [];
  let paragraphLines: string[] = [];
  let listItems: string[] = [];

  function flushParagraph() {
    if (paragraphLines.length > 0) {
      htmlBlocks.push(`<p>${renderInline(escapeHtml(paragraphLines.join(" ")))}</p>`);
      paragraphLines = [];
    }
  }

  function flushList() {
    if (listItems.length > 0) {
      const items = listItems.map((item) => `<li>${renderInline(escapeHtml(item))}</li>`).join("");
      htmlBlocks.push(`<ul>${items}</ul>`);
      listItems = [];
    }
  }

  for (const line of lines) {
    const headingMatch = /^(#{2,3})\s+(.*)$/.exec(line);
    const listMatch = /^-\s+(.*)$/.exec(line);

    if (headingMatch) {
      flushParagraph();
      flushList();
      const level = headingMatch[1].length;
      htmlBlocks.push(`<h${level}>${renderInline(escapeHtml(headingMatch[2]))}</h${level}>`);
    } else if (listMatch) {
      flushParagraph();
      listItems.push(listMatch[1]);
    } else if (line.trim() === "") {
      flushParagraph();
      flushList();
    } else {
      flushList();
      paragraphLines.push(line.trim());
    }
  }
  flushParagraph();
  flushList();

  return htmlBlocks.join("\n");
}

/** Strips markdown/HTML syntax down to plain words, for a reading-time estimate. */
function countWords(markdown: string): number {
  const plain = markdown
    .replace(/<[^>]+>/g, " ")
    .replace(/[#*_`[\]()-]/g, " ")
    .trim();
  if (!plain) return 0;
  return plain.split(/\s+/).filter(Boolean).length;
}

export function parseBlogMarkdown(raw: string): BlogPost {
  const { frontmatter, body } = parseFrontmatter(raw);
  const wordCount = countWords(body);
  return {
    ...frontmatter,
    bodyHtml: markdownToHtml(body),
    readingTimeMinutes: Math.max(1, Math.round(wordCount / WORDS_PER_MINUTE)),
  };
}
