"use client";

import { Button } from "@/components/ui/button";
import { adminCopy } from "@/lib/copy/admin";
import { ThreadEmpty } from "./thread-empty";

const c = adminCopy.pageError;

// Catches what a dashboard or ticket page throws (a database that is down, mostly). The layout
// around it stays, so the developer keeps the navigation and can try again.
export default function DashboardError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <main className="flex h-full min-h-0 flex-col">
      <ThreadEmpty title={c.title} body={c.body}>
        <Button type="button" onClick={() => retry()} className="h-9 rounded-lg px-3.5 text-body font-semibold hover:bg-primary-hover pointer-coarse:h-11">
          {c.retry}
        </Button>
      </ThreadEmpty>
    </main>
  );
}
