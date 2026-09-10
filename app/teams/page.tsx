import { prisma } from "@/lib/prisma";
import SectionCard from "@/components/SectionCard";
import { positionColor } from "@/lib/draftBoardStyle";
import {
  getPlayerGrades,
  gradeColor,
  normalizePlayerName,
  scoreToGrade,
  type GradeCutoff,
  type PlayerGrade,
} from "@/lib/playerGrades";

export const metadata = {
  title: "Teams — Waiver Wire Wizards",
};

export const revalidate = 0;

const SLOT_ORDER: Record<string, number> = { starter: 0, bench: 1, taxi: 2, ir: 3 };
const SLOT_LABEL: Record<string, string> = {
  starter: "Starters",
  bench: "Bench",
  taxi: "Taxi",
  ir: "IR",
};

// Fixed so every team lists positions in the same order — makes it easy to
// scan across cards instead of matching Sleeper's per-roster player order.
const POSITION_ORDER: Record<string, number> = { QB: 0, RB: 1, WR: 2, TE: 3, K: 4, DEF: 5 };

function byPosition<T extends { playerPosition: string; playerName: string }>(a: T, b: T) {
  const order = (POSITION_ORDER[a.playerPosition] ?? 99) - (POSITION_ORDER[b.playerPosition] ?? 99);
  return order !== 0 ? order : a.playerName.localeCompare(b.playerName);
}

const GRADE_STAT_ROWS: [label: string, key: keyof PlayerGrade][] = [
  ["NFL Status", "status"],
  ["Age", "age"],
  ["Position Rank", "posRank"],
  ["Projected Targets", "projTgt"],
  ["Projected Carries", "projCar"],
  ["Red Zone Share", "rzShare"],
  ["% Time Out", "pctTimeOut"],
  ["Durability", "dur"],
  ["Volume Index", "volumeIdx"],
  ["Red Zone Index", "rzIdx"],
  ["Availability Index", "availIdx"],
  ["Trajectory Index", "trajIdx"],
];

function GradeBadge({ grade, score }: { grade: string; score: number }) {
  const colors = gradeColor(grade);
  return (
    <span
      className="shrink-0 rounded px-2 py-0.5 text-[11px] font-700"
      style={{ background: colors.bg, color: colors.text }}
    >
      {grade} &middot; {score.toFixed(1)}
    </span>
  );
}

export default async function TeamsPage() {
  const [teams, settings, playerGrades] = await Promise.all([
    prisma.team.findMany({
      orderBy: { name: "asc" },
      include: { roster: true },
    }),
    prisma.appSettings.findUnique({ where: { id: 1 } }),
    getPlayerGrades(),
  ]);

  const gradeByName = new Map(
    playerGrades.players.map((g) => [normalizePlayerName(g.player), g])
  );
  const cutoffs: GradeCutoff[] = playerGrades.gradeCutoffs;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      <div>
        <h1 className="font-display font-700 text-2xl sm:text-3xl text-purple mb-2">
          Teams
        </h1>
        <p className="text-ink/60 text-sm">
          Who owns who, straight from Sleeper. Grades come from the{" "}
          <a href="/data" className="underline hover:text-purple">
            linked workbook
          </a>
          .
          {settings?.sleeperLastSynced && (
            <> Rosters last synced {settings.sleeperLastSynced.toLocaleString()}.</>
          )}
        </p>
      </div>

      {teams.every((t) => t.roster.length === 0) ? (
        <div className="wwz-card p-8 text-center text-ink/60 text-sm">
          Rosters haven&rsquo;t been synced from Sleeper yet.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-6">
          {teams.map((team) => {
            const bySlot = new Map<string, typeof team.roster>();
            for (const player of team.roster) {
              const list = bySlot.get(player.slot) ?? [];
              list.push(player);
              bySlot.set(player.slot, list);
            }
            for (const list of bySlot.values()) list.sort(byPosition);
            const slots = Array.from(bySlot.keys()).sort(
              (a, b) => (SLOT_ORDER[a] ?? 99) - (SLOT_ORDER[b] ?? 99)
            );

            const gradedPlayers = team.roster
              .map((p) => gradeByName.get(normalizePlayerName(p.playerName)))
              .filter((g): g is PlayerGrade => !!g);
            const teamScore =
              gradedPlayers.length > 0
                ? gradedPlayers.reduce((sum, g) => sum + g.score, 0) / gradedPlayers.length
                : null;
            const teamGrade = teamScore !== null ? scoreToGrade(teamScore, cutoffs) : null;

            return (
              <SectionCard
                key={team.id}
                title={
                  <span className="flex items-center justify-between gap-2 flex-1 min-w-0">
                    <span className="truncate">
                      {team.name} &mdash; {team.ownerName}
                    </span>
                    {teamGrade && teamScore !== null && (
                      <GradeBadge grade={teamGrade} score={teamScore} />
                    )}
                  </span>
                }
              >
                {slots.length === 0 ? (
                  <div className="p-4 text-sm text-ink/50">No roster synced yet.</div>
                ) : (
                  <div className="divide-y divide-purple/10">
                    {slots.map((slot) => (
                      <div key={slot} className="px-4 py-2.5">
                        <div className="text-[11px] font-700 uppercase tracking-wide text-ink/40 mb-1.5">
                          {SLOT_LABEL[slot] ?? slot}
                        </div>
                        <div className="space-y-1">
                          {(bySlot.get(slot) ?? []).map((player) => {
                            const colors = positionColor(player.playerPosition);
                            const grade = gradeByName.get(normalizePlayerName(player.playerName));

                            const row = (
                              <div className="flex items-center gap-2 px-2 py-1 text-xs">
                                <span
                                  className="w-8 shrink-0 text-center rounded px-1.5 py-0.5 text-[10px] font-700"
                                  style={{ background: colors.bg, color: colors.text }}
                                >
                                  {player.playerPosition}
                                </span>
                                <span className="font-600 flex-1">{player.playerName}</span>
                                {player.nflTeam && (
                                  <span className="text-ink/40 shrink-0">{player.nflTeam}</span>
                                )}
                                {grade && <GradeBadge grade={grade.grade} score={grade.score} />}
                                {grade && (
                                  <svg
                                    aria-hidden
                                    viewBox="0 0 20 20"
                                    className="w-3.5 h-3.5 shrink-0 text-ink/30 transition-transform group-open:rotate-180"
                                  >
                                    <path
                                      fill="currentColor"
                                      d="M5.25 7.5L10 12.25L14.75 7.5H5.25Z"
                                    />
                                  </svg>
                                )}
                              </div>
                            );

                            if (!grade) {
                              return (
                                <div key={player.id} className="rounded" style={{ background: "#f4f1fb" }}>
                                  {row}
                                </div>
                              );
                            }

                            return (
                              <details key={player.id} className="group rounded" style={{ background: "#f4f1fb" }}>
                                <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                                  {row}
                                </summary>
                                <div className="px-3 pb-2.5 pt-0.5">
                                  <div className="rounded bg-white/60 grid grid-cols-2 gap-x-3 gap-y-1 px-3 py-2 text-[11px]">
                                    {GRADE_STAT_ROWS.map(([label, key]) => (
                                      <div key={key} className="flex justify-between gap-2">
                                        <span className="text-ink/50">{label}</span>
                                        <span className="font-600">{String(grade[key])}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </details>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
