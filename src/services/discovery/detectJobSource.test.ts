import { describe, expect, it } from "vitest";
import { detectJobSource } from "@/services/discovery/detectJobSource";

describe("detectJobSource", () => {
  it("1. a known Greenhouse URL detects as greenhouse", () => {
    const result = detectJobSource("https://boards.greenhouse.io/acme-co/jobs/12345");
    expect(result.provider).toBe("greenhouse");
    expect(result.sourceType).toBe("ATS");
    expect(result.confidence).toBe("high");
  });

  it("1b. the Greenhouse API hostname also detects as greenhouse", () => {
    const result = detectJobSource("https://boards-api.greenhouse.io/v1/boards/acme-co/jobs");
    expect(result.provider).toBe("greenhouse");
  });

  it("2. a known Workday URL detects as workday", () => {
    const result = detectJobSource("https://cigna.wd5.myworkdayjobs.com/cignacareers");
    expect(result.provider).toBe("workday");
    expect(result.sourceType).toBe("ATS");
    expect(result.confidence).toBe("high");
  });

  it("2b. Workday numbered subdomains wd1 through wd5 all detect correctly", () => {
    for (const n of [1, 2, 3, 4, 5]) {
      const result = detectJobSource(`https://acme.wd${n}.myworkdayjobs.com/acmecareers`);
      expect(result.provider).toBe("workday");
    }
  });

  it("3. a known Lever URL detects as lever", () => {
    const result = detectJobSource("https://jobs.lever.co/acme-co");
    expect(result.provider).toBe("lever");
    expect(result.sourceType).toBe("ATS");
    expect(result.confidence).toBe("high");
  });

  it("3b. the Lever API hostname also detects as lever", () => {
    const result = detectJobSource("https://api.lever.co/v0/postings/acme-co");
    expect(result.provider).toBe("lever");
  });

  it("4. a known Ashby URL detects as ashby", () => {
    const result = detectJobSource("https://jobs.ashbyhq.com/acme-co");
    expect(result.provider).toBe("ashby");
    expect(result.sourceType).toBe("ATS");
    expect(result.confidence).toBe("high");
  });

  it("5. a known Workable URL detects as workable", () => {
    const result = detectJobSource("https://apply.workable.com/acme-co/");
    expect(result.provider).toBe("workable");
    expect(result.confidence).toBe("high");
  });

  it("5b. a Workable account-subdomain URL also detects as workable, at medium confidence", () => {
    const result = detectJobSource("https://acme-co.workable.com/spi/v3/jobs");
    expect(result.provider).toBe("workable");
    expect(result.confidence).toBe("medium");
  });

  it("6. a known Teamtailor URL detects as teamtailor", () => {
    const result = detectJobSource("https://acme-co.teamtailor.com");
    expect(result.provider).toBe("teamtailor");
    expect(result.confidence).toBe("high");
  });

  it("7. a Recruitee URL detects as recruitee at medium confidence (partially verified)", () => {
    const result = detectJobSource("https://acme-co.recruitee.com");
    expect(result.provider).toBe("recruitee");
    expect(result.confidence).toBe("medium");
  });

  it("8. Personio URLs are NOT classified — pattern could not be confidently verified", () => {
    const result = detectJobSource("https://acme-co.jobs.personio.com");
    expect(result.provider).toBe("unknown");
  });

  it("9. a completely unrelated URL detects as unknown", () => {
    const result = detectJobSource("https://example.com/careers");
    expect(result.provider).toBe("unknown");
    expect(result.sourceType).toBe("UNKNOWN");
    expect(result.confidence).toBe("low");
  });

  it("10. a malformed URL returns a safe unknown result rather than throwing", () => {
    expect(() => detectJobSource("not a url at all")).not.toThrow();
    const result = detectJobSource("not a url at all");
    expect(result.provider).toBe("unknown");
    expect(result.normalizedEndpoint).toBeNull();
  });

  it("10b. an empty string returns a safe unknown result", () => {
    const result = detectJobSource("");
    expect(result.provider).toBe("unknown");
  });

  it("11. a non-http/https scheme is rejected safely", () => {
    const result = detectJobSource("ftp://boards.greenhouse.io/acme-co");
    expect(result.provider).toBe("unknown");
  });

  it("11b. javascript: scheme is rejected safely", () => {
    const result = detectJobSource("javascript:alert(1)");
    expect(result.provider).toBe("unknown");
  });

  it("12. URL normalization strips a trailing slash without changing provider identity", () => {
    const withSlash = detectJobSource("https://jobs.lever.co/acme-co/");
    const withoutSlash = detectJobSource("https://jobs.lever.co/acme-co");
    expect(withSlash.provider).toBe("lever");
    expect(withSlash.normalizedEndpoint).toBe(withoutSlash.normalizedEndpoint);
  });

  it("13. Greenhouse board-token/path information is preserved after normalization", () => {
    const result = detectJobSource("https://boards.greenhouse.io/acme-co/jobs/12345?content=true");
    expect(result.normalizedEndpoint).toContain("acme-co");
    expect(result.normalizedEndpoint).toContain("12345");
    expect(result.normalizedEndpoint).toContain("content=true");
  });

  it("14a. a lookalike domain (different TLD) is NOT falsely classified as Greenhouse", () => {
    const result = detectJobSource("https://boards.greenhouse.example.com/acme-co");
    expect(result.provider).toBe("unknown");
  });

  it("14b. a spoofed hostname appending the real domain as a subdomain is NOT falsely classified", () => {
    const result = detectJobSource("https://boards.greenhouse.io.attacker.example/acme-co");
    expect(result.provider).toBe("unknown");
  });

  it("14c. a spoofed Workday-lookalike hostname is NOT falsely classified", () => {
    const result = detectJobSource("https://acme.myworkdayjobs.com.attacker.example/acmecareers");
    expect(result.provider).toBe("unknown");
  });

  it("14d. the bare marketing domains for subdomain-pattern providers are NOT classified as a customer board", () => {
    expect(detectJobSource("https://www.workable.com").provider).toBe("unknown");
    expect(detectJobSource("https://www.teamtailor.com").provider).toBe("unknown");
    expect(detectJobSource("https://www.recruitee.com").provider).toBe("unknown");
  });

  it("15. provider detection never imports or calls the OpenAI SDK", async () => {
    const source = await import("node:fs").then((fs) =>
      fs.readFileSync(new URL("./detectJobSource.ts", import.meta.url), "utf8")
    );
    expect(source).not.toMatch(/from\s+["']openai["']|require\(["']openai["']\)/);
  });

  it("16. provider detection never performs a network request (no fetch call in the module)", async () => {
    const source = await import("node:fs").then((fs) =>
      fs.readFileSync(new URL("./detectJobSource.ts", import.meta.url), "utf8")
    );
    expect(source).not.toMatch(/\bfetch\s*\(/);
  });

  it("17. provider detection never writes to the database (no Prisma dependency)", async () => {
    const source = await import("node:fs").then((fs) =>
      fs.readFileSync(new URL("./detectJobSource.ts", import.meta.url), "utf8")
    );
    expect(source).not.toMatch(/prisma/i);
  });

  it("18-19. detection is deterministic — the same URL always produces the same result", () => {
    const first = detectJobSource("https://boards.greenhouse.io/acme-co/jobs/1");
    const second = detectJobSource("https://boards.greenhouse.io/acme-co/jobs/1");
    expect(first).toEqual(second);
  });

  it("20. the result is plain, JSON-serializable data with no hidden state", () => {
    const result = detectJobSource("https://jobs.ashbyhq.com/acme-co");
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });
});
