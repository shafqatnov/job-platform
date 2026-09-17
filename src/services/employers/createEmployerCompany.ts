import { prisma } from "@/lib/prisma";
import { slugify } from "@/utils/slugify";

export type CreateEmployerCompanyInput = {
  userId: string;
  name: string;
};

export type CreateEmployerCompanyResult =
  | { success: true; companyId: string; employerProfileId: string }
  | { success: false; error: string };

const MAX_SLUG_ATTEMPTS = 50;

/**
 * Creates the Company + EmployerProfile pair a newly-signed-up employer
 * needs before they can post a job (Better Auth's sign-up only creates
 * the User row with role="employer" — it has no concept of Company).
 * Uses the existing Company/EmployerProfile schema exactly as designed
 * (docs/26 §11-12); does not invent a second employer/company model.
 *
 * `userId` must come from the authenticated session, never from client
 * input. Fails safely if this user already has an EmployerProfile
 * (Phase 1 is one employer profile per one company — no re-assignment
 * here).
 */
export async function createEmployerCompany(
  input: CreateEmployerCompanyInput
): Promise<CreateEmployerCompanyResult> {
  const name = input.name.trim();

  if (!name) {
    return { success: false, error: "Company name is required." };
  }
  if (name.length > 200) {
    return { success: false, error: "Company name is too long." };
  }

  const existingProfile = await prisma.employerProfile.findUnique({
    where: { userId: input.userId },
    select: { id: true },
  });
  if (existingProfile) {
    return { success: false, error: "This account already has a company." };
  }

  const baseSlug = slugify(name) || "company";
  let slug = baseSlug;
  let attempt = 1;

  while (attempt <= MAX_SLUG_ATTEMPTS) {
    const collision = await prisma.company.findUnique({ where: { slug }, select: { id: true } });
    if (!collision) break;
    attempt += 1;
    slug = `${baseSlug}-${attempt}`;
  }
  if (attempt > MAX_SLUG_ATTEMPTS) {
    return { success: false, error: "Could not create a unique company identifier. Please try a different name." };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: { name, slug },
        select: { id: true },
      });
      const employerProfile = await tx.employerProfile.create({
        data: { userId: input.userId, companyId: company.id },
        select: { id: true },
      });
      return { companyId: company.id, employerProfileId: employerProfile.id };
    });

    return { success: true, ...result };
  } catch (error) {
    console.error("createEmployerCompany failed", error);
    return { success: false, error: "We couldn't save your company right now. Please try again." };
  }
}
