import { prisma } from "@/lib/prisma";
import SectionCard from "@/components/SectionCard";
import CopyImageButton from "@/components/CopyImageButton";
import ValueGrid, { type ValueBoard, type ValueCell } from "@/components/ValueGrid";
import { avatarColor, initials, positionColor, POSITION_COLORS } from "@/lib/draftBoardStyle";
import {
  expectedFporByPick,
  fpor,
  playerKey,
  type Replacement,
  VALUE_POSITIONS,
  waiverReplacement,
} from "@/lib/fpor";
import { getRosteredPlayerIds } from "@/lib/sleeper";

export const metadata = {
  title: "Draft — Waiver Wire Wizards",
};

export const revalidate = 0;

// Rounds shown on the market board when there's no league draft to match.
const DEFAULT_ROUNDS = 15;

// Who's rostered right now, live from Sleeper (cached an hour). Falls back to
// the daily-synced RosterPlayer table if Sleeper can't be reached.
async function rosteredPlayerIds(): Promise<Set<string>> {
  const leagueId = process.env.SLEEPER_LEAGUE_ID;
  if (leagueId) {
    try {
      return new Set(await getRosteredPlayerIds(leagueId));
    } catch (err) {
      console.error("Live roster pull failed; using last synced rosters", err);
    }
  }
  const rows = await prisma.rosterPlayer.findMany({ select: { sleeperPlayerId: true } });
  return new Set(rows.map((r) => r.sleeperPlayerId));
}

type BoardPlayer = {
  overall: number;
  playerName: string;
  playerPosition: string;
  sleeperPlayerId: string | null;
};

// Turns players in draft order into value-grid cells, numbering each one's
// position rank within that order (the 5th WR taken is WR5).
function makeCellBuilder(
  pointsById: Map<string, number>,
  pointsByKey: Map<string, number>,
  replacements: Record<string, Replacement>,
  levels: Record<string, number>,
  expectedAt: (overall: number) => number
) {
  const takenAtPosition = new Map<string, number>();
  return (player: BoardPlayer, label: string): ValueCell => {
    const positionRank = (takenAtPosition.get(player.playerPosition) ?? 0) + 1;
    takenAtPosition.set(player.playerPosition, positionRank);
    const points =
      (player.sleeperPlayerId ? pointsById.get(player.sleeperPlayerId) : undefined) ??
      pointsByKey.get(playerKey(player.playerName, player.playerPosition));
    const value = fpor(points, player.playerPosition, levels);
    const expected = expectedAt(player.overall);
    const replacement = replacements[player.playerPosition] ?? null;
    return {
      label,
      playerName: player.playerName,
      position: player.playerPosition,
      positionRank,
      points: points ?? null,
      replacementName: replacement?.playerName ?? null,
      replacementPoints: replacement?.points ?? null,
      expected,
      fpor: value,
      vsPick: value === null ? null : value - expected,
      graded: (VALUE_POSITIONS as readonly string[]).includes(player.playerPosition),
    };
  };
}

export default async function DraftPage() {
  const [settings, teams, picks, adp, seasonPoints, rostered] = await Promise.all([
    prisma.appSettings.findUnique({ where: { id: 1 } }),
    prisma.team.findMany({ orderBy: { draftPosition: "asc" } }),
    prisma.draftPick.findMany({ orderBy: { overall: "asc" } }),
    prisma.adpEntry.findMany({ orderBy: { overall: "asc" } }),
    prisma.playerSeasonPoints.findMany(),
    rosteredPlayerIds(),
  ]);

  const draftOrder = teams.filter((t) => t.draftPosition !== null);
  const rounds = Array.from(new Set(picks.map((p) => p.round))).sort((a, b) => a - b);
  const picksByTeamAndRound = new Map(picks.map((p) => [`${p.teamId}:${p.round}`, p]));

  // Value grid: FPOR for every pick, by market ADP or by our actual draft.
  const teamCount = draftOrder.length || teams.length;
  const replacements = waiverReplacement(seasonPoints, rostered, teamCount);
  const levels = Object.fromEntries(
    Object.entries(replacements).map(([pos, r]) => [pos, r.points])
  );
  const pointsById = new Map(seasonPoints.map((p) => [p.sleeperPlayerId, p.points]));
  const pointsByKey = new Map(
    seasonPoints.map((p) => [playerKey(p.playerName, p.playerPosition), p.points])
  );
  const expectedAt = expectedFporByPick(
    seasonPoints.map((p) => fpor(p.points, p.playerPosition, levels) ?? 0)
  );
  const hasPoints = seasonPoints.length > 0;
  const replacementText = VALUE_POSITIONS.map((pos) => {
    const r = replacements[pos];
    return `${pos}: ${r.playerName ?? "formula"} ${r.points.toFixed(1)}`;
  }).join(" · ");
  const caption = (source: string) =>
    `${source}. Half-PPR points through week ${settings?.statsThroughWeek ?? "?"} over the best free agent on our waiver wire (${replacementText}).`;

  let leagueBoard: ValueBoard | null = null;
  if (hasPoints && picks.length > 0) {
    const cellFor = makeCellBuilder(pointsById, pointsByKey, replacements, levels, expectedAt);
    const cellByPick = new Map(
      picks.map((p) => [`${p.teamId}:${p.round}`, cellFor(p, `${p.round}.${p.pick}`)])
    );
    leagueBoard = {
      columns: draftOrder.map((t) => t.name),
      rows: rounds.map((round) =>
        draftOrder.map((t) => cellByPick.get(`${t.id}:${round}`) ?? null)
      ),
      caption: caption("Our league draft"),
    };
  }

  let marketBoard: ValueBoard | null = null;
  if (hasPoints && adp.length > 0 && teamCount > 0) {
    const cellFor = makeCellBuilder(pointsById, pointsByKey, replacements, levels, expectedAt);
    const roundCount = rounds.length || DEFAULT_ROUNDS;
    const rows: (ValueCell | null)[][] = Array.from({ length: roundCount }, () =>
      Array<ValueCell | null>(teamCount).fill(null)
    );
    for (const entry of adp.slice(0, roundCount * teamCount)) {
      const index = entry.overall - 1;
      const round = Math.floor(index / teamCount) + 1;
      const pickInRound = (index % teamCount) + 1;
      // Snake order: odd rounds run left to right, even rounds come back.
      const column = round % 2 === 1 ? pickInRound - 1 : teamCount - pickInRound;
      rows[round - 1][column] = cellFor(entry, `${round}.${pickInRound}`);
    }
    marketBoard = {
      columns: Array.from({ length: teamCount }, (_, i) => `Slot ${i + 1}`),
      rows,
      caption: caption(`Market ADP (${settings?.adpSnapshotNote ?? "snapshot"})`),
    };
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      <div>
        <h1 className="font-display font-700 text-2xl sm:text-3xl text-purple mb-2">
          Draft
        </h1>
        <p className="text-ink/60 text-sm">
          {picks.length > 0
            ? "Full results from the league draft."
            : "Set by the commissioner ahead of the draft."}
        </p>
      </div>

      <SectionCard title="Draft Order">
        {draftOrder.length > 0 ? (
          <ol className="divide-y divide-purple/10">
            {draftOrder.map((team) => (
              <li
                key={team.id}
                className="flex items-center gap-3 px-4 py-2.5 text-sm"
              >
                <span className="w-6 shrink-0 text-right font-700 text-purple">
                  {team.draftPosition}
                </span>
                <span className="font-600">{team.name}</span>
                <span className="text-ink/50">({team.ownerName})</span>
              </li>
            ))}
          </ol>
        ) : (
          <div className="p-8 text-center text-ink/60 text-sm">
            {settings?.draftOrderNote ??
              "Draft order will be posted here once it's set."}
          </div>
        )}
      </SectionCard>

      {picks.length > 0 && (
        <SectionCard title="Draft Results">
          <div className="flex items-center justify-between gap-3 px-4 pt-3">
            <p className="text-[11px] text-ink/40 sm:hidden">Swipe to see every team &rarr;</p>
            <CopyImageButton targetId="draft-results-table" fileName="draft-results.png" />
          </div>
          <div
            id="draft-results-table"
            className="overflow-x-auto snap-x snap-proximity p-2 sm:p-4"
            style={{ background: "#0e1220" }}
          >
            <div className="flex flex-wrap gap-2 sm:gap-3 pb-3">
              {Object.entries(POSITION_COLORS).map(([pos, colors]) => (
                <span
                  key={pos}
                  className="text-[10px] sm:text-[11px] font-700 rounded px-2 py-0.5"
                  style={{ background: colors.bg, color: colors.text }}
                >
                  {pos}
                </span>
              ))}
            </div>

            <div
              className="inline-grid gap-1 sm:gap-1.5"
              style={{
                gridTemplateColumns: `repeat(${draftOrder.length}, clamp(112px, 32vw, 168px))`,
              }}
            >
              {draftOrder.map((team, i) => (
                <div
                  key={team.id}
                  className="snap-start flex flex-col items-center gap-1.5 px-1 pb-2"
                >
                  <div
                    className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-[11px] sm:text-xs font-700 text-white"
                    style={{ background: avatarColor(i) }}
                  >
                    {initials(team.ownerName)}
                  </div>
                  <div className="text-cream text-[11px] sm:text-xs font-700 text-center leading-tight">
                    {team.name}
                  </div>
                </div>
              ))}

              {rounds.map((round) =>
                draftOrder.map((team) => {
                  const pick = picksByTeamAndRound.get(`${team.id}:${round}`);
                  const colors = pick ? positionColor(pick.playerPosition) : null;
                  return (
                    <div
                      key={`${team.id}:${round}`}
                      className="snap-start rounded-md p-1.5 sm:p-2 min-h-[68px] sm:min-h-[76px] flex flex-col justify-between"
                      style={{
                        background: colors?.bg ?? "#1a2033",
                        color: colors?.text ?? "#5a6280",
                      }}
                    >
                      {pick ? (
                        <>
                          <span className="text-[9px] sm:text-[10px] font-700 opacity-70">
                            {pick.round}.{pick.pick}
                          </span>
                          <span className="text-[11px] sm:text-xs font-700 leading-tight">
                            {pick.playerName}
                          </span>
                          <span className="text-[9px] sm:text-[10px] opacity-80">
                            {pick.playerPosition} · {pick.nflTeam}
                          </span>
                          {pick.note && (
                            <span className="mt-1 w-fit text-[8px] sm:text-[9px] font-700 uppercase tracking-wide rounded px-1 py-0.5 bg-black/15">
                              {pick.note}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-xs">—</span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </SectionCard>
      )}

      <SectionCard title="Value Grid">
        <p className="px-4 pt-3 text-xs text-ink/60">
          Every pick colored by fantasy points over replacement (FPOR): half-PPR points
          scored so far minus what the best free agent at that position on our waiver wire
          has scored. It puts every position on one scale. Hover a player (tap on mobile)
          for the full comparison.
          &ldquo;vs. Pick&rdquo; compares that with what the pick should have returned (the
          Nth pick gets the Nth-best FPOR this season), so busts go negative.
        </p>
        <ValueGrid market={marketBoard} league={leagueBoard} />
      </SectionCard>
    </div>
  );
}
