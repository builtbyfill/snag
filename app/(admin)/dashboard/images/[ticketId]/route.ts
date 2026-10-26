import type { NextRequest } from "next/server";
import { isSignedIn } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { getStorage } from "@/lib/storage";
import { notFound, ticketImageResponse } from "@/lib/tickets/image";

// The only way a screenshot leaves the server. The session is checked here first, before the
// database or storage, not only in proxy.ts; any refusal is a 404. `?w=320` or `?w=640` gives a
// JPEG thumbnail for the thread. On Supabase the full size is a redirect to a 10-minute signed URL.
export async function GET(request: NextRequest, { params }: { params: Promise<{ ticketId: string }> }) {
  if (!(await isSignedIn())) return notFound();
  const { ticketId } = await params;
  return ticketImageResponse(
    { db: getDb(), storage: getStorage(), signedIn: true },
    { ticketId, w: request.nextUrl.searchParams.get("w") },
  );
}
