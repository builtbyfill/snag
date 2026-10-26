"use server";

import { headers } from "next/headers";
import { after } from "next/server";
import { clientIp } from "@/lib/auth/rate-limit";
import { describeError } from "@/lib/log";
import { getDb } from "@/lib/db/client";
import { readReportEnv } from "@/lib/env";
import { runExtraction } from "@/lib/extraction/run";
import { addFollowUp, type FollowUpResult } from "@/lib/reports/follow-up";
import { getReportStatuses, type ReportStatus } from "@/lib/reports/statuses";
import { submitReport } from "@/lib/reports/submit";
import type { ReportErrorCode } from "@/lib/reports/validate";
import { getStorage } from "@/lib/storage";

export type ReportActionResult =
  | { ok: true; ticketId: string }
  | { ok: false; error: ReportErrorCode; field: "form" | "sentence" | "screenshot" };

/** Public: anyone with the report link can call this. Everything is validated in submitReport. */
export async function submitReportAction(slug: string, formData: FormData): Promise<ReportActionResult> {
  try {
    const env = readReportEnv();
    const storage = getStorage();
    const result = await submitReport(
      { db: getDb(), storage, ipHashSecret: env.IP_HASH_SECRET },
      {
        slug,
        sentence: formData.get("sentence"),
        file: formData.get("screenshot"),
        ip: clientIp(await headers()),
      },
    );
    if (result.ok) {
      // Save first, extract second: after() runs once the response has been sent, so the
      // client's confirmation never waits on the model. Failures land on the ticket itself.
      const { ticketId } = result;
      after(async () => {
        try {
          await runExtraction(ticketId, { db: getDb(), storage });
        } catch (error) {
          console.error(`runExtraction failed for ticket ${ticketId}: ${describeError(error)}`);
        }
      });
    }
    // The ticket id goes back so this device can keep its own history and ask for its status later.
    return result.ok ? { ok: true, ticketId: result.ticketId } : { ok: false, error: result.error, field: result.field };
  } catch (error) {
    console.error(`submitReportAction failed: ${describeError(error)}`);
    return { ok: false, error: "server", field: "form" };
  }
}

/**
 * Public: statuses of the reports this device holds ids for. Returns { id, status } only, and only
 * for ids that belong to this link's project (see lib/reports/statuses.ts). Never throws.
 */
export async function getReportStatusesAction(slug: string, ids: string[]): Promise<ReportStatus[]> {
  try {
    return await getReportStatuses(getDb(), slug, ids);
  } catch (error) {
    console.error(`getReportStatusesAction failed: ${describeError(error)}`);
    return [];
  }
}

/**
 * Public: adds text to a report this device sent. Everything is validated in addFollowUp (the
 * report must belong to this link's project; rate-limited per address). Never throws.
 */
export async function addFollowUpAction(slug: string, ticketId: string, body: string): Promise<FollowUpResult> {
  try {
    const env = readReportEnv();
    return await addFollowUp(
      { db: getDb(), ipHashSecret: env.IP_HASH_SECRET },
      { slug, ticketId, body, ip: clientIp(await headers()) },
    );
  } catch (error) {
    console.error(`addFollowUpAction failed: ${describeError(error)}`);
    return { ok: false, error: "server" };
  }
}
