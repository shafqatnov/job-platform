import type { Metadata } from "next";
import Link from "next/link";
import { Section } from "@/components/Section";
import { Card } from "@/components/Card";
import { SignUpForm } from "@/features/auth/SignUpForm";

export const metadata: Metadata = {
  title: "Create Account",
  description: "Create a candidate or employer account on Job Platform.",
};

export default function SignUpPage() {
  return (
    <Section aria-labelledby="sign-up-heading">
      <div className="mx-auto flex max-w-md flex-col gap-6">
        <div className="flex flex-col gap-2 text-center">
          <h1 id="sign-up-heading" className="text-2xl font-semibold text-foreground sm:text-3xl">
            Create your account
          </h1>
          <p className="text-muted-foreground">Join as a candidate or employer to get started.</p>
        </div>
        <Card padding="lg">
          <SignUpForm />
        </Card>
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/sign-in" className="font-medium text-brand-600 hover:text-brand-700">
            Sign in
          </Link>
        </p>
      </div>
    </Section>
  );
}
