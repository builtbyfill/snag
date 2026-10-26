"use server";

import { after } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { runExtraction } from "@/lib/extraction/run";
import { describeError } from "@/lib/log";
import { getStorage } from "@/lib/storage";
import { retryExtraction, type RetryResult } from "@/lib/tickets/retry";
import { updateTicketField, type UpdateResult } from "@/lib/tickets/update";

/**
 * Retry on a failed ticket card. Signed-in only. The ticket turns `pending` at once (the thread
 * then refreshes every 3 seconds), and the extraction runs after the response, as on submit.
 */
export async function retryExtractionAction(ticketId: string): Promise<RetryResult> {
  await requireSession();
  // Read before the ticket turns pending: an env problem must not leave it stuck there.
  const storage = getStorage();
  const result = await retryExtraction(getDb(), ticketId);
  if (result.ok) {
    after(async () => {
      try {
        await runExtraction(ticketId, { db: getDb(), storage });
      } catch (error) {
        console.error(`runExtraction failed for ticket ${ticketId}: ${describeError(error)}`);
      }
    });
  }
  return result;
}

/** Saves one editable field from the detail page. Signed-in only; the whitelist lives in updateTicketField. */
export async function updateTicketFieldAction(ticketId: string, field: string, value: string): Promise<UpdateResult> {
  await requireSession();
  return updateTicketField(getDb(), ticketId, field, value);
}
