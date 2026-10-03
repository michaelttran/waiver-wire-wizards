"use client";

import { useEffect, useState } from "react";
import CopyImageButton from "@/components/CopyImageButton";

export type ValueCell = {
  label: string; // "round.pick"
  playerName: string;
  position: string;
  positionRank: number;
  points: number | null; // season half-PPR points; null = no stats
  replacementName: string | null; // free agent setting the bar; null = lineup formula
  replacementPoints: number | null;
  expected: number; // FPOR this pick should return
  fpor: number | null; // null = no stats (N/A)
  vsPick: number | null; // fpor minus what this pick should return; can be negative
  graded: boolean; // false for K/DEF, which FPOR doesn't cover
};

export type ValueBoard = {
  columns: string[];
  rows: (ValueCell | null)[][];
  caption: string;
};

type Mode = "market" | "league";
type Metric = "vsPick" | "fpor";

const NEUTRAL = "#1a2033";
const ZERO_RED = "hsl(0, 62%, 30%)";

function hue(hueDegrees: number) {
  return `hsl(${Math.round(hueDegrees)}, 58%, 32%)`;
}

// FPOR: 0 / N/A is red, anything above zero runs red → yellow → green up to the
// board's best value, like the PPR Rankings graphic this is modeled on.
// vs. Pick: diverging around zero — red for busts, yellow for "got what you
// paid for", green for steals — scaled to the board's largest miss or hit.
function cellColor(cell: ValueCell, metric: Metric, scale: number) {
  if (!cell.graded) return NEUTRAL;
  const value = cell[metric];
  if (value === null) return ZERO_RED;
  if (metric === "fpor") {
    if (value <= 0 || scale <= 0) return ZERO_RED;
    return hue(Math.min(1, value / scale) * 120);
  }
  const t = scale > 0 ? Math.max(-1, Math.min(1, value / scale)) : 0;
  return hue(60 + t * 60);
}

function formatValue(cell: ValueCell, metric: Metric) {
  if (!cell.graded) return "—";
  const value = cell[metric];
  if (value === null) return metric === "fpor" ? "FPOR N/A" : "vs pick N/A";
  const sign = value < 0 ? "−" : "+";
  const text = `${sign}${Math.abs(value).toFixed(1)}`;
  return metric === "fpor" ? `FPOR ${text}` : `${text} vs pick`;
}

function signed(value: number) {
  return `${value < 0 ? "−" : "+"}${Math.abs(value).toFixed(1)}`;
}

type Active = { key: string; cell: ValueCell; rect: DOMRect };

const CARD_WIDTH = 240;

// The comparison behind a cell. Positioned `fixed` against the cell's screen
// rect so the grid's horizontal scroller doesn't clip it; flips above the cell
// when there's no room below.
function DetailCard({ active }: { active: Active }) {
  const { cell, rect } = active;
  const left = Math.max(
    8,
    Math.min(rect.left + rect.width / 2 - CARD_WIDTH / 2, window.innerWidth - CARD_WIDTH - 8)
  );
  const below = rect.bottom + 180 < window.innerHeight;
  const position = below
    ? { top: rect.bottom + 6 }
    : { bottom: window.innerHeight - rect.top + 6 };

  return (
    <div
      role="tooltip"
      className="fixed z-50 rounded-lg bg-white text-ink shadow-xl ring-1 ring-black/10 p-3 text-xs space-y-1.5 pointer-events-none"
      style={{ left, width: CARD_WIDTH, ...position }}
    >
      <div className="font-700 text-sm leading-tight">{cell.playerName}</div>
      <div className="text-ink/50">
        {cell.position}
        {cell.positionRank} · pick {cell.label}
      </div>
      {cell.points === null ? (
        <div>No stats yet this season.</div>
      ) : (
        <table className="w-full">
          <tbody>
            <tr>
              <td className="text-ink/60">Season points</td>
              <td className="text-right font-600">{cell.points.toFixed(1)}</td>
            </tr>
            <tr>
              <td className="text-ink/60">
                Best free agent {cell.position}
                {cell.replacementName ? `: ${cell.replacementName}` : " (formula)"}
              </td>
              <td className="text-right font-600 align-top">
                {cell.replacementPoints?.toFixed(1) ?? "—"}
              </td>
            </tr>
            <tr className="border-t border-black/10">
              <td className="font-700 pt-1">FPOR</td>
              <td className="text-right font-700 pt-1">{signed(cell.fpor ?? 0)}</td>
            </tr>
            <tr>
              <td className="text-ink/60">Pick {cell.label} should return</td>
              <td className="text-right font-600">{signed(cell.expected)}</td>
            </tr>
            <tr className="border-t border-black/10">
              <td className="font-700 pt-1">vs. Pick</td>
              <td className="text-right font-700 pt-1">{signed(cell.vsPick ?? 0)}</td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  );
}

function ToggleGroup<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; disabled?: boolean }[];
}) {
  return (
    <div className="inline-flex rounded border border-purple/30 overflow-hidden text-xs font-600">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          disabled={o.disabled}
          onClick={() => onChange(o.value)}
          className={`px-3 py-1.5 transition-colors disabled:opacity-40 ${
            value === o.value ? "bg-purple text-cream" : "text-purple hover:bg-purple/10"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function ValueGrid({
  market,
  league,
}: {
  market: ValueBoard | null;
  league: ValueBoard | null;
}) {
  const [mode, setMode] = useState<Mode>(market ? "market" : "league");
  const [metric, setMetric] = useState<Metric>("vsPick");
  const [active, setActive] = useState<Active | null>(null);

  // Mouse users get the card on hover; touch users tap a cell to open it and
  // tap anywhere else (or scroll) to close it.
  const canHover = () => window.matchMedia("(hover: hover)").matches;
  useEffect(() => {
    if (!active) return;
    const close = () => setActive(null);
    const onPointerDown = (e: PointerEvent) => {
      if (!(e.target as Element).closest?.("[data-value-cell]")) close();
    };
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [active]);
  const board = mode === "market" ? market : league;
  const scale = Math.max(
    0,
    ...(board?.rows.flat().map((c) => Math.abs((c?.graded && c[metric]) || 0)) ?? [])
  );

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-3">
        <div className="flex flex-wrap gap-2">
          <ToggleGroup
            value={mode}
            onChange={(m) => {
              setMode(m);
              setActive(null);
            }}
            options={[
              { value: "market", label: "Market ADP", disabled: !market },
              { value: "league", label: "Our Draft", disabled: !league },
            ]}
          />
          <ToggleGroup
            value={metric}
            onChange={setMetric}
            options={[
              { value: "vsPick", label: "vs. Pick" },
              { value: "fpor", label: "FPOR" },
            ]}
          />
        </div>
        <CopyImageButton targetId="value-grid" fileName={`value-grid-${mode}-${metric}.png`} />
      </div>
      <div
        id="value-grid"
        className="overflow-x-auto snap-x snap-proximity p-2 sm:p-4"
        style={{ background: "#0e1220" }}
      >
        {board ? (
          <>
            <p className="text-cream/70 text-[11px] sm:text-xs pb-3">{board.caption}</p>
            <div
              className="inline-grid gap-1 sm:gap-1.5"
              style={{
                gridTemplateColumns: `repeat(${board.columns.length}, clamp(104px, 30vw, 140px))`,
              }}
            >
              {board.columns.map((col, i) => (
                <div
                  key={i}
                  className="snap-start text-cream text-[11px] sm:text-xs font-700 text-center leading-tight px-1 pb-1"
                >
                  {col}
                </div>
              ))}
              {board.rows.map((row, r) =>
                row.map((cell, c) => {
                  const key = `${mode}:${r}:${c}`;
                  const interactive = cell?.graded ?? false;
                  const open = (el: HTMLElement) =>
                    cell && setActive({ key, cell, rect: el.getBoundingClientRect() });
                  return (
                    <div
                      key={key}
                      data-value-cell={interactive ? "" : undefined}
                      className={`snap-start rounded-md p-1.5 sm:p-2 min-h-[64px] sm:min-h-[72px] flex flex-col justify-between text-cream ${
                        interactive ? "cursor-pointer" : ""
                      } ${active?.key === key ? "ring-2 ring-white" : ""}`}
                      style={{ background: cell ? cellColor(cell, metric, scale) : NEUTRAL }}
                      onMouseEnter={
                        interactive
                          ? (e) => canHover() && open(e.currentTarget)
                          : undefined
                      }
                      onMouseLeave={
                        interactive ? () => canHover() && setActive(null) : undefined
                      }
                      onClick={
                        interactive
                          ? (e) => {
                              if (canHover()) return;
                              if (active?.key === key) setActive(null);
                              else open(e.currentTarget);
                            }
                          : undefined
                      }
                    >
                      {cell ? (
                        <>
                          <span className="text-[9px] sm:text-[10px] font-700 opacity-70">
                            {cell.label} ({cell.position}
                            {cell.positionRank})
                          </span>
                          <span className="text-[11px] sm:text-xs font-700 leading-tight">
                            {cell.playerName}
                          </span>
                          <span className="text-[9px] sm:text-[10px] font-700 opacity-90">
                            {formatValue(cell, metric)}
                          </span>
                        </>
                      ) : (
                        <span className="text-xs opacity-50">—</span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-3 text-cream/70 text-[10px] sm:text-[11px]">
              <span>{metric === "fpor" ? "0 / N/A" : `−${scale.toFixed(0)} bust`}</span>
              <span
                className="h-2.5 w-28 rounded"
                style={{
                  background: `linear-gradient(to right, ${hue(0)}, ${hue(60)}, ${hue(120)})`,
                }}
              />
              <span>
                {metric === "fpor" ? "max FPOR" : `+${scale.toFixed(0)} steal`} · K/DEF not graded
              </span>
            </div>
          </>
        ) : (
          <p className="p-8 text-center text-cream/60 text-sm">
            No data yet — it fills in after the next Sleeper sync.
          </p>
        )}
      </div>
      {active && <DetailCard active={active} />}
    </>
  );
}
