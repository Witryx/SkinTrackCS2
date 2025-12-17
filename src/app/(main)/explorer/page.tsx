"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSkinDetailPath, getSkinImageUrl } from "@/app/lib/skin-images";
import { Rarity, rarityBgClass, rarityOptions, rarityTextClass } from "@/app/lib/rarity";

type SkinResult = {
  name: string;
  weapon: string;
  skin: string;
  wear?: string | null;
  rarity: string;
  minFloat: number | null;
  maxFloat: number | null;
  price: number | null;
  medianPrice: number | null;
  suggestedPrice: number | null;
  volume7d: number | null;
  median7d: number | null;
  quantity: number | null;
  itemPage?: string | null;
  marketPage?: string | null;
};

const currency = new Intl.NumberFormat("cs-CZ", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});

const formatNumber = (value: number | null | undefined) =>
  typeof value === "number" ? value.toLocaleString("cs-CZ") : "-";

const formatFloat = (value: number | null | undefined) =>
  typeof value === "number" ? value.toFixed(4) : "-";

const formatCurrency = (value: number | null | undefined) =>
  typeof value === "number" ? currency.format(value) : "-";

const sortOptions = [
  { value: "cheapest", label: "Nejnizsi cena" },
  { value: "most-expensive", label: "Nejvyssi cena" },
] as const;

const useDebounce = <T,>(value: T, delay = 350) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
};

export default function ExplorerPage() {
  const [q, setQ] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [rarity, setRarity] = useState<"all" | Rarity>("all");
  const [tradableOnly, setTradableOnly] = useState(false);
  const [sort, setSort] = useState<"cheapest" | "most-expensive">("cheapest");
  const [rarityOpen, setRarityOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [items, setItems] = useState<SkinResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const rarityRef = useRef<HTMLDivElement | null>(null);
  const sortRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (rarityRef.current && !rarityRef.current.contains(target)) setRarityOpen(false);
      if (sortRef.current && !sortRef.current.contains(target)) setSortOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const navigateToDetail =
    (href: string) => (event: React.MouseEvent<HTMLElement>) => {
      const target = event.target as HTMLElement;
      if (target.closest("a")) return;
      router.push(href);
    };

  const navigateToDetailOnKey =
    (href: string) => (event: React.KeyboardEvent<HTMLElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        router.push(href);
      }
    };

  const debouncedQuery = useDebounce(q, 400);
  const hasActiveFilters = rarity !== "all" || !!minPrice || !!maxPrice;
  const showPlaceholder = debouncedQuery.trim().length < 2 && !hasActiveFilters;

  useEffect(() => {
    if (showPlaceholder) {
      setItems([]);
      setError(null);
      return;
    }

    const params = new URLSearchParams({
      q: debouncedQuery.trim(),
      sort,
    });

    if (minPrice) params.set("minPrice", minPrice);
    if (maxPrice) params.set("maxPrice", maxPrice);
    if (rarity !== "all") params.set("rarity", rarity);
    if (tradableOnly) params.set("tradable", "1");

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetch(`/api/skins/search?${params.toString()}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error("Fetch failed");
        }
        const body = await res.json();
        setItems(body.items ?? []);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setError("Nepodarilo se nacist data z databaze skinu.");
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [debouncedQuery, minPrice, maxPrice, sort, tradableOnly, rarity, showPlaceholder]);

  const badgeText = useMemo(() => {
    if (showPlaceholder) return "Zadej alespon 2 znaky pro hledani nebo pouzij filtr";
    if (loading) return "Nacitani dat z databaze...";
    if (error) return "Chyba pri nacitani";
    return `Nalezeno ${items.length} polozek`;
  }, [showPlaceholder, loading, error, items.length]);

  return (
    <section className="container-max py-6 space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Skin Explorer</h1>
          <p className="text-white/60">
            Vyhledavame az kdyz zacnes psat.
          </p>
        </div>

        <div className="w-full sm:w-96">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Hledej skin / zbran / nazev edice"
            className="w-full rounded-xl border border-white/10 bg-transparent px-3 py-2 outline-none"
          />
        </div>
      </header>

      <div className="card p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3 text-sm text-white/70">
          <span className="uppercase tracking-wide text-xs text-white/50">Filtry</span>
          <div ref={sortRef} className="relative inline-flex items-center">
            <button
              type="button"
              onClick={() => setSortOpen((v) => !v)}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-semibold text-white"
            >
              <span className="text-white/60 text-xs">Řadit</span>
              <span>
                {sort === "cheapest"
                  ? "Nejnizsi cena"
                  : sortOptions.find((s) => s.value === sort)?.label ?? "Nejvyssi cena"}
              </span>
              <span className="text-white/60 text-xs">▼</span>
            </button>
            {sortOpen && (
              <div className="absolute left-0 top-full z-20 mt-2 w-44 overflow-hidden rounded-lg border border-white/10 bg-slate-900/95 shadow-2xl backdrop-blur">
                {sortOptions.map((opt) => {
                  const active = opt.value === sort;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setSort(opt.value);
                        setSortOpen(false);
                      }}
                      className={`w-full px-3 py-2 text-left text-sm transition ${
                        active ? "bg-white/10 text-white" : "text-white/80 hover:bg-white/5"
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-[1.2fr_1fr]">
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-white/60">Cena od (EUR)</label>
              <input
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                placeholder="0"
                className="rounded-lg border border-white/10 bg-transparent px-3 py-2 outline-none"
                type="number"
                min="0"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-white/60">Cena do (EUR)</label>
              <input
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                placeholder="500"
                className="rounded-lg border border-white/10 bg-transparent px-3 py-2 outline-none"
                type="number"
                min="0"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label className="text-xs text-white/60">Rarity</label>
              {rarity !== "all" && (
                <span
                  className={`flex items-center gap-1 text-[11px] font-semibold ${
                    rarityTextClass[rarity as Rarity] ?? "text-white/70"
                  }`}
                >
                  <span className="h-2 w-2 rounded-full bg-current" />
                  {rarity}
                </span>
              )}
            </div>
            <div ref={rarityRef} className="relative">
              <button
                type="button"
                onClick={() => setRarityOpen((v) => !v)}
                className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition ${
                  rarity !== "all" ? "border-sky-400/70 bg-white/5" : "border-white/10 bg-transparent"
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className="text-sm text-white">{rarity === "all" ? "Vsechny kvality" : rarity}</span>
                  {rarity !== "all" && (
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        rarityBgClass[rarity as Rarity] ?? "bg-white/40"
                      }`}
                    />
                  )}
                </span>
                <span className="text-white/60 text-xs">▼</span>
              </button>

              {rarityOpen && (
                <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-lg border border-white/10 bg-slate-900/95 shadow-2xl backdrop-blur">
                  {rarityOptions.map((option) => {
                    const active = option.value === rarity;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          setRarity(option.value as "all" | Rarity);
                          setRarityOpen(false);
                        }}
                        className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition ${
                          active ? "bg-white/10 text-white" : "text-white/80 hover:bg-white/5"
                        }`}
                      >
                        <span>{option.label}</span>
                        {option.value !== "all" && (
                          <span
                            className={`h-2.5 w-2.5 rounded-full ${
                              rarityBgClass[option.value as Rarity] ?? "bg-white/40"
                            }`}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm text-white/60">
        <span>{badgeText}</span>
        {loading && <span className="text-white/80">Loading...</span>}
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {showPlaceholder && (
        <div className="rounded-xl border border-white/10 bg-white/5 px-6 py-10 text-center text-white/70">
          Zadej hledany vyraz, vysledky se dotahnou live ze Skinportu az pri psani.
        </div>
      )}

      {!showPlaceholder && !loading && !items.length && !error && (
        <div className="rounded-xl border border-white/10 bg-white/5 px-6 py-10 text-center text-white/70">
          Nic jsme nenasli. Zkus zmenit filtr nebo jinou kombinaci.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
        {items.map((item) => {
          const detailPath = getSkinDetailPath(item.name);
          const imageUrl = getSkinImageUrl(item.name);

          return (
            <article
              key={item.name}
              className="bg-white/5 rounded-2xl border border-white/10 shadow-md hover:shadow-lg transition hover:-translate-y-0.5 flex flex-col overflow-hidden cursor-pointer"
              role="link"
              tabIndex={0}
              onClick={navigateToDetail(detailPath)}
              onKeyDown={navigateToDetailOnKey(detailPath)}
            >
              <div className="bg-gradient-to-r from-sky-900/50 to-slate-900/40 px-4 py-3 flex items-center gap-3">
                <div className="h-20 w-24 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden">
                  <img
                    src={imageUrl}
                    alt={item.name}
                    loading="lazy"
                    className="max-h-20 w-full object-contain drop-shadow"
                  />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-xs text-white/60">
                    <span>{item.weapon}</span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold ${rarityTextClass[item.rarity as Rarity] ?? "text-white"}`}
                    >
                      {item.rarity}
                    </span>
                  </div>
                  <div className="font-semibold text-lg leading-tight">{item.skin}</div>
                  {item.wear && (
                    <div className="text-xs text-white/60 mt-1">{item.wear}</div>
                  )}
                  {(item.minFloat !== null || item.maxFloat !== null) && (
                    <div className="text-[11px] text-white/50 mt-1">
                      Float: {formatFloat(item.minFloat)} – {formatFloat(item.maxFloat)}
                    </div>
                  )}
                </div>
              </div>

              <div className="p-4 flex flex-col gap-3 flex-1">
                <div className="flex items-start justify-between">
                  <div className="text-sm text-white/60">
                    Objem 7d:{" "}
                    <span className="text-white/80">{formatNumber(item.volume7d)}</span>
                    <br />
                    Median 7d:{" "}
                    <span className="text-white/80">
                      {formatCurrency(item.median7d)}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-white/60">od</div>
                    <div className="text-xl font-bold">
                      {formatCurrency(item.price)}
                    </div>
                    <div className="text-xs text-white/60">
                      Skladem: {formatNumber(item.quantity)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-white/5 text-sm text-sky-300">
                  <a
                    href={item.marketPage || item.itemPage}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Otevrit na Skinport
                  </a>
                  <div className="flex items-center gap-2 text-xs text-white/60">
                    <span className="truncate max-w-[9rem]">{item.name}</span>
                    <Link
                      href={detailPath}
                      className="text-sky-300 hover:underline text-sm"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Detail
                    </Link>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
