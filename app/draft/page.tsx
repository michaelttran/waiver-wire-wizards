import { prisma } from "@/lib/prisma";
import SectionCard from "@/components/SectionCard";
import CopyImageButton from "@/components/CopyImageButton";
import { avatarColor, initials, positionColor, POSITION_COLORS } from "@/lib/draftBoardStyle";

export const metadata = {
  title: "Draft — Waiver Wire Wizards",
};

export const revalidate = 0;

export default async function DraftPage() {
  const [settings, teams, picks] = await Promise.all([
    prisma.appSettings.findUnique({ where: { id: 1 } }),
    prisma.team.findMany({ orderBy: { draftPosition: "asc" } }),
    prisma.draftPick.findMany({ orderBy: { overall: "asc" } }),
  ]);

  const draftOrder = teams.filter((t) => t.draftPosition !== null);
  const rounds = Array.from(new Set(picks.map((p) => p.round))).sort((a, b) => a - b);
  const picksByTeamAndRound = new Map(picks.map((p) => [`${p.teamId}:${p.round}`, p]));

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
    </div>
  );
}
