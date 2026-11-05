import { describe, expect, it } from "vitest";
import { markdownToHtml, parseBlogMarkdown, parseFrontmatter } from "@/lib/blog/parseMarkdown";

const VALID_POST = `---
title: Example Title
slug: example-title
description: An example description.
categorySlug: drilling-oilfield-careers
author: Jobnura Editorial Team
publishedAt: 2026-11-01
draft: true
---

## Heading Two

A paragraph with **bold** and *italic* text, and a [link](https://example.com).

- First item
- Second item
`;

describe("parseFrontmatter", () => {
  it("parses required fields and the optional draft boolean", () => {
    const { frontmatter, body } = parseFrontmatter(VALID_POST);
    expect(frontmatter).toEqual({
      title: "Example Title",
      slug: "example-title",
      description: "An example description.",
      categorySlug: "drilling-oilfield-careers",
      author: "Jobnura Editorial Team",
      publishedAt: "2026-11-01",
      draft: true,
    });
    expect(body.trim().startsWith("## Heading Two")).toBe(true);
  });

  it("throws when the frontmatter block never closes", () => {
    expect(() => parseFrontmatter("---\ntitle: X\n")).toThrow(/closing/);
  });

  it("throws when a required field is missing", () => {
    const missingSlug = VALID_POST.replace("slug: example-title\n", "");
    expect(() => parseFrontmatter(missingSlug)).toThrow(/slug/);
  });
});

describe("markdownToHtml", () => {
  it("converts headings, paragraphs, bold/italic, links, and lists", () => {
    const html = markdownToHtml(
      "## Heading Two\n\nA paragraph with **bold** and *italic* text, and a [link](https://example.com).\n\n- First item\n- Second item"
    );
    expect(html).toContain("<h2>Heading Two</h2>");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<em>italic</em>");
    expect(html).toContain('<a href="https://example.com" rel="noopener">link</a>');
    expect(html).toContain("<ul><li>First item</li><li>Second item</li></ul>");
  });

  it("escapes HTML special characters so content can't break out of the page", () => {
    const html = markdownToHtml("A <script>alert(1)</script> paragraph.");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("escapes a double quote inside a link URL so it can't break out of the href attribute", () => {
    const html = markdownToHtml('A [link](https://example.com/"onmouseover="alert(1)) in text.');
    expect(html).not.toContain('href="https://example.com/"onmouseover="alert(1"');
    expect(html).toContain("&quot;onmouseover=&quot;alert(1");
  });
});

describe("parseBlogMarkdown", () => {
  it("produces a full BlogPost with bodyHtml and a reading-time estimate", () => {
    const post = parseBlogMarkdown(VALID_POST);
    expect(post.title).toBe("Example Title");
    expect(post.draft).toBe(true);
    expect(post.bodyHtml).toContain("<h2>Heading Two</h2>");
    expect(post.readingTimeMinutes).toBeGreaterThanOrEqual(1);
  });

  it("defaults readingTimeMinutes to at least 1 for a very short post", () => {
    const shortPost = VALID_POST.replace(
      /A paragraph with[\s\S]*Second item\n/,
      "Short.\n"
    );
    const post = parseBlogMarkdown(shortPost);
    expect(post.readingTimeMinutes).toBe(1);
  });
});
