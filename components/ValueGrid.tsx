"use client";

import { useState } from "react";
import CopyImageButton from "@/components/CopyImageButton";

export type ValueCell = {
  label: string; // "round.pick"
  playerName: string;
  position: string;
  positionRank: number;
  fpor: number | null; // null = no stats (N/A)
  graded: boolean; // false for K/DEF, which FPOR doesn't cover
};

export type ValueBoard = {
  columns: string[];
  rows: (ValueCell | null)[][];
  caption: string;
};

type Mode = "market" | "league";

const NEUTRAL = "#1a2033";
const ZERO_RED = "hsl(0, 62%, 30%)";

// 0 / N/A is red; anything above zero runs red → yellow → green up to the
// board's best value, like the PPR Rankings graphic this is modeled on.
function cellColor(cell: ValueCell, max: number) {
  if (!cell.graded) return NEUTRAL;
  if (cell.fpor === null || cell.fpor <= 0 || max <= 0) return ZERO_RED;
  const t = Math.min(1, cell.fpor / max);
  return `hsl(${Math.round(t * 120)}, 58%, ${30 + Math.round(t * 4)}%)`;
}

export default function ValueGrid({
  market,
  league,
}: {
  market: ValueBoard | null;
  league: ValueBoard | null;
}) {
  const [mode, setMode] = useState<Mode>(market ? "market" : "league");
  const board = mode === "market" ? market : league;
  const max = Math.max(
    0,
    ...(board?.rows.flat().map((c) => (c?.graded && c.fpor) || 0) ?? [])
  );

  const options: { value: Mode; label: string; disabled: boolean }[] = [
    { value: "market", label: "Market ADP", disabled: !market },
    { value: "league", label: "Our Draft", disabled: !league },
  ];

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-3">
        <div className="inline-flex rounded border border-purple/30 overflow-hidden text-xs font-600">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              disabled={o.disabled}
              onClick={() => setMode(o.value)}
              className={`px-3 py-1.5 transition-colors disabled:opacity-40 ${
                mode === o.value ? "bg-purple text-cream" : "text-purple hover:bg-purple/10"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
        <CopyImageButton targetId="value-grid" fileName={`value-grid-${mode}.png`} />
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
                row.map((cell, c) => (
                  <div
                    key={`${r}:${c}`}
                    className="snap-start rounded-md p-1.5 sm:p-2 min-h-[64px] sm:min-h-[72px] flex flex-col justify-between text-cream"
                    style={{ background: cell ? cellColor(cell, max) : NEUTRAL }}
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
                          {!cell.graded
                            ? "—"
                            : cell.fpor === null
                              ? "FPOR N/A"
                              : `FPOR +${cell.fpor.toFixed(1)}`}
                        </span>
                      </>
                    ) : (
                      <span className="text-xs opacity-50">—</span>
                    )}
                  </div>
                ))
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-3 text-cream/70 text-[10px] sm:text-[11px]">
              <span>0 / N/A</span>
              <span
                className="h-2.5 w-28 rounded"
                style={{
                  background: `linear-gradient(to right, ${ZERO_RED}, hsl(60, 58%, 32%), hsl(120, 58%, 34%))`,
                }}
              />
              <span>max FPOR · K/DEF not graded</span>
            </div>
          </>
        ) : (
          <p className="p-8 text-center text-cream/60 text-sm">
            No data yet — it fills in after the next Sleeper sync.
          </p>
        )}
      </div>
    </>
  );
}
