"use server";

import { after } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { readReportEnv } from "@/lib/env";
import { runExtraction } from "@/lib/extraction/run";
import { createLocalStorage } from "@/lib/storage";
import { retryExtraction, type RetryResult } from "@/lib/tickets/retry";

/**
 * Retry on a failed ticket card. Signed-in only. The ticket turns `pending` at once (the thread
 * then refreshes every 3 seconds), and the extraction runs after the response, as on submit.
 */
export async function retryExtractionAction(ticketId: string): Promise<RetryResult> {
  await requireSession();
  const result = await retryExtraction(getDb(), ticketId);
  if (result.ok) {
    const storage = createLocalStorage(readReportEnv().UPLOAD_DIR);
    after(async () => {
      try {
        await runExtraction(ticketId, { db: getDb(), storage });
      } catch (error) {
        console.error(`runExtraction failed for ticket ${ticketId}`, error);
      }
    });
  }
  return result;
}
