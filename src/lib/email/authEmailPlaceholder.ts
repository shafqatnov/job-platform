/**
 * No email provider is configured for this project (verified: no email
 * SDK/package installed, no provider credentials in .env). Better
 * Auth's own password-reset and email-verification endpoints throw a
 * hard 400 error if their respective send callbacks are not configured
 * at all — so leaving them unset does not "safely do nothing", it
 * breaks the endpoints outright.
 *
 * This module exists to satisfy that requirement honestly: it makes
 * the underlying Better Auth flow (real token generation, real
 * single-use consumption, real password/verification state changes)
 * fully functional and testable, WITHOUT ever claiming an email was
 * actually delivered. It only logs safe, non-sensitive metadata — never
 * the reset/verification URL or token itself.
 *
 * Replace `deliverAuthEmail` with a real provider call (Resend,
 * Postmark, SES, etc.) once one is chosen and configured — nothing
 * else in the auth flow needs to change; see src/lib/auth.ts's
 * sendResetPassword / emailVerification.sendVerificationEmail, which
 * are the only two callers of this module.
 */

export type AuthEmailEvent = "password_reset_requested" | "verification_email_requested";

export type AuthEmailContext = {
  event: AuthEmailEvent;
  userId: string;
};

/**
 * Placeholder "delivery" — logs that a real email *should* be sent here
 * and to which user, without sending anything and without ever logging
 * the reset/verification URL or token. Never throws, so the calling
 * Better Auth endpoint still completes and returns its own safe,
 * generic response to the client.
 */
export async function deliverAuthEmail(context: AuthEmailContext): Promise<void> {
  console.log(
    JSON.stringify({
      event: "auth_email_not_sent_no_provider_configured",
      authEvent: context.event,
      userId: context.userId,
    })
  );
}
