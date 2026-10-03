"use client";

import { useState } from "react";
import CopyImageButton from "@/components/CopyImageButton";

export type ValueCell = {
  label: string; // "round.pick"
  playerName: string;
  position: string;
  positionRank: number;
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
            onChange={setMode}
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
                row.map((cell, c) => (
                  <div
                    key={`${r}:${c}`}
                    className="snap-start rounded-md p-1.5 sm:p-2 min-h-[64px] sm:min-h-[72px] flex flex-col justify-between text-cream"
                    style={{ background: cell ? cellColor(cell, metric, scale) : NEUTRAL }}
                    title={
                      cell?.graded
                        ? `${formatValue(cell, "fpor")} · ${formatValue(cell, "vsPick")}`
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
                ))
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
    </>
  );
}
