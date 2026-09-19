import { NextResponse } from "next/server";
import { getSessionUser } from "@/services/auth/getSessionUser";
import { getResumeForDownload } from "@/services/candidates/getResumeForDownload";

/**
 * Streams the AUTHENTICATED candidate's own resume. There is no id of
 * any kind in this route (no query string, no path param) — the only
 * possible target is "whoever is signed in right now", so there is
 * nothing here a client could tamper with to reach another candidate's
 * file. The browser never sees the underlying (private-access) Blob URL
 * — only this same-origin, session-protected endpoint.
 */
export async function GET(): Promise<Response> {
  const user = await getSessionUser();
  if (!user || user.role !== "candidate" || user.status !== "active") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await getResumeForDownload(user.id);
  if (!result.found) {
    return NextResponse.json({ error: "No resume on file." }, { status: 404 });
  }

  return new Response(result.stream, {
    status: 200,
    headers: {
      "Content-Type": result.contentType || "application/pdf",
      "Content-Disposition": 'inline; filename="resume.pdf"',
      "Cache-Control": "private, no-store",
    },
  });
}
