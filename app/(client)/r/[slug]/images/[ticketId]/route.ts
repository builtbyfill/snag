import type { NextRequest } from "next/server";
import { getDb } from "@/lib/db/client";
import { readReportEnv } from "@/lib/env";
import { isDemoTicket } from "@/lib/reports/demo";
import { createLocalStorage } from "@/lib/storage";
import { notFound, ticketImageResponse } from "@/lib/tickets/image";

// Screenshots of a demo project's reports, for its client page (no sign-in: the page is public).
// Only a ticket of a demo project is served; everything else is the same 404 as the dashboard
// route gives, so the route says nothing about real projects' reports.
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string; ticketId: string }> }) {
  const { slug, ticketId } = await params;
  const db = getDb();
  if (!(await isDemoTicket(db, slug, ticketId))) return notFound();
  return ticketImageResponse(
    { db, storage: createLocalStorage(readReportEnv().UPLOAD_DIR), signedIn: true },
    { ticketId, w: request.nextUrl.searchParams.get("w") },
  );
}
