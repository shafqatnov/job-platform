import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadBlogPostsFromDir } from "@/lib/blog/getBlogPosts";

const validPost = (slug: string, publishedAt: string) => `---
title: ${slug}
slug: ${slug}
description: A test post.
categorySlug: drilling-oilfield-careers
author: Jobnura
publishedAt: ${publishedAt}
draft: true
---

Body text.
`;

let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "jobnura-blog-test-"));
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("loadBlogPostsFromDir (fault tolerance)", () => {
  it("loads every valid .md file, newest first, and ignores non-Markdown files", () => {
    fs.writeFileSync(path.join(dir, "older.md"), validPost("older", "2026-01-01"));
    fs.writeFileSync(path.join(dir, "newer.md"), validPost("newer", "2026-06-01"));
    fs.writeFileSync(path.join(dir, "notes.txt"), "not a post");

    const posts = loadBlogPostsFromDir(dir, vi.fn());
    expect(posts.map((post) => post.slug)).toEqual(["newer", "older"]);
  });

  it("skips a malformed file, logs it by filename, and still returns the valid posts", () => {
    fs.writeFileSync(path.join(dir, "good.md"), validPost("good", "2026-01-01"));
    fs.writeFileSync(path.join(dir, "no-frontmatter.md"), "Just text, no frontmatter.");
    fs.writeFileSync(path.join(dir, "bad-draft.md"), validPost("bad-draft", "2026-02-01").replace("draft: true", "draft: yes"));
    const logError = vi.fn();

    const posts = loadBlogPostsFromDir(dir, logError);

    expect(posts.map((post) => post.slug)).toEqual(["good"]);
    expect(logError).toHaveBeenCalledTimes(2);
    const messages = logError.mock.calls.map(([message]) => message).join("\n");
    expect(messages).toContain("no-frontmatter.md");
    expect(messages).toContain("bad-draft.md");
  });

  it("a malformed file is never treated as a published post (fails closed)", () => {
    fs.writeFileSync(path.join(dir, "bad-draft.md"), validPost("bad-draft", "2026-02-01").replace("draft: true", "draft: yes"));
    const posts = loadBlogPostsFromDir(dir, vi.fn());
    expect(posts.filter((post) => !post.draft)).toHaveLength(0);
  });

  it("returns no posts (instead of throwing) when the content directory does not exist", () => {
    const logError = vi.fn();
    expect(loadBlogPostsFromDir(path.join(dir, "missing"), logError)).toEqual([]);
    expect(logError).toHaveBeenCalledTimes(1);
  });
});
