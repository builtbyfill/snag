import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { projects } from "@/lib/db/schema";
import { POSITIONING } from "@/lib/copy/brand";
import { clientCopy } from "@/lib/copy/client";
import { readOfficeHours } from "@/lib/office-hours";
import { listDemoReports } from "@/lib/reports/demo";
import { ClientPortal } from "./client-portal";

// Sending a report starts its extraction after the response, inside this page's function: up to
// two model calls of 60 s each (lib/extraction/policy.ts), so the Vercel limit is 300 s, not 60.
export const maxDuration = 300;

async function projectBySlug(slug: string) {
  const [project] = await getDb()
    .select({ name: projects.name, demo: projects.demo, officeHours: projects.officeHours })
    .from(projects)
    .where(eq(projects.slug, slug));
  return project ?? null;
}

// Who is behind the page: shown in the header and on the Contact card. Both optional, plain text.
function developer() {
  const name = process.env.DEVELOPER_NAME?.trim().slice(0, 60) || null;
  const email = process.env.DEVELOPER_EMAIL?.trim() || null;
  return { name, email: email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null };
}

export async function generateMetadata({ params }: PageProps<"/r/[slug]">): Promise<Metadata> {
  const project = await projectBySlug((await params).slug);
  return { title: project ? `${clientCopy.pageTitle}: ${project.name}` : "Snag", description: POSITIONING };
}

// Slug lookup only. An unknown slug is a 404; there is no listing of projects anywhere public.
// A demo project's reports come along (lib/reports/demo.ts); a real project's never do.
export default async function ReportPage({ params }: PageProps<"/r/[slug]">) {
  const { slug } = await params;
  const project = await projectBySlug(slug);
  if (!project) notFound();

  const { name, email } = developer();
  const demoReports = project.demo ? await listDemoReports(getDb(), slug) : null;
  return (
    <ClientPortal
      slug={slug}
      projectName={project.name}
      developerName={name}
      developerEmail={email}
      officeHours={readOfficeHours(project.officeHours)}
      demoReports={demoReports}
    />
  );
}
