import type { Metadata } from "next";
import { Section } from "@/components/Section";
import { getPublishedBlogPosts } from "@/lib/blog/getBlogPosts";
import { BLOG_CATEGORIES } from "@/constants/blogCategories";
import { BlogPostCard } from "@/features/blog/BlogPostCard";
import { getConfiguredSiteUrl } from "@/lib/siteUrl";
import Link from "next/link";

const TITLE = "Oil & Gas Career Blog";
const DESCRIPTION =
  "Career guidance, certification explainers, and Gulf employment guidance for oil & gas job seekers, from Jobnura.";
const path = "/blog";

export async function generateMetadata(): Promise<Metadata> {
  // While zero articles are published, the empty blog home still loads for
  // visitors but is never offered to search engines (no canonical, noindex)
  // — matching the sitemap, which also omits /blog until then.
  if (getPublishedBlogPosts().length === 0) {
    return { title: TITLE, description: DESCRIPTION, robots: { index: false, follow: true } };
  }

  const siteUrl = getConfiguredSiteUrl();

  return {
    title: TITLE,
    description: DESCRIPTION,
    ...(siteUrl ? { alternates: { canonical: `${siteUrl}${path}` } } : {}),
    openGraph: {
      title: `${TITLE} | Jobnura`,
      description: DESCRIPTION,
      type: "website",
      ...(siteUrl ? { url: `${siteUrl}${path}` } : {}),
    },
    twitter: {
      card: "summary",
      title: `${TITLE} | Jobnura`,
      description: DESCRIPTION,
    },
  };
}

export default function BlogHomePage() {
  const posts = getPublishedBlogPosts();

  return (
    <>
      <Section aria-labelledby="blog-heading" className="pb-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-3 text-center">
          <h1 id="blog-heading" className="text-2xl font-semibold text-foreground sm:text-3xl">
            Oil & Gas Career Blog
          </h1>
          <p className="text-muted-foreground">
            Career guidance, certification explainers, and Gulf employment guidance for oil & gas
            job seekers.
          </p>
        </div>
      </Section>

      <Section className="pt-0" aria-labelledby="blog-categories-heading">
        <h2 id="blog-categories-heading" className="sr-only">
          Browse by category
        </h2>
        <div className="flex flex-wrap justify-center gap-2">
          {BLOG_CATEGORIES.map((category) => (
            <Link
              key={category.slug}
              href={`/blog/category/${category.slug}`}
              className="rounded-full border border-border px-4 py-1.5 text-sm text-foreground transition-colors hover:bg-surface-muted"
            >
              {category.name}
            </Link>
          ))}
        </div>
      </Section>

      <Section className="pt-0" aria-labelledby="blog-posts-heading">
        <h2 id="blog-posts-heading" className="sr-only">
          Latest articles
        </h2>
        {posts.length === 0 ? (
          <p className="mx-auto max-w-md text-center text-muted-foreground">
            No articles have been published yet. Check back soon.
          </p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <BlogPostCard key={post.slug} post={post} />
            ))}
          </div>
        )}
      </Section>
    </>
  );
}
