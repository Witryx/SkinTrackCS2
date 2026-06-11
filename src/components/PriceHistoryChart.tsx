"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type PriceHistoryPoint = {
  date: string;
  price: number;
};

type Props = {
  points: PriceHistoryPoint[];
  currency?: string;
  marketHashName?: string;
};

const periods = [
  { id: "24h", label: "24h", amount: 24, unit: "hour" },
  { id: "7d", label: "7 dní", amount: 7, unit: "day" },
  { id: "30d", label: "30 dní", amount: 30, unit: "day" },
  { id: "90d", label: "90 dní", amount: 90, unit: "day" },
] as const;

const toDate = (value: string) =>
  new Date(value.length > 10 ? value : `${value}T00:00:00Z`);

export default function PriceHistoryChart({
  points,
  currency = "EUR",
  marketHashName,
}: Props) {
  const [history, setHistory] = useState({
    points,
    currency,
  });
  const [loadingHistory, setLoadingHistory] = useState(Boolean(marketHashName));
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [period, setPeriod] = useState<(typeof periods)[number]>(() => periods[2]);

  useEffect(() => {
    setHistory({ points, currency });
  }, [points, currency, marketHashName]);

  useEffect(() => {
    if (!marketHashName) {
      setLoadingHistory(false);
      return;
    }

    let controller: AbortController | null = null;

    const loadHistory = () => {
      controller?.abort();
      const currentController = new AbortController();
      controller = currentController;
      setLoadingHistory(true);
      setHistoryError(null);

      fetch(
        `/api/skins/price-history?${new URLSearchParams({
          name: marketHashName,
          days: "90",
        }).toString()}`,
        {
          cache: "no-store",
          signal: currentController.signal,
        }
      )
        .then(async (response) => {
          if (!response.ok) throw new Error("Price history failed");
          return response.json();
        })
        .then((body) => {
          const nextPoints = Array.isArray(body?.points) ? body.points : [];
          setHistory({
            points: nextPoints,
            currency: typeof body?.currency === "string" ? body.currency : "EUR",
          });
        })
        .catch((error) => {
          if (error.name === "AbortError") return;
          console.error("Price history fetch failed", error);
          setHistoryError("Graf se nepodařilo načíst.");
        })
        .finally(() => {
          if (!currentController.signal.aborted) {
            setLoadingHistory(false);
          }
        });
    };

    const handleHistoryUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ marketHashName?: string }>).detail;
      if (detail?.marketHashName === marketHashName) {
        loadHistory();
      }
    };

    loadHistory();
    window.addEventListener(
      "skintrack:price-history-updated",
      handleHistoryUpdated
    );

    return () => {
      controller?.abort();
      window.removeEventListener(
        "skintrack:price-history-updated",
        handleHistoryUpdated
      );
    };
  }, [marketHashName]);

  const windowMs =
    period.unit === "hour"
      ? period.amount * 60 * 60 * 1000
      : period.amount * 24 * 60 * 60 * 1000;

  const sorted = useMemo(
    () => [...history.points].sort((a, b) => a.date.localeCompare(b.date)),
    [history.points]
  );

  const windowStart = useMemo(() => {
    if (!sorted.length) return null;
    const anchor = toDate(sorted[sorted.length - 1].date);
    return new Date(anchor.getTime() - windowMs);
  }, [sorted, windowMs]);

  const filtered = useMemo(() => {
    if (!sorted.length || !windowStart) return [];
    return sorted.filter((point) => toDate(point.date) >= windowStart);
  }, [sorted, windowStart]);

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat("cs-CZ", {
        style: "currency",
        currency: history.currency,
        maximumFractionDigits: 2,
      }),
    [history.currency]
  );

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("cs-CZ", {
        day: "2-digit",
        month: "short",
      }),
    []
  );
  const timeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("cs-CZ", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    []
  );
  const dateTimeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("cs-CZ", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }),
    []
  );

  const stats = useMemo(() => {
    if (!filtered.length) {
      return {
        min: null,
        max: null,
        first: null,
        last: null,
      };
    }
    const prices = filtered.map((p) => p.price);
    return {
      min: Math.min(...prices),
      max: Math.max(...prices),
      first: filtered[0]?.price ?? null,
      last: filtered.at(-1)?.price ?? null,
    };
  }, [filtered]);

  const change =
    stats.first !== null && stats.last !== null
      ? stats.last - stats.first
      : null;
  const changePct =
    change !== null && stats.first
      ? (change / stats.first) * 100
      : null;

  const hasData = filtered.length > 0;
  const isSinglePoint = filtered.length === 1;
  const hasChartData = filtered.length > 1;
  const lastPointDate = hasData ? filtered.at(-1)?.date ?? null : null;
  const singlePoint = isSinglePoint ? filtered[0] : null;
  const spanMs =
    filtered.length > 1
      ? toDate(filtered[filtered.length - 1].date).getTime() -
        toDate(filtered[0].date).getTime()
      : 0;
  const showTimeTicks = period.unit === "hour" || spanMs <= 1000 * 60 * 60 * 36;

  const yDomain = useMemo<[number | string, number | string]>(() => {
    if (stats.min === null || stats.max === null) {
      return ["dataMin", "dataMax"];
    }
    if (stats.min === stats.max) {
      const padding = Math.max(0.01, Math.abs(stats.min) * 0.05);
      const lower = Math.max(0, stats.min - padding);
      return [lower, stats.max + padding];
    }
    const padding = Math.abs(stats.max - stats.min) * 0.1;
    const lower = Math.max(0, stats.min - padding);
    return [lower, stats.max + padding];
  }, [stats.min, stats.max]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="kicker">Graf nejlevnější ceny</div>
          <h3 className="text-xl font-semibold">Lowest live market price</h3>
          {lastPointDate && (
            <div className="text-xs text-[color:var(--muted)]">
              Poslední snapshot {dateTimeFormatter.format(toDate(lastPointDate))} /{" "}
              {filtered.length} bodů
            </div>
          )}
        </div>
        <div className="inline-flex items-center gap-1 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-1 shadow-sm">
          {periods.map((opt) => {
            const active = opt.id === period.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setPeriod(opt)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  active
                    ? "bg-[color:var(--fg)] text-[color:var(--bg)]"
                    : "text-[color:var(--muted)] hover:text-[color:var(--fg)]"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {!hasData && (
        <div className="rounded-xl border border-dashed border-[color:var(--border)] bg-[color:var(--card)] px-4 py-6 text-sm text-[color:var(--muted)]">
          {loadingHistory
            ? "Načítám historii ceny..."
            : historyError ??
              "Zatím nejsou žádná historická data nejlevnější live ceny. Graf se začne plnit po dalších live updatech marketu."}
        </div>
      )}

      {isSinglePoint && singlePoint && (
        <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-5">
          <div className="text-xs font-semibold uppercase text-[color:var(--muted)]">
            První uložený snapshot
          </div>
          <div className="mt-2 text-3xl font-black">
            {currencyFormatter.format(singlePoint.price)}
          </div>
          <div className="mt-1 text-sm text-[color:var(--muted)]">
            {dateTimeFormatter.format(toDate(singlePoint.date))}
          </div>
          <div className="mt-4 text-xs leading-5 text-[color:var(--muted)]">
            Graf se začne kreslit po dalším uloženém snapshotu. Historie se doplňuje
            přes cron a při načtení live nabídek.
          </div>
        </div>
      )}

      {hasChartData && (
        <div className="h-64 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-3">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={filtered} margin={{ top: 10, right: 18, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--accent-2)" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                tickFormatter={(value) =>
                  showTimeTicks
                    ? timeFormatter.format(toDate(value))
                    : dateFormatter.format(toDate(value))
                }
                interval="preserveStartEnd"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--muted)", fontSize: 12 }}
              />
              <YAxis
                tickFormatter={(value) => currencyFormatter.format(value)}
                domain={yDomain}
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--muted)", fontSize: 12 }}
                width={70}
              />
              <Tooltip
                cursor={{ stroke: "var(--accent)", strokeOpacity: 0.2 }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const price = payload[0]?.value;
                  return (
                    <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--card-solid)] px-3 py-2 text-xs shadow-md">
                      <div className="text-[color:var(--muted)]">
                        {dateFormatter.format(toDate(String(label)))}{" "}
                        {timeFormatter.format(toDate(String(label)))}
                      </div>
                      <div className="text-sm font-semibold">
                        {typeof price === "number"
                          ? currencyFormatter.format(price)
                          : "-"}
                      </div>
                    </div>
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey="price"
                stroke="var(--accent)"
                strokeWidth={2}
                fill="url(#priceGradient)"
                dot={{
                  r: 3,
                  stroke: "var(--accent)",
                  strokeWidth: 2,
                  fill: "var(--card-solid)",
                }}
                activeDot={{ r: 4 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className="grid gap-3 md:grid-cols-3">
        <div className="stat-tile text-sm">
          <div className="text-[color:var(--muted)]">Minimum</div>
          <div className="text-lg font-semibold">
            {stats.min !== null ? currencyFormatter.format(stats.min) : "-"}
          </div>
        </div>
        <div className="stat-tile text-sm">
          <div className="text-[color:var(--muted)]">Maximum</div>
          <div className="text-lg font-semibold">
            {stats.max !== null ? currencyFormatter.format(stats.max) : "-"}
          </div>
        </div>
        <div className="stat-tile text-sm">
          <div className="text-[color:var(--muted)]">Změna</div>
          <div
            className={`text-lg font-semibold ${
              change === null
                ? "text-[color:var(--muted)]"
                : change >= 0
                  ? "text-emerald-500"
                  : "text-rose-500"
            }`}
          >
            {change !== null ? currencyFormatter.format(change) : "-"}
          </div>
          <div className="text-xs text-[color:var(--muted)]">
            {changePct !== null ? `${changePct.toFixed(2)}%` : ""}
          </div>
        </div>
      </div>
    </div>
  );
}
