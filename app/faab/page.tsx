import { prisma } from "@/lib/prisma";
import SectionCard from "@/components/SectionCard";

export const metadata = {
  title: "FAAB Tracker — Waiver Wire Wizards",
};

export const revalidate = 0;

export default async function FaabPage() {
  const teams = await prisma.team.findMany({
    orderBy: { name: "asc" },
    include: { faabMoves: { orderBy: { createdAt: "desc" } } },
  });

  const rows = teams.map((team) => {
    const spent = team.faabMoves.reduce((sum, move) => sum + move.amount, 0);
    return {
      ...team,
      spent,
      remaining: team.faabStarting - spent,
    };
  });

  const recentMoves = teams
    .flatMap((team) => team.faabMoves.map((move) => ({ ...move, teamName: team.name })))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 15);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      <div>
        <h1 className="font-display font-700 text-2xl sm:text-3xl text-purple mb-2">
          FAAB Tracker
        </h1>
        <p className="text-ink/60 text-sm">
          Season FAAB allowance is $100 per team. Remaining budgets and buy-in status update
          live as the commissioner logs moves.
        </p>
      </div>

      <SectionCard title="Team Budgets">
        <div className="overflow-x-auto">
          <table className="wwz-table">
            <thead>
              <tr>
                <th>Team</th>
                <th>Owner</th>
                <th>Starting</th>
                <th>Spent</th>
                <th>Remaining</th>
                <th>League Entry</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((team) => (
                <tr key={team.id}>
                  <td className="font-600 text-purple whitespace-nowrap">{team.name}</td>
                  <td className="whitespace-nowrap">{team.ownerName}</td>
                  <td>${team.faabStarting}</td>
                  <td>${team.spent}</td>
                  <td className={team.remaining <= 10 ? "text-red-600 font-600" : ""}>
                    ${team.remaining}
                  </td>
                  <td className="whitespace-nowrap">{team.buyInPaid ? "Paid" : "Unpaid"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard title="Recent FAAB Moves">
        {recentMoves.length === 0 ? (
          <p className="p-5 text-sm text-ink/50">No FAAB moves logged yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="wwz-table">
              <thead>
                <tr>
                  <th>Week</th>
                  <th>Team</th>
                  <th>Description</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {recentMoves.map((move) => (
                  <tr key={move.id}>
                    <td>{move.week}</td>
                    <td className="whitespace-nowrap">{move.teamName}</td>
                    <td>{move.description}</td>
                    <td>${move.amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
