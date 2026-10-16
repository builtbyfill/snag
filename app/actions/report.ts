"use server";

import { headers } from "next/headers";
import { clientIp } from "@/lib/auth/rate-limit";
import { getDb } from "@/lib/db/client";
import { readReportEnv } from "@/lib/env";
import { submitReport } from "@/lib/reports/submit";
import type { ReportErrorCode } from "@/lib/reports/validate";
import { createLocalStorage } from "@/lib/storage";

export type ReportActionResult =
  | { ok: true }
  | { ok: false; error: ReportErrorCode; field: "form" | "sentence" | "screenshot" };

/** Public: anyone with the report link can call this. Everything is validated in submitReport. */
export async function submitReportAction(slug: string, formData: FormData): Promise<ReportActionResult> {
  try {
    const env = readReportEnv();
    const result = await submitReport(
      { db: getDb(), storage: createLocalStorage(env.UPLOAD_DIR), ipHashSecret: env.IP_HASH_SECRET },
      {
        slug,
        sentence: formData.get("sentence"),
        file: formData.get("screenshot"),
        ip: clientIp(await headers()),
      },
    );
    // Extraction is scheduled here with after() in slice 4. The client never waits on it.
    return result.ok ? { ok: true } : { ok: false, error: result.error, field: result.field };
  } catch (error) {
    console.error("submitReportAction failed", error);
    return { ok: false, error: "server", field: "form" };
  }
}
