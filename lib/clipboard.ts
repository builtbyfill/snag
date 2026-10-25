// Copies text to the clipboard. The Clipboard API only exists on https and on localhost; opened
// over the network (http://192.168.x.x:3000) it is missing, so this falls back to the old
// select-and-copy route, which still works there. Rejects when neither works.
export async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Blocked (focus, permissions): try the fallback below.
    }
  }
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  area.style.pointerEvents = "none";
  document.body.appendChild(area);
  const active = document.activeElement as HTMLElement | null;
  area.select();
  try {
    if (!document.execCommand("copy")) throw new Error("copy refused");
  } finally {
    area.remove();
    active?.focus?.();
  }
}
