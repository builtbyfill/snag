import type { NextRequest } from "next/server";
import { isSignedIn } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { readReportEnv } from "@/lib/env";
import { createLocalStorage } from "@/lib/storage";
import { notFound, ticketImageResponse } from "@/lib/tickets/image";

// The only way a screenshot leaves the server. The session is checked here first, before the
// database or the uploads folder, not only in proxy.ts; any refusal is a 404. `?w=320` or
// `?w=640` gives a JPEG thumbnail for the thread.
export async function GET(request: NextRequest, { params }: { params: Promise<{ ticketId: string }> }) {
  if (!(await isSignedIn())) return notFound();
  const { ticketId } = await params;
  return ticketImageResponse(
    { db: getDb(), storage: createLocalStorage(readReportEnv().UPLOAD_DIR), signedIn: true },
    { ticketId, w: request.nextUrl.searchParams.get("w") },
  );
}
