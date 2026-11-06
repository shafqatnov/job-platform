import Link from "next/link";
import { Card } from "@/components/Card";
import { getBlogCategoryBySlug } from "@/constants/blogCategories";
import type { BlogPost } from "@/lib/blog/types";

export type BlogPostCardProps = {
  post: Pick<BlogPost, "title" | "slug" | "description" | "categorySlug" | "publishedAt" | "readingTimeMinutes" | "draft">;
};

/** One post summary card, shared by the blog homepage and category pages. */
export function BlogPostCard({ post }: BlogPostCardProps) {
  const category = getBlogCategoryBySlug(post.categorySlug);

  return (
    <Card padding="lg" className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-brand-600">
        {category ? <span>{category.name}</span> : null}
        {post.draft ? (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">Draft</span>
        ) : null}
      </div>
      <h3 className="text-lg font-semibold text-foreground">
        <Link href={`/blog/${post.slug}`} className="hover:underline">
          {post.title}
        </Link>
      </h3>
      <p className="text-sm text-muted-foreground">{post.description}</p>
      <p className="text-xs text-muted-foreground">
        {new Date(post.publishedAt).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
        {" · "}
        {post.readingTimeMinutes} min read
      </p>
    </Card>
  );
}
