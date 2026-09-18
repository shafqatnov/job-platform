/**
 * Simple, production-safe HTML for the two Better Auth transactional
 * emails. No marketing content, no invented expiry claim (Better Auth's
 * callback payload does not pass an expiry value, so none is stated
 * here as a specific duration — only the evergreen, always-true safety
 * line that an unrequested email can be ignored).
 */

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildPasswordResetEmail(input: { name: string; url: string }): {
  subject: string;
  htmlContent: string;
} {
  const safeName = escapeHtml(input.name);
  const safeUrl = escapeHtml(input.url);
  return {
    subject: "Reset your Jobnura password",
    htmlContent: `
      <p>Hello ${safeName},</p>
      <p>We received a request to reset the password for your Jobnura account.</p>
      <p><a href="${safeUrl}">Reset your password</a></p>
      <p>If you didn't request this, you can safely ignore this email — your password will not be changed.</p>
      <p>— Jobnura</p>
    `.trim(),
  };
}

export function buildVerificationEmail(input: { name: string; url: string }): {
  subject: string;
  htmlContent: string;
} {
  const safeName = escapeHtml(input.name);
  const safeUrl = escapeHtml(input.url);
  return {
    subject: "Verify your Jobnura email address",
    htmlContent: `
      <p>Hello ${safeName},</p>
      <p>Please confirm this is your email address to verify your Jobnura account.</p>
      <p><a href="${safeUrl}">Verify your email</a></p>
      <p>If you didn't request this, you can safely ignore this email.</p>
      <p>— Jobnura</p>
    `.trim(),
  };
}
