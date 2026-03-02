"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getSkinDetailPath, getSkinImageUrl } from "@/app/lib/skin-images";
import type { Rarity } from "@/app/lib/rarity";

type SkinResult = {
  name: string;
  weapon: string;
  skin: string;
  wear?: string | null;
  rarity: string;
  minFloat: number | null;
  maxFloat: number | null;
  price: number | null;
};

type InputItem = {
  name: string;
  weapon: string;
  skin: string;
  rarity: string;
  price: number | null;
  float: number;
  minFloat: number;
  maxFloat: number;
};

type SimOutput = {
  marketHashName: string;
  probability: number;
  float: number;
  wear: string;
  price: number | null;
  collection: string;
};

type SimResult = {
  rarity: string;
  nextRarity: string;
  avgFloat: number;
  outputs: SimOutput[];
  expectedValue: number;
};

type SortMode = "cheapest" | "most-expensive";
type RarityFilter = Rarity | "all";

const rarityOptions: Array<{ value: RarityFilter; label: string }> = [
  { value: "all", label: "Vsechny kvality" },
  { value: "Consumer", label: "Consumer" },
  { value: "Industrial", label: "Industrial" },
  { value: "Mil-Spec", label: "Mil-Spec" },
  { value: "Restricted", label: "Restricted" },
  { value: "Classified", label: "Classified" },
  { value: "Covert", label: "Covert" },
];

const rarityBadgeColor: Record<Rarity, string> = {
  Consumer: "bg-gray-600",
  Industrial: "bg-sky-500",
  "Mil-Spec": "bg-blue-600",
  Restricted: "bg-violet-600",
  Classified: "bg-fuchsia-600",
  Covert: "bg-rose-600",
};

const floatEdges = [0, 0.03, 0.07, 0.15, 0.38, 0.45, 1];

const sortOptions: Array<{ value: SortMode; label: string }> = [
  { value: "cheapest", label: "Nejnizsi cena" },
  { value: "most-expensive", label: "Nejvyssi cena" },
];

const currency = new Intl.NumberFormat("cs-CZ", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});

const formatCurrency = (value: number | null | undefined) =>
  typeof value === "number" ? currency.format(value) : "-";

const formatFloat = (value: number | null | undefined, digits = 4) =>
  typeof value === "number" ? value.toFixed(digits) : "-";

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const useDebounce = <T,>(value: T, delay = 350) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
};

const splitMarketName = (name: string) => {
  const [weaponRaw, restRaw] = name.split("|").map((part) => part?.trim() ?? "");
  const rest = restRaw || weaponRaw || name;
  const wearMatch = rest.match(/\(([^)]+)\)\s*$/);
  const wear = wearMatch ? wearMatch[1].trim() : null;
  const skin = wear ? rest.replace(/\([^)]+\)\s*$/, "").trim() : rest.trim();
  return { weapon: weaponRaw || "Item", skin: skin || rest || name, wear };
};

export default function TradeupPage() {
  const [query, setQuery] = useState("");
  const [rarity, setRarity] = useState<RarityFilter>("all");
  const [collection, setCollection] = useState("all");
  const [sortMode, setSortMode] = useState<SortMode>("cheapest");
  const [floatCapStart, setFloatCapStart] = useState(0);
  const [floatCapEnd, setFloatCapEnd] = useState(1);
  const [stattrakOnly, setStattrakOnly] = useState(false);
  const [myInventoryOnly, setMyInventoryOnly] = useState(false);

  const [steamId, setSteamId] = useState<string | null>(null);
  const [inventoryNames, setInventoryNames] = useState<Set<string> | null>(null);
  const [inventoryLoading, setInventoryLoading] = useState(false);

  const [results, setResults] = useState<SkinResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [inputs, setInputs] = useState<InputItem[]>([]);
  const [simResult, setSimResult] = useState<SimResult | null>(null);
  const [simError, setSimError] = useState<string | null>(null);
  const [simLoading, setSimLoading] = useState(false);

  const debouncedQuery = useDebounce(query, 350);

  useEffect(() => {
    const id = localStorage.getItem("steamId");
    setSteamId(id);
  }, []);

  useEffect(() => {
    if (!myInventoryOnly || !steamId || inventoryLoading || inventoryNames) return;
    const controller = new AbortController();
    setInventoryLoading(true);

    fetch(`/api/steam/inventory/${steamId}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("Inventory fetch failed");
        return res.json();
      })
      .then((body) => {
        const names = Array.isArray(body?.items)
          ? body.items
              .map((item: { marketHashName?: string }) =>
                `${item.marketHashName ?? ""}`.trim().toLowerCase()
              )
              .filter((name: string) => name.length > 0)
          : [];
        setInventoryNames(new Set(names));
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setInventoryNames(new Set());
      })
      .finally(() => setInventoryLoading(false));

    return () => controller.abort();
  }, [myInventoryOnly, steamId, inventoryLoading, inventoryNames]);

  const hasActiveFilters =
    rarity !== "all" ||
    collection !== "all" ||
    stattrakOnly ||
    myInventoryOnly ||
    floatCapStart > 0 ||
    floatCapEnd < 1;
  const showPlaceholder = debouncedQuery.trim().length < 2 && !hasActiveFilters;

  useEffect(() => {
    if (showPlaceholder) {
      setResults([]);
      setError(null);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    const load = async () => {
      const queryLen = debouncedQuery.trim().length;
      const needSearch = queryLen >= 2 || rarity !== "all";

      if (needSearch) {
        const params = new URLSearchParams({
          q: debouncedQuery.trim(),
          sort: sortMode,
          limit: "2000",
        });
        if (rarity !== "all") params.set("rarity", rarity);
        const res = await fetch(`/api/skins/search?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("Search failed");
        const body = await res.json();
        setResults(Array.isArray(body?.items) ? body.items : []);
        return;
      }

      const res = await fetch("/api/skins?limit=2000", {
        signal: controller.signal,
      });
      if (!res.ok) throw new Error("Listing failed");
      const body = await res.json();
      setResults(Array.isArray(body?.items) ? body.items : []);
    };

    load()
      .catch((err) => {
        if (err.name === "AbortError") return;
        setError("Nepodarilo se nacist skiny.");
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [showPlaceholder, debouncedQuery, rarity, sortMode]);

  const collectionOptions = useMemo(() => {
    const values = Array.from(
      new Set(results.map((item) => item.weapon).filter((weapon) => weapon.length > 0))
    ).sort((a, b) => a.localeCompare(b));
    return ["all", ...values];
  }, [results]);

  const filteredResults = useMemo(() => {
    let list = [...results];

    if (collection !== "all") list = list.filter((item) => item.weapon === collection);
    if (stattrakOnly) list = list.filter((item) => item.name.toLowerCase().includes("stattrak"));

    list = list.filter((item) => {
      const min = item.minFloat ?? 0;
      const max = item.maxFloat ?? 1;
      return max >= floatCapStart && min <= floatCapEnd;
    });

    if (myInventoryOnly) {
      if (!steamId || !inventoryNames) return [];
      list = list.filter((item) => inventoryNames.has(item.name.toLowerCase()));
    }

    return list;
  }, [
    results,
    collection,
    stattrakOnly,
    floatCapStart,
    floatCapEnd,
    myInventoryOnly,
    steamId,
    inventoryNames,
  ]);

  const sortedResults = useMemo(() => {
    const list = [...filteredResults];
    list.sort((a, b) => {
      const ap =
        a.price ??
        (sortMode === "cheapest" ? Number.MAX_SAFE_INTEGER : Number.MIN_SAFE_INTEGER);
      const bp =
        b.price ??
        (sortMode === "cheapest" ? Number.MAX_SAFE_INTEGER : Number.MIN_SAFE_INTEGER);
      return sortMode === "cheapest" ? ap - bp : bp - ap;
    });
    return list;
  }, [filteredResults, sortMode]);

  const addInput = (item: SkinResult) => {
    if (inputs.length >= 10) return;
    if (inputs.length && inputs[0].rarity !== item.rarity) {
      setSimError("Contract musi obsahovat 10 skinu stejne rarity.");
      return;
    }

    const minFloat = item.minFloat ?? 0;
    const maxFloat = item.maxFloat ?? 1;
    const float = clamp((floatCapStart + floatCapEnd) / 2, minFloat, maxFloat);

    setInputs((prev) => [
      ...prev,
      {
        name: item.name,
        weapon: item.weapon,
        skin: item.skin,
        rarity: item.rarity,
        price: item.price ?? null,
        float,
        minFloat,
        maxFloat,
      },
    ]);
    setSimError(null);
  };

  const removeInput = (index: number) => {
    setInputs((prev) => prev.filter((_, idx) => idx !== index));
  };

  const clearContract = () => {
    setInputs([]);
    setSimResult(null);
    setSimError(null);
  };

  const autoFill = () => {
    if (inputs.length >= 10) return;
    const targetRarity = inputs[0]?.rarity ?? sortedResults[0]?.rarity ?? null;
    if (!targetRarity) return;

    const available = sortedResults.filter((item) => item.rarity === targetRarity);
    const needed = 10 - inputs.length;
    const chunk = available.slice(0, needed);
    if (!chunk.length) return;

    setInputs((prev) => [
      ...prev,
      ...chunk.map((item) => {
        const minFloat = item.minFloat ?? 0;
        const maxFloat = item.maxFloat ?? 1;
        return {
          name: item.name,
          weapon: item.weapon,
          skin: item.skin,
          rarity: item.rarity,
          price: item.price ?? null,
          float: clamp((floatCapStart + floatCapEnd) / 2, minFloat, maxFloat),
          minFloat,
          maxFloat,
        } satisfies InputItem;
      }),
    ].slice(0, 10));
    setSimError(null);
  };

  const updateFloat = (index: number, value: number) => {
    setInputs((prev) =>
      prev.map((item, idx) =>
        idx === index
          ? { ...item, float: clamp(value, item.minFloat, item.maxFloat) }
          : item
      )
    );
  };

  const totalCost = useMemo(
    () => inputs.reduce((sum, item) => sum + (item.price ?? 0), 0),
    [inputs]
  );
  const avgFloat = useMemo(() => {
    if (!inputs.length) return 0;
    return inputs.reduce((sum, item) => sum + item.float, 0) / inputs.length;
  }, [inputs]);
  const rarityMismatch = useMemo(() => {
    if (inputs.length < 2) return false;
    const first = inputs[0]?.rarity;
    return inputs.some((item) => item.rarity !== first);
  }, [inputs]);

  const simulateItems = useMemo(
    () => inputs.map((item) => ({ name: item.name, float: item.float })),
    [inputs]
  );

  useEffect(() => {
    if (inputs.length !== 10 || rarityMismatch) {
      setSimResult(null);
      if (inputs.length && rarityMismatch) {
        setSimError("Vsechny skiny v contractu musi mit stejnou raritu.");
      } else {
        setSimError(null);
      }
      setSimLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      setSimLoading(true);
      setSimError(null);
      try {
        const res = await fetch("/api/tradeup/simulate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: simulateItems }),
          signal: controller.signal,
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body?.error ?? "Tradeup simulation failed");
        setSimResult(body as SimResult);
      } catch (err) {
        if ((err as { name?: string })?.name === "AbortError") return;
        setSimResult(null);
        setSimError(err instanceof Error ? err.message : "Tradeup simulation failed");
      } finally {
        setSimLoading(false);
      }
    }, 280);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [inputs.length, rarityMismatch, simulateItems]);

  const metrics = useMemo(() => {
    if (!simResult || totalCost <= 0) {
      return { profitChance: null as number | null, profitability: null as number | null, avgProfit: null as number | null };
    }
    const profitChance = simResult.outputs.reduce((sum, out) => {
      if (out.price === null || out.price <= totalCost) return sum;
      return sum + out.probability;
    }, 0);
    const profitability = (simResult.expectedValue / totalCost) * 100;
    const avgProfit = simResult.expectedValue - totalCost;
    return { profitChance, profitability, avgProfit };
  }, [simResult, totalCost]);

  const outcomes = useMemo(() => {
    if (!simResult) return [];
    const withProfit = simResult.outputs.map((out) => ({
      ...out,
      profit: out.price !== null ? out.price - totalCost : null,
    }));
    const bestKey = withProfit.reduce<string | null>((best, out) => {
      if (out.profit === null) return best;
      if (!best) return `${out.marketHashName}-${out.collection}`;
      const current = withProfit.find((entry) => `${entry.marketHashName}-${entry.collection}` === best);
      if (!current || current.profit === null || out.profit > current.profit) {
        return `${out.marketHashName}-${out.collection}`;
      }
      return best;
    }, null);

    return withProfit.map((out) => ({
      ...out,
      isBest: bestKey === `${out.marketHashName}-${out.collection}`,
    }));
  }, [simResult, totalCost]);

  return (
    <section className="container-max py-8 space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="kicker">Trade-up</div>
          <h1 className="display text-3xl">Trade-up Simulator</h1>
          <p className="text-[color:var(--muted)]">
            Skins se nactou az po zadani hledani nebo filtru. Outcome se pocita automaticky.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-[color:var(--muted)]">
          <span className="badge">Contract {inputs.length}/10</span>
          {simLoading && <span className="badge">Pocitam...</span>}
        </div>
      </header>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <div className="card p-5 space-y-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Hledej skin..."
                className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-2 text-sm outline-none"
              />

              <select
                value={rarity}
                onChange={(e) => setRarity(e.target.value as RarityFilter)}
                className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-2 text-sm outline-none"
              >
                {rarityOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <select
                value={collection}
                onChange={(e) => setCollection(e.target.value)}
                className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-2 text-sm outline-none"
              >
                <option value="all">Vsechny kolekce</option>
                {collectionOptions
                  .filter((option) => option !== "all")
                  .map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
              </select>

              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as SortMode)}
                className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-2 text-sm outline-none"
              >
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <select
                value={String(floatCapStart)}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  setFloatCapStart(value);
                  if (value > floatCapEnd) setFloatCapEnd(value);
                }}
                className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-2 text-sm outline-none"
              >
                {floatEdges.map((value) => (
                  <option key={`from-${value}`} value={value}>
                    Float od {formatFloat(value, 2)}
                  </option>
                ))}
              </select>

              <select
                value={String(floatCapEnd)}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  setFloatCapEnd(value);
                  if (value < floatCapStart) setFloatCapStart(value);
                }}
                className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-2 text-sm outline-none"
              >
                {floatEdges.map((value) => (
                  <option key={`to-${value}`} value={value}>
                    Float do {formatFloat(value, 2)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-sm text-[color:var(--muted)]">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={stattrakOnly}
                  onChange={(e) => setStattrakOnly(e.target.checked)}
                  className="h-4 w-4"
                  style={{ accentColor: "var(--accent-2)" }}
                />
                StatTrak
              </label>

              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={myInventoryOnly}
                  onChange={(e) => setMyInventoryOnly(e.target.checked)}
                  className="h-4 w-4"
                  style={{ accentColor: "var(--accent-2)" }}
                />
                Jen muj inventar
              </label>

              {myInventoryOnly && !steamId && (
                <a href="/api/steam/login" className="link text-xs">
                  Prihlasit Steam
                </a>
              )}
              {myInventoryOnly && steamId && inventoryLoading && (
                <span className="text-xs">Nacitam inventar...</span>
              )}

              <button onClick={autoFill} className="btn-ghost text-xs px-3 py-1.5">
                Auto-fill do 10
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-sm text-[color:var(--muted)]">
            <span>
              {showPlaceholder
                ? "Zadej aspon 2 znaky nebo aktivuj filtr"
                : loading
                  ? "Nacitam skiny..."
                  : `Nalezeno ${sortedResults.length} skinu`}
            </span>
          </div>

          {error && (
            <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {error}
            </div>
          )}

          {showPlaceholder && (
            <div className="rounded-xl border border-dashed border-[color:var(--border)] bg-[color:var(--card)] px-6 py-10 text-center text-[color:var(--muted)]">
              Skins se zobrazi az po zadani filtru.
            </div>
          )}

          {!showPlaceholder && !loading && !sortedResults.length && !error && (
            <div className="rounded-xl border border-dashed border-[color:var(--border)] bg-[color:var(--card)] px-6 py-10 text-center text-[color:var(--muted)]">
              Nic jsme nenasli. Zkus jinou kombinaci filtru.
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sortedResults.map((item) => {
              const parsed = splitMarketName(item.name);
              const rarityKey =
                (item.rarity as Rarity) in rarityBadgeColor
                  ? (item.rarity as Rarity)
                  : "Consumer";

              return (
                <article key={item.name} className="card overflow-hidden p-3 transition hover:-translate-y-0.5">
                  <div className="mb-2 flex items-center justify-between text-xs text-[color:var(--muted)]">
                    <span>{formatCurrency(item.price)}</span>
                    <span className={`rounded-full px-2 py-1 text-white ${rarityBadgeColor[rarityKey]}`}>
                      {item.rarity}
                    </span>
                  </div>

                  <div className="mb-3 h-28 rounded-xl border border-[color:var(--border)] bg-[color:var(--card-solid)] p-2 flex items-center justify-center">
                    <img
                      src={getSkinImageUrl(item.name)}
                      alt={item.name}
                      loading="lazy"
                      className="max-h-24 w-full object-contain"
                    />
                  </div>

                  <div className="line-clamp-1 text-base font-semibold">{parsed.weapon}</div>
                  <div className="line-clamp-1 text-sm text-[color:var(--muted)]">{parsed.skin}</div>

                  <div className="mt-2 text-[11px] text-[color:var(--muted)]">
                    Float: {formatFloat(item.minFloat, 3)} - {formatFloat(item.maxFloat, 3)}
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <button
                      onClick={() => addInput(item)}
                      disabled={inputs.length >= 10}
                      className="btn-primary flex-1 text-xs py-2"
                    >
                      Pridej
                    </button>
                    <Link
                      href={getSkinDetailPath(item.name)}
                      prefetch={false}
                      className="btn-ghost text-xs px-3 py-2"
                    >
                      Detail
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="kicker">Contract</div>
                <h2 className="display text-2xl">Tradeup</h2>
              </div>
              <button onClick={clearContract} className="btn-ghost text-xs px-3 py-1.5">
                Vycistit
              </button>
            </div>

            {rarityMismatch && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                Vsech 10 skinu musi mit stejnou raritu.
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 10 }, (_, index) => {
                const item = inputs[index] ?? null;
                if (!item) {
                  return (
                    <div
                      key={`slot-${index}`}
                      className="rounded-xl border border-dashed border-[color:var(--border)] bg-[color:var(--card)] px-3 py-6 text-center text-xs text-[color:var(--muted)]"
                    >
                      Slot {index + 1}
                    </div>
                  );
                }

                return (
                  <article key={`${item.name}-${index}`} className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold">{formatCurrency(item.price)}</span>
                      <button onClick={() => removeInput(index)} className="text-rose-300 hover:text-rose-200">
                        Odebrat
                      </button>
                    </div>

                    <div className="h-20 rounded-lg border border-[color:var(--border)] bg-[color:var(--card-solid)] p-2 flex items-center justify-center">
                      <img
                        src={getSkinImageUrl(item.name)}
                        alt={item.name}
                        loading="lazy"
                        className="max-h-16 w-full object-contain"
                      />
                    </div>

                    <div className="line-clamp-1 text-sm font-semibold">{item.weapon}</div>
                    <div className="line-clamp-1 text-xs text-[color:var(--muted)]">{item.skin}</div>

                    <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--card-solid)] p-2">
                      <div className="text-[11px] text-[color:var(--muted)]">Float</div>
                      <div className="text-sm font-semibold">{formatFloat(item.float, 4)}</div>
                      <input
                        type="range"
                        min={item.minFloat}
                        max={item.maxFloat}
                        step={0.0001}
                        value={item.float}
                        onChange={(e) => updateFloat(index, Number(e.target.value))}
                        className="mt-1 w-full"
                      />
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
              <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-2">
                <div className="text-[11px] text-[color:var(--muted)]">Average float</div>
                <div className="text-sm font-semibold">{formatFloat(avgFloat, 5)}</div>
              </div>
              <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-2">
                <div className="text-[11px] text-[color:var(--muted)]">Cost</div>
                <div className="text-sm font-semibold">{formatCurrency(totalCost)}</div>
              </div>
              <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-2">
                <div className="text-[11px] text-[color:var(--muted)]">Profit chance</div>
                <div className="text-sm font-semibold">
                  {metrics.profitChance === null ? "-" : `${(metrics.profitChance * 100).toFixed(2)}%`}
                </div>
              </div>
              <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-2">
                <div className="text-[11px] text-[color:var(--muted)]">Profitability</div>
                <div className="text-sm font-semibold">
                  {metrics.profitability === null ? "-" : `${metrics.profitability.toFixed(2)}%`}
                </div>
              </div>
              <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-2">
                <div className="text-[11px] text-[color:var(--muted)]">Average P</div>
                <div
                  className={`text-sm font-semibold ${
                    metrics.avgProfit === null
                      ? "text-[color:var(--muted)]"
                      : metrics.avgProfit >= 0
                        ? "text-emerald-400"
                        : "text-rose-400"
                  }`}
                >
                  {metrics.avgProfit === null ? "-" : formatCurrency(metrics.avgProfit)}
                </div>
              </div>
            </div>

            {simError && (
              <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                {simError}
              </div>
            )}
          </div>

          <div className="card p-5 space-y-4">
            <div className="flex items-end justify-between">
              <div>
                <div className="kicker">Outcomes</div>
                <h3 className="display text-2xl">Vysledky tradeupu</h3>
              </div>
              {simResult && (
                <div className="text-xs text-[color:var(--muted)]">
                  {simResult.rarity} {"->"} {simResult.nextRarity}
                </div>
              )}
            </div>

            {!simResult && (
              <div className="rounded-xl border border-dashed border-[color:var(--border)] bg-[color:var(--card)] px-4 py-8 text-center text-sm text-[color:var(--muted)]">
                Outcome se prepocita automaticky jakmile mas 10 skinu stejne rarity.
              </div>
            )}

            {!!simResult && (
              <div className="grid gap-3 md:grid-cols-2">
                {outcomes.map((out) => {
                  const parsed = splitMarketName(out.marketHashName);
                  return (
                    <article
                      key={`${out.marketHashName}-${out.collection}`}
                      className={`rounded-xl border p-3 ${
                        out.isBest
                          ? "border-emerald-400/45 bg-emerald-500/10"
                          : out.profit !== null && out.profit >= 0
                            ? "border-emerald-500/25 bg-emerald-500/5"
                            : "border-rose-500/25 bg-rose-500/5"
                      }`}
                    >
                      <div className="mb-2 flex items-center justify-between text-xs">
                        <span className="badge">{(out.probability * 100).toFixed(2)}%</span>
                        <span
                          className={`font-semibold ${
                            out.profit === null
                              ? "text-[color:var(--muted)]"
                              : out.profit >= 0
                                ? "text-emerald-400"
                                : "text-rose-400"
                          }`}
                        >
                          {out.profit === null
                            ? "-"
                            : `${out.profit >= 0 ? "+" : ""}${formatCurrency(out.profit)}`}
                        </span>
                      </div>

                      <div className="mb-2 h-20 rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] p-2 flex items-center justify-center">
                        <img
                          src={getSkinImageUrl(out.marketHashName)}
                          alt={out.marketHashName}
                          loading="lazy"
                          className="max-h-16 w-full object-contain"
                        />
                      </div>

                      <div className="line-clamp-1 text-sm font-semibold">{parsed.weapon}</div>
                      <div className="line-clamp-1 text-xs text-[color:var(--muted)]">{parsed.skin}</div>

                      <div className="mt-2 text-xs text-[color:var(--muted)]">
                        {out.wear} ({formatFloat(out.float, 7)})
                      </div>
                      <div className="text-xs text-[color:var(--muted)]">{out.collection}</div>

                      <div className="mt-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-2 text-sm font-semibold">
                        {formatCurrency(out.price)}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {simResult && (
              <div className="text-sm text-[color:var(--muted)]">
                Expected value:{" "}
                <span className="font-semibold text-[color:var(--fg)]">
                  {formatCurrency(simResult.expectedValue)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
