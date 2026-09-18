import { beforeEach, describe, expect, it, vi } from "vitest";

const sendTransactionalEmailMock = vi.fn();
vi.mock("@/lib/email/brevoClient", () => ({
  sendTransactionalEmail: (...args: unknown[]) => sendTransactionalEmailMock(...args),
}));

const { auth } = await import("@/lib/auth");

type CallbackUser = {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
};

const SAMPLE_USER: CallbackUser = {
  id: "user-1",
  email: "person@example.invalid",
  name: "Test Person",
  emailVerified: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

/**
 * Tests the exact wiring in src/lib/auth.ts — auth.options is the same
 * object literal passed to betterAuth() (verified against
 * node_modules/better-auth/dist/auth/base.mjs, which returns `options`
 * unchanged) — so this calls the real, deployed callback, mocking only
 * the outbound Brevo call itself.
 */
describe("auth.ts Brevo email wiring", () => {
  beforeEach(() => {
    sendTransactionalEmailMock.mockReset();
    sendTransactionalEmailMock.mockResolvedValue(undefined);
  });

  it("sendResetPassword invokes Brevo with the correct recipient, subject, and generated link", async () => {
    const resetUrl = "https://www.jobnura.com/reset-password/sample-token?callbackURL=%2Freset-password";
    const sendResetPassword = auth.options.emailAndPassword?.sendResetPassword;
    expect(sendResetPassword).toBeTypeOf("function");

    await sendResetPassword!({ user: SAMPLE_USER, url: resetUrl, token: "sample-token" });

    expect(sendTransactionalEmailMock).toHaveBeenCalledTimes(1);
    const callArg = sendTransactionalEmailMock.mock.calls[0][0];
    expect(callArg.to).toEqual({ email: SAMPLE_USER.email, name: SAMPLE_USER.name });
    expect(callArg.subject).toMatch(/reset/i);
    expect(callArg.subject).toMatch(/jobnura/i);
    expect(callArg.htmlContent).toContain(resetUrl);
  });

  it("sendVerificationEmail invokes Brevo with the correct recipient, subject, and generated link", async () => {
    const verifyUrl = "https://www.jobnura.com/verify-email?token=sample-token&callbackURL=%2F";
    const sendVerificationEmail = auth.options.emailVerification?.sendVerificationEmail;
    expect(sendVerificationEmail).toBeTypeOf("function");

    await sendVerificationEmail!({ user: SAMPLE_USER, url: verifyUrl, token: "sample-token" });

    expect(sendTransactionalEmailMock).toHaveBeenCalledTimes(1);
    const callArg = sendTransactionalEmailMock.mock.calls[0][0];
    expect(callArg.to).toEqual({ email: SAMPLE_USER.email, name: SAMPLE_USER.name });
    expect(callArg.subject).toMatch(/verify/i);
    expect(callArg.subject).toMatch(/jobnura/i);
    // The template HTML-escapes the URL for safe attribute embedding
    // (& becomes &amp;) — this asserts the correctly-escaped form.
    expect(callArg.htmlContent).toContain(verifyUrl.replace(/&/g, "&amp;"));
  });

  it("propagates a Brevo failure rather than swallowing it", async () => {
    sendTransactionalEmailMock.mockRejectedValue(new Error("Brevo rejected the email (HTTP 400: invalid sender)."));
    const sendResetPassword = auth.options.emailAndPassword?.sendResetPassword;

    await expect(
      sendResetPassword!({
        user: SAMPLE_USER,
        url: "https://www.jobnura.com/reset-password/x?callbackURL=%2F",
        token: "x",
      })
    ).rejects.toThrow(/Brevo rejected the email/);
  });
});
