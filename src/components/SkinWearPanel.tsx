"use client";

import { useId, useState } from "react";

type SkinWearPanelProps = {
  wear?: string | null;
  minFloat?: number | null;
  maxFloat?: number | null;
};

type WearSegment = {
  label: string;
  short: string;
  min: number;
  max: number;
  className: string;
};

const WEAR_SEGMENTS: WearSegment[] = [
  { label: "Factory New", short: "FN", min: 0, max: 0.07, className: "bg-emerald-400" },
  { label: "Minimal Wear", short: "MW", min: 0.07, max: 0.15, className: "bg-lime-400" },
  { label: "Field-Tested", short: "FT", min: 0.15, max: 0.38, className: "bg-amber-400" },
  { label: "Well-Worn", short: "WW", min: 0.38, max: 0.45, className: "bg-orange-500" },
  { label: "Battle-Scarred", short: "BS", min: 0.45, max: 1, className: "bg-rose-500" },
];

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const formatFloat = (value: number) => value.toFixed(2);

const normalizeBounds = (
  minFloat?: number | null,
  maxFloat?: number | null
) => {
  const min = typeof minFloat === "number" ? clamp(minFloat, 0, 1) : 0;
  const max = typeof maxFloat === "number" ? clamp(maxFloat, 0, 1) : 1;
  if (min > max) {
    return { min: 0, max: 1 };
  }
  return { min, max };
};

const getSegmentByWear = (wear?: string | null) => {
  if (!wear) return null;
  const normalized = wear.trim().toLowerCase();
  return (
    WEAR_SEGMENTS.find((segment) => segment.label.toLowerCase() === normalized) ??
    null
  );
};

const getSegmentByFloat = (value: number) =>
  WEAR_SEGMENTS.find((segment, index) => {
    if (index === WEAR_SEGMENTS.length - 1) {
      return value >= segment.min && value <= segment.max;
    }
    return value >= segment.min && value < segment.max;
  }) ?? null;

const resolveInitialFloat = (
  wear: string | null | undefined,
  min: number,
  max: number
) => {
  const wearSegment = getSegmentByWear(wear);
  if (wearSegment) {
    const segmentMin = Math.max(min, wearSegment.min);
    const segmentMax = Math.min(max, wearSegment.max);
    if (segmentMin <= segmentMax) {
      return Number(((segmentMin + segmentMax) / 2).toFixed(3));
    }
  }
  return Number(((min + max) / 2).toFixed(3));
};

export default function SkinWearPanel({
  wear,
  minFloat,
  maxFloat,
}: SkinWearPanelProps) {
  const rangeId = useId();
  const bounds = normalizeBounds(minFloat, maxFloat);
  const [previewFloat, setPreviewFloat] = useState(() =>
    resolveInitialFloat(wear, bounds.min, bounds.max)
  );

  const currentSegment = getSegmentByFloat(previewFloat) ?? getSegmentByWear(wear);
  const sliderLeft = `${previewFloat * 100}%`;
  const hasWearProfile =
    Boolean(wear) ||
    typeof minFloat === "number" ||
    typeof maxFloat === "number";

  if (!hasWearProfile) {
    return null;
  }

  return (
    <div className="card p-6 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="kicker">Wear</div>
          <h3 className="text-xl font-semibold">Float preview</h3>
        </div>
        <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] px-4 py-3 text-right">
          <div className="text-[10px] uppercase tracking-[0.24em] text-[color:var(--muted)]">
            Aktivni wear
          </div>
          <div className="text-lg font-semibold">
            {formatFloat(previewFloat)} {currentSegment?.short ?? "--"}
          </div>
          <div className="text-xs text-[color:var(--muted)]">
            {currentSegment?.label ?? wear ?? "Wear profil"}
          </div>
        </div>
      </div>

      <div className="rounded-[1.5rem] border border-[color:var(--border)] bg-[linear-gradient(180deg,rgba(16,27,52,0.96),rgba(11,18,36,0.92))] p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="text-[color:var(--muted)]">Rozsah skinu</span>
          <span className="font-medium text-[color:var(--fg)]">
            {formatFloat(bounds.min)} - {formatFloat(bounds.max)}
          </span>
        </div>

        <div className="relative px-3 pt-10">
          <div
            className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg border border-white/10 bg-slate-300/20 px-3 py-1 text-sm font-semibold text-white shadow-lg shadow-black/30 backdrop-blur"
            style={{ left: sliderLeft }}
          >
            {formatFloat(previewFloat)} {currentSegment?.short ?? ""}
          </div>

          <div className="relative h-3 overflow-hidden rounded-full bg-white/10">
            {WEAR_SEGMENTS.map((segment) => {
              const start = Math.max(segment.min, bounds.min);
              const end = Math.min(segment.max, bounds.max);
              if (end <= start) return null;

              return (
                <div
                  key={segment.label}
                  className={`absolute inset-y-0 ${segment.className}`}
                  style={{
                    left: `${start * 100}%`,
                    width: `${(end - start) * 100}%`,
                  }}
                />
              );
            })}
          </div>

          <div
            className="pointer-events-none absolute top-[2.05rem] z-10 h-6 w-6 -translate-x-1/2 rounded-full border-2 border-slate-950/80 bg-white shadow-[0_0_18px_rgba(15,23,42,0.55)]"
            style={{ left: sliderLeft }}
          />

          <input
            id={rangeId}
            type="range"
            min={bounds.min}
            max={bounds.max}
            step={0.001}
            value={previewFloat}
            onChange={(event) => setPreviewFloat(Number(event.target.value))}
            className="absolute inset-x-0 top-8 h-8 cursor-pointer opacity-0"
            aria-label="Wear preview slider"
          />

          <div className="mt-3 flex items-center justify-between text-[11px] font-medium text-[color:var(--muted)]">
            <span>{formatFloat(bounds.min)}</span>
            <span>{formatFloat(bounds.max)}</span>
          </div>
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-5">
          {WEAR_SEGMENTS.map((segment) => {
            const isActive = currentSegment?.label === segment.label;
            return (
              <div
                key={segment.label}
                className={`rounded-xl border px-3 py-2 text-xs transition ${
                  isActive
                    ? "border-white/20 bg-white/10 text-white"
                    : "border-white/10 bg-white/[0.03] text-[color:var(--muted)]"
                }`}
              >
                <div className="font-semibold">{segment.short}</div>
                <div>{segment.label}</div>
                <div className="mt-1 text-[10px]">
                  {formatFloat(segment.min)} - {formatFloat(segment.max)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
