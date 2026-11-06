/**
 * Renders a blog post's already-converted HTML body (see
 * src/lib/blog/parseMarkdown.ts). The HTML originates only from Markdown
 * files committed to this repository under src/content/blog/ — never
 * from user input or an external source — so dangerouslySetInnerHTML is
 * safe here in the same sense it already is for the JobPosting/
 * BreadcrumbList JSON-LD strings elsewhere in this app.
 *
 * Styling uses Tailwind's child-element selectors (`[&_h2]:...`), the
 * same technique PolicySection.tsx already uses for its own `ul`
 * styling — no @tailwindcss/typography plugin is installed, so this
 * avoids adding one for a handful of element types.
 */
export function ArticleBody({ html }: { html: string }) {
  return (
    <div
      className="flex flex-col gap-4 text-muted-foreground [&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-foreground [&_h3]:mt-4 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-foreground [&_a]:text-brand-600 [&_a]:underline [&_strong]:text-foreground [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-2 [&_ul]:pl-5"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
