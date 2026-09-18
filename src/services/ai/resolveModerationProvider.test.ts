import { afterEach, describe, expect, it } from "vitest";
import { resolveModerationProvider } from "@/services/ai/resolveModerationProvider";

describe("resolveModerationProvider", () => {
  const originalApiKey = process.env.OPENAI_API_KEY;
  const originalFlag = process.env.AI_MODERATION_PROVIDER;

  afterEach(() => {
    if (originalApiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalApiKey;
    if (originalFlag === undefined) delete process.env.AI_MODERATION_PROVIDER;
    else process.env.AI_MODERATION_PROVIDER = originalFlag;
  });

  it("defaults to the unconfigured provider when neither the key nor the flag is set", () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.AI_MODERATION_PROVIDER;
    expect(resolveModerationProvider().name).toBe("unconfigured");
  });

  it("stays unconfigured when only the API key is present (no explicit opt-in)", () => {
    process.env.OPENAI_API_KEY = "sk-test-not-real";
    delete process.env.AI_MODERATION_PROVIDER;
    expect(resolveModerationProvider().name).toBe("unconfigured");
  });

  it("stays unconfigured when only the opt-in flag is set but no key exists", () => {
    delete process.env.OPENAI_API_KEY;
    process.env.AI_MODERATION_PROVIDER = "openai";
    expect(resolveModerationProvider().name).toBe("unconfigured");
  });

  it("only enables the real provider when BOTH the key and the explicit opt-in are present", () => {
    process.env.OPENAI_API_KEY = "sk-test-not-real";
    process.env.AI_MODERATION_PROVIDER = "openai";
    expect(resolveModerationProvider().name).toBe("openai");
  });
});
