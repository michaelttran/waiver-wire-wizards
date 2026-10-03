import { prisma } from "@/lib/prisma";
import SectionCard from "@/components/SectionCard";
import { getRecaps } from "@/lib/recaps";

export const metadata = {
  title: "Weekly Challenges — Waiver Wire Wizards",
};

const TIEBREAKERS = [
  { challenge: "Defense Wins Championships", criteria: "Highest D/ST score" },
  { challenge: "All Gas, No Brakes", criteria: "Every starter scores 10+" },
  {
    challenge: "Monday Night Miracle",
    criteria: "Team that gains the most points from MNF players",
  },
];

export const revalidate = 0;

export default async function ChallengesPage() {
  const [challenges, recaps] = await Promise.all([
    prisma.weeklyChallenge.findMany({
      orderBy: { week: "asc" },
      include: { winner: true },
    }),
    getRecaps(),
  ]);
  const recapWeeks = new Set(recaps.map((r) => r.week));

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      <div>
        <h1 className="font-display font-700 text-2xl sm:text-3xl text-purple mb-2">
          Weekly Challenges
        </h1>
        <p className="text-ink/60 text-sm">
          A new head-to-head side challenge every week of the regular season. Winners are
          updated live by the commissioner.
        </p>
      </div>

      <SectionCard title="Season Challenge Schedule">
        <table className="wwz-table">
          <thead>
            <tr>
              <th>Wk</th>
              <th>Challenge</th>
              <th>Winner Criteria</th>
              <th>Winner</th>
            </tr>
          </thead>
          <tbody>
            {challenges.map((c) => (
              <tr key={c.id}>
                <td>
                  {recapWeeks.has(c.week) ? (
                    <a href={`#recap-week-${c.week}`} className="text-purple font-600 underline">
                      {c.week}
                    </a>
                  ) : (
                    c.week
                  )}
                </td>
                <td>{c.title}</td>
                <td>{c.criteria}</td>
                <td>
                  {c.winner ? (
                    <span className="text-purple font-600">{c.winner.name}</span>
                  ) : (
                    <span className="text-ink/40">TBD</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </SectionCard>

      {recaps.length > 0 && (
        <SectionCard title="Weekly Recaps">
          <div className="divide-y divide-purple/10">
            {recaps.map((r, i) => (
              <details
                key={r.week}
                id={`recap-week-${r.week}`}
                open={i === 0}
                className="group scroll-mt-24"
              >
                <summary className="cursor-pointer list-none px-4 sm:px-6 py-4 flex items-center justify-between gap-4 hover:bg-lavender">
                  <span className="font-display font-700 text-purple">{r.title}</span>
                  <span className="text-ink/40 text-sm transition-transform group-open:rotate-90">
                    &#9656;
                  </span>
                </summary>
                <div
                  className="wwz-recap px-4 sm:px-6 pb-6"
                  dangerouslySetInnerHTML={{ __html: r.html }}
                />
              </details>
            ))}
          </div>
        </SectionCard>
      )}

      <SectionCard title="Tiebreaker Challenges">
        <table className="wwz-table">
          <thead>
            <tr>
              <th>Challenge</th>
              <th>Winner Criteria</th>
            </tr>
          </thead>
          <tbody>
            {TIEBREAKERS.map((t) => (
              <tr key={t.challenge}>
                <td>{t.challenge}</td>
                <td>{t.criteria}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </SectionCard>
    </div>
  );
}
