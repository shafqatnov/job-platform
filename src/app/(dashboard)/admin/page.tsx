import type { Metadata } from "next";
import Link from "next/link";
import { Section } from "@/components/Section";
import { Card } from "@/components/Card";
import { getButtonClassName } from "@/components/Button";
import { listAdminJobs } from "@/services/admin/listAdminJobs";

export const metadata: Metadata = {
  title: "Admin Dashboard",
  robots: { index: false, follow: false },
};

export default async function AdminDashboardPage() {
  const pendingJobs = await listAdminJobs({ status: "pending_review" });

  return (
    <Section aria-labelledby="admin-dashboard-heading">
      <h1 id="admin-dashboard-heading" className="mb-8 text-2xl font-semibold text-foreground sm:text-3xl">
        Admin Dashboard
      </h1>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card padding="lg" className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-foreground">Pending review</h2>
          <p className="text-muted-foreground">
            {pendingJobs.length} {pendingJobs.length === 1 ? "job is" : "jobs are"} waiting for moderation.
          </p>
          <Link href="/admin/jobs/pending" className={getButtonClassName({ className: "self-start" })}>
            Review pending jobs
          </Link>
        </Card>

        <Card padding="lg" className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-foreground">All jobs</h2>
          <p className="text-muted-foreground">Browse every job listing regardless of status.</p>
          <Link href="/admin/jobs" className={getButtonClassName({ variant: "outline", className: "self-start" })}>
            View all jobs
          </Link>
        </Card>
      </div>
    </Section>
  );
}
