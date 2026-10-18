// Runs once when a Next.js server starts, before it takes requests (dev and `next start`).
// Only the Node.js runtime has the database driver, so the import stays behind the runtime check.
export async function register() {
  // Only a real server start: not the Edge runtime, and never during `next build`.
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NEXT_PHASE === "phase-production-build") return;

  // Fail fast: a missing, short or placeholder secret, or two equal secrets, stops the server here
  // with the variable's name (never its value).
  const { readAuthEnv } = await import("@/lib/env");
  readAuthEnv();

  try {
    const { getDb } = await import("@/lib/db/client");
    const { failInterruptedExtractions } = await import("@/lib/extraction/run");
    // Anything still pending lost its extraction with the previous process (one instance at a time).
    const marked = await failInterruptedExtractions(getDb());
    if (marked > 0) console.warn(`Marked ${marked} interrupted extraction(s) as failed; Retry is available.`);
  } catch (error) {
    // A missing database must not stop the server from starting; the sweep runs again next start.
    console.error("Start-up check for interrupted extractions failed", error);
  }
}
