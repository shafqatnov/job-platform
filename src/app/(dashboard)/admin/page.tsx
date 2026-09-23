import type { Metadata } from "next";
import Link from "next/link";
import { Section } from "@/components/Section";
import { Card } from "@/components/Card";
import { getButtonClassName } from "@/components/Button";
import { listAdminJobs } from "@/services/admin/listAdminJobs";
import { listPendingImportedJobReviews } from "@/services/admin/listImportedJobReviews";
import { listPendingLocationReviews } from "@/services/admin/locationReviews";

export const metadata: Metadata = {
  title: "Admin Dashboard",
  robots: { index: false, follow: false },
};

export default async function AdminDashboardPage() {
  const pendingJobs = await listAdminJobs({ status: "pending_review" });
  const pendingImportedJobs = await listPendingImportedJobReviews();
  const pendingLocationReviews = await listPendingLocationReviews();

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

        <Card padding="lg" className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-foreground">Job sources</h2>
          <p className="text-muted-foreground">Manage the authorized source registry for future job acquisition.</p>
          <Link
            href="/admin/job-sources"
            className={getButtonClassName({ variant: "outline", className: "self-start" })}
          >
            Manage job sources
          </Link>
        </Card>

        <Card padding="lg" className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-foreground">Imported jobs</h2>
          <p className="text-muted-foreground">
            {pendingImportedJobs.length} imported {pendingImportedJobs.length === 1 ? "job needs" : "jobs need"} review.
          </p>
          <Link
            href="/admin/imported-jobs"
            className={getButtonClassName({ variant: "outline", className: "self-start" })}
          >
            Review imported jobs
          </Link>
        </Card>

        <Card padding="lg" className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-foreground">Unknown locations</h2>
          <p className="text-muted-foreground">
            {pendingLocationReviews.length} imported {pendingLocationReviews.length === 1 ? "job is" : "jobs are"}{" "}
            waiting on a location to be resolved before they can publish.
          </p>
          <Link
            href="/admin/unknown-locations"
            className={getButtonClassName({ variant: "outline", className: "self-start" })}
          >
            Resolve unknown locations
          </Link>
        </Card>
      </div>
    </Section>
  );
}
