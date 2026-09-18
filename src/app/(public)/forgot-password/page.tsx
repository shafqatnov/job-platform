import type { Metadata } from "next";
import Link from "next/link";
import { Section } from "@/components/Section";
import { Card } from "@/components/Card";
import { ForgotPasswordForm } from "@/features/auth/ForgotPasswordForm";

const TITLE = "Forgot Password";
const DESCRIPTION = "Request a password reset for your Job Platform account.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  // Same reasoning as /sign-in and /sign-up: a plain utility form, not a
  // useful search result, but still a real, crawlable page.
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

export default function ForgotPasswordPage() {
  return (
    <Section aria-labelledby="forgot-password-heading">
      <div className="mx-auto flex max-w-md flex-col gap-6">
        <div className="flex flex-col gap-2 text-center">
          <h1 id="forgot-password-heading" className="text-2xl font-semibold text-foreground sm:text-3xl">
            Forgot your password?
          </h1>
          <p className="text-muted-foreground">
            Enter your email and we&apos;ll send you instructions to reset it.
          </p>
        </div>
        <Card padding="lg">
          <ForgotPasswordForm />
        </Card>
        <p className="text-center text-sm text-muted-foreground">
          Remembered it?{" "}
          <Link href="/sign-in" className="font-medium text-brand-600 hover:text-brand-700">
            Back to sign in
          </Link>
        </p>
      </div>
    </Section>
  );
}
