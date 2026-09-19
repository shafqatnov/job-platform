/**
 * Shared between the client upload component and the server-side
 * upload route/service — deliberately has NO server-only imports
 * (no Prisma, no @vercel/blob) so it's safe to bundle into client code.
 */

/**
 * The one fixed, non-identifying pathname every resume upload request
 * is required to use. The candidate's own identity/ownership is never
 * derived from this string (or anything else the client sends) — it
 * comes from the authenticated session server-side. Rejecting any other
 * pathname in the upload route closes off a crafted request naming an
 * arbitrary/huge/traversal-style path; `addRandomSuffix` at upload time
 * still gives each candidate's actual blob a unique, unguessable URL.
 */
export const RESUME_PATHNAME = "resume.pdf";

export const RESUME_CONTENT_TYPE = "application/pdf";

/** 5MB — see docs/resume storage architecture inspection for rationale. */
export const MAX_RESUME_SIZE_BYTES = 5 * 1024 * 1024;
