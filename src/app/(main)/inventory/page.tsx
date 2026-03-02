"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getSkinDetailPath } from "@/app/lib/skin-images";
import { Rarity, resolveRarity } from "@/app/lib/rarity";

type InventoryItem = {
  assetId: string;
  classId: string;
  instanceId: string;
  amount: number;
  name: string;
  marketHashName: string;
  iconUrl: string | null;
  type: string | null;
  tradable: number;
  marketable: number;
  rarityTag?: string | null;
  collection?: string | null;
  exterior?: string | null;
  floatValue?: number | null;
  inspectLink?: string | null;
  position?: number;
};

type PriceEntry = {
  price: number | null;
  currency: string;
  source: string;
};

type SortMode =
  | "most-recent"
  | "most-expensive"
  | "cheapest"
  | "highest-float"
  | "lowest-float"
  | "highest-rarity"
  | "lowest-rarity";

type Category = "Normal" | "StatTrak" | "Souvenir";
type WearName =
  | "Factory New"
  | "Minimal Wear"
  | "Field-Tested"
  | "Well-Worn"
  | "Battle-Scarred";

type EnrichedInventoryItem = InventoryItem & {
  price: number | null;
  value: number | null;
  rarity: Rarity;
  category: Category;
  typeGroup: string;
  wearName: WearName | null;
  floatEstimate: number | null;
  floatSource: "exact" | "steam" | "estimated" | "unknown";
  collectionValue: string;
};

const currency = new Intl.NumberFormat("cs-CZ", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});

const rarityRank: Record<Rarity, number> = {
  Consumer: 1,
  Industrial: 2,
  "Mil-Spec": 3,
  Restricted: 4,
  Classified: 5,
  Covert: 6,
};

const rarityCardClass: Record<Rarity, string> = {
  Consumer:
    "bg-[color:var(--card)] border-gray-400/65 shadow-[0_0_0_1px_rgba(156,163,175,0.28),0_14px_30px_rgba(2,8,23,0.42)] hover:border-gray-300/85",
  Industrial:
    "bg-[color:var(--card)] border-sky-400/65 shadow-[0_0_0_1px_rgba(56,189,248,0.32),0_14px_30px_rgba(8,47,73,0.38)] hover:border-sky-300/85",
  "Mil-Spec":
    "bg-[color:var(--card)] border-blue-400/65 shadow-[0_0_0_1px_rgba(96,165,250,0.34),0_14px_30px_rgba(15,23,42,0.44)] hover:border-blue-300/85",
  Restricted:
    "bg-[color:var(--card)] border-purple-400/70 shadow-[0_0_0_1px_rgba(192,132,252,0.34),0_14px_30px_rgba(59,7,100,0.38)] hover:border-purple-300/90",
  Classified:
    "bg-[color:var(--card)] border-fuchsia-400/70 shadow-[0_0_0_1px_rgba(232,121,249,0.36),0_14px_30px_rgba(112,26,117,0.36)] hover:border-fuchsia-300/90",
  Covert:
    "bg-[color:var(--card)] border-red-400/75 shadow-[0_0_0_1px_rgba(248,113,113,0.44),0_16px_34px_rgba(127,29,29,0.34)] hover:border-red-300/95",
};

const sortOptions: Array<{ value: SortMode; label: string }> = [
  { value: "most-recent", label: "Most Recent" },
  { value: "most-expensive", label: "Most Expensive" },
  { value: "cheapest", label: "Cheapest" },
  { value: "highest-float", label: "Highest Float" },
  { value: "lowest-float", label: "Lowest Float" },
  { value: "highest-rarity", label: "Highest Rarity" },
  { value: "lowest-rarity", label: "Lowest Rarity" },
];

const wearRanges: Record<WearName, { min: number; max: number; short: string }> = {
  "Factory New": { min: 0, max: 0.07, short: "FN" },
  "Minimal Wear": { min: 0.07, max: 0.15, short: "MW" },
  "Field-Tested": { min: 0.15, max: 0.38, short: "FT" },
  "Well-Worn": { min: 0.38, max: 0.45, short: "WW" },
  "Battle-Scarred": { min: 0.45, max: 1, short: "BS" },
};

const wearOrder: WearName[] = [
  "Factory New",
  "Minimal Wear",
  "Field-Tested",
  "Well-Worn",
  "Battle-Scarred",
];

const typeKeywordMap: Array<{ key: string; value: string }> = [
  { key: "music kit", value: "Music Kit" },
  { key: "sniper rifle", value: "Sniper Rifle" },
  { key: "machinegun", value: "Machinegun" },
  { key: "shotgun", value: "Shotgun" },
  { key: "sticker", value: "Sticker" },
  { key: "graffiti", value: "Graffiti" },
  { key: "equipment", value: "Equipment" },
  { key: "agent", value: "Agent" },
  { key: "glove", value: "Gloves" },
  { key: "knife", value: "Knife" },
  { key: "rifle", value: "Rifle" },
  { key: "pistol", value: "Pistol" },
  { key: "smg", value: "SMG" },
];

const getSteamIconUrl = (iconUrl: string | null) => {
  if (!iconUrl) return "";
  return `https://steamcommunity-a.akamaihd.net/economy/image/${iconUrl}`;
};

const parseNumberInput = (value: string) => {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseUnknownNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length) {
    const parsed = Number(value.trim().replace(",", "."));
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const parseFlag = (value: unknown) => {
  const parsed = parseUnknownNumber(value);
  return parsed && parsed > 0 ? 1 : 0;
};

const toAmount = (value: unknown) => {
  const parsed = parseUnknownNumber(value);
  if (parsed === null) return 1;
  return Math.max(1, Math.floor(parsed));
};

const rarityFromTag = (rarityTag?: string | null): Rarity | null => {
  if (!rarityTag) return null;
  const normalized = rarityTag.toLowerCase();
  if (normalized.includes("consumer")) return "Consumer";
  if (normalized.includes("industrial")) return "Industrial";
  if (normalized.includes("mil") || normalized.includes("high grade"))
    return "Mil-Spec";
  if (normalized.includes("restricted")) return "Restricted";
  if (normalized.includes("classified")) return "Classified";
  if (normalized.includes("extraordinary")) return "Covert";
  if (normalized.includes("covert") || normalized.includes("contraband"))
    return "Covert";
  return null;
};

const rarityFromType = (itemType?: string | null): Rarity | null => {
  if (!itemType) return null;
  const normalized = itemType.toLowerCase();
  if (normalized.includes("glove")) return "Covert";
  return null;
};
const detectCategory = (marketHashName: string): Category => {
  const normalized = marketHashName.toLowerCase();
  if (normalized.startsWith("stattrak")) return "StatTrak";
  if (normalized.startsWith("souvenir")) return "Souvenir";
  return "Normal";
};

const resolveWearName = (raw: string | null | undefined): WearName | null => {
  if (!raw) return null;
  const normalized = raw.trim().toLowerCase();
  if (normalized === "factory new" || normalized === "fn") return "Factory New";
  if (normalized === "minimal wear" || normalized === "mw") return "Minimal Wear";
  if (normalized === "field-tested" || normalized === "ft") return "Field-Tested";
  if (normalized === "well-worn" || normalized === "ww") return "Well-Worn";
  if (normalized === "battle-scarred" || normalized === "bs") return "Battle-Scarred";
  return null;
};

const parseWear = (
  marketHashName: string,
  exteriorTag?: string | null
): WearName | null => {
  const match = marketHashName.match(/\(([^)]+)\)\s*$/);
  if (match?.[1]) {
    const fromName = resolveWearName(match[1]);
    if (fromName) return fromName;
  }
  return resolveWearName(exteriorTag);
};

const detectTypeGroup = (itemType: string | null) => {
  if (!itemType) return "Other";
  const normalized = itemType.toLowerCase();
  for (const type of typeKeywordMap) {
    if (normalized.includes(type.key)) return type.value;
  }
  const cleaned = itemType.trim();
  return cleaned.length ? cleaned : "Other";
};

const toggleSelection = (list: string[], value: string) => {
  if (list.includes(value)) return list.filter((entry) => entry !== value);
  return [...list, value];
};

const formatStat = (value: number | null | undefined) =>
  typeof value === "number" ? value.toLocaleString("cs-CZ") : "-";

const formatFloat = (value: number | null | undefined) =>
  typeof value === "number" ? value.toFixed(4) : "-";

const splitMarketName = (name: string) => {
  const [weaponRaw, restRaw] = name.split("|").map((part) => part?.trim() ?? "");
  const rest = restRaw || weaponRaw || name;
  const wearMatch = rest.match(/\(([^)]+)\)\s*$/);
  const wear = wearMatch ? wearMatch[1].trim() : null;
  const skin = wear ? rest.replace(/\([^)]+\)\s*$/, "").trim() : rest.trim();
  return {
    weapon: weaponRaw || "Item",
    skin: skin || rest || name,
    wear,
  };
};

export default function InventoryPage() {
  const [steamId, setSteamId] = useState<string | null>(null);
  const [steamItems, setSteamItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

  const [query, setQuery] = useState("");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [wearMin, setWearMin] = useState("");
  const [wearMax, setWearMax] = useState("");
  const [tradableOnly, setTradableOnly] = useState(false);
  const [marketableOnly, setMarketableOnly] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<Category[]>([]);
  const [selectedRarities, setSelectedRarities] = useState<Rarity[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [sortMode, setSortMode] = useState<SortMode>("most-expensive");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [priceMap, setPriceMap] = useState<Record<string, PriceEntry>>({});
  const [priceLoading, setPriceLoading] = useState(false);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [exactFloatMap, setExactFloatMap] = useState<Record<string, number | null>>({});
  const [floatLoadingAssetId, setFloatLoadingAssetId] = useState<string | null>(null);
  const [floatError, setFloatError] = useState<string | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  useEffect(() => {
    const id = localStorage.getItem("steamId");
    setSteamId(id);
  }, []);

  useEffect(() => {
    if (!steamId) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetch(`/api/steam/inventory/${steamId}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error ?? "Inventory fetch failed");
        }
        return res.json();
      })
      .then((data) => {
        const rows: Array<Partial<InventoryItem>> = Array.isArray(data?.items)
          ? data.items
          : [];
        const normalized = rows.map((item, index): InventoryItem => ({
          assetId: `${item.assetId ?? `steam-${index}`}`,
          classId: `${item.classId ?? ""}`,
          instanceId: `${item.instanceId ?? ""}`,
          amount: toAmount(item.amount),
          name: `${item.name ?? item.marketHashName ?? "Unknown"}`,
          marketHashName: `${item.marketHashName ?? item.name ?? "Unknown"}`,
          iconUrl: item.iconUrl ?? null,
          type: item.type ?? null,
          tradable: parseFlag(item.tradable),
          marketable: parseFlag(item.marketable),
          rarityTag: item.rarityTag ?? null,
          collection: item.collection ?? null,
          exterior: item.exterior ?? null,
          floatValue: parseUnknownNumber(item.floatValue),
          inspectLink:
            typeof item.inspectLink === "string" ? item.inspectLink : null,
          position: typeof item.position === "number" ? item.position : index,
        }));
        setSteamItems(normalized);
        setExactFloatMap({});
        setFloatError(null);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setError(err.message ?? "Nepodarilo se nacist inventar.");
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [steamId, refreshNonce]);

  useEffect(() => {
    if (!steamItems.length) {
      setPriceMap({});
      setExactFloatMap({});
      setFloatError(null);
      return;
    }

    const controller = new AbortController();
    setPriceLoading(true);
    setPriceError(null);

    fetch("/api/skins/prices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        names: steamItems.map((item) => item.marketHashName),
      }),
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error ?? "Price lookup failed");
        }
        return res.json();
      })
      .then((data) => {
        setPriceMap(data.prices ?? {});
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setPriceError(err.message ?? "Nepodarilo se nacist ceny.");
      })
      .finally(() => setPriceLoading(false));

    return () => controller.abort();
  }, [steamItems]);

  const enrichedItems = useMemo(() => {
    return steamItems.map<EnrichedInventoryItem>((item, index) => {
      const price = priceMap[item.marketHashName]?.price ?? null;
      const rarity =
        rarityFromTag(item.rarityTag ?? null) ??
        rarityFromType(item.type) ??
        resolveRarity(price ?? null);
      const category = detectCategory(item.marketHashName);
      const typeGroup = detectTypeGroup(item.type);
      const wearName = parseWear(item.marketHashName, item.exterior);
      const wearRange = wearName ? wearRanges[wearName] : null;
      const floatFromInspect = parseUnknownNumber(exactFloatMap[item.assetId]);
      const floatFromItem = parseUnknownNumber(item.floatValue);
      const floatEstimate =
        floatFromInspect ??
        floatFromItem ??
        (wearRange ? (wearRange.min + wearRange.max) / 2 : null);
      const floatSource =
        floatFromInspect !== null
          ? "exact"
          : floatFromItem !== null
            ? "steam"
            : wearRange
              ? "estimated"
              : "unknown";
      const collectionValue = item.collection?.trim() || "Unknown";
      return {
        ...item,
        position: typeof item.position === "number" ? item.position : index,
        price,
        value: price !== null ? price * item.amount : null,
        rarity,
        category,
        typeGroup,
        wearName,
        floatEstimate,
        floatSource,
        collectionValue,
      };
    });
  }, [steamItems, priceMap, exactFloatMap]);

  const minPriceValue = parseNumberInput(priceMin);
  const maxPriceValue = parseNumberInput(priceMax);
  const minWearValue = parseNumberInput(wearMin);
  const maxWearValue = parseNumberInput(wearMax);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return enrichedItems.filter((item) => {
      if (q) {
        const text =
          `${item.marketHashName} ${item.name} ${item.type ?? ""} ${item.collectionValue}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      if (tradableOnly && !item.tradable) return false;
      if (marketableOnly && !item.marketable) return false;
      if (selectedCategories.length && !selectedCategories.includes(item.category))
        return false;
      if (selectedRarities.length && !selectedRarities.includes(item.rarity))
        return false;
      if (selectedTypes.length && !selectedTypes.includes(item.typeGroup))
        return false;
      if (minPriceValue !== null) {
        if (item.price === null || item.price < minPriceValue) return false;
      }
      if (maxPriceValue !== null) {
        if (item.price === null || item.price > maxPriceValue) return false;
      }
      if (minWearValue !== null) {
        if (item.floatEstimate === null || item.floatEstimate < minWearValue)
          return false;
      }
      if (maxWearValue !== null) {
        if (item.floatEstimate === null || item.floatEstimate > maxWearValue)
          return false;
      }
      return true;
    });
  }, [
    enrichedItems,
    query,
    tradableOnly,
    marketableOnly,
    selectedCategories,
    selectedRarities,
    selectedTypes,
    minPriceValue,
    maxPriceValue,
    minWearValue,
    maxWearValue,
  ]);

  const sortedItems = useMemo(() => {
    const list = [...filteredItems];
    const compareNumber = (
      a: number | null,
      b: number | null,
      direction: "asc" | "desc"
    ) => {
      if (a === null && b === null) return 0;
      if (a === null) return 1;
      if (b === null) return -1;
      return direction === "asc" ? a - b : b - a;
    };

    list.sort((a, b) => {
      if (sortMode === "most-recent") {
        return (a.position ?? 0) - (b.position ?? 0);
      }
      if (sortMode === "most-expensive") {
        return compareNumber(a.price, b.price, "desc");
      }
      if (sortMode === "cheapest") {
        return compareNumber(a.price, b.price, "asc");
      }
      if (sortMode === "highest-float") {
        return compareNumber(a.floatEstimate, b.floatEstimate, "desc");
      }
      if (sortMode === "lowest-float") {
        return compareNumber(a.floatEstimate, b.floatEstimate, "asc");
      }
      if (sortMode === "highest-rarity") {
        return (
          rarityRank[b.rarity] - rarityRank[a.rarity] ||
          compareNumber(a.price, b.price, "desc")
        );
      }
      return (
        rarityRank[a.rarity] - rarityRank[b.rarity] ||
        compareNumber(a.price, b.price, "asc")
      );
    });
    return list;
  }, [filteredItems, sortMode]);
  useEffect(() => {
    if (!sortedItems.length) {
      setSelectedAssetId(null);
      return;
    }
    const exists = sortedItems.some((item) => item.assetId === selectedAssetId);
    if (!exists) {
      setSelectedAssetId(sortedItems[0].assetId);
    }
  }, [sortedItems, selectedAssetId]);

  const selectedItem = useMemo(() => {
    if (!sortedItems.length) return null;
    return (
      sortedItems.find((item) => item.assetId === selectedAssetId) ?? sortedItems[0]
    );
  }, [sortedItems, selectedAssetId]);

  useEffect(() => {
    const hasResolvedExact = (assetId: string) =>
      Object.prototype.hasOwnProperty.call(exactFloatMap, assetId);

    const needsExactFloat = (item: EnrichedInventoryItem | null | undefined) => {
      if (!item?.inspectLink) return false;
      if (parseUnknownNumber(item.floatValue) !== null) return false;
      return !hasResolvedExact(item.assetId);
    };

    const nextItem =
      (selectedItem && needsExactFloat(selectedItem) ? selectedItem : null) ??
      sortedItems.find((item) => needsExactFloat(item)) ??
      null;

    if (!nextItem?.inspectLink) {
      setFloatLoadingAssetId(null);
      return;
    }

    const assetId = nextItem.assetId;
    const controller = new AbortController();
    setFloatLoadingAssetId(assetId);
    setFloatError(null);

    fetch("/api/steam/inspect-float", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inspectLink: nextItem.inspectLink }),
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error ?? "Float lookup failed");
        }
        return res.json();
      })
      .then((data) => {
        const resolved = parseUnknownNumber(data?.floatValue);
        setExactFloatMap((prev) => ({ ...prev, [assetId]: resolved }));
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setExactFloatMap((prev) => ({ ...prev, [assetId]: null }));
        setFloatError("Presny float se nepodarilo nacist.");
      })
      .finally(() =>
        setFloatLoadingAssetId((current) => (current === assetId ? null : current))
      );

    return () => controller.abort();
  }, [selectedItem, sortedItems, exactFloatMap]);

  const totals = useMemo(() => {
    let amount = 0;
    let pricedAmount = 0;
    let sum = 0;
    for (const item of enrichedItems) {
      amount += item.amount;
      if (item.price !== null) {
        pricedAmount += item.amount;
        sum += item.price * item.amount;
      }
    }
    return { amount, pricedAmount, sum };
  }, [enrichedItems]);

  const typeCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of enrichedItems) {
      map.set(item.typeGroup, (map.get(item.typeGroup) ?? 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [enrichedItems]);

  const applyWearPreset = (wear: WearName) => {
    setWearMin(wearRanges[wear].min.toString());
    setWearMax(wearRanges[wear].max.toString());
  };

  const clearAllFilters = () => {
    setQuery("");
    setPriceMin("");
    setPriceMax("");
    setWearMin("");
    setWearMax("");
    setTradableOnly(false);
    setMarketableOnly(false);
    setSelectedCategories([]);
    setSelectedRarities([]);
    setSelectedTypes([]);
  };

  if (!steamId) {
    return (
      <section className="container-max py-10">
        <div className="card p-6 space-y-3">
          <div className="kicker">Inventar</div>
          <h1 className="display text-3xl">Steam inventar</h1>
          <p className="text-[color:var(--muted)]">
            Pro zobrazeni inventare se prihlas pres Steam.
          </p>
          <a href="/api/steam/login" className="btn-primary w-fit">
            Prihlasit pres Steam
          </a>
        </div>
      </section>
    );
  }

  return (
    <section className="container-max py-8">
      <div className="card p-4 sm:p-6">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-end gap-5">
            <div>
              <h1 className="display text-4xl font-semibold tracking-tight">Inventory</h1>
            </div>
            <div className="text-sm text-[color:var(--muted)]">
              <div>Items</div>
              <div className="text-2xl font-semibold">{formatStat(totals.amount)}</div>
            </div>
            <div className="text-sm text-[color:var(--muted)]">
              <div>Value</div>
              <div className="text-2xl font-semibold">{currency.format(totals.sum)}</div>
            </div>
          </div>

          <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto">
            <div className="min-w-[250px] flex-1 rounded-full border border-[color:var(--border)] bg-[color:var(--card)] px-4 py-2 lg:min-w-[320px] lg:flex-none">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search..."
                className="w-full bg-transparent text-sm text-[color:var(--fg)] placeholder:text-[color:var(--muted)] outline-none"
              />
            </div>
            <button
              onClick={() => setRefreshNonce((v) => v + 1)}
              className="btn-ghost text-sm px-4 py-2"
            >
              Refresh
            </button>
            <button
              onClick={() => setFiltersOpen((v) => !v)}
              className="btn-ghost text-sm px-4 py-2"
            >
              Filters
            </button>
          </div>
        </div>
        {(error || priceError || floatError) && (
          <div className="mb-4 rounded-xl border border-rose-400/40 bg-rose-500/15 px-4 py-3 text-sm text-rose-200">
            {error || priceError || floatError}
          </div>
        )}

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-xs text-[color:var(--muted)]">Sort:</span>
          {sortOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setSortMode(option.value)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                sortMode === option.value
                  ? "border border-[color:var(--accent-2)] bg-[color:var(--card)] text-[color:var(--fg)]"
                  : "border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--muted)] hover:text-[color:var(--fg)]"
              }`}
            >
              {option.label}
            </button>
          ))}
          {priceLoading && <span className="text-xs text-[color:var(--muted)]">Nacitani cen...</span>}
        </div>

        {filtersOpen && (
          <div className="mb-4 card p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-xl font-semibold">Filters</div>
              <button onClick={clearAllFilters} className="text-xs font-semibold text-[color:var(--accent-2)] hover:underline">
                Reset all
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-2">
                <div className="text-sm font-semibold">Category</div>
                {(["Normal", "StatTrak", "Souvenir"] as Category[]).map((category) => (
                  <label key={category} className="inline-flex w-full items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedCategories.includes(category)}
                      onChange={() =>
                        setSelectedCategories((prev) =>
                          toggleSelection(prev, category) as Category[]
                        )
                      }
                      className="h-4 w-4"
                    />
                    {category}
                  </label>
                ))}
              </div>

              <div className="space-y-2">
                <div className="text-sm font-semibold">Rarity</div>
                {(Object.keys(rarityRank) as Rarity[]).map((rarity) => (
                  <label key={rarity} className="inline-flex w-full items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedRarities.includes(rarity)}
                      onChange={() =>
                        setSelectedRarities((prev) =>
                          toggleSelection(prev, rarity) as Rarity[]
                        )
                      }
                      className="h-4 w-4"
                    />
                    {rarity}
                  </label>
                ))}
              </div>

              <div className="space-y-2">
                <div className="text-sm font-semibold">Type</div>
                <div className="max-h-36 space-y-1 overflow-auto pr-1">
                  {typeCounts.map(([type, count]) => (
                    <label key={type} className="inline-flex w-full items-center justify-between gap-2 text-sm">
                      <span className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedTypes.includes(type)}
                          onChange={() => setSelectedTypes((prev) => toggleSelection(prev, type))}
                          className="h-4 w-4"
                        />
                        {type}
                      </span>
                      <span className="rounded-full border border-[color:var(--border)] bg-[color:var(--card)] px-2 py-0.5 text-xs text-[color:var(--muted)]">{count}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-semibold">Wear + Price</div>
                <div className="grid grid-cols-2 gap-2">
                  <input value={wearMin} onChange={(e) => setWearMin(e.target.value)} placeholder="Wear min" className="rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] px-2 py-1 text-sm text-[color:var(--fg)]" />
                  <input value={wearMax} onChange={(e) => setWearMax(e.target.value)} placeholder="Wear max" className="rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] px-2 py-1 text-sm text-[color:var(--fg)]" />
                  <input value={priceMin} onChange={(e) => setPriceMin(e.target.value)} placeholder="EUR min" className="rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] px-2 py-1 text-sm text-[color:var(--fg)]" />
                  <input value={priceMax} onChange={(e) => setPriceMax(e.target.value)} placeholder="EUR max" className="rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] px-2 py-1 text-sm text-[color:var(--fg)]" />
                </div>
                <div className="grid grid-cols-5 gap-1">
                  {wearOrder.map((wear) => (
                    <button key={wear} onClick={() => applyWearPreset(wear)} className="rounded border border-[color:var(--border)] bg-[color:var(--card)] px-2 py-1 text-[11px] font-semibold">
                      {wearRanges[wear].short}
                    </button>
                  ))}
                </div>
              </div>
            </div>

          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
          <div>
            {!loading && !sortedItems.length && (
              <div className="rounded-2xl border border-dashed border-[color:var(--border)] bg-[color:var(--card)] px-6 py-12 text-center text-[color:var(--muted)]">
                Inventar je prazdny nebo filtry nic nenasly.
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {sortedItems.map((item) => {
                const selected = item.assetId === selectedItem?.assetId;
                const wearShort = item.wearName ? wearRanges[item.wearName].short : "--";
                const floatLabel =
                  item.floatEstimate !== null
                    ? `${item.floatSource === "estimated" ? "~" : ""}${formatFloat(item.floatEstimate)}`
                    : "-";
                const parsed = splitMarketName(item.marketHashName);
                return (
                  <button
                    key={item.assetId}
                    onClick={() => setSelectedAssetId(item.assetId)}
                    className={`rounded-3xl border-2 p-3 text-left transition hover:-translate-y-0.5 ${
                      rarityCardClass[item.rarity]
                    } ${selected ? "ring-2 ring-[color:var(--accent-2)]" : "ring-0"}`}
                  >
                    <div className="mb-2 flex items-start justify-between">
                      <span className="rounded-full border border-[color:var(--border)] bg-[color:var(--card)] px-2 py-0.5 text-[11px] font-semibold text-[color:var(--muted)]">{item.typeGroup}</span>
                      <div className="flex items-center gap-1">
                        {item.amount > 1 && (
                          <span className="rounded-full border border-[color:var(--border)] bg-[color:var(--card)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--muted)]">
                            x{item.amount}
                          </span>
                        )}
                        <span className="text-[11px] text-[color:var(--muted)]">
                          {wearShort !== "--" ? `${wearShort} ` : ""}
                          {floatLabel}
                        </span>
                      </div>
                    </div>
                    <div className="mb-3 flex h-28 items-center justify-center overflow-hidden rounded-2xl border border-slate-700/70 bg-[radial-gradient(circle_at_50%_28%,rgba(40,113,255,0.4),rgba(3,9,22,0.95)_72%)] px-2 shadow-[inset_0_0_0_1px_rgba(56,189,248,0.14)]">
                      {item.iconUrl ? (
                        <img
                          src={getSteamIconUrl(item.iconUrl)}
                          alt={item.marketHashName}
                          className="max-h-24 w-full object-contain drop-shadow-[0_10px_22px_rgba(2,8,23,0.85)]"
                          loading="lazy"
                        />
                      ) : (
                        <div className="text-xs text-[color:var(--muted)]">No image</div>
                      )}
                    </div>
                    <div className="mb-1 line-clamp-1 text-sm font-semibold">{parsed.weapon}</div>
                    <div className="mb-3 line-clamp-1 text-sm text-[color:var(--muted)]">{parsed.skin}</div>
                    <div className="flex items-center justify-between rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-2 text-sm">
                      <span className="font-semibold">{item.price !== null ? currency.format(item.price) : "-"}</span>
                      <span className="text-xs text-[color:var(--muted)]">
                        {floatLabel !== "-"
                          ? `Float ${floatLabel}`
                          : wearShort !== "--"
                            ? wearShort
                            : "-"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <aside className="h-fit card p-5 xl:sticky xl:top-24">
            {!selectedItem && <div className="text-sm text-[color:var(--muted)]">Vyber item z inventare.</div>}
            {selectedItem && (
              <div className="space-y-4">
                <div className="overflow-hidden rounded-2xl border border-slate-700/70 bg-[radial-gradient(circle_at_50%_28%,rgba(40,113,255,0.4),rgba(3,9,22,0.95)_72%)] p-4 shadow-[inset_0_0_0_1px_rgba(56,189,248,0.14)]">
                  {selectedItem.iconUrl ? (
                    <img
                      src={getSteamIconUrl(selectedItem.iconUrl)}
                      alt={selectedItem.marketHashName}
                      className="mx-auto h-44 w-full object-contain drop-shadow-[0_14px_26px_rgba(2,8,23,0.85)]"
                    />
                  ) : (
                    <div className="flex h-44 items-center justify-center text-sm text-[color:var(--muted)]">No image</div>
                  )}
                </div>
                <div>
                  <div className="text-3xl font-semibold leading-tight">{splitMarketName(selectedItem.marketHashName).weapon}</div>
                  <div className="text-2xl font-semibold">{splitMarketName(selectedItem.marketHashName).skin}</div>
                  {(selectedItem.wearName || selectedItem.floatEstimate !== null) && (
                    <div className="mt-1 text-sm text-[color:var(--accent-2)]">
                      {selectedItem.wearName ? `${selectedItem.wearName} ` : ""}
                      (
                      {selectedItem.floatEstimate !== null
                        ? `${selectedItem.floatSource === "estimated" ? "~" : ""}${formatFloat(selectedItem.floatEstimate)}`
                        : "-"}
                      )
                    </div>
                  )}
                  {floatLoadingAssetId === selectedItem.assetId && (
                    <div className="mt-1 text-xs text-[color:var(--muted)]">
                      Nacitam presny float...
                    </div>
                  )}
                </div>
                <div className="space-y-2 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-3">
                  <div className="flex items-center justify-between text-sm">
                    <span>Price</span>
                    <span className="font-semibold">{selectedItem.price !== null ? currency.format(selectedItem.price) : "-"}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-[color:var(--muted)]"><span>Mnozstvi</span><span>x{selectedItem.amount}</span></div>
                  <div className="flex items-center justify-between text-xs text-[color:var(--muted)]"><span>Collection</span><span>{selectedItem.collectionValue}</span></div>
                  <div className="flex items-center justify-between text-xs text-[color:var(--muted)]"><span>Rarity</span><span>{selectedItem.rarity}</span></div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={getSkinDetailPath(selectedItem.marketHashName)}
                    prefetch={false}
                    className="btn-primary"
                  >
                    Detail skinu
                  </Link>
                  <a href={`https://steamcommunity.com/market/listings/730/${encodeURIComponent(selectedItem.marketHashName)}`} target="_blank" rel="noreferrer" className="btn-ghost">Steam market</a>
                </div>
              </div>
            )}
          </aside>
        </div>

      </div>
    </section>
  );
}

