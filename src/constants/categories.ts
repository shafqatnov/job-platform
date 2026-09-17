export type CategoryOption = {
  slug: string;
  name: string;
};

/**
 * Reference list of common job categories for category-selector and
 * browse UI. Illustrative reference data only — not tied to real listing
 * counts, since no jobs exist in a database yet.
 */
export const JOB_CATEGORIES: CategoryOption[] = [
  { slug: "technology", name: "Technology" },
  { slug: "software-development", name: "Software Development" },
  { slug: "ai-machine-learning", name: "AI & Machine Learning" },
  { slug: "cyber-security", name: "Cyber Security" },
  { slug: "cloud", name: "Cloud" },
  { slug: "data-science", name: "Data Science" },
  { slug: "oil-gas", name: "Oil & Gas" },
  { slug: "petroleum", name: "Petroleum" },
  { slug: "drilling", name: "Drilling" },
  { slug: "offshore", name: "Offshore" },
  { slug: "mechanical-engineering", name: "Mechanical Engineering" },
  { slug: "electrical-engineering", name: "Electrical Engineering" },
  { slug: "civil-engineering", name: "Civil Engineering" },
  { slug: "chemical-engineering", name: "Chemical Engineering" },
  { slug: "energy", name: "Energy" },
  { slug: "mining", name: "Mining" },
  { slug: "construction", name: "Construction" },
  { slug: "manufacturing", name: "Manufacturing" },
  { slug: "healthcare", name: "Healthcare" },
  { slug: "doctors", name: "Doctors" },
  { slug: "nursing", name: "Nursing" },
  { slug: "finance", name: "Finance" },
  { slug: "accounting", name: "Accounting" },
  { slug: "banking", name: "Banking" },
  { slug: "marketing", name: "Marketing" },
  { slug: "sales", name: "Sales" },
  { slug: "design", name: "Design" },
  { slug: "customer-support", name: "Customer Support" },
  { slug: "operations", name: "Operations" },
  { slug: "human-resources", name: "Human Resources" },
  { slug: "education", name: "Education" },
  { slug: "government", name: "Government" },
  { slug: "hospitality", name: "Hospitality" },
  { slug: "logistics", name: "Logistics" },
  { slug: "supply-chain", name: "Supply Chain" },
  { slug: "remote", name: "Remote" },
  { slug: "graduate", name: "Graduate" },
  { slug: "internships", name: "Internships" },
  { slug: "executive", name: "Executive" },
];

/** Looks up a category by its slug. */
export function getCategoryBySlug(slug: string): CategoryOption | undefined {
  return JOB_CATEGORIES.find((category) => category.slug === slug);
}

/**
 * A curated subset shown on the homepage's "Popular Categories" grid, so
 * that browsing there stays visually clean even as the full reference
 * list (used by filter dropdowns) grows. Order is intentional.
 */
export const FEATURED_CATEGORY_SLUGS: string[] = [
  "software-development",
  "ai-machine-learning",
  "data-science",
  "cyber-security",
  "oil-gas",
  "mechanical-engineering",
  "healthcare",
  "finance",
  "construction",
  "logistics",
  "remote",
  "executive",
];
