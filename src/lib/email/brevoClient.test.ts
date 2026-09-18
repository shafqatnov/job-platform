import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendTransactionalEmail, BrevoConfigurationError, BrevoDeliveryError } from "@/lib/email/brevoClient";

const REAL_API_KEY = "xkeysib-test-fake-key-not-a-real-secret-0123456789";

describe("sendTransactionalEmail", () => {
  const originalKey = process.env.BREVO_API_KEY;
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.BREVO_API_KEY = REAL_API_KEY;
  });

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.BREVO_API_KEY;
    } else {
      process.env.BREVO_API_KEY = originalKey;
    }
    global.fetch = originalFetch;
  });

  it("throws BrevoConfigurationError when BREVO_API_KEY is missing, without calling fetch", async () => {
    delete process.env.BREVO_API_KEY;
    const fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      sendTransactionalEmail({ to: { email: "a@example.invalid" }, subject: "s", htmlContent: "<p>hi</p>" })
    ).rejects.toBeInstanceOf(BrevoConfigurationError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reads the API key from process.env.BREVO_API_KEY and sends it only in the api-key header", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    global.fetch = fetchMock as unknown as typeof fetch;

    await sendTransactionalEmail({
      to: { email: "person@example.invalid", name: "Person" },
      subject: "Reset your Jobnura password",
      htmlContent: "<p>hello</p>",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, requestInit] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.brevo.com/v3/smtp/email");
    expect(requestInit.method).toBe("POST");
    expect(requestInit.headers["api-key"]).toBe(REAL_API_KEY);

    const body = JSON.parse(requestInit.body);
    expect(body.sender).toEqual({ name: "Jobnura", email: "shafqat69@gmail.com" });
    expect(body.to).toEqual([{ email: "person@example.invalid", name: "Person" }]);
    expect(body.subject).toBe("Reset your Jobnura password");
    expect(body.htmlContent).toBe("<p>hello</p>");
  });

  it("throws BrevoDeliveryError with a safe message when Brevo returns an error response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ code: "invalid_parameter", message: "Sender not verified" }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      sendTransactionalEmail({ to: { email: "a@example.invalid" }, subject: "s", htmlContent: "<p>hi</p>" })
    ).rejects.toThrow(BrevoDeliveryError);
  });

  it("throws BrevoDeliveryError when the network request itself fails", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("getaddrinfo ENOTFOUND api.brevo.com"));
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      sendTransactionalEmail({ to: { email: "a@example.invalid" }, subject: "s", htmlContent: "<p>hi</p>" })
    ).rejects.toThrow(BrevoDeliveryError);
  });

  it("never includes the API key value in any thrown error, on success, HTTP failure, or network failure", async () => {
    // HTTP failure path
    const errorFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ code: "unauthorized", message: "Key not found" }),
    });
    global.fetch = errorFetch as unknown as typeof fetch;
    try {
      await sendTransactionalEmail({ to: { email: "a@example.invalid" }, subject: "s", htmlContent: "<p>hi</p>" });
    } catch (error) {
      expect(String(error)).not.toContain(REAL_API_KEY);
    }

    // Network failure path
    const networkFailFetch = vi.fn().mockRejectedValue(new Error("network down"));
    global.fetch = networkFailFetch as unknown as typeof fetch;
    try {
      await sendTransactionalEmail({ to: { email: "a@example.invalid" }, subject: "s", htmlContent: "<p>hi</p>" });
    } catch (error) {
      expect(String(error)).not.toContain(REAL_API_KEY);
    }

    // Missing-key path
    delete process.env.BREVO_API_KEY;
    try {
      await sendTransactionalEmail({ to: { email: "a@example.invalid" }, subject: "s", htmlContent: "<p>hi</p>" });
    } catch (error) {
      expect(String(error)).not.toContain(REAL_API_KEY);
    }
  });
});
