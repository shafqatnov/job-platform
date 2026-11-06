import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getBlogPostBySlug } from "@/lib/blog/getBlogPosts";
import { getBlogCategoryBySlug } from "@/constants/blogCategories";
import { Section } from "@/components/Section";
import { ArticleBody } from "@/features/blog/ArticleBody";
import { Breadcrumbs, breadcrumbJsonLd, type BreadcrumbItem } from "@/components/Breadcrumbs";
import { getConfiguredSiteUrl } from "@/lib/siteUrl";
import type { BlogPost } from "@/lib/blog/types";

/**
 * Pure (no DB/request access), mirrors buildJobBreadcrumbItems's own
 * reasoning in [country]/jobs/[slug]/page.tsx — kept directly testable.
 */
export function buildBlogBreadcrumbItems(
  post: Pick<BlogPost, "title" | "categorySlug">
): BreadcrumbItem[] {
  const category = getBlogCategoryBySlug(post.categorySlug);
  return [
    { label: "Home", href: "/" },
    { label: "Blog", href: "/blog" },
    ...(category ? [{ label: category.name, href: `/blog/category/${category.slug}` }] : []),
    { label: post.title },
  ];
}

/**
 * A draft is never served by a production build (`next build` / `next
 * start`, i.e. the public site and every Vercel deployment): its direct URL
 * returns a 404 there. Under `next dev` (NODE_ENV "development") a draft stays
 * reachable by its own URL for internal review, with the DRAFT banner.
 * Pure — the environment is passed in so it is directly testable.
 */
export function isDraftHiddenFromPublic(
  post: Pick<BlogPost, "draft">,
  nodeEnv: string | undefined = process.env.NODE_ENV
): boolean {
  return post.draft === true && nodeEnv === "production";
}

/** Exported so its wording is directly testable without a full render. */
export const DRAFT_BANNER_TEXT =
  "this article is unpublished and only partially fact-checked — some claims still need " +
  "verification before publication. It is not linked from any public listing and is not " +
  "indexed by search engines.";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPostBySlug(slug);

  if (!post) {
    return { title: "Blog" };
  }

  if (post.draft) {
    // Never indexable or followed, in any environment.
    return { title: "Blog", robots: { index: false, follow: false } };
  }

  const siteUrl = getConfiguredSiteUrl();
  const path = `/blog/${post.slug}`;

  return {
    title: post.title,
    description: post.description,
    ...(siteUrl ? { alternates: { canonical: `${siteUrl}${path}` } } : {}),
    openGraph: {
      title: post.title,
      description: post.description,
      type: "article",
      ...(siteUrl ? { url: `${siteUrl}${path}` } : {}),
    },
    twitter: {
      card: "summary",
      title: post.title,
      description: post.description,
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getBlogPostBySlug(slug);

  if (!post || isDraftHiddenFromPublic(post)) {
    notFound();
  }

  const breadcrumbItems = buildBlogBreadcrumbItems(post);
  const siteUrl = getConfiguredSiteUrl();
  const breadcrumbListJsonLd = breadcrumbJsonLd(breadcrumbItems, siteUrl);
  const breadcrumbJsonLdString = JSON.stringify(breadcrumbListJsonLd).replace(/</g, "\\u003c");

  // BlogPosting JSON-LD built only from real frontmatter fields — no
  // invented author credentials, word count claims, or ratings. Omitted
  // entirely for a draft post (never indexable structured data for
  // unpublished content), matching generateMetadata's own draft handling.
  const articleJsonLd: Record<string, unknown> | null = post.draft
    ? null
    : {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        headline: post.title,
        description: post.description,
        datePublished: post.publishedAt,
        ...(post.updatedAt ? { dateModified: post.updatedAt } : {}),
        author: { "@type": "Organization", name: post.author },
        ...(siteUrl ? { mainEntityOfPage: `${siteUrl}/blog/${post.slug}` } : {}),
      };
  const articleJsonLdString = articleJsonLd
    ? JSON.stringify(articleJsonLd).replace(/</g, "\\u003c")
    : null;

  return (
    <>
      {articleJsonLdString ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: articleJsonLdString }} />
      ) : null}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbJsonLdString }} />
      <Section aria-labelledby="blog-post-heading">
        <div className="mx-auto max-w-3xl">
          <Breadcrumbs items={breadcrumbItems} />
          {post.draft ? (
            <div className="mb-6 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <strong>Draft:</strong> {DRAFT_BANNER_TEXT}
            </div>
          ) : null}
          <div className="mb-8 flex flex-col gap-2">
            <h1 id="blog-post-heading" className="text-2xl font-semibold text-foreground sm:text-3xl">
              {post.title}
            </h1>
            <p className="text-sm text-muted-foreground">
              By {post.author} ·{" "}
              {new Date(post.publishedAt).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
              {" · "}
              {post.readingTimeMinutes} min read
            </p>
          </div>
          <ArticleBody html={post.bodyHtml} />
        </div>
      </Section>
    </>
  );
}
