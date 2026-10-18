import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { projects } from "@/lib/db/schema";
import { clientCopy } from "@/lib/copy/client";
import { ClientPortal } from "./client-portal";

async function projectBySlug(slug: string) {
  const [project] = await getDb().select({ name: projects.name }).from(projects).where(eq(projects.slug, slug));
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
  return { title: project ? `${clientCopy.pageTitle}: ${project.name}` : "Snag" };
}

// Slug lookup only. An unknown slug is a 404; there is no listing of projects anywhere public.
export default async function ReportPage({ params }: PageProps<"/r/[slug]">) {
  const { slug } = await params;
  const project = await projectBySlug(slug);
  if (!project) notFound();

  const { name, email } = developer();
  return <ClientPortal slug={slug} projectName={project.name} developerName={name} developerEmail={email} />;
}
