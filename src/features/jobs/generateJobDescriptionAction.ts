"use server";

import { getSessionUser } from "@/services/auth/getSessionUser";
import { findCountryBySlug, findCityInCountry, findCategoryBySlug } from "@/services/jobs/referenceData";
import { generateJobDescription } from "@/services/ai/generateJobDescription";

export type GenerateJobDescriptionActionState =
  | { success: true; description: string }
  | { success: false; error: string };

/**
 * The employer job-posting form's "Generate with AI" action. Re-derives
 * the acting user from the session on every call — only an
 * authenticated, active employer can trigger this (paid) AI call, same
 * gate as createJobAction.ts. Country/city/category are resolved from
 * real database rows by slug (never trusted as free-text from the
 * client) purely so the AI prompt uses real names, exactly like
 * createJob.ts already does for the same fields.
 *
 * This never creates, edits, or submits a Job row — it only returns
 * generated text for the employer to review in the still-unsaved form.
 */
export async function generateJobDescriptionAction(formData: FormData): Promise<GenerateJobDescriptionActionState> {
  const user = await getSessionUser();
  if (!user || user.role !== "employer" || user.status !== "active") {
    return { success: false, error: "You must be signed in as an employer to use this feature." };
  }

  const companyName = String(formData.get("companyName") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const countrySlug = String(formData.get("country") ?? "").trim();
  const citySlug = String(formData.get("city") ?? "").trim();
  const categorySlug = String(formData.get("category") ?? "").trim();
  const existingDescription = String(formData.get("description") ?? "").trim();
  const salaryMinRaw = String(formData.get("salaryMin") ?? "").trim();
  const salaryMaxRaw = String(formData.get("salaryMax") ?? "").trim();
  const currencyCode = String(formData.get("currencyCode") ?? "").trim();
  const rawApplicationMethod = String(formData.get("applicationMethod") ?? "").trim();

  const country = countrySlug ? await findCountryBySlug(countrySlug) : null;
  const city = country && citySlug ? await findCityInCountry(citySlug, country.id) : null;
  const category = categorySlug ? await findCategoryBySlug(categorySlug) : null;

  const salaryMin = salaryMinRaw ? Number(salaryMinRaw) : undefined;
  const salaryMax = salaryMaxRaw ? Number(salaryMaxRaw) : undefined;

  const result = await generateJobDescription({
    title,
    companyName: companyName || undefined,
    countryName: country?.name,
    cityName: city?.name,
    categoryName: category?.name,
    existingDescription: existingDescription || undefined,
    salaryMin: Number.isFinite(salaryMin) ? salaryMin : undefined,
    salaryMax: Number.isFinite(salaryMax) ? salaryMax : undefined,
    currencyCode: currencyCode || undefined,
    applicationMethod: rawApplicationMethod === "external_url" ? "external_url" : "on_platform",
  });

  if (!result.ok) {
    return { success: false, error: result.error };
  }

  return { success: true, description: result.description };
}
