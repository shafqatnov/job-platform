export type BlogCategoryOption = {
  slug: string;
  name: string;
  description: string;
};

/**
 * Reference list of blog content categories, matching the 5 content-strategy
 * groupings from the Jobnura Blog feasibility investigation. Deliberately a
 * separate taxonomy from JOB_CATEGORIES (src/constants/categories.ts) — blog
 * topics (career guidance, certifications) are not the same concept as job
 * listing categories (employer-posted roles), even where names overlap.
 */
export const BLOG_CATEGORIES: BlogCategoryOption[] = [
  {
    slug: "offshore-rig-careers",
    name: "Offshore & Rig Careers",
    description: "Life, roles, and career paths on offshore platforms and rigs.",
  },
  {
    slug: "drilling-oilfield-careers",
    name: "Drilling & Oilfield Careers",
    description: "Drilling roles, oilfield job types, and how to get started.",
  },
  {
    slug: "certifications-training",
    name: "Certifications & Training",
    description: "BOSIET, HUET, H2S, OPITO, IWCF, IADC, and other industry training explained.",
  },
  {
    slug: "gulf-employment-guidance",
    name: "Gulf Employment Guidance",
    description: "Working in Saudi Arabia, Qatar, UAE, and other Gulf oil & gas markets.",
  },
  {
    slug: "cv-interview-prep",
    name: "CV & Interview Preparation",
    description: "CVs, interviews, and avoiding recruitment scams in oil & gas hiring.",
  },
];

export function getBlogCategoryBySlug(slug: string): BlogCategoryOption | undefined {
  return BLOG_CATEGORIES.find((category) => category.slug === slug);
}
