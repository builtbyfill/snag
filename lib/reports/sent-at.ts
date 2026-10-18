// When a report was sent: "17 Oct, 01:09", or "30 Dec 2025, 08:00" for another year (local time,
// 24-hour clock, the same short months as the date tiles). Built by hand so server and browser agree.
const two = (n: number) => String(n).padStart(2, '0');
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatSentAt(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const time = `${two(d.getHours())}:${two(d.getMinutes())}`;
  const sameYear = d.getFullYear() === now.getFullYear();
  const day = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return sameYear ? `${day}, ${time}` : `${day} ${d.getFullYear()}, ${time}`;
}
