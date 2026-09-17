import type { Metadata } from "next";
import { Section } from "@/components/Section";
import { Card } from "@/components/Card";
import { AdminJobsTable } from "@/features/admin/AdminJobsTable";
import { listAdminJobs } from "@/services/admin/listAdminJobs";

export const metadata: Metadata = {
  title: "Pending Jobs",
  robots: { index: false, follow: false },
};

export default async function AdminPendingJobsPage() {
  const jobs = await listAdminJobs({ status: "pending_review" });

  return (
    <Section aria-labelledby="admin-pending-jobs-heading">
      <h1 id="admin-pending-jobs-heading" className="mb-8 text-2xl font-semibold text-foreground sm:text-3xl">
        Pending Jobs
      </h1>
      <Card padding="lg">
        <AdminJobsTable
          jobs={jobs}
          emptyTitle="No jobs are waiting for review"
          emptyDescription="New employer submissions will appear here for moderation."
        />
      </Card>
    </Section>
  );
}
