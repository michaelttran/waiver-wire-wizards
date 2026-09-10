// Formats a timestamp in both Pacific and Eastern time explicitly, rather
// than relying on the server's or viewer's local timezone — this app's
// commissioner and league members aren't guaranteed to share one. `short`
// timeZoneName resolves to PST/PDT and EST/EDT automatically depending on
// daylight saving, so the label is always correct for the date given.
function formatInZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

export function formatSyncTimestamp(date: Date): string {
  return `${formatInZone(date, "America/Los_Angeles")} / ${formatInZone(date, "America/New_York")}`;
}
