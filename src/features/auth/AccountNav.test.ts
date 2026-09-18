import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const useSessionMock = vi.fn();
vi.mock("@/lib/auth-client", () => ({
  authClient: { useSession: () => useSessionMock() },
}));

// AccountNav renders SignOutButton in every signed-in branch, which
// calls next/navigation's useRouter() — real only inside an actual
// Next.js App Router render tree, unavailable here, so it's mocked;
// its push/refresh methods are only invoked from a click handler this
// static render never triggers.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const { AccountNav } = await import("@/features/auth/AccountNav");

/**
 * No React DOM-testing-library dependency exists in this project (and
 * none is added here — react-dom's own renderToStaticMarkup, already a
 * dependency via react-dom, is enough to render this presentational
 * component to a real HTML string in the existing Node test
 * environment). authClient itself is mocked so this exercises the
 * exact component/JSX in src/features/auth/AccountNav.tsx, not a
 * network call.
 */
describe("AccountNav dashboard link (candidate navigation entry point)", () => {
  it("shows a Dashboard link to /employer for an employer session (unchanged)", () => {
    useSessionMock.mockReturnValue({ data: { user: { role: "employer", name: "Employer" } }, isPending: false });
    const html = renderToStaticMarkup(createElement(AccountNav));
    expect(html).toContain('href="/employer"');
    expect(html).not.toContain('href="/candidate"');
  });

  it("shows a Dashboard link to /candidate for a candidate session (new)", () => {
    useSessionMock.mockReturnValue({ data: { user: { role: "candidate", name: "Candidate" } }, isPending: false });
    const html = renderToStaticMarkup(createElement(AccountNav));
    expect(html).toContain('href="/candidate"');
    expect(html).not.toContain('href="/employer"');
  });

  it("shows neither dashboard link for an admin session (unchanged pre-existing behavior)", () => {
    useSessionMock.mockReturnValue({ data: { user: { role: "admin", name: "Admin" } }, isPending: false });
    const html = renderToStaticMarkup(createElement(AccountNav));
    expect(html).not.toContain('href="/employer"');
    expect(html).not.toContain('href="/candidate"');
  });

  it("shows sign-in/sign-up links when signed out (unchanged)", () => {
    useSessionMock.mockReturnValue({ data: null, isPending: false });
    const html = renderToStaticMarkup(createElement(AccountNav));
    expect(html).toContain('href="/sign-in"');
    expect(html).toContain('href="/sign-up"');
  });
});
