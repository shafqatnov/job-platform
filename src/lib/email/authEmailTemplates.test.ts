import { describe, expect, it } from "vitest";
import { buildPasswordResetEmail, buildVerificationEmail } from "@/lib/email/authEmailTemplates";

describe("buildPasswordResetEmail", () => {
  it("includes Jobnura branding, the real link, and a safety line, with no invented expiry", () => {
    const { subject, htmlContent } = buildPasswordResetEmail({
      name: "Ada",
      url: "https://www.jobnura.com/reset-password/tok?callbackURL=%2F",
    });
    expect(subject).toMatch(/jobnura/i);
    expect(subject).toMatch(/reset/i);
    expect(htmlContent).toContain("https://www.jobnura.com/reset-password/tok?callbackURL=%2F");
    expect(htmlContent).toMatch(/safely ignore/i);
    expect(htmlContent).not.toMatch(/hour|24 hours|expires? in \d/i);
  });

  it("HTML-escapes the user name to prevent markup injection", () => {
    const { htmlContent } = buildPasswordResetEmail({
      name: '<img src=x onerror=alert(1)>',
      url: "https://www.jobnura.com/reset-password/tok",
    });
    expect(htmlContent).not.toContain("<img src=x onerror=alert(1)>");
    expect(htmlContent).toContain("&lt;img");
  });
});

describe("buildVerificationEmail", () => {
  it("includes Jobnura branding and the real link", () => {
    const { subject, htmlContent } = buildVerificationEmail({
      name: "Ada",
      url: "https://www.jobnura.com/verify-email?token=tok",
    });
    expect(subject).toMatch(/jobnura/i);
    expect(subject).toMatch(/verify/i);
    expect(htmlContent).toContain("https://www.jobnura.com/verify-email?token=tok");
  });

  it("HTML-escapes the user name to prevent markup injection", () => {
    const { htmlContent } = buildVerificationEmail({
      name: '<script>alert(1)</script>',
      url: "https://www.jobnura.com/verify-email?token=tok",
    });
    expect(htmlContent).not.toContain("<script>alert(1)</script>");
  });
});
