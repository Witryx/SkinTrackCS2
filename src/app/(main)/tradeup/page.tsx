"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getSkinDetailPath, getSkinImageUrl } from "@/app/lib/skin-images";
import { isWeaponInSkinCategory } from "@/app/lib/skin-categories";
import type { Rarity } from "@/app/lib/rarity";

type SkinResult = {
  name: string;
  weapon: string;
  skin: string;
  wear?: string | null;
  imageUrl?: string | null;
  rarity: string;
  collections?: string[];
  primaryCollection?: string | null;
  containers?: string[];
  primaryContainer?: string | null;
  minFloat: number | null;
  maxFloat: number | null;
  price: number | null;
};

type InputItem = {
  name: string;
  weapon: string;
  skin: string;
  rarity: string;
  imageUrl?: string | null;
  variant: ItemVariant;
  collections: string[];
  primaryCollection: string | null;
  containers: string[];
  primaryContainer: string | null;
  marketPrice: number | null;
  customPrice: string;
  float: number;
  minFloat: number;
  maxFloat: number;
};

type SimOutput = {
  marketHashName: string;
  probability: number;
  float: number;
  wear: string;
  rarity: string;
  price: number | null;
  collection: string;
};

type SimResult = {
  mode: "standard" | "knife";
  poolKind: "collection" | "case";
  requiredItems: number;
  contractVariant: "regular" | "stattrak";
  rarity: string;
  nextRarity: string;
  avgFloat: number;
  avgNormalizedFloat: number;
  outputs: SimOutput[];
  expectedValue: number;
};

type SortMode = "cheapest" | "most-expensive";
type RarityFilter = Rarity | "all";
type DisplayRarity = Rarity | "Special";
type ItemVariant = "regular" | "stattrak" | "souvenir";

type PersistedTradeupState = {
  inputs?: unknown[];
  outcomePriceInputs?: Record<string, string>;
  knifeMode?: boolean;
};

type ComputedOutcome = SimOutput & {
  key: string;
  customPrice: string;
  manualPrice: number | null;
  effectivePrice: number | null;
  profit: number | null;
  isBest: boolean;
  isWorst: boolean;
};

type PriceLookupEntry = {
  price: number | null;
};

type PriceLookupResponse = {
  prices?: Record<string, PriceLookupEntry>;
};

type TradeupEligibilityEntry = {
  canOutput: boolean;
  reason: string | null;
  pool: string | null;
  outputCount: number;
};

type TradeupEligibilityResponse = {
  eligibility?: Record<string, TradeupEligibilityEntry>;
};

const rarityOptions: Array<{ value: RarityFilter; label: string }> = [
  { value: "all", label: "Všechny kvality" },
  { value: "Consumer", label: "Consumer" },
  { value: "Industrial", label: "Industrial" },
  { value: "Mil-Spec", label: "Mil-Spec" },
  { value: "Restricted", label: "Restricted" },
  { value: "Classified", label: "Classified" },
  { value: "Covert", label: "Covert" },
];

const rarityBadgeColor: Record<DisplayRarity, string> = {
  Consumer: "bg-gray-600",
  Industrial: "bg-sky-500",
  "Mil-Spec": "bg-blue-600",
  Restricted: "bg-violet-600",
  Classified: "bg-fuchsia-600",
  Covert: "bg-rose-600",
  Special: "bg-amber-500",
};

const floatEdges = [0, 0.03, 0.07, 0.15, 0.38, 0.45, 1];

const sortOptions: Array<{ value: SortMode; label: string }> = [
  { value: "cheapest", label: "Nejnižší cena" },
  { value: "most-expensive", label: "Nejvyšší cena" },
];

const currency = new Intl.NumberFormat("cs-CZ", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});

const TRADEUP_STORAGE_KEY = "skintrack.tradeup.v2";

const formatCurrency = (value: number | null | undefined) =>
  typeof value === "number" ? currency.format(value) : "Unknown";

const formatSignedCurrency = (value: number | null | undefined) => {
  if (typeof value !== "number") return "Unknown";
  return `${value >= 0 ? "+" : ""}${currency.format(value)}`;
};

const formatFloat = (value: number | null | undefined, digits = 4) =>
  typeof value === "number" ? value.toFixed(digits) : "-";

const formatPercent = (value: number | null | undefined) =>
  typeof value === "number" ? `${value.toFixed(2)}%` : "Unknown";

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const profitTextClass = (value: number | null | undefined) => {
  if (typeof value !== "number") return "text-[color:var(--muted)]";
  return value >= 0 ? "text-emerald-300" : "text-rose-300";
};

const profitabilityTextClass = (value: number | null | undefined) => {
  if (typeof value !== "number") return "text-[color:var(--muted)]";
  return value >= 100 ? "text-emerald-300" : "text-rose-300";
};

const fieldClass =
  "h-14 rounded-xl border border-[color:var(--border)] bg-[color:var(--card-solid)] px-3 py-2 text-sm text-[color:var(--fg)] outline-none transition placeholder:text-[color:var(--muted)] focus:border-[color:var(--accent)] disabled:cursor-not-allowed disabled:opacity-60";

const selectClass = `${fieldClass} tradeup-select`;

const skinCardClass =
  "overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--card-solid)] p-3 text-[color:var(--fg)] shadow-[var(--shadow-soft)] transition hover:-translate-y-0.5 hover:border-[color:var(--accent)]";

const miniPanelClass =
  "rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3 py-2";

const parsePriceInput = (value: string) => {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
};

const hasInvalidPriceInput = (value: string) =>
  value.trim().length > 0 && parsePriceInput(value) === null;

const getEffectivePrice = (marketPrice: number | null, customPrice: string) => {
  const manualPrice = parsePriceInput(customPrice);
  return manualPrice ?? marketPrice;
};

const readLookupPrice = (
  prices: Record<string, PriceLookupEntry> | undefined,
  name: string
) => {
  const entry = prices?.[name] ?? prices?.[name.toLowerCase()];
  const price = entry?.price;
  return typeof price === "number" && Number.isFinite(price) ? price : null;
};

const getItemVariant = (name: string): ItemVariant => {
  if (/^\s*souvenir\s+/i.test(name)) return "souvenir";
  if (/^\s*stattrak\S*\s+/i.test(name)) return "stattrak";
  return "regular";
};

const variantLabel: Record<ItemVariant, string> = {
  regular: "Regular",
  stattrak: "StatTrak",
  souvenir: "Souvenir",
};

const getVariantBadgeClass = (variant: ItemVariant) => {
  if (variant === "stattrak") return "border-amber-400/35 text-amber-200";
  if (variant === "souvenir") return "border-yellow-400/35 text-yellow-200";
  return "border-[color:var(--border)] text-[color:var(--muted)]";
};

const getCollections = (item: {
  collections?: string[] | null;
  primaryCollection?: string | null;
}) => {
  const collections = Array.isArray(item.collections)
    ? item.collections.filter(
        (entry): entry is string =>
          typeof entry === "string" && entry.trim().length > 0
      )
    : [];
  if (collections.length) return collections;
  return item.primaryCollection ? [item.primaryCollection] : [];
};

const getContainers = (item: {
  containers?: string[] | null;
  primaryContainer?: string | null;
}) => {
  const containers = Array.isArray(item.containers)
    ? item.containers.filter(
        (entry): entry is string =>
          typeof entry === "string" && entry.trim().length > 0
      )
    : [];
  if (containers.length) return containers;
  return item.primaryContainer ? [item.primaryContainer] : [];
};

const getCasePools = (item: {
  collections?: string[] | null;
  primaryCollection?: string | null;
  containers?: string[] | null;
  primaryContainer?: string | null;
}) => {
  const collections = new Set(getCollections(item));
  const containers = getContainers(item);
  const casePools = containers.filter((entry) => !collections.has(entry));
  return casePools.length ? casePools : containers;
};

const getTradeupPools = (
  item: {
    collections?: string[] | null;
    primaryCollection?: string | null;
    containers?: string[] | null;
    primaryContainer?: string | null;
  },
  knifeMode: boolean
) => (knifeMode ? getCasePools(item) : getCollections(item));

const getPreferredTradeupPool = (
  item: {
    collections?: string[] | null;
    primaryCollection?: string | null;
    containers?: string[] | null;
    primaryContainer?: string | null;
  },
  knifeMode: boolean
) => {
  const pools = getTradeupPools(item, knifeMode);
  if (knifeMode) return pools[0] ?? item.primaryContainer ?? null;
  return (
    pools.find((pool) => /\bcollection\b/i.test(pool)) ??
    item.primaryCollection ??
    pools[0] ??
    null
  );
};

const normalizePoolName = (value: string) =>
  value.trim().toLowerCase().replace(/\s+/g, " ");

const GLOVE_ONLY_CASE_POOLS = new Set(
  [
    "clutch case",
    "revolution case",
    "recoil case",
    "snakebite case",
    "glove case",
    "operation hydra case",
    "operation broken fang case",
  ].map(normalizePoolName)
);

const isGloveOnlyCasePool = (pool: string | null | undefined) => {
  if (!pool) return false;
  return GLOVE_ONLY_CASE_POOLS.has(normalizePoolName(pool));
};

const hasStattrakKnifePool = (item: {
  collections?: string[] | null;
  primaryCollection?: string | null;
  containers?: string[] | null;
  primaryContainer?: string | null;
}) => {
  const pools = getTradeupPools(item, true);
  if (!pools.length) return false;
  return pools.some((pool) => !isGloveOnlyCasePool(pool));
};

const isSpecialItem = (item: Pick<SkinResult, "weapon" | "name">) =>
  isWeaponInSkinCategory(item.weapon, item.name, "knife") ||
  isWeaponInSkinCategory(item.weapon, item.name, "gloves");

const getOutcomeKey = (output: Pick<SimOutput, "marketHashName" | "collection">) =>
  `${output.marketHashName}::${output.collection}`;

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

const getCanonicalMarketName = (name: string) => {
  const parsed = splitMarketName(name);
  const variant = getItemVariant(name);
  const weapon = parsed.weapon
    .replace(/^\s*stattrak(?:\u2122)?\s*/i, "")
    .replace(/^\s*souvenir\s*/i, "")
    .trim();
  const base = `${weapon || parsed.weapon} | ${parsed.skin}`;
  if (variant === "stattrak") return `StatTrak\u2122 ${base}`;
  if (variant === "souvenir") return `Souvenir ${base}`;
  return base;
};

const normalizeInventoryName = (value: string) =>
  value.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");

const getInventoryComparableNames = (name: string) => {
  const normalized = normalizeInventoryName(name);
  if (!normalized) return [];

  const canonical = normalizeInventoryName(getCanonicalMarketName(name));
  return canonical && canonical !== normalized
    ? [normalized, canonical]
    : [normalized];
};

const getResultInventoryComparableNames = (name: string) =>
  splitMarketName(name).wear
    ? [normalizeInventoryName(name)]
    : getInventoryComparableNames(name);

const mergeFloatMin = (a: number | null, b: number | null) => {
  if (typeof a === "number" && typeof b === "number") return Math.min(a, b);
  if (typeof a === "number") return a;
  if (typeof b === "number") return b;
  return null;
};

const mergeFloatMax = (a: number | null, b: number | null) => {
  if (typeof a === "number" && typeof b === "number") return Math.max(a, b);
  if (typeof a === "number") return a;
  if (typeof b === "number") return b;
  return null;
};

const sanitizeInputItem = (value: unknown): InputItem | null => {
  if (!value || typeof value !== "object") return null;

  const raw = value as Partial<InputItem> & { price?: number | null };
  if (typeof raw.name !== "string" || typeof raw.weapon !== "string") return null;
  if (typeof raw.skin !== "string" || typeof raw.rarity !== "string") return null;

  const minFloat =
    typeof raw.minFloat === "number" && Number.isFinite(raw.minFloat)
      ? raw.minFloat
      : 0;
  const maxFloat =
    typeof raw.maxFloat === "number" && Number.isFinite(raw.maxFloat)
      ? raw.maxFloat
      : 1;
  const midpoint = clamp((minFloat + maxFloat) / 2, minFloat, maxFloat);
  const floatValue =
    typeof raw.float === "number" && Number.isFinite(raw.float)
      ? clamp(raw.float, minFloat, maxFloat)
      : midpoint;
  const collections = getCollections(raw);
  const marketPrice =
    typeof raw.marketPrice === "number" && Number.isFinite(raw.marketPrice)
      ? raw.marketPrice
      : typeof raw.price === "number" && Number.isFinite(raw.price)
        ? raw.price
        : null;
  const containers = getContainers(raw);

  return {
    name: raw.name,
    weapon: raw.weapon,
    skin: raw.skin,
    rarity: raw.rarity,
    imageUrl: typeof raw.imageUrl === "string" ? raw.imageUrl : null,
    variant:
      raw.variant === "stattrak" || raw.variant === "souvenir"
        ? raw.variant
        : getItemVariant(raw.name),
    collections,
    primaryCollection: raw.primaryCollection ?? collections[0] ?? null,
    containers,
    primaryContainer: raw.primaryContainer ?? containers[0] ?? null,
    marketPrice,
    customPrice: typeof raw.customPrice === "string" ? raw.customPrice : "",
    float: floatValue,
    minFloat,
    maxFloat,
  };
};

export default function TradeupPage() {
  const [query, setQuery] = useState("");
  const [rarity, setRarity] = useState<RarityFilter>("all");
  const [collection, setCollection] = useState("all");
  const [knifeMode, setKnifeMode] = useState(false);
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
  const [eligibilityByName, setEligibilityByName] = useState<
    Record<string, TradeupEligibilityEntry>
  >({});
  const [eligibilityLoading, setEligibilityLoading] = useState(false);

  const [inputs, setInputs] = useState<InputItem[]>([]);
  const [outcomePriceInputs, setOutcomePriceInputs] = useState<
    Record<string, string>
  >({});
  const [storageReady, setStorageReady] = useState(false);

  const [simResult, setSimResult] = useState<SimResult | null>(null);
  const [simError, setSimError] = useState<string | null>(null);
  const [simLoading, setSimLoading] = useState(false);

  const debouncedQuery = useDebounce(query, 350);
  const requiredItems = knifeMode ? 5 : 10;
  const poolLabel = knifeMode ? "Case" : "Collection";
  const poolFilterLabel = knifeMode ? "Všechny case pooly" : "Všechny kolekce";
  const contractVariant = inputs[0]?.variant ?? (stattrakOnly ? "stattrak" : "regular");
  const completionPercent = Math.round((inputs.length / requiredItems) * 100);

  useEffect(() => {
    const id = localStorage.getItem("steamId");
    setSteamId(id);

    try {
      const raw = localStorage.getItem(TRADEUP_STORAGE_KEY);
      if (!raw) {
        setStorageReady(true);
        return;
      }

      const parsed = JSON.parse(raw) as PersistedTradeupState;
      const restoredKnifeMode = parsed?.knifeMode === true;
      const restoredInputs = Array.isArray(parsed?.inputs)
        ? parsed.inputs
            .map((entry) => sanitizeInputItem(entry))
            .filter((entry): entry is InputItem => entry !== null)
            .slice(0, restoredKnifeMode ? 5 : 10)
        : [];

      setKnifeMode(restoredKnifeMode);
      if (restoredKnifeMode) setRarity("Covert");
      setInputs(restoredInputs);
      if (parsed?.outcomePriceInputs && typeof parsed.outcomePriceInputs === "object") {
        const restoredPrices = Object.entries(parsed.outcomePriceInputs).reduce<
          Record<string, string>
        >((acc, [key, value]) => {
          if (typeof value === "string") acc[key] = value;
          return acc;
        }, {});
        setOutcomePriceInputs(restoredPrices);
      }
    } catch {
      localStorage.removeItem(TRADEUP_STORAGE_KEY);
    } finally {
      setStorageReady(true);
    }
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    localStorage.setItem(
      TRADEUP_STORAGE_KEY,
      JSON.stringify({
        inputs,
        outcomePriceInputs,
        knifeMode,
      })
    );
  }, [inputs, outcomePriceInputs, storageReady, knifeMode]);

  useEffect(() => {
    if (!myInventoryOnly || !steamId || inventoryNames) return;
    const controller = new AbortController();
    let active = true;
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
              .flatMap((item: { marketHashName?: string }) =>
                getInventoryComparableNames(`${item.marketHashName ?? ""}`)
              )
              .filter((name: string) => name.length > 0)
          : [];
        setInventoryNames(new Set(names));
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setInventoryNames(new Set());
      })
      .finally(() => {
        if (active) setInventoryLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [myInventoryOnly, steamId, inventoryNames]);

  const hasActiveFilters =
    knifeMode ||
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
        setError("Nepodařilo se načíst skiny.");
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [showPlaceholder, debouncedQuery, rarity, sortMode]);

  const collectionOptions = useMemo(() => {
    const values = Array.from(
      new Set(
        results
          .flatMap((item) => getTradeupPools(item, knifeMode))
          .filter((entry) => entry.trim().length > 0)
      )
    ).sort((a, b) => a.localeCompare(b));

    return ["all", ...values];
  }, [results, knifeMode]);

  useEffect(() => {
    if (collection === "all") return;
    if (!collectionOptions.includes(collection)) {
      setCollection("all");
    }
  }, [collection, collectionOptions]);

  const filteredResults = useMemo(() => {
    let list = [...results];
    const enforceStattrakKnifePools =
      knifeMode && (stattrakOnly || inputs[0]?.variant === "stattrak");

    if (knifeMode) {
      list = list.filter(
        (item) =>
          item.rarity === "Covert" &&
          !isSpecialItem(item) &&
          getTradeupPools(item, true).length > 0
      );
    }

    if (enforceStattrakKnifePools) {
      list = list.filter((item) => hasStattrakKnifePool(item));
    }

    if (collection !== "all") {
      list = list.filter((item) => getTradeupPools(item, knifeMode).includes(collection));
    }

    if (stattrakOnly) {
      list = list.filter((item) => item.name.toLowerCase().includes("stattrak"));
    }

    list = list.filter((item) => {
      const min = item.minFloat ?? 0;
      const max = item.maxFloat ?? 1;
      return max >= floatCapStart && min <= floatCapEnd;
    });

    if (myInventoryOnly) {
      if (!steamId || !inventoryNames) return [];
      list = list.filter((item) =>
        getResultInventoryComparableNames(item.name).some((name) =>
          inventoryNames.has(name)
        )
      );
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
    knifeMode,
    inputs,
  ]);

  const uniqueResults = useMemo(() => {
    const byKey = new Map<string, SkinResult>();

    for (const item of filteredResults) {
      const variant = getItemVariant(item.name);
      const canonicalName = getCanonicalMarketName(item.name);
      const key = `${variant}::${item.rarity.toLowerCase()}::${canonicalName.toLowerCase()}`;
      const existing = byKey.get(key);

      if (!existing) {
        byKey.set(key, {
          ...item,
          collections: getCollections(item),
          primaryCollection: item.primaryCollection ?? getCollections(item)[0] ?? null,
          containers: getContainers(item),
          primaryContainer: item.primaryContainer ?? getContainers(item)[0] ?? null,
        });
        continue;
      }

      const prices = [existing.price, item.price].filter(
        (value): value is number => typeof value === "number"
      );
      const mergedCollections = Array.from(
        new Set([...getCollections(existing), ...getCollections(item)])
      );
      const mergedContainers = Array.from(
        new Set([...getContainers(existing), ...getContainers(item)])
      );

      byKey.set(key, {
        ...existing,
        price: prices.length ? Math.min(...prices) : null,
        minFloat: mergeFloatMin(existing.minFloat, item.minFloat),
        maxFloat: mergeFloatMax(existing.maxFloat, item.maxFloat),
        collections: mergedCollections,
        primaryCollection: existing.primaryCollection ?? mergedCollections[0] ?? null,
        containers: mergedContainers,
        primaryContainer: existing.primaryContainer ?? mergedContainers[0] ?? null,
      });
    }

    return Array.from(byKey.values());
  }, [filteredResults]);

  const sortedResults = useMemo(() => {
    const list = [...uniqueResults];
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
  }, [uniqueResults, sortMode]);

  const eligibilityNames = useMemo(
    () => sortedResults.map((item) => item.name),
    [sortedResults]
  );
  const eligibilitySignature = useMemo(
    () => eligibilityNames.join("\n"),
    [eligibilityNames]
  );

  useEffect(() => {
    if (!eligibilityNames.length) {
      setEligibilityByName({});
      setEligibilityLoading(false);
      return;
    }

    const controller = new AbortController();
    setEligibilityLoading(true);

    fetch("/api/tradeup/eligibility", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: knifeMode ? "knife" : "standard",
        names: eligibilityNames,
      }),
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("Eligibility fetch failed");
        return (await res.json()) as TradeupEligibilityResponse;
      })
      .then((body) => {
        setEligibilityByName(body.eligibility ?? {});
      })
      .catch((err) => {
        if ((err as { name?: string })?.name === "AbortError") return;
        console.error("Trade-up eligibility lookup failed", err);
        setEligibilityByName({});
      })
      .finally(() => setEligibilityLoading(false));

    return () => controller.abort();
  }, [eligibilitySignature, eligibilityNames, knifeMode]);

  const clearFilters = () => {
    setQuery("");
    setRarity(knifeMode ? "Covert" : "all");
    setCollection("all");
    setSortMode("cheapest");
    setFloatCapStart(0);
    setFloatCapEnd(1);
    setStattrakOnly(false);
    setMyInventoryOnly(false);
  };

  const setTradeupMode = (enabled: boolean) => {
    setKnifeMode(enabled);
    setInputs([]);
    setOutcomePriceInputs({});
    setSimResult(null);
    setSimError(null);
    setEligibilityByName({});
    setCollection("all");
    setRarity(enabled ? "Covert" : "all");
  };

  const addInput = (item: SkinResult) => {
    if (inputs.length >= requiredItems) return;
    const eligibility = eligibilityByName[item.name] ?? null;
    if (!eligibility && eligibilityLoading) {
      setSimError("Počkej na kontrolu outputů pro tenhle skin.");
      return;
    }
    if (eligibility && !eligibility.canOutput) {
      setSimError(eligibility.reason ?? "Tenhle skin nemá žádné platné outputy.");
      return;
    }
    const variant = getItemVariant(item.name);
    if (variant === "souvenir") {
      setSimError("Souvenir skiny nejdou použít v Trade Up Contractu.");
      return;
    }
    if (knifeMode && variant === "stattrak" && !hasStattrakKnifePool(item)) {
      setSimError(
        "StatTrak Covert z tohoto case poolu nelze použít: pool obsahuje jen gloves bez nožů."
      );
      return;
    }
    if (inputs.length && inputs[0].variant !== variant) {
      setSimError("Nelze míchat StatTrak a regular skiny v jednom contractu.");
      return;
    }
    if (inputs.length && inputs[0].rarity !== item.rarity) {
      setSimError(
        knifeMode
          ? "Knife contract musí obsahovat 5 Covert skinů stejné rarity."
          : "Contract musí obsahovat 10 skinů stejné rarity."
      );
      return;
    }
    if (!knifeMode && item.rarity === "Covert") {
      setSimError("Covert skiny použij v knife/gloves módu s 5 inputy.");
      return;
    }
    if (knifeMode && (item.rarity !== "Covert" || isSpecialItem(item))) {
      setSimError("Knife trade-up přijímá jen běžné Covert skiny z case poolu.");
      return;
    }
    if (!getTradeupPools(item, knifeMode).length) {
      setSimError(
        knifeMode
          ? "Tenhle skin nemá rozpoznaný case pool pro knife trade-up."
          : "Tenhle skin nemá rozpoznanou collection pro trade-up."
      );
      return;
    }

    const minFloat = item.minFloat ?? 0;
    const maxFloat = item.maxFloat ?? 1;
    const float = clamp((floatCapStart + floatCapEnd) / 2, minFloat, maxFloat);
    const collections = getCollections(item);
    const containers = getContainers(item);

    setInputs((prev) => [
      ...prev,
      {
        name: item.name,
        weapon: item.weapon,
        skin: item.skin,
        rarity: item.rarity,
        imageUrl: item.imageUrl ?? null,
        variant,
        collections,
        primaryCollection: item.primaryCollection ?? collections[0] ?? null,
        containers,
        primaryContainer: item.primaryContainer ?? containers[0] ?? null,
        marketPrice: item.price ?? null,
        customPrice: "",
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
    setOutcomePriceInputs({});
    setSimResult(null);
    setSimError(null);
  };

  const autoFill = () => {
    if (inputs.length >= requiredItems) return;
    const targetRarity =
      knifeMode ? "Covert" : inputs[0]?.rarity ?? sortedResults[0]?.rarity ?? null;
    if (!targetRarity) return;
    const targetVariant =
      inputs[0]?.variant ?? (stattrakOnly ? "stattrak" : "regular");

    const available = sortedResults.filter(
      (item) =>
        item.rarity === targetRarity &&
        eligibilityByName[item.name]?.canOutput === true &&
        getItemVariant(item.name) === targetVariant &&
        (targetVariant !== "stattrak" || !knifeMode || hasStattrakKnifePool(item)) &&
        (!knifeMode || (!isSpecialItem(item) && getTradeupPools(item, true).length > 0)) &&
        (knifeMode || item.rarity !== "Covert")
    );
    const needed = requiredItems - inputs.length;
    const chunk = Array.from({ length: needed }, (_, index) => {
      if (!available.length) return null;
      return available[index % available.length];
    }).filter((item): item is SkinResult => item !== null);
    if (!chunk.length) return;

    setInputs((prev) => [
      ...prev,
      ...chunk.map((item) => {
        const minFloat = item.minFloat ?? 0;
        const maxFloat = item.maxFloat ?? 1;
        const collections = getCollections(item);
        const containers = getContainers(item);
        const variant = getItemVariant(item.name);
        return {
          name: item.name,
          weapon: item.weapon,
          skin: item.skin,
          rarity: item.rarity,
          imageUrl: item.imageUrl ?? null,
          variant,
          collections,
          primaryCollection: item.primaryCollection ?? collections[0] ?? null,
          containers,
          primaryContainer: item.primaryContainer ?? containers[0] ?? null,
          marketPrice: item.price ?? null,
          customPrice: "",
          float: clamp((floatCapStart + floatCapEnd) / 2, minFloat, maxFloat),
          minFloat,
          maxFloat,
        } satisfies InputItem;
      }),
    ].slice(0, requiredItems));
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

  const updateInputPrice = (index: number, value: string) => {
    setInputs((prev) =>
      prev.map((item, idx) =>
        idx === index ? { ...item, customPrice: value } : item
      )
    );
  };

  const inputPricing = useMemo(() => {
    let total = 0;
    let knownCount = 0;
    let manualCount = 0;

    for (const item of inputs) {
      const manualPrice = parsePriceInput(item.customPrice);
      const effectivePrice = manualPrice ?? item.marketPrice;
      if (manualPrice !== null) manualCount += 1;
      if (effectivePrice === null) continue;
      total += effectivePrice;
      knownCount += 1;
    }

    const missingCount = inputs.length - knownCount;
    return {
      total,
      knownCount,
      missingCount,
      manualCount,
      isMissingSome: missingCount > 0,
      isMissingAll: inputs.length > 0 && knownCount === 0,
    };
  }, [inputs]);

  const totalCost = inputPricing.total;
  const avgFloat = useMemo(() => {
    if (!inputs.length) return 0;
    return inputs.reduce((sum, item) => sum + item.float, 0) / inputs.length;
  }, [inputs]);
  const avgAdjustedFloat = useMemo(() => {
    if (!inputs.length) return 0;
    return (
      inputs.reduce((sum, item) => {
        const range = item.maxFloat - item.minFloat;
        if (range <= 0) return sum;
        return sum + clamp((item.float - item.minFloat) / range, 0, 1);
      }, 0) / inputs.length
    );
  }, [inputs]);
  const rarityMismatch = useMemo(() => {
    if (inputs.length < 2) return false;
    const first = inputs[0]?.rarity;
    return inputs.some((item) => item.rarity !== first);
  }, [inputs]);
  const variantMismatch = useMemo(() => {
    if (inputs.length < 2) return false;
    const first = inputs[0]?.variant;
    return inputs.some((item) => item.variant !== first);
  }, [inputs]);
  const hasSouvenirInput = useMemo(
    () => inputs.some((item) => item.variant === "souvenir"),
    [inputs]
  );

  const simulateItems = useMemo(
    () => inputs.map((item) => ({ name: item.name, float: item.float })),
    [inputs]
  );
  const missingInputPriceNames = useMemo(
    () =>
      Array.from(
        new Set(
          inputs
            .filter((item) => item.marketPrice === null)
            .map((item) => item.name)
        )
      ),
    [inputs]
  );

  useEffect(() => {
    if (!missingInputPriceNames.length) return;

    const controller = new AbortController();
    fetch("/api/skins/prices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ names: missingInputPriceNames }),
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("Input price lookup failed");
        return (await res.json()) as PriceLookupResponse;
      })
      .then((body) => {
        setInputs((current) => {
          let changed = false;
          const next = current.map((item) => {
            if (item.marketPrice !== null) return item;
            const price = readLookupPrice(body.prices, item.name);
            if (price === null) return item;
            changed = true;
            return { ...item, marketPrice: price };
          });
          return changed ? next : current;
        });
      })
      .catch((error) => {
        if ((error as { name?: string })?.name !== "AbortError") {
          console.error("Input price lookup failed", error);
        }
      });

    return () => controller.abort();
  }, [missingInputPriceNames]);

  useEffect(() => {
    const hasInvalidKnifeItem =
      knifeMode &&
      inputs.some(
        (item) =>
          item.rarity !== "Covert" ||
          isSpecialItem(item) ||
          !getTradeupPools(item, true).length
      );
    const hasImpossibleStattrakPool =
      knifeMode &&
      inputs.some(
        (item) => item.variant === "stattrak" && !hasStattrakKnifePool(item)
      );
    const hasInvalidStandardItem =
      !knifeMode && inputs.some((item) => item.rarity === "Covert");

    if (
      inputs.length !== requiredItems ||
      rarityMismatch ||
      variantMismatch ||
      hasSouvenirInput ||
      hasImpossibleStattrakPool ||
      hasInvalidKnifeItem ||
      hasInvalidStandardItem
    ) {
      setSimResult(null);
      if (inputs.length && hasSouvenirInput) {
        setSimError("Souvenir skiny nejdou použít v Trade Up Contractu.");
      } else if (inputs.length && variantMismatch) {
        setSimError("Nelze míchat StatTrak a regular skiny v jednom contractu.");
      } else if (inputs.length && hasImpossibleStattrakPool) {
        setSimError(
          "Tenhle case pool má jen gloves. Pro StatTrak knife trade-up použij Covert z knife poolu."
        );
      } else if (inputs.length && rarityMismatch) {
        setSimError("Všechny skiny v contractu musí mít stejnou raritu.");
      } else if (hasInvalidKnifeItem) {
        setSimError("Knife trade-up přijímá jen 5 Covert skinů z podporovaných case poolů.");
      } else if (hasInvalidStandardItem) {
        setSimError("Covert skiny použij v knife/gloves módu s 5 inputy.");
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
          body: JSON.stringify({
            mode: knifeMode ? "knife" : "standard",
            items: simulateItems,
          }),
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
  }, [
    inputs,
    inputs.length,
    knifeMode,
    rarityMismatch,
    variantMismatch,
    hasSouvenirInput,
    requiredItems,
    simulateItems,
  ]);

  const missingOutcomePriceNames = useMemo(
    () =>
      simResult
        ? Array.from(
            new Set(
              simResult.outputs
                .filter((output) => output.price === null)
                .map((output) => output.marketHashName)
            )
          )
        : [],
    [simResult]
  );

  useEffect(() => {
    if (!missingOutcomePriceNames.length) return;

    const controller = new AbortController();
    fetch("/api/skins/prices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ names: missingOutcomePriceNames }),
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("Outcome price lookup failed");
        return (await res.json()) as PriceLookupResponse;
      })
      .then((body) => {
        setSimResult((current) => {
          if (!current) return current;
          let changed = false;
          const outputs = current.outputs.map((output) => {
            if (output.price !== null) return output;
            const price = readLookupPrice(body.prices, output.marketHashName);
            if (price === null) return output;
            changed = true;
            return { ...output, price };
          });
          return changed ? { ...current, outputs } : current;
        });
      })
      .catch((error) => {
        if ((error as { name?: string })?.name !== "AbortError") {
          console.error("Outcome price lookup failed", error);
        }
      });

    return () => controller.abort();
  }, [missingOutcomePriceNames]);

  const outcomes = useMemo<ComputedOutcome[]>(() => {
    if (!simResult) return [];

    const mapped = simResult.outputs.map((out) => {
      const key = getOutcomeKey(out);
      const customPrice = outcomePriceInputs[key] ?? "";
      const manualPrice = parsePriceInput(customPrice);
      const effectivePrice = manualPrice ?? out.price;
      return {
        ...out,
        key,
        customPrice,
        manualPrice,
        effectivePrice,
        profit:
          effectivePrice !== null && !inputPricing.isMissingAll
            ? effectivePrice - totalCost
            : null,
        isBest: false,
        isWorst: false,
      };
    });

    const profits = mapped
      .map((out) => out.profit)
      .filter((value): value is number => typeof value === "number");
    const bestProfit = profits.length ? Math.max(...profits) : null;
    const worstProfit = profits.length ? Math.min(...profits) : null;

    const withFlags = mapped.map((out) => ({
      ...out,
      isBest: bestProfit !== null && out.profit === bestProfit,
      isWorst:
        worstProfit !== null &&
        out.profit === worstProfit &&
        out.profit !== null &&
        out.profit < 0,
    }));

    return withFlags.sort((a, b) => {
      const aHasProfit = typeof a.profit === "number";
      const bHasProfit = typeof b.profit === "number";

      if (aHasProfit && bHasProfit) {
        if (b.profit! !== a.profit!) return b.profit! - a.profit!;
      } else if (aHasProfit !== bHasProfit) {
        return aHasProfit ? -1 : 1;
      }

      return b.probability - a.probability;
    });
  }, [simResult, outcomePriceInputs, inputPricing.isMissingAll, totalCost]);

  const metrics = useMemo(() => {
    const pricedOutcomes = outcomes.filter(
      (outcome) => typeof outcome.effectivePrice === "number"
    );
    const expectedValue = pricedOutcomes.reduce(
      (sum, outcome) => sum + (outcome.effectivePrice as number) * outcome.probability,
      0
    );
    const isMissingSomeOutcomePrices =
      !!simResult && pricedOutcomes.length < simResult.outputs.length;
    const isMissingAllOutcomePrices =
      !!simResult && simResult.outputs.length > 0 && pricedOutcomes.length === 0;
    const hasKnownCost = !inputPricing.isMissingAll;
    const hasKnownOutcomePrices = !isMissingAllOutcomePrices;
    const pricedProfits = outcomes
      .map((outcome) => outcome.profit)
      .filter((value): value is number => typeof value === "number");

    const profitChance =
      simResult && hasKnownCost && hasKnownOutcomePrices
        ? pricedOutcomes.reduce((sum, outcome) => {
            if ((outcome.effectivePrice as number) <= totalCost) return sum;
            return sum + outcome.probability;
          }, 0)
        : null;

    const avgReturn = simResult && hasKnownOutcomePrices ? expectedValue : null;
    const avgProfit =
      simResult && hasKnownCost && hasKnownOutcomePrices
        ? expectedValue - totalCost
        : null;
    const profitability =
      simResult && totalCost > 0 && hasKnownCost && hasKnownOutcomePrices
        ? (expectedValue / totalCost) * 100
        : null;
    const maxProfit = pricedProfits.length ? Math.max(...pricedProfits) : null;
    const minProfit = pricedProfits.length ? Math.min(...pricedProfits) : null;

    return {
      isMissingSomeInputPrices: inputPricing.isMissingSome,
      isMissingAllInputPrices: inputPricing.isMissingAll,
      isMissingSomeOutcomePrices,
      isMissingAllOutcomePrices,
      profitChance,
      avgReturn,
      avgProfit,
      profitability,
      maxProfit,
      minProfit,
    };
  }, [simResult, outcomes, inputPricing, totalCost]);

  const updateOutcomePrice = (key: string, value: string) => {
    setOutcomePriceInputs((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  return (
    <section className="container-max py-8">
      <div className="space-y-6">
        <header className="market-stage flex flex-col gap-4 p-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="kicker">
              Trade-up
            </div>
            <h1 className="display mt-2 text-4xl">
              CS2 Tradeup Calculator
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-[color:var(--muted)]">
            <span className="badge">
              Contract {inputs.length}/{requiredItems}
            </span>
            <span className={`rounded-full border bg-[color:var(--surface-soft)] px-3 py-1.5 text-xs font-bold uppercase ${getVariantBadgeClass(contractVariant)}`}>
            {variantLabel[contractVariant]}
            </span>
            <span className="rounded-full border border-[color:var(--border)] bg-cyan-300/10 px-3 py-1.5 text-xs font-bold uppercase text-[color:var(--accent)]">
              {knifeMode ? "Gold mode" : "Standard mode"}
            </span>
            {inputPricing.manualCount > 0 && (
              <span className="badge">
                Manual prices {inputPricing.manualCount}
              </span>
            )}
            {simLoading && (
              <span className="rounded-full border border-[color:var(--border)] bg-cyan-300/10 px-3 py-1.5 text-xs font-bold uppercase text-[color:var(--accent)]">
                Počítám...
              </span>
            )}
          </div>
        </header>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,0.98fr)_1px_minmax(0,1.02fr)]">
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-4">
              <h2 className="display text-3xl">Select skins</h2>
              <button
                onClick={clearFilters}
                className="btn-ghost text-sm"
              >
                Reset
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid gap-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-1 text-sm sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setTradeupMode(false)}
                className={`rounded-lg px-3 py-2 font-semibold transition ${
                  !knifeMode
                    ? "bg-[color:var(--fg)] text-[color:var(--bg)]"
                    : "text-[color:var(--muted)] hover:bg-[color:var(--card-solid)]"
                }`}
              >
                Standard 10x
              </button>
              <button
                type="button"
                onClick={() => setTradeupMode(true)}
                className={`rounded-lg px-3 py-2 font-semibold transition ${
                  knifeMode
                    ? "bg-[color:var(--fg)] text-[color:var(--bg)]"
                    : "text-[color:var(--muted)] hover:bg-[color:var(--card-solid)]"
                }`}
              >
                Covert 5x to Gold
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Hledej skin..."
                className={fieldClass}
              />

              <select
                value={rarity}
                onChange={(e) => setRarity(e.target.value as RarityFilter)}
                disabled={knifeMode}
                className={selectClass}
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
                className={selectClass}
              >
                <option value="all">{poolFilterLabel}</option>
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
                className={selectClass}
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
                className={selectClass}
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
                className={selectClass}
              >
                {floatEdges.map((value) => (
                  <option key={`to-${value}`} value={value}>
                    Float do {formatFloat(value, 2)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-sm font-semibold text-[color:var(--fg)]">
              <label className="inline-flex items-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3 py-2">
                <input
                  type="checkbox"
                  checked={stattrakOnly}
                  onChange={(e) => setStattrakOnly(e.target.checked)}
                  className="h-4 w-4"
                  style={{ accentColor: "var(--accent)" }}
                />
                StatTrak
              </label>

              <label className="inline-flex items-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3 py-2">
                <input
                  type="checkbox"
                  checked={myInventoryOnly}
                  onChange={(e) => setMyInventoryOnly(e.target.checked)}
                  className="h-4 w-4"
                  style={{ accentColor: "var(--accent)" }}
                />
                Jen můj inventář
              </label>

              {myInventoryOnly && !steamId && (
                <a href="/api/steam/login" className="link text-xs">
                  Přihlásit Steam
                </a>
              )}
              {myInventoryOnly && steamId && inventoryLoading && (
                <span className="text-xs">Načítám inventář...</span>
              )}

              <button
                onClick={autoFill}
                className="rounded-lg border border-[color:var(--border)] bg-cyan-300/10 px-3 py-2 text-xs font-bold text-[color:var(--accent)] transition hover:bg-cyan-300/18"
              >
                Auto-fill do {requiredItems}
              </button>
              <button
                onClick={clearFilters}
                className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3 py-2 text-xs font-bold text-[color:var(--muted)] transition hover:bg-[color:var(--card-solid)]"
              >
                Reset filtrů
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-sm font-semibold text-[color:var(--muted)]">
            <span>
              {showPlaceholder
                ? "Zadej aspoň 2 znaky nebo aktivuj filtr"
                : loading
                  ? "Načítám skiny..."
                  : `Nalezeno ${sortedResults.length} skinů`}
            </span>
            <span>
              {collection !== "all"
                ? `${poolLabel}: ${collection}`
                : `${poolLabel} filtr vypnutý`}
            </span>
          </div>

          {error && (
            <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              {error}
            </div>
          )}

          {showPlaceholder && (
            <div className="rounded-xl border border-dashed border-[color:var(--border)] bg-[color:var(--surface-soft)] px-6 py-10 text-center text-[color:var(--muted)]">
              Skiny se zobrazí až po zadání filtru.
            </div>
          )}

          {!showPlaceholder && !loading && !sortedResults.length && !error && (
            <div className="rounded-xl border border-dashed border-[color:var(--border)] bg-[color:var(--surface-soft)] px-6 py-10 text-center text-[color:var(--muted)]">
              Nic jsme nenašli. Zkus jinou kombinaci filtrů.
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sortedResults.map((item) => {
              const parsed = splitMarketName(item.name);
              const rarityKey =
                (item.rarity as DisplayRarity) in rarityBadgeColor
                  ? (item.rarity as DisplayRarity)
                  : "Consumer";
              const itemPool = getPreferredTradeupPool(item, knifeMode) ?? "Unknown";
              const variant = getItemVariant(item.name);
              const rarityBlocked =
                inputs.length > 0 && inputs[0].rarity !== item.rarity;
              const variantBlocked =
                inputs.length > 0 && inputs[0].variant !== variant;
              const souvenirBlocked = variant === "souvenir";
              const covertBlocked = !knifeMode && item.rarity === "Covert";
              const knifeBlocked =
                knifeMode && (item.rarity !== "Covert" || isSpecialItem(item));
              const stattrakPoolBlocked =
                knifeMode && variant === "stattrak" && !hasStattrakKnifePool(item);
              const eligibility = eligibilityByName[item.name] ?? null;
              const eligibilityPending = eligibilityLoading && !eligibility;
              const outputBlocked = eligibility?.canOutput === false;
              const addDisabled =
                inputs.length >= requiredItems ||
                rarityBlocked ||
                variantBlocked ||
                souvenirBlocked ||
                covertBlocked ||
                knifeBlocked ||
                stattrakPoolBlocked ||
                eligibilityPending ||
                outputBlocked;
              const addLabel = souvenirBlocked
                ? "Souvenir nejde"
                : variantBlocked
                  ? "Jiný typ"
                  : rarityBlocked
                    ? "Jiná rarita"
                    : covertBlocked
                      ? "Gold mode"
                      : stattrakPoolBlocked
                        ? "Bez ST nože"
                      : eligibilityPending
                        ? "Kontrola"
                      : outputBlocked
                        ? "Bez outputu"
                      : knifeBlocked
                        ? "Nejde do Gold"
                        : "Přidej";

              return (
                <article
                  key={item.name}
                  className={skinCardClass}
                >
                  <div className="mb-2 flex items-center justify-between gap-2 text-xs text-[color:var(--muted)]">
                    <span className="rounded-full bg-[color:var(--surface-soft)] px-2 py-1 font-black text-[color:var(--fg)]">
                      {formatCurrency(item.price)}
                    </span>
                    <div className="flex flex-wrap justify-end gap-1">
                      {variant !== "regular" && (
                        <span className={`badge ${getVariantBadgeClass(variant)}`}>
                          {variantLabel[variant]}
                        </span>
                      )}
                      <span
                        className={`rounded-full px-2 py-1 text-white ${rarityBadgeColor[rarityKey]}`}
                      >
                        {item.rarity}
                      </span>
                    </div>
                  </div>

                  <div className="market-stage mb-3 flex h-28 items-center justify-center p-2">
                    <img
                      src={item.imageUrl ?? getSkinImageUrl(item.name)}
                      alt={item.name}
                      loading="lazy"
                      className="max-h-24 w-full object-contain"
                    />
                  </div>

                  <div className="line-clamp-1 text-base font-semibold">{parsed.weapon}</div>
                  <div className="line-clamp-1 text-sm font-semibold text-[color:var(--muted)]">
                    {parsed.skin}
                  </div>

                  <div className="mt-2 space-y-1 text-[11px] font-semibold text-[color:var(--muted)]">
                    <div>
                      {poolLabel}: {itemPool}
                    </div>
                    <div>
                      Float: {formatFloat(item.minFloat, 3)} - {formatFloat(item.maxFloat, 3)}
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <button
                      onClick={() => addInput(item)}
                      disabled={addDisabled}
                      title={outputBlocked ? eligibility?.reason ?? undefined : undefined}
                      className="flex flex-1 items-center justify-center rounded-lg bg-[color:var(--fg)] px-3 py-2 text-xs font-black text-[color:var(--bg)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:bg-[color:var(--surface-strong)] disabled:text-[color:var(--muted)]"
                    >
                      {addLabel}
                    </button>
                    <Link
                      href={getSkinDetailPath(item.name)}
                      prefetch={false}
                      className="rounded-lg border border-[color:var(--border)] px-3 py-2 text-xs font-bold text-[color:var(--muted)] transition hover:border-[color:var(--accent)] hover:text-[color:var(--fg)]"
                    >
                      Detail
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
          </div>

          <div className="hidden bg-[color:var(--border)] xl:block" />

          <div className="space-y-5 xl:sticky xl:top-24 xl:max-h-[calc(100vh-7rem)] xl:self-start xl:overflow-y-auto xl:pr-2">
            <div className="card p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="kicker">
                  Contract
                </div>
                <h2 className="display mt-1 text-3xl">
                  Tradeup
                </h2>
              </div>
              <button
                onClick={clearContract}
                className="btn-ghost text-xs"
              >
                Vyčistit
              </button>
            </div>

            <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-3">
              <div className="mb-2 flex items-center justify-between text-xs font-bold text-[color:var(--muted)]">
                <span>
                  {inputs.length}/{requiredItems} inputů
                </span>
                <span>{completionPercent}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[color:var(--surface-strong)]">
                <div
                  className="h-full rounded-full bg-[color:var(--accent)] transition-all"
                  style={{ width: `${completionPercent}%` }}
                />
              </div>
            </div>

            {(rarityMismatch || variantMismatch) && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                {variantMismatch
                  ? "Contract nemůže míchat StatTrak a regular skiny."
                  : knifeMode
                    ? "Všech 5 skinů musí být Covert a ze stejné rarity."
                    : "Všech 10 skinů musí mít stejnou raritu."}
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: requiredItems }, (_, index) => {
                const item = inputs[index] ?? null;
                if (!item) {
                  return (
                    <div
                      key={`slot-${index}`}
                      className="rounded-xl border border-dashed border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3 py-6 text-center text-xs font-bold text-[color:var(--muted)]"
                    >
                      Slot {index + 1}
                    </div>
                  );
                }

                const rarityKey =
                  (item.rarity as DisplayRarity) in rarityBadgeColor
                    ? (item.rarity as DisplayRarity)
                    : "Consumer";
                const effectivePrice = getEffectivePrice(
                  item.marketPrice,
                  item.customPrice
                );
                const invalidPrice = hasInvalidPriceInput(item.customPrice);

                return (
                  <article
                    key={`${item.name}-${index}`}
                    className="space-y-3 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card-solid)] p-3"
                  >
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <div className="flex flex-wrap gap-1">
                        <span
                          className={`rounded-full px-2 py-1 text-white ${rarityBadgeColor[rarityKey]}`}
                        >
                          {item.rarity}
                        </span>
                        {item.variant !== "regular" && (
                          <span className={`badge ${getVariantBadgeClass(item.variant)}`}>
                            {variantLabel[item.variant]}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => removeInput(index)}
                        className="text-rose-300 hover:text-rose-200"
                      >
                        Odebrat
                      </button>
                    </div>

                    <div className="market-stage flex h-20 items-center justify-center p-2">
                      <img
                        src={item.imageUrl ?? getSkinImageUrl(item.name)}
                        alt={item.name}
                        loading="lazy"
                        className="max-h-16 w-full object-contain"
                      />
                    </div>

                    <div className="line-clamp-1 text-sm font-semibold">{item.weapon}</div>
                    <div className="line-clamp-1 text-xs font-semibold text-[color:var(--muted)]">
                      {item.skin}
                    </div>
                    <div className="text-[11px] font-semibold text-[color:var(--muted)]">
                      {poolLabel}:{" "}
                      {getPreferredTradeupPool(item, knifeMode) ?? "Unknown"}
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className={miniPanelClass}>
                        <div className="text-[11px] font-bold uppercase text-[color:var(--muted)]">Market price</div>
                        <div className="text-sm font-semibold">
                          {formatCurrency(item.marketPrice)}
                        </div>
                      </div>
                      <label className={miniPanelClass}>
                        <div className="text-[11px] font-bold uppercase text-[color:var(--muted)]">Moje cena</div>
                        <input
                          value={item.customPrice}
                          onChange={(e) => updateInputPrice(index, e.target.value)}
                          inputMode="decimal"
                          placeholder="např. 1.35"
                          className={`mt-1 w-full rounded-md border px-2 py-1 text-sm outline-none ${
                            invalidPrice
                            ? "border-rose-500/60 bg-rose-500/10 text-rose-500"
                              : "border-[color:var(--border)] bg-[color:var(--card-solid)] text-[color:var(--fg)]"
                          }`}
                        />
                      </label>
                    </div>

                    <div className={miniPanelClass}>
                      <div className="flex items-center justify-between text-[11px] font-bold uppercase text-[color:var(--muted)]">
                        <span>Float</span>
                        <span>{formatFloat(item.float, 4)}</span>
                      </div>
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

                    <div className="text-[11px] font-semibold text-[color:var(--muted)]">
                      Použitá cena:{" "}
                      <span className="font-semibold text-[color:var(--fg)]">
                        {formatCurrency(effectivePrice)}
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
              <div className={miniPanelClass}>
                <div className="text-[11px] font-bold uppercase text-[color:var(--muted)]">Average float</div>
                <div className="text-sm font-semibold">{formatFloat(avgFloat, 5)}</div>
              </div>
              <div className={miniPanelClass}>
                <div className="text-[11px] font-bold uppercase text-[color:var(--muted)]">Adjusted float</div>
                <div className="text-sm font-semibold">
                  {formatFloat(simResult?.avgNormalizedFloat ?? avgAdjustedFloat, 5)}
                </div>
              </div>
              <div className={miniPanelClass}>
                <div className="text-[11px] font-bold uppercase text-[color:var(--muted)]">Cost</div>
                <div className="text-sm font-semibold">
                  {metrics.isMissingAllInputPrices ? "Unknown" : formatCurrency(totalCost)}
                </div>
              </div>
              <div className={miniPanelClass}>
                <div className="text-[11px] font-bold uppercase text-[color:var(--muted)]">Profit chance</div>
                <div className="text-sm font-semibold">
                  {metrics.profitChance === null
                    ? "Unknown"
                    : `${(metrics.profitChance * 100).toFixed(2)}%`}
                </div>
              </div>
              <div className={miniPanelClass}>
                <div className="text-[11px] font-bold uppercase text-[color:var(--muted)]">Profitability</div>
                <div className={`text-sm font-semibold ${profitabilityTextClass(metrics.profitability)}`}>
                  {formatPercent(metrics.profitability)}
                </div>
              </div>
              <div className={miniPanelClass}>
                <div className="text-[11px] font-bold uppercase text-[color:var(--muted)]">Average return</div>
                <div className="text-sm font-semibold">
                  {formatCurrency(metrics.avgReturn)}
                </div>
              </div>
              <div className={miniPanelClass}>
                <div className="text-[11px] font-bold uppercase text-[color:var(--muted)]">Average profit</div>
                <div className={`text-sm font-semibold ${profitTextClass(metrics.avgProfit)}`}>
                  {formatSignedCurrency(metrics.avgProfit)}
                </div>
              </div>
              <div className={miniPanelClass}>
                <div className="text-[11px] font-bold uppercase text-[color:var(--muted)]">Max profit</div>
                <div className={`text-sm font-semibold ${profitTextClass(metrics.maxProfit)}`}>
                  {formatSignedCurrency(metrics.maxProfit)}
                </div>
              </div>
              <div className={miniPanelClass}>
                <div className="text-[11px] font-bold uppercase text-[color:var(--muted)]">Max loss</div>
                <div className={`text-sm font-semibold ${profitTextClass(metrics.minProfit)}`}>
                  {formatSignedCurrency(metrics.minProfit)}
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
                <h3 className="display text-2xl">Výsledky tradeupu</h3>
              </div>
              {simResult && (
                <div className="text-right text-xs text-[color:var(--muted)]">
                  <div>
                    {simResult.rarity} {"->"} {simResult.nextRarity}
                  </div>
                  <div>{variantLabel[simResult.contractVariant]}</div>
                  <div>EV {formatCurrency(metrics.avgReturn)}</div>
                </div>
              )}
            </div>

            {!simResult && (
              <div className="rounded-xl border border-dashed border-[color:var(--border)] bg-[color:var(--card)] px-4 py-8 text-center text-sm text-[color:var(--muted)]">
                Outcome se přepočítá automaticky, jakmile máš {requiredItems}{" "}
                {knifeMode ? "Covert skinů ze stejných case poolů." : "skinů stejné rarity."}
              </div>
            )}

            {!!simResult && (
              <div className="grid gap-3 md:grid-cols-2">
                {outcomes.map((out) => {
                  const parsed = splitMarketName(out.marketHashName);
                  const rarityKey =
                    (out.rarity as DisplayRarity) in rarityBadgeColor
                      ? (out.rarity as DisplayRarity)
                      : "Consumer";
                  const invalidPrice = hasInvalidPriceInput(out.customPrice);

                  return (
                    <article
                      key={out.key}
                      className={`rounded-xl border p-3 ${
                        out.isBest
                          ? "border-emerald-400/45 bg-emerald-500/10"
                          : out.isWorst
                            ? "border-rose-500/35 bg-rose-500/8"
                            : out.profit !== null && out.profit >= 0
                              ? "border-emerald-500/25 bg-emerald-500/5"
                              : "border-[color:var(--border)] bg-[color:var(--card)]"
                      }`}
                    >
                      <div className="mb-2 flex items-center justify-between gap-2 text-xs">
                        <span className="badge">{(out.probability * 100).toFixed(2)}%</span>
                        <span
                          className={`rounded-full px-2 py-1 text-white ${rarityBadgeColor[rarityKey]}`}
                        >
                          {out.rarity}
                        </span>
                      </div>
                      <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-[color:var(--card-solid)]">
                        <div
                          className="h-full rounded-full bg-[color:var(--accent-2)]"
                          style={{ width: `${clamp(out.probability * 100, 0, 100)}%` }}
                        />
                      </div>

                      <div className="mb-2 flex h-20 items-center justify-center rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] p-2">
                        <img
                          src={getSkinImageUrl(out.marketHashName)}
                          alt={out.marketHashName}
                          loading="lazy"
                          className="max-h-16 w-full object-contain"
                        />
                      </div>

                      <div className="line-clamp-1 text-sm font-semibold">{parsed.weapon}</div>
                      <div className="line-clamp-1 text-xs text-[color:var(--muted)]">
                        {parsed.skin}
                      </div>

                      <div className="mt-2 space-y-1 text-xs text-[color:var(--muted)]">
                        <div>{simResult.poolKind === "case" ? "Case" : "Collection"}: {out.collection}</div>
                        <div>
                          {out.wear} ({formatFloat(out.float, 7)})
                        </div>
                        <div>Market price: {formatCurrency(out.price)}</div>
                      </div>

                      <label className="mt-3 block rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] p-2">
                        <div className="text-[11px] text-[color:var(--muted)]">
                          Vlastní cena outcome
                        </div>
                        <input
                          value={out.customPrice}
                          onChange={(e) => updateOutcomePrice(out.key, e.target.value)}
                          inputMode="decimal"
                          placeholder="např. 4.90"
                          className={`mt-1 w-full rounded-md border px-2 py-1 text-sm outline-none ${
                            invalidPrice
                              ? "border-rose-500/60 bg-rose-500/10 text-rose-100"
                              : "border-[color:var(--border)] bg-[color:var(--card-solid)] text-[color:var(--fg)]"
                          }`}
                        />
                      </label>

                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-2">
                          <div className="text-[11px] text-[color:var(--muted)]">
                            Použitá cena
                          </div>
                          <div className="text-sm font-semibold">
                            {formatCurrency(out.effectivePrice)}
                          </div>
                        </div>
                        <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-2">
                          <div className="text-[11px] text-[color:var(--muted)]">Profit</div>
                          <div
                            className={`text-sm font-semibold ${
                              out.profit === null
                                ? "text-[color:var(--muted)]"
                                : out.profit >= 0
                                  ? "text-emerald-400"
                                  : "text-rose-400"
                            }`}
                          >
                            {formatSignedCurrency(out.profit)}
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
      </div>
    </section>
  );
}

