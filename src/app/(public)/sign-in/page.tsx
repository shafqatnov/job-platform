import type { Metadata } from "next";
import Link from "next/link";
import { Section } from "@/components/Section";
import { Card } from "@/components/Card";
import { SignInForm } from "@/features/auth/SignInForm";

const TITLE = "Sign In";
const DESCRIPTION = "Sign in to your Jobnura account.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  // A plain utility form with no unique content per visit — not a
  // useful search result on its own, but still a real, crawlable page
  // (so links from it are still followed), unlike the authenticated
  // dashboards which are disallowed outright in robots.ts.
  robots: { index: false, follow: true },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: "website",
  },
  twitter: {
    card: "summary",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function SignInPage() {
  return (
    <Section aria-labelledby="sign-in-heading">
      <div className="mx-auto flex max-w-md flex-col gap-6">
        <div className="flex flex-col gap-2 text-center">
          <h1 id="sign-in-heading" className="text-2xl font-semibold text-foreground sm:text-3xl">
            Sign in
          </h1>
          <p className="text-muted-foreground">Welcome back.</p>
        </div>
        <Card padding="lg">
          <SignInForm />
        </Card>
        <p className="text-center text-sm text-muted-foreground">
          <Link href="/forgot-password" className="font-medium text-brand-600 hover:text-brand-700">
            Forgot your password?
          </Link>
        </p>
        <p className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link href="/sign-up" className="font-medium text-brand-600 hover:text-brand-700">
            Create one
          </Link>
        </p>
      </div>
    </Section>
  );
}
