import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { projects } from "@/lib/db/schema";
import { clientCopy, DEFAULT_CLIENT_LOCALE } from "@/lib/i18n/client-copy";
import { ReportForm } from "./report-form";

// One language for every report link today; a per-project language would be read here.
const locale = DEFAULT_CLIENT_LOCALE;

async function projectBySlug(slug: string) {
  const [project] = await getDb().select({ name: projects.name }).from(projects).where(eq(projects.slug, slug));
  return project ?? null;
}

export async function generateMetadata({ params }: PageProps<"/r/[slug]">): Promise<Metadata> {
  const project = await projectBySlug((await params).slug);
  return { title: project ? `${clientCopy[locale].pageTitle}: ${project.name}` : "Snag", robots: { index: false } };
}

// Slug lookup only. An unknown slug is a 404; there is no listing of projects anywhere public.
export default async function ReportPage({ params }: PageProps<"/r/[slug]">) {
  const { slug } = await params;
  const project = await projectBySlug(slug);
  if (!project) notFound();

  return (
    <div lang={locale} className="flex flex-1 flex-col">
      <header className="mb-6">
        <h1 className="text-title text-ink">{project.name}</h1>
        <p className="text-body text-ink-muted">{clientCopy[locale].subtitle}</p>
      </header>
      <ReportForm slug={slug} locale={locale} />
    </div>
  );
}
