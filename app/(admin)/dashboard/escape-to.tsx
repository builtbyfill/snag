"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Where a key belongs to the element: fields, dialogs, and open menus (Base UI's popup is a listbox). */
export const TYPING_OR_MENU = "input, textarea, select, dialog, [role='dialog'], [role='listbox'], [role='option'], [role='menu'], [role='menuitem'], [contenteditable='true']";

/** Esc goes back to the chat while focus is in the ticket, unless a field, dialog or menu has the key. */
export function EscapeTo({ href }: { href: string }) {
  const router = useRouter();
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      // Only from inside the ticket (WCAG 2.1.4), and not while a field, menu or dialog has the key.
      if (!(event.target instanceof HTMLElement) || !event.target.closest("main") || event.target.closest(TYPING_OR_MENU)) return;
      router.push(href);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [href, router]);
  return null;
}
