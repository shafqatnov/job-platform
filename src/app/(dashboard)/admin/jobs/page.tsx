import type { Metadata } from "next";
import { Section } from "@/components/Section";
import { Card } from "@/components/Card";
import { AdminJobsTable } from "@/features/admin/AdminJobsTable";
import { listAdminJobs } from "@/services/admin/listAdminJobs";

export const metadata: Metadata = {
  title: "All Jobs",
  robots: { index: false, follow: false },
};

export default async function AdminAllJobsPage() {
  const jobs = await listAdminJobs();

  return (
    <Section aria-labelledby="admin-jobs-heading">
      <h1 id="admin-jobs-heading" className="mb-8 text-2xl font-semibold text-foreground sm:text-3xl">
        All Jobs
      </h1>
      <Card padding="lg">
        <AdminJobsTable
          jobs={jobs}
          emptyTitle="No jobs yet"
          emptyDescription="Jobs will appear here once employers start posting."
        />
      </Card>
    </Section>
  );
}
