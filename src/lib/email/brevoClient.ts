/**
 * Minimal Brevo transactional-email client. A single POST to Brevo's
 * REST API via the platform's built-in `fetch` — no SDK package is
 * needed for one endpoint, so none is installed.
 *
 * BREVO_API_KEY is read from process.env only, at call time (never
 * cached into a client-visible module, never sent to the browser — this
 * file is only ever imported from server-only code, currently just
 * src/lib/auth.ts). Its value is never included in any thrown error,
 * logged message, or return value anywhere in this file.
 */

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

/** The single verified Brevo sender identity for this project. Not
 *  configurable via env — there is exactly one correct value, already
 *  verified in the Brevo account, and it is not a secret. */
const SENDER = { name: "Jobnura", email: "shafqat69@gmail.com" };

export class BrevoConfigurationError extends Error {}
export class BrevoDeliveryError extends Error {}

export type SendTransactionalEmailInput = {
  to: { email: string; name?: string };
  subject: string;
  htmlContent: string;
};

/**
 * Sends one transactional email through Brevo. Throws
 * BrevoConfigurationError if BREVO_API_KEY is missing (a deployment
 * misconfiguration, not a delivery failure) and BrevoDeliveryError if
 * Brevo itself rejects or fails the request. Never resolves as if an
 * email was sent when it was not.
 */
export async function sendTransactionalEmail(input: SendTransactionalEmailInput): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    throw new BrevoConfigurationError("BREVO_API_KEY is not configured for this environment.");
  }

  let response: Response;
  try {
    response = await fetch(BREVO_API_URL, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify({
        sender: SENDER,
        to: [input.to],
        subject: input.subject,
        htmlContent: input.htmlContent,
      }),
    });
  } catch (error) {
    // A network-level failure (DNS, TLS, timeout) — never include the
    // request itself (which carries the API key in its headers) in the
    // thrown message, only the safe, generic cause.
    const detail = error instanceof Error ? error.message : "unknown network error";
    throw new BrevoDeliveryError(`Could not reach Brevo: ${detail}`);
  }

  if (!response.ok) {
    // Brevo's own error responses are a small, safe, documented shape
    // ({code, message}) describing what was wrong with the request —
    // never the API key (which Brevo never echoes back) and never
    // recipient PII beyond what the caller already provided.
    let safeDetail = `HTTP ${response.status}`;
    try {
      const body: unknown = await response.json();
      if (body && typeof body === "object" && "message" in body && typeof body.message === "string") {
        safeDetail = `HTTP ${response.status}: ${body.message}`;
      }
    } catch {
      // Response body wasn't valid JSON — keep the generic HTTP-status detail.
    }
    throw new BrevoDeliveryError(`Brevo rejected the email (${safeDetail}).`);
  }
}
