import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/services/auth/getSessionUser";
import { authorizeResumeUpload, commitResumeUpload } from "@/services/candidates/resumeUpload";
import { RESUME_CONTENT_TYPE, MAX_RESUME_SIZE_BYTES } from "@/services/candidates/resumeUploadConstants";

/**
 * Authorizes and completes candidate resume uploads via Vercel Blob's
 * client-upload pattern: the browser uploads bytes directly to Blob
 * (never through this server), and this route only (1) issues a
 * short-lived, scoped upload token after re-deriving the caller's
 * identity from their session, and (2) commits the result to the DB
 * once Blob's own infrastructure confirms the upload finished.
 *
 * `onBeforeGenerateToken` is the real authorization boundary — it never
 * trusts the client-supplied pathname/payload for identity, only for
 * the (validated) upload target. `onUploadCompleted` is called by
 * Vercel's own signed callback (verified via BLOB_WEBHOOK_PUBLIC_KEY
 * internally by the SDK), not by the original browser request, so it
 * has no session to check — its trust comes entirely from the
 * `tokenPayload` this route itself set in onBeforeGenerateToken, which
 * the browser cannot see or modify.
 */
export async function POST(request: Request): Promise<NextResponse> {
  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const user = await getSessionUser();
        if (!user || user.role !== "candidate" || user.status !== "active") {
          throw new Error("Unauthorized");
        }

        const authResult = await authorizeResumeUpload(user.id, pathname);
        if (!authResult.ok) {
          throw new Error(authResult.error);
        }

        return {
          allowedContentTypes: [RESUME_CONTENT_TYPE],
          maximumSizeInBytes: MAX_RESUME_SIZE_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ candidateProfileId: authResult.candidateProfileId }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        if (!tokenPayload) {
          console.error("Resume upload completed without a tokenPayload — refusing to commit");
          return;
        }
        const { candidateProfileId } = JSON.parse(tokenPayload) as { candidateProfileId: string };
        await commitResumeUpload(candidateProfileId, blob.url);
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    // Never log the request body or blob URL here — only the (safe,
    // pre-written) error message from our own authorization checks.
    const message = error instanceof Error ? error.message : "Upload failed";
    console.error("Resume upload authorization failed:", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
