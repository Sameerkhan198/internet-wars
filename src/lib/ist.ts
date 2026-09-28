/**
 * Admin forms take and show times in IST (UTC+05:30, no DST) explicitly, so
 * the value is identical on the server render and in any admin's browser.
 */
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** ISO instant → "YYYY-MM-DDTHH:mm" in IST (for <input type="datetime-local">). */
export function isoToIstInput(iso: string): string {
  return new Date(new Date(iso).getTime() + IST_OFFSET_MS).toISOString().slice(0, 16);
}

/** "YYYY-MM-DDTHH:mm" read as IST → ISO instant. Returns "" for empty input. */
export function istInputToIso(value: string): string {
  if (!value) return "";
  const asUtc = Date.parse(`${value}:00Z`);
  return Number.isNaN(asUtc) ? "" : new Date(asUtc - IST_OFFSET_MS).toISOString();
}

export function formatIst(d: Date | string): string {
  return new Date(d).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
