import { prisma } from "@/lib/prisma";
import SectionCard from "@/components/SectionCard";

export const metadata = {
  title: "Weekly Challenges — Waiver Wire Wizards",
};

const TIEBREAKERS = [
  { challenge: "All Gas, No Brakes", criteria: "Every starter scores 10+" },
  { challenge: "Defense Wins Championships", criteria: "Highest D/ST score" },
  {
    challenge: "Monday Night Miracle",
    criteria: "Team that gains the most points from MNF players",
  },
];

export const revalidate = 0;

export default async function ChallengesPage() {
  const challenges = await prisma.weeklyChallenge.findMany({
    orderBy: { week: "asc" },
    include: { winner: true },
  });

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
                <td>{c.week}</td>
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
