import type { Metadata } from "next";
import Link from "next/link";
import { Section } from "@/components/Section";
import { Card } from "@/components/Card";
import { ResetPasswordForm } from "@/features/auth/ResetPasswordForm";

const TITLE = "Reset Password";
const DESCRIPTION = "Set a new password for your Jobnura account.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
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

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : null;

  return (
    <Section aria-labelledby="reset-password-heading">
      <div className="mx-auto flex max-w-md flex-col gap-6">
        <div className="flex flex-col gap-2 text-center">
          <h1 id="reset-password-heading" className="text-2xl font-semibold text-foreground sm:text-3xl">
            Reset your password
          </h1>
        </div>
        <Card padding="lg">
          {token ? (
            <ResetPasswordForm token={token} />
          ) : (
            <div className="flex flex-col items-center gap-3 text-center">
              <p className="text-muted-foreground">
                This reset link is invalid or missing. Request a new one to continue.
              </p>
              <Link href="/forgot-password" className="font-medium text-brand-600 hover:text-brand-700">
                Request a new reset link
              </Link>
            </div>
          )}
        </Card>
      </div>
    </Section>
  );
}
