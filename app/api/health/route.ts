import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";

// For the Compose healthcheck (and later Caddy or a monitor): 200 once the database answers.
// Says nothing else about the app, so it is safe to leave public.
export async function GET() {
  try {
    await getDb().execute(sql`select 1`);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
