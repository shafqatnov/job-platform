import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getBlogCategoryBySlug } from "@/constants/blogCategories";
import { getPublishedBlogPostsByCategory } from "@/lib/blog/getBlogPosts";
import { Section } from "@/components/Section";
import { BlogPostCard } from "@/features/blog/BlogPostCard";
import { Breadcrumbs, breadcrumbJsonLd, type BreadcrumbItem } from "@/components/Breadcrumbs";
import { getConfiguredSiteUrl } from "@/lib/siteUrl";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const category = getBlogCategoryBySlug(slug);

  if (!category) {
    return { title: "Blog" };
  }

  const title = `${category.name} Articles`;
  const description = category.description;

  // An empty category page still loads for visitors, but is never offered
  // to search engines (no canonical, noindex) until it has a published
  // post — matching the sitemap, which also omits empty categories.
  if (getPublishedBlogPostsByCategory(category.slug).length === 0) {
    return { title, description, robots: { index: false, follow: true } };
  }

  const siteUrl = getConfiguredSiteUrl();
  const path = `/blog/category/${category.slug}`;

  return {
    title,
    description,
    ...(siteUrl ? { alternates: { canonical: `${siteUrl}${path}` } } : {}),
    openGraph: {
      title,
      description,
      type: "website",
      ...(siteUrl ? { url: `${siteUrl}${path}` } : {}),
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default async function BlogCategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const category = getBlogCategoryBySlug(slug);

  if (!category) {
    notFound();
  }

  const posts = getPublishedBlogPostsByCategory(category.slug);

  const breadcrumbItems: BreadcrumbItem[] = [
    { label: "Home", href: "/" },
    { label: "Blog", href: "/blog" },
    { label: category.name },
  ];
  const siteUrl = getConfiguredSiteUrl();
  const breadcrumbListJsonLd = breadcrumbJsonLd(breadcrumbItems, siteUrl);
  const breadcrumbJsonLdString = JSON.stringify(breadcrumbListJsonLd).replace(/</g, "\\u003c");

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbJsonLdString }} />
      <Section aria-labelledby="blog-category-heading">
        <div className="mb-10 flex flex-col gap-2">
          <Breadcrumbs items={breadcrumbItems} />
          <h1 id="blog-category-heading" className="text-2xl font-semibold text-foreground sm:text-3xl">
            {category.name}
          </h1>
          <p className="text-muted-foreground">{category.description}</p>
        </div>

        {posts.length === 0 ? (
          <p className="text-muted-foreground">No articles published in this category yet. Check back soon.</p>
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
