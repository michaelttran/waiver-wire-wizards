"use client";

import { Fragment, useMemo, useState } from "react";
import { positionColor } from "@/lib/draftBoardStyle";
import { nflTeamLogoUrl } from "@/lib/nflTeams";
import type { PulseEntry, TeamUsage, UsagePlayer, UsageStatLine } from "@/lib/usageStats";

const PURPLE_LIGHT = "#6d3aa8";
const PURPLE_DARK = "#3a1c63";

type ColKey = keyof UsageStatLine | "trend";
type ColSpec = { key: ColKey; label: string; bar?: boolean; pct?: boolean };

const POS_SPECS: Record<UsagePlayer["position"], { label: string; cols: ColSpec[] }> = {
  QB: {
    label: "Quarterbacks",
    cols: [
      { key: "snapPct", label: "Snap%", bar: true },
      { key: "carries", label: "Att" },
      { key: "rushYards", label: "Ru Yd" },
      { key: "ypc", label: "YPC" },
      { key: "yaco", label: "YACO" },
      { key: "passYards", label: "Pass Yd" },
      { key: "passTd", label: "Pass TD" },
      { key: "interceptions", label: "INT" },
      { key: "td", label: "Ru TD" },
      { key: "trend", label: "Trend" },
      { key: "fantasyPoints", label: "FPTS" },
    ],
  },
  RB: {
    label: "Running Backs",
    cols: [
      { key: "snapPct", label: "Snap%", bar: true },
      { key: "carries", label: "Car" },
      { key: "rushYards", label: "Ru Yd" },
      { key: "ypc", label: "YPC" },
      { key: "yaco", label: "YACO" },
      { key: "targets", label: "Tgt" },
      { key: "receptions", label: "Rec" },
      { key: "recYards", label: "Re Yd" },
      { key: "ypt", label: "YPT" },
      { key: "td", label: "TD" },
      { key: "trend", label: "Trend" },
      { key: "fantasyPoints", label: "FPTS" },
    ],
  },
  WR: {
    label: "Wide Receivers",
    cols: [
      { key: "snapPct", label: "Snap%", bar: true },
      { key: "targets", label: "Tgt" },
      { key: "targetSharePct", label: "Tgt Shr", pct: true },
      { key: "receptions", label: "Rec" },
      { key: "recYards", label: "Re Yd" },
      { key: "ypt", label: "YPT" },
      { key: "aDOT", label: "aDOT" },
      { key: "avgSeparation", label: "Sep" },
      { key: "avgCushion", label: "Cush" },
      { key: "airYardsSharePct", label: "AY Shr", pct: true },
      { key: "yacAboveExpectation", label: "YAC+/-" },
      { key: "td", label: "TD" },
      { key: "trend", label: "Trend" },
      { key: "fantasyPoints", label: "FPTS" },
    ],
  },
  TE: {
    label: "Tight Ends",
    cols: [
      { key: "snapPct", label: "Snap%", bar: true },
      { key: "targets", label: "Tgt" },
      { key: "targetSharePct", label: "Tgt Shr", pct: true },
      { key: "receptions", label: "Rec" },
      { key: "recYards", label: "Re Yd" },
      { key: "ypt", label: "YPT" },
      { key: "aDOT", label: "aDOT" },
      { key: "avgSeparation", label: "Sep" },
      { key: "avgCushion", label: "Cush" },
      { key: "airYardsSharePct", label: "AY Shr", pct: true },
      { key: "yacAboveExpectation", label: "YAC+/-" },
      { key: "td", label: "TD" },
      { key: "trend", label: "Trend" },
      { key: "fantasyPoints", label: "FPTS" },
    ],
  },
};
const POSITION_ORDER: UsagePlayer["position"][] = ["QB", "RB", "WR", "TE"];

// All-null line for a week a player has no WeeklyPlayerStat row for (their
// team hasn't played yet, or they didn't play) — every numeric column reads
// as "–" rather than quietly substituting something else.
function emptyLine(week: number): UsageStatLine {
  return {
    week, snapPct: null, carries: null, rushYards: null, rushTd: null,
    rushYardsAfterContact: null, yaco: null, ypc: null, targets: null,
    receptions: null, recYards: null, recTd: null, ypt: null, targetSharePct: null,
    aDOT: null, td: null, passAttempts: null, passCompletions: null, passYards: null,
    passTd: null, interceptions: null, fantasyPoints: null, avgCushion: null,
    avgSeparation: null, airYardsSharePct: null, yacAboveExpectation: null,
    opponent: null, isHome: null,
  };
}

function fmt(v: number | null, suffix = ""): string {
  if (v === null || v === undefined) return "–";
  const text = Number.isInteger(v) ? String(v) : v.toFixed(1);
  return `${text}${suffix}`;
}

function BarCell({ value }: { value: number | null }) {
  if (value === null) return <span className="text-ink/30 text-xs">–</span>;
  const pct = Math.round(value);
  return (
    <div className="flex flex-col gap-0.5 min-w-[52px]">
      <span className="text-xs font-600">{pct}%</span>
      <div className="h-1 rounded bg-purple/15 overflow-hidden">
        <div className="h-full rounded" style={{ width: `${pct}%`, background: PURPLE_LIGHT }} />
      </div>
    </div>
  );
}

function PosBadge({ position }: { position: string }) {
  const colors = positionColor(position);
  return (
    <span
      className="inline-block shrink-0 rounded px-[5px] py-px text-[10px] font-700 tracking-wide mr-1.5 align-[1px]"
      style={{ background: colors.bg, color: colors.text }}
    >
      {position}
    </span>
  );
}

// 6-point-max sparkline of a player's snap share across the weeks they've
// played, with the most recent point emphasized — the "is their role
// growing" read the raw Week 6 / Season numbers alone don't give you.
function Trend({ weeks }: { weeks: UsageStatLine[] }) {
  const values = weeks.map((w) => w.snapPct).filter((v): v is number => v !== null);
  if (values.length < 2) return <span className="text-ink/30 text-xs">–</span>;

  const w = 68,
    h = 24,
    pad = 3;
  const pts = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (w - pad * 2);
    const y = h - pad - (v / 100) * (h - pad * 2);
    return [x, y] as const;
  });
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)},${h - pad} L${pts[0][0].toFixed(1)},${h - pad} Z`;
  const last = pts[pts.length - 1];
  const delta = Math.round(values[values.length - 1] - values[0]);
  const deltaClass = delta > 3 ? "text-emerald-700" : delta < -3 ? "text-red-700" : "text-ink/40";

  return (
    <div className="inline-flex items-center gap-1.5">
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0">
        <path d={area} fill="rgba(109,58,168,.15)" />
        <path d={line} fill="none" stroke={PURPLE_LIGHT} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={last[0]} cy={last[1]} r={2.4} fill={PURPLE_DARK} />
      </svg>
      <span className={`text-[11px] font-700 whitespace-nowrap ${deltaClass}`}>
        {delta > 0 ? "+" : ""}
        {delta}%
      </span>
    </div>
  );
}

function cellValue(col: ColSpec, line: UsageStatLine) {
  if (col.key === "trend") return null; // handled separately — needs the full weeks array, not one line
  const v = line[col.key as keyof UsageStatLine];
  if (col.pct) return fmt(v as number | null, "%");
  return fmt(v as number | null);
}

function PositionTable({
  position,
  players,
  rangeLine,
  expanded,
  onToggle,
}: {
  position: UsagePlayer["position"];
  players: UsagePlayer[];
  rangeLine: (p: UsagePlayer) => UsageStatLine;
  expanded: Record<string, boolean>;
  onToggle: (id: string) => void;
}) {
  const spec = POS_SPECS[position];
  if (players.length === 0) return null;

  return (
    <div>
      <div className="flex items-baseline gap-2 mb-1.5">
        <h3 className="text-xs font-700 text-purple uppercase tracking-wide">{spec.label}</h3>
        <span className="text-[11px] font-600 text-ink/35">{players.length} on roster</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm [font-variant-numeric:tabular-nums]">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-purple-dark text-cream text-left font-600 text-[13px] px-2.5 py-2 whitespace-nowrap">
                Player
              </th>
              {spec.cols.map((c) => (
                <th
                  key={c.key}
                  className={`bg-purple-dark text-cream font-600 text-[13px] px-2.5 py-2 whitespace-nowrap ${
                    c.key === "trend" ? "text-center" : "text-right"
                  }`}
                >
                  {c.label}
                </th>
              ))}
              <th className="bg-purple-dark px-2.5 py-2" />
            </tr>
          </thead>
          <tbody>
            {players.map((p, i) => {
              const line = rangeLine(p);
              const isOpen = !!expanded[p.sleeperPlayerId];
              const rowBg = i % 2 === 0 ? "bg-lavender" : "bg-cream";
              return (
                <Fragment key={p.sleeperPlayerId}>
                  <tr className={`${rowBg} hover:bg-purple/10`}>
                    <td className={`sticky left-0 z-[1] ${rowBg} shadow-[1px_0_0_rgba(45,27,105,.12)] px-2.5 py-[7px] whitespace-nowrap font-600`}>
                      <PosBadge position={p.position} />
                      {p.name}
                    </td>
                    {spec.cols.map((c) => (
                      <td
                        key={c.key}
                        className={`px-2.5 py-[7px] border-t border-purple/10 whitespace-nowrap ${
                          c.key === "trend" ? "text-center" : "text-right"
                        } ${c.key === "fantasyPoints" ? "font-700 text-purple-dark" : ""}`}
                      >
                        {c.key === "trend" ? (
                          <Trend weeks={p.weeks} />
                        ) : c.bar ? (
                          <BarCell value={line[c.key as keyof UsageStatLine] as number | null} />
                        ) : (
                          cellValue(c, line)
                        )}
                      </td>
                    ))}
                    <td className="px-2.5 py-[7px] border-t border-purple/10 text-right">
                      <button
                        type="button"
                        onClick={() => onToggle(p.sleeperPlayerId)}
                        className={`inline-flex items-center gap-1 rounded-full border border-purple/15 px-2 py-0.5 text-[11px] font-700 whitespace-nowrap transition-colors ${
                          isOpen ? "bg-purple text-cream border-purple" : "bg-lavender text-purple-dark hover:bg-purple/15"
                        }`}
                      >
                        {isOpen ? "▲" : "▾"} Weeks
                      </button>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={spec.cols.length + 2} className="p-0 border-t border-dashed border-purple/20 border-b border-purple/10">
                        <div className="bg-purple/5 px-3.5 py-2.5">
                          <div className="text-[11px] font-700 text-purple uppercase tracking-wide mb-1.5">
                            {p.name} &middot; week-by-week log
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-[13px] [font-variant-numeric:tabular-nums]">
                              <thead>
                                <tr>
                                  <th className="text-left font-600 px-2 py-1.5 bg-purple-light text-cream whitespace-nowrap">Week</th>
                                  {spec.cols
                                    .filter((c) => c.key !== "trend")
                                    .map((c) => (
                                      <th key={c.key} className="text-right font-600 px-2 py-1.5 bg-purple-light text-cream whitespace-nowrap">
                                        {c.label}
                                      </th>
                                    ))}
                                </tr>
                              </thead>
                              <tbody>
                                {p.weeks.map((wLine, idx) => (
                                  <tr key={wLine.week} className={idx % 2 === 0 ? "bg-white" : "bg-lavender"}>
                                    <td className="px-2 py-1.5 font-600 text-ink/60 whitespace-nowrap">
                                      Wk {wLine.week}
                                      {wLine.opponent && (
                                        <span className="font-500 text-ink/35">
                                          {" "}
                                          {wLine.isHome ? "vs" : "@"} {wLine.opponent}
                                        </span>
                                      )}
                                    </td>
                                    {spec.cols
                                      .filter((c) => c.key !== "trend")
                                      .map((c) => (
                                        <td key={c.key} className="px-2 py-1.5 text-right whitespace-nowrap">
                                          {c.bar ? <BarCell value={wLine[c.key as keyof UsageStatLine] as number | null} /> : cellValue(c, wLine)}
                                        </td>
                                      ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LeaguePulse({ pulse }: { pulse: PulseEntry[] }) {
  if (pulse.length === 0) {
    return (
      <div className="wwz-card p-6 text-center text-ink/50 text-sm">
        Check back after week 2 — risers need a prior week to compare against.
      </div>
    );
  }
  const max = Math.max(...pulse.map((p) => p.deltaSnapPct));
  const axisMax = Math.ceil((max + 2) / 5) * 5;

  return (
    <div className="wwz-card">
      <div className="wwz-section-header text-[13px]">
        <span>Top risers &middot; snap share, week over week</span>
      </div>
      <div className="flex flex-wrap gap-3.5 px-4 pt-3 text-[11px] text-ink/55">
        {POSITION_ORDER.map((pos) => {
          const c = positionColor(pos);
          return (
            <span key={pos} className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: c.bg }} />
              {pos}
            </span>
          );
        })}
      </div>
      <div className="flex flex-col gap-2 px-4 py-3">
        {pulse.map((p) => {
          const pct = Math.max(4, (p.deltaSnapPct / axisMax) * 100);
          const colors = positionColor(p.position);
          return (
            <div key={p.sleeperPlayerId} className="grid grid-cols-[148px_1fr_56px] sm:grid-cols-[168px_1fr_56px] items-center gap-2.5">
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-[13px] font-600">
                  <PosBadge position={p.position} />
                  <span className="truncate">{p.name}</span>
                </span>
                <span className="block text-[10px] font-500 text-ink/40 leading-tight pl-[26px]">
                  {p.nflTeam}
                </span>
              </span>
              <span className="relative h-4 rounded bg-purple/10">
                <span
                  className="absolute inset-y-0 left-0 rounded"
                  style={{ width: `${pct}%`, background: colors.bg }}
                />
              </span>
              <span className="text-[13px] font-700 text-right" style={{ color: colors.text }}>
                +{p.deltaSnapPct}%
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between px-4 pb-3 text-[10px] text-ink/35">
        <span className="ml-[150px]">0%</span>
        <span>+{Math.round(axisMax / 2)}%</span>
        <span>+{axisMax}%</span>
      </div>
    </div>
  );
}

export default function UsageExplorer({
  teams,
  pulse,
  statsThroughWeek,
}: {
  teams: TeamUsage[];
  pulse: PulseEntry[];
  statsThroughWeek: number;
}) {
  const defaultTeam = teams.find((t) => t.hasData)?.abbr ?? teams[0]?.abbr ?? "";
  const [teamAbbr, setTeamAbbr] = useState(defaultTeam);
  const [week, setWeek] = useState<number | "season">(statsThroughWeek || "season");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const team = teams.find((t) => t.abbr === teamAbbr);
  const byPosition = useMemo(() => {
    const grouped: Record<UsagePlayer["position"], UsagePlayer[]> = { QB: [], RB: [], WR: [], TE: [] };
    for (const p of team?.players ?? []) grouped[p.position].push(p);
    return grouped;
  }, [team]);

  function rangeLine(p: UsagePlayer): UsageStatLine {
    if (week === "season") return p.season;
    // No fallback to season totals here — a team that hasn't played its
    // current week yet (bye, or just hasn't kicked off) should show as
    // genuinely empty for that week, not silently borrow season numbers
    // under a "Week N" label.
    return p.weeks.find((w) => w.week === week) ?? emptyLine(week);
  }

  // Opponent is a team-level fact (same for everyone on the roster that
  // week), so it's pulled off whichever player happens to have a row for it
  // rather than threaded through every column.
  function opponentFor(wk: number): { opponent: string; isHome: boolean } | null {
    for (const p of team?.players ?? []) {
      const line = p.weeks.find((w) => w.week === wk);
      if (line?.opponent) return { opponent: line.opponent, isHome: line.isHome ?? false };
    }
    return null;
  }
  function opponentLabel(wk: number): string {
    const info = opponentFor(wk);
    return info ? `${info.isHome ? "vs" : "@"} ${info.opponent}` : "";
  }

  function toggle(id: string) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  if (statsThroughWeek === 0) {
    return (
      <div className="wwz-card p-8 text-center text-ink/60 text-sm">
        No weekly stats synced yet — these fill in after the next Sleeper sync.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-2">
          {teams.map((t) => {
            const active = t.abbr === teamAbbr;
            return (
              <button
                key={t.abbr}
                type="button"
                disabled={!t.hasData}
                onClick={() => {
                  setTeamAbbr(t.abbr);
                  setExpanded({});
                }}
                title={t.hasData ? undefined : "No synced stats for this team yet"}
                className={`relative flex items-center gap-2 text-left rounded-md border bg-white pl-3 pr-2.5 py-2 text-[13px] font-600 overflow-hidden ${
                  active ? "border-purple ring-2 ring-purple/20" : "border-purple/10"
                } ${t.hasData ? "" : "opacity-35 cursor-not-allowed"}`}
              >
                <span className="absolute left-0 top-0 bottom-0 w-[5px]" style={{ background: t.color }} />
                {/* eslint-disable-next-line @next/next/no-img-element -- tiny third-party icon, not worth Next/Image's remote-pattern config */}
                <img
                  src={nflTeamLogoUrl(t.abbr)}
                  alt=""
                  width={24}
                  height={24}
                  className="shrink-0"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
                <span className="min-w-0">
                  <span className="font-700 block">{t.abbr}</span>
                  <span className="block text-[10px] font-500 text-ink/50 truncate">
                    {t.name.replace(t.abbr, "").trim()}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 bg-white border border-purple/10 rounded-lg px-4 py-3 shadow-sm">
        <span className="text-[11px] font-700 uppercase tracking-wide text-ink/35 mr-1">Range</span>
        <div className="inline-flex flex-wrap gap-0.5 bg-lavender rounded-lg p-[3px]">
          {Array.from({ length: statsThroughWeek }, (_, i) => i + 1).map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => setWeek(w)}
              className={`px-3 py-1.5 rounded-md text-[13px] font-600 transition-colors ${
                week === w ? "bg-purple text-cream" : "text-purple-dark hover:bg-purple/10"
              }`}
            >
              Wk {w}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setWeek("season")}
            className={`px-3 py-1.5 rounded-md text-[13px] font-600 transition-colors ${
              week === "season" ? "bg-purple text-cream" : "text-purple-dark hover:bg-purple/10"
            }`}
          >
            Season
          </button>
        </div>
      </div>

      <div className="wwz-card">
        <div className="wwz-section-header">
          <span className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded-[3px]" style={{ background: team?.color ?? "#999" }} />
            {team?.name ?? "Select a team"}
          </span>
          <span className="font-sans font-500 text-[11px] text-cream/75">
            {week === "season"
              ? `Season (thru Wk ${statsThroughWeek})`
              : `Week ${week}${opponentLabel(week) ? ` · ${opponentLabel(week)}` : ""}`}
          </span>
        </div>
        <div className="p-3.5 space-y-5">
          {team && team.players.length > 0 ? (
            POSITION_ORDER.map((pos) => (
              <PositionTable
                key={pos}
                position={pos}
                players={byPosition[pos]}
                rangeLine={rangeLine}
                expanded={expanded}
                onToggle={toggle}
              />
            ))
          ) : (
            <p className="text-sm text-ink/50 text-center py-6">No synced stats for this team yet.</p>
          )}
        </div>
      </div>

      <LeaguePulse pulse={pulse} />
    </div>
  );
}
