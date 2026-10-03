import Link from "next/link";
import { prisma } from "@/lib/prisma";
import SectionCard from "@/components/SectionCard";
import { getStandings } from "@/lib/recaps";

export const metadata = {
  title: "Standings — Waiver Wire Wizards",
};

export const revalidate = 0;

function formatOdds(pct: number) {
  if (pct > 0 && pct < 1) return "<1%";
  if (pct < 100 && pct > 99) return ">99%";
  return `${Math.round(pct)}%`;
}

export default async function StandingsPage() {
  const [standings, teams] = await Promise.all([
    getStandings(),
    prisma.team.findMany({ select: { sleeperUserId: true, name: true } }),
  ]);

  // The numbers are written once a week, but team names come from the daily
  // Sleeper sync so a rename shows up here without waiting for the next recap.
  const nameBySleeperId = new Map(
    teams.filter((t) => t.sleeperUserId).map((t) => [t.sleeperUserId as string, t.name]),
  );

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      <div>
        <h1 className="font-display font-700 text-2xl sm:text-3xl text-purple mb-2">
          Standings
        </h1>
        <p className="text-ink/60 text-sm">
          Updated every Tuesday with the{" "}
          <Link href="/challenges" className="text-purple underline">
            weekly recap
          </Link>
          .
        </p>
      </div>

      {standings ? (
        <SectionCard title={`Standings and Playoff Odds (after Week ${standings.afterWeek})`}>
          <div className="overflow-x-auto">
            <table className="wwz-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Team</th>
                  <th>Record</th>
                  <th>Points</th>
                  <th>All-play</th>
                  <th>Playoff odds</th>
                </tr>
              </thead>
              <tbody>
                {standings.rows.map((r, i) => (
                  <tr key={r.sleeperUserId}>
                    <td className="text-ink/50">{i + 1}</td>
                    <td className="font-600 whitespace-nowrap">
                      {nameBySleeperId.get(r.sleeperUserId) ?? r.name}
                    </td>
                    <td className="whitespace-nowrap">
                      {r.wins}-{r.losses}
                      {r.ties ? `-${r.ties}` : ""}
                    </td>
                    <td>{Math.round(r.points)}</td>
                    <td className="whitespace-nowrap">
                      {r.allPlayWins}-{r.allPlayLosses}
                    </td>
                    <td className="font-600 text-purple">{formatOdds(r.playoffOdds)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="wwz-recap px-4 sm:px-6 py-5">
            <p>
              <em>
                All-play is what your record would be if you played everyone every week.
                Playoff odds come from simulating the rest of the season 20,000 times (top 6
                get in).
              </em>
            </p>
            {standings.notesHtml && (
              // Trusted content: committed to this repo in content/recaps.
              <div className="wwz-recap" dangerouslySetInnerHTML={{ __html: standings.notesHtml }} />
            )}
          </div>
        </SectionCard>
      ) : (
        <p className="text-ink/60 text-sm">Standings show up after the first weekly recap.</p>
      )}
    </div>
  );
}
