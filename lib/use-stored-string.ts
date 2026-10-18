"use client";

import { useSyncExternalStore } from "react";

/** Returned during server rendering and hydration, before the browser has read storage. */
export const NOT_READ = "\u0000not-read";
const EVENT = "snag-storage";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange); // other tabs
  window.addEventListener(EVENT, onChange); // this tab, after notifyStoredString()
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null; // blocked storage behaves like an empty one
  }
}

/**
 * A localStorage value as React state without a hydration mismatch: the server and the first
 * client render see NOT_READ, then the browser's value. Snapshots are strings, so they compare
 * stably and never loop.
 */
export function useStoredString(key: string): string | null {
  return useSyncExternalStore(subscribe, () => read(key), () => NOT_READ);
}

/** Tell this tab's useStoredString hooks that a value changed. */
export function notifyStoredString() {
  window.dispatchEvent(new Event(EVENT));
}
