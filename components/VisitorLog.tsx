import { prisma } from "@/lib/prisma";
import { formatSyncTimestamp } from "@/lib/formatDate";
import SectionCard from "@/components/SectionCard";

function device(userAgent: string | null): string {
  if (!userAgent) return "Unknown";
  if (/iPhone/.test(userAgent)) return "iPhone";
  if (/iPad/.test(userAgent)) return "iPad";
  if (/Android/.test(userAgent)) return "Android";
  if (/Macintosh/.test(userAgent)) return "Mac";
  if (/Windows/.test(userAgent)) return "Windows";
  if (/Linux/.test(userAgent)) return "Linux";
  return "Other";
}

function place(v: { city: string | null; region: string | null; country: string | null }) {
  return [v.city, v.region, v.country].filter(Boolean).join(", ") || "Unknown";
}

// Admin-only view of the page-visit log that /api/track records. Grouped by
// IP so it's easy to tell who's been lurking, with the raw feed underneath.
export default async function VisitorLog() {
  const visits = await prisma.pageVisit.findMany({ orderBy: { createdAt: "desc" }, take: 2000 });

  const byIp = new Map<
    string,
    { ip: string; views: number; pages: Map<string, number>; last: (typeof visits)[number] }
  >();
  for (const v of visits) {
    const entry = byIp.get(v.ip) ?? { ip: v.ip, views: 0, pages: new Map(), last: v };
    entry.views++;
    entry.pages.set(v.path, (entry.pages.get(v.path) ?? 0) + 1);
    byIp.set(v.ip, entry);
  }
  const visitors = [...byIp.values()];

  return (
    <SectionCard title="Visitors (last 30 days)">
      {visits.length === 0 ? (
        <div className="p-4 text-sm text-ink/60">No visits logged yet.</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="wwz-table">
              <thead>
                <tr>
                  <th>IP</th>
                  <th>Location</th>
                  <th>Device</th>
                  <th>Views</th>
                  <th>Pages</th>
                  <th>Last seen</th>
                </tr>
              </thead>
              <tbody>
                {visitors.map((v) => (
                  <tr key={v.ip}>
                    <td className="font-mono text-xs whitespace-nowrap">{v.ip}</td>
                    <td className="whitespace-nowrap">{place(v.last)}</td>
                    <td>{device(v.last.userAgent)}</td>
                    <td>{v.views}</td>
                    <td className="text-xs">
                      {[...v.pages.entries()]
                        .sort((a, b) => b[1] - a[1])
                        .map(([path, n]) => `${path} (${n})`)
                        .join(", ")}
                    </td>
                    <td className="text-xs whitespace-nowrap">
                      {formatSyncTimestamp(v.last.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <details className="border-t border-purple/10">
            <summary className="px-4 py-2 text-xs font-600 text-purple cursor-pointer">
              Every visit, newest first (last 200)
            </summary>
            <div className="overflow-x-auto">
              <table className="wwz-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Page</th>
                    <th>IP</th>
                    <th>Location</th>
                    <th>Device</th>
                  </tr>
                </thead>
                <tbody>
                  {visits.slice(0, 200).map((v) => (
                    <tr key={v.id}>
                      <td className="text-xs whitespace-nowrap">{formatSyncTimestamp(v.createdAt)}</td>
                      <td>{v.path}</td>
                      <td className="font-mono text-xs whitespace-nowrap">{v.ip}</td>
                      <td className="whitespace-nowrap">{place(v)}</td>
                      <td>{device(v.userAgent)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </SectionCard>
  );
}
