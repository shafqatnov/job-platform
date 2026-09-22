import { describe, expect, it } from "vitest";
import { getProfileCompletion } from "@/features/candidates/profileCompletion";

describe("getProfileCompletion (pure, no DB access)", () => {
  it("is 0% when none of the optional fields are filled", () => {
    const result = getProfileCompletion({ headline: null, cityName: null, hasResume: false });
    expect(result.percent).toBe(0);
    expect(result.items.every((item) => !item.complete)).toBe(true);
  });

  it("is 100% when every optional field is filled — never invents a field beyond what's real", () => {
    const result = getProfileCompletion({ headline: "Senior Engineer", cityName: "London", hasResume: true });
    expect(result.percent).toBe(100);
    expect(result.items.every((item) => item.complete)).toBe(true);
  });

  it("is a fraction when only some optional fields are filled", () => {
    const result = getProfileCompletion({ headline: "Senior Engineer", cityName: null, hasResume: false });
    expect(result.percent).toBe(Math.round((1 / 3) * 100));
  });

  it("treats a headline of only whitespace as not filled", () => {
    const result = getProfileCompletion({ headline: "   ", cityName: "London", hasResume: true });
    expect(result.items.find((item) => item.label === "Headline")?.complete).toBe(false);
  });

  it("never counts fullName or country — both are mandatory at profile creation, not a completion signal", () => {
    const result = getProfileCompletion({ headline: null, cityName: null, hasResume: false });
    expect(result.items.map((item) => item.label)).toEqual(["Headline", "City", "Resume"]);
  });
});
