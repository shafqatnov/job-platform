export type SelectFilterOption = {
  value: string;
  label: string;
};

/** Filter vocabulary specific to job listings (not cross-cutting reference data). */
export const WORK_MODES: SelectFilterOption[] = [
  { value: "remote", label: "Remote" },
  { value: "hybrid", label: "Hybrid" },
  { value: "onsite", label: "On-site" },
];

export const EMPLOYMENT_TYPES: SelectFilterOption[] = [
  { value: "full_time", label: "Full-time" },
  { value: "part_time", label: "Part-time" },
  { value: "contract", label: "Contract" },
  { value: "internship", label: "Internship" },
  { value: "temporary", label: "Temporary" },
];

export const SORT_OPTIONS: SelectFilterOption[] = [
  { value: "relevance", label: "Most Relevant" },
  { value: "newest", label: "Newest" },
  { value: "salary_desc", label: "Salary: High to Low" },
];
