import SectionCard from "@/components/SectionCard";
import UsageExplorer from "@/components/UsageExplorer";
import { getUsageExplorerData } from "@/lib/usageStats";

export const metadata = {
  title: "Data — Waiver Wire Wizards",
};

// Usage stats are only as fresh as the last Sleeper sync (daily, via cron) —
// no need to re-fetch them on every request in between.
export const revalidate = 300;

export default async function DataPage() {
  const sheetUrl = process.env.PLAYER_GRADES_SHEET_URL;
  const usage = await getUsageExplorerData();

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      <div>
        <h1 className="font-display font-700 text-2xl sm:text-3xl text-purple mb-2">
          Data
        </h1>
        <p className="text-ink/60 text-sm">
          Player grades on the Teams page are pulled from this workbook, maintained
          outside the site.
        </p>
      </div>

      <SectionCard title="Player Grades Workbook">
        <div className="p-4 space-y-3">
          {sheetUrl ? (
            <>
              <a
                href={sheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block rounded bg-purple text-cream text-sm font-600 px-4 py-2 hover:bg-purple-light transition-colors"
              >
                Open in Google Sheets &#8599;
              </a>
              <p className="text-xs text-ink/50">
                The &ldquo;Player Grades&rdquo; tab feeds the grades and stats shown on the{" "}
                <a href="/teams" className="underline hover:text-purple">
                  Teams
                </a>{" "}
                page (checked hourly).
              </p>
            </>
          ) : (
            <p className="text-sm text-ink/50">
              No spreadsheet linked yet — set <code>PLAYER_GRADES_SHEET_URL</code> to enable this.
            </p>
          )}
        </div>
      </SectionCard>

      <div>
        <h2 className="font-display font-700 text-xl text-purple mb-2">NFL Usage Explorer</h2>
        <p className="text-ink/60 text-sm max-w-3xl">
          Every rostered QB/RB/WR/TE for a real NFL team, with snap share, usage, and efficiency for any
          week this season or the season to date — plus a league-wide look at whose snap share is rising.
          Synced daily from Sleeper alongside the rest of the site&rsquo;s data.
        </p>
      </div>

      <UsageExplorer teams={usage.teams} pulse={usage.pulse} statsThroughWeek={usage.statsThroughWeek} />

      <div className="wwz-card">
        <div className="wwz-section-header text-[13px]">Glossary</div>
        <dl className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-x-4 gap-y-2 p-4 text-[13px] text-ink/60">
          <div className="pb-1 border-b border-dashed border-purple/10">
            <dt className="inline font-700 text-purple-dark">Snap%</dt>
            <dd className="inline ml-1">offensive snaps played</dd>
          </div>
          <div className="pb-1 border-b border-dashed border-purple/10">
            <dt className="inline font-700 text-purple-dark">YPC / YPT</dt>
            <dd className="inline ml-1">yards per carry / per target</dd>
          </div>
          <div className="pb-1 border-b border-dashed border-purple/10">
            <dt className="inline font-700 text-purple-dark">YACO</dt>
            <dd className="inline ml-1">rushing yards after contact, per carry</dd>
          </div>
          <div className="pb-1 border-b border-dashed border-purple/10">
            <dt className="inline font-700 text-purple-dark">Tgt Shr</dt>
            <dd className="inline ml-1">% of team targets</dd>
          </div>
          <div className="pb-1 border-b border-dashed border-purple/10">
            <dt className="inline font-700 text-purple-dark">aDOT</dt>
            <dd className="inline ml-1">avg. depth of target (air yds)</dd>
          </div>
          <div className="pb-1 border-b border-dashed border-purple/10">
            <dt className="inline font-700 text-purple-dark">Sep / Cush</dt>
            <dd className="inline ml-1">separation from defender at catch / cushion at the snap (yds)</dd>
          </div>
          <div className="pb-1 border-b border-dashed border-purple/10">
            <dt className="inline font-700 text-purple-dark">AY Shr</dt>
            <dd className="inline ml-1">% of team air yards this player drew (NGS)</dd>
          </div>
          <div className="pb-1 border-b border-dashed border-purple/10">
            <dt className="inline font-700 text-purple-dark">YAC+/-</dt>
            <dd className="inline ml-1">yards after catch vs. NGS-expected, +/-</dd>
          </div>
          <div className="col-span-full -mt-1 text-[11px] text-ink/40">
            Sep / Cush / AY Shr / YAC+/- show &ldquo;&ndash;&rdquo; on lower-volume weeks &mdash; the NFL&rsquo;s
            Next Gen Stats feed only publishes these for a subset of player-weeks, not every game.
          </div>
          <div className="pb-1 border-b border-dashed border-purple/10">
            <dt className="inline font-700 text-purple-dark">Trend</dt>
            <dd className="inline ml-1">snap% across recent weeks</dd>
          </div>
          <div className="pb-1 border-b border-dashed border-purple/10">
            <dt className="inline font-700 text-purple-dark">Weeks</dt>
            <dd className="inline ml-1">full week-by-week log, per player</dd>
          </div>
        </dl>
      </div>

      <div className="rounded-lg border border-purple/10 bg-white p-4 flex gap-3">
        <span className="text-lg leading-tight">&#9888;&#65039;</span>
        <p className="text-[13px] text-ink/70 leading-relaxed">
          <strong className="text-purple-dark">One stat isn&rsquo;t here:</strong> route participation. Neither
          Sleeper nor any free public feed (nflverse included — checked directly) publishes it during an
          active season; it&rsquo;s normally a PFF/FantasyData-exclusive stat. Everything else — snap%, carries,
          targets, receptions, target share, aDOT, YPC/YPT — comes from Sleeper, and the separation/cushion/
          air-yards-share/YAC+/- columns on WR and TE come from the NFL&rsquo;s own Next Gen Stats (via nflverse),
          both refreshed in the same daily sync.
        </p>
      </div>
    </div>
  );
}
