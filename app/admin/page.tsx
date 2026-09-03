import { redirect } from "next/navigation";
import { isAuthed } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import SectionCard from "@/components/SectionCard";
import {
  addFaabMove,
  deleteFaabMove,
  logout,
  replaceDraftPicks,
  setChallengeWinner,
  syncFromSleeper,
  updateDraftNote,
  updateTeam,
} from "@/app/admin/actions";

export const metadata = {
  title: "Admin — Waiver Wire Wizards",
};

export const revalidate = 0;

export default async function AdminPage() {
  if (!(await isAuthed())) {
    redirect("/admin/login");
  }

  const [teams, challenges, settings, draftPicks] = await Promise.all([
    prisma.team.findMany({
      orderBy: { name: "asc" },
      include: { faabMoves: { orderBy: { createdAt: "desc" } } },
    }),
    prisma.weeklyChallenge.findMany({ orderBy: { week: "asc" } }),
    prisma.appSettings.findUnique({ where: { id: 1 } }),
    prisma.draftPick.findMany({
      orderBy: { overall: "asc" },
      include: { team: true },
    }),
  ]);

  const picksCsv = draftPicks
    .map((p) =>
      [p.round, p.team.name, p.playerName, p.playerPosition, p.nflTeam, p.note ?? ""].join(", ")
    )
    .join("\n");

  const allMoves = teams
    .flatMap((t) => t.faabMoves.map((m) => ({ ...m, teamName: t.name })))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-700 text-2xl sm:text-3xl text-purple mb-1">
            Commissioner Admin
          </h1>
          <p className="text-ink/60 text-sm">
            Changes here go live on the site immediately.
          </p>
        </div>
        <form action={logout}>
          <button
            type="submit"
            className="rounded border border-purple/30 text-purple text-sm px-3 py-1.5 hover:bg-lavender transition-colors"
          >
            Log Out
          </button>
        </form>
      </div>

      <SectionCard title="Sleeper Sync">
        <form
          action={syncFromSleeper}
          className="flex flex-wrap items-center justify-between gap-3 p-4"
        >
          <p className="text-xs text-ink/60">
            Pulls team/owner names, draft order, and the full draft board straight from your
            Sleeper league.
            {settings?.sleeperLastSynced && (
              <>
                {" "}
                Last synced{" "}
                <span className="font-600">
                  {settings.sleeperLastSynced.toLocaleString()}
                </span>
                .
              </>
            )}
          </p>
          <button
            type="submit"
            className="rounded bg-purple text-cream text-xs font-600 px-3 py-1.5 hover:bg-purple-light transition-colors shrink-0"
          >
            Sync from Sleeper
          </button>
        </form>
      </SectionCard>

      <SectionCard title="Teams, Buy-In & FAAB">
        <div className="overflow-x-auto">
          <table className="wwz-table">
            <thead>
              <tr>
                <th>Team</th>
                <th>Owner</th>
                <th>FAAB Start</th>
                <th>Draft Pos</th>
                <th>League Entry</th>
                <th>Playoff Entry</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {teams.map((team) => (
                <tr key={team.id}>
                  <td colSpan={7} className="p-0">
                    <form
                      action={updateTeam}
                      className="grid grid-cols-7 gap-2 items-center px-4 py-2"
                    >
                      <input type="hidden" name="id" value={team.id} />
                      <input
                        name="name"
                        defaultValue={team.name}
                        className="rounded border border-purple/20 px-2 py-1 text-sm"
                      />
                      <input
                        name="ownerName"
                        defaultValue={team.ownerName}
                        className="rounded border border-purple/20 px-2 py-1 text-sm"
                      />
                      <input
                        name="faabStarting"
                        type="number"
                        defaultValue={team.faabStarting}
                        className="rounded border border-purple/20 px-2 py-1 text-sm"
                      />
                      <input
                        name="draftPosition"
                        type="number"
                        min={1}
                        defaultValue={team.draftPosition ?? ""}
                        className="rounded border border-purple/20 px-2 py-1 text-sm"
                      />
                      <label className="flex items-center gap-1.5 text-sm">
                        <input
                          type="checkbox"
                          name="buyInPaid"
                          defaultChecked={team.buyInPaid}
                        />
                        Paid
                      </label>
                      <label className="flex items-center gap-1.5 text-sm">
                        <input
                          type="checkbox"
                          name="playoffPaid"
                          defaultChecked={team.playoffPaid}
                        />
                        Paid
                      </label>
                      <button
                        type="submit"
                        className="rounded bg-purple text-cream text-xs font-600 px-3 py-1.5 justify-self-start hover:bg-purple-light transition-colors"
                      >
                        Save
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard title="Log a FAAB Move">
        <form action={addFaabMove} className="grid sm:grid-cols-5 gap-2 p-4">
          <select
            name="teamId"
            required
            className="rounded border border-purple/20 px-2 py-1.5 text-sm"
          >
            <option value="">Team&hellip;</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
          <input
            name="week"
            type="number"
            min={1}
            max={18}
            placeholder="Week"
            required
            className="rounded border border-purple/20 px-2 py-1.5 text-sm"
          />
          <input
            name="description"
            placeholder="Description (e.g. waiver claim)"
            required
            className="rounded border border-purple/20 px-2 py-1.5 text-sm sm:col-span-2"
          />
          <input
            name="amount"
            type="number"
            min={0}
            placeholder="Amount $"
            required
            className="rounded border border-purple/20 px-2 py-1.5 text-sm"
          />
          <button
            type="submit"
            className="rounded bg-purple text-cream text-xs font-600 px-3 py-2 sm:col-span-5 justify-self-start hover:bg-purple-light transition-colors"
          >
            Add Move
          </button>
        </form>

        {allMoves.length > 0 && (
          <table className="wwz-table">
            <thead>
              <tr>
                <th>Week</th>
                <th>Team</th>
                <th>Description</th>
                <th>Amount</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {allMoves.map((move) => (
                <tr key={move.id}>
                  <td>{move.week}</td>
                  <td>{move.teamName}</td>
                  <td>{move.description}</td>
                  <td>${move.amount}</td>
                  <td>
                    <form action={deleteFaabMove}>
                      <input type="hidden" name="id" value={move.id} />
                      <button
                        type="submit"
                        className="text-xs text-red-600 hover:underline"
                      >
                        Delete
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SectionCard>

      <SectionCard title="Weekly Challenge Winners">
        <table className="wwz-table">
          <thead>
            <tr>
              <th>Wk</th>
              <th>Challenge</th>
              <th>Winner</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {challenges.map((c) => (
              <tr key={c.id}>
                <td>{c.week}</td>
                <td>{c.title}</td>
                <td colSpan={2} className="p-0">
                  <form
                    action={setChallengeWinner}
                    className="flex items-center gap-2 px-4 py-2"
                  >
                    <input type="hidden" name="id" value={c.id} />
                    <select
                      name="winnerId"
                      defaultValue={c.winnerId ?? ""}
                      className="rounded border border-purple/20 px-2 py-1 text-sm flex-1"
                    >
                      <option value="">TBD</option>
                      {teams.map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      className="rounded bg-purple text-cream text-xs font-600 px-3 py-1.5 hover:bg-purple-light transition-colors"
                    >
                      Save
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </SectionCard>

      <SectionCard title="Draft Order Note (shown until draft order/picks are set)">
        <form action={updateDraftNote} className="p-4 space-y-3">
          <textarea
            name="draftOrderNote"
            defaultValue={settings?.draftOrderNote}
            rows={3}
            className="w-full rounded border border-purple/20 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded bg-purple text-cream text-xs font-600 px-3 py-1.5 hover:bg-purple-light transition-colors"
          >
            Save
          </button>
        </form>
      </SectionCard>

      <SectionCard title="Draft Picks">
        <form action={replaceDraftPicks} className="p-4 space-y-3">
          <p className="text-xs text-ink/60">
            One pick per line: <code>round, team name, player, position, nfl team, note (optional)</code>.
            Pick number and overall are derived from each team&rsquo;s Draft Pos above. Saving replaces
            every pick below, so paste the full board each time.
          </p>
          <textarea
            name="picksCsv"
            defaultValue={picksCsv}
            rows={16}
            spellCheck={false}
            className="w-full rounded border border-purple/20 px-3 py-2 text-xs font-mono"
          />
          <button
            type="submit"
            className="rounded bg-purple text-cream text-xs font-600 px-3 py-1.5 hover:bg-purple-light transition-colors"
          >
            Save Draft Picks
          </button>
        </form>
      </SectionCard>
    </div>
  );
}
