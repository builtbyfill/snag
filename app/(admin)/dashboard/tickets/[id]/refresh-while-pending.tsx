"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Rendered only while the ticket is being read: refreshes every 3 seconds until it isn't. */
export function RefreshWhilePending() {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 3000);
    return () => clearInterval(timer);
  }, [router]);
  return null;
}
