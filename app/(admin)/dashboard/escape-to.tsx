"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Esc goes back to the chat, unless a field or dialog has the key. */
export function EscapeTo({ href }: { href: string }) {
  const router = useRouter();
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (event.target instanceof HTMLElement && event.target.closest("input, textarea, select, dialog, [role='dialog']")) return;
      router.push(href);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [href, router]);
  return null;
}
