type PeriodStats = {
  min: number | null;
  max: number | null;
  avg: number | null;
  median: number | null;
  volume: number | null;
};

export type SkinportHistoryItem = {
  market_hash_name: string;
  version: string | null;
  currency: string;
  item_page: string;
  market_page: string;
  last_24_hours: PeriodStats;
  last_7_days: PeriodStats;
  last_30_days: PeriodStats;
  last_90_days: PeriodStats;
};

export type SkinportItem = {
  market_hash_name: string;
  version: string | null;
  currency: string;
  suggested_price: number | null;
  item_page: string;
  market_page: string;
  min_price: number | null;
  max_price: number | null;
  mean_price: number | null;
  median_price: number | null;
  quantity: number;
  created_at: number;
  updated_at: number;
};

export type ParsedName = {
  weapon: string;
  skin: string;
  wear?: string | null;
};

export type TrendSkin = ParsedName & {
  name: string;
  price: number | null;
  volume7d: number;
  median7d: number | null;
  quantity: number | null;
  rarity?: string | null;
  itemPage?: string;
  marketPage?: string;
};

export type SkinDetail = TrendSkin & {
  minPrice: number | null;
  maxPrice: number | null;
  meanPrice: number | null;
  medianPrice: number | null;
  suggestedPrice: number | null;
};

type CacheEntry<T> = {
  data: T;
  fetchedAt: number;
};

const TTL_ITEMS = 1000 * 60 * 15; // 15 minutes
const TTL_HISTORY = 1000 * 60 * 10; // 10 minutes

let itemsCache: CacheEntry<Record<string, SkinportItem>> | null = null;
let historyCache: CacheEntry<SkinportHistoryItem[]> | null = null;

async function fetchJson<T>(
  url: string,
  retries = 3,
  delayMs = 800,
  timeoutMs = 5000
): Promise<T | null> {
  let lastErr: unknown = new Error("Skinport request failed.");
  for (let attempt = 0; attempt < retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        headers: { "Accept-Encoding": "br" },
        cache: "no-store",
        signal: controller.signal,
      });
      if (!res.ok) {
        lastErr = new Error(`Skinport request failed with status ${res.status}`);
        if (attempt < retries - 1) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          continue;
        }
        console.error("Skinport request returned non-OK response", {
          status: res.status,
          url,
        });
        return null;
      }
      return (await res.json()) as T;
    } catch (err) {
      lastErr = err;
      if (attempt < retries - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }
      console.error("Skinport request failed after retries", err);
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }
  console.error("Skinport request exhausted retries", lastErr);
  return null;
}

export async function getSkinportItems(): Promise<Record<string, SkinportItem>> {
  const now = Date.now();
  if (itemsCache && now - itemsCache.fetchedAt < TTL_ITEMS) {
    return itemsCache.data;
  }

  const params = new URLSearchParams({
    app_id: "730",
    currency: "EUR",
    tradable: "1",
  });

  const list = await fetchJson<SkinportItem[]>(
    `https://api.skinport.com/v1/items?${params.toString()}`
  );

  if (!Array.isArray(list)) {
    console.error("Skinport items fetch returned invalid payload", { list });
    if (itemsCache) return itemsCache.data;
    return {};
  }

  const data = list.reduce<Record<string, SkinportItem>>((acc, item) => {
    acc[item.market_hash_name.toLowerCase()] = item;
    return acc;
  }, {});

  itemsCache = { data, fetchedAt: now };
  return data;
}

export async function getSkinportHistory(): Promise<SkinportHistoryItem[]> {
  const now = Date.now();
  if (historyCache && now - historyCache.fetchedAt < TTL_HISTORY) {
    return historyCache.data;
  }

  const params = new URLSearchParams({
    app_id: "730",
    currency: "EUR",
  });

  const data = await fetchJson<SkinportHistoryItem[]>(
    `https://api.skinport.com/v1/sales/history?${params.toString()}`
  );

  if (!Array.isArray(data)) {
    console.error("Skinport history fetch returned invalid payload", { data });
    if (historyCache) return historyCache.data;
    return [];
  }

  historyCache = { data, fetchedAt: now };
  return data;
}

export function parseMarketHashName(name: string): ParsedName {
  const [weaponRaw, restRaw] = name.split("|").map((part) => part?.trim() ?? "");
  const rest = restRaw || weaponRaw || name;

  const wearMatch = rest.match(/\(([^)]+)\)/);
  const wear = wearMatch ? wearMatch[1] : null;
  const skin = rest.replace(/\([^)]+\)/, "").trim() || rest;

  return {
    weapon: weaponRaw || "Skin",
    skin,
    wear,
  };
}

export async function getTrendingSkins() {
  const [historyRaw, itemsRaw, metaMap] = await Promise.all([
    getSkinportHistory(),
    getSkinportItems(),
    getSkinMetaMap().catch(() => null),
  ]);

  const history = Array.isArray(historyRaw) ? historyRaw : [];
  const items = itemsRaw ?? {};

  const sorted = history
    .filter((item) => (item.last_7_days?.volume ?? 0) > 0)
    .sort(
      (a, b) =>
        (b.last_7_days?.volume ?? 0) - (a.last_7_days?.volume ?? 0) ||
        (b.last_7_days?.median ?? 0) - (a.last_7_days?.median ?? 0)
    );

  const normalized: TrendSkin[] = sorted.map((entry) => {
    const item =
      items[entry.market_hash_name.toLowerCase()] ??
      items[entry.market_hash_name];

    const priceCandidate =
      item?.min_price ??
      item?.median_price ??
      entry.last_7_days?.median ??
      entry.last_7_days?.avg ??
      item?.suggested_price ??
      null;

    const parsed = parseMarketHashName(entry.market_hash_name);
    const meta =
      metaMap?.get(normalizeName(`${parsed.weapon} ${parsed.skin}`)) ?? null;

    return {
      name: entry.market_hash_name,
      price: priceCandidate,
      rarity: meta?.rarity ?? resolveRarity(priceCandidate),
      volume7d: entry.last_7_days?.volume ?? 0,
      median7d: entry.last_7_days?.median ?? null,
      quantity: item?.quantity ?? null,
      itemPage: item?.item_page ?? entry.item_page,
      marketPage: item?.market_page ?? entry.market_page,
      ...parsed,
    };
  });

  const featured = normalized.slice(0, 3);
  const trending = normalized.slice(3, 33);

  return {
    featured,
    trending,
  };
}

export type SearchFilters = {
  q?: string;
  minPrice?: number;
  maxPrice?: number;
  tradable?: boolean;
  limit?: number;
  sort?: "volume" | "cheapest" | "most-expensive";
};

export async function searchSkins({
  q,
  minPrice,
  maxPrice,
  tradable,
  limit = 60,
  sort = "volume",
}: SearchFilters) {
  const [itemsRaw, historyRaw, metaMap] = await Promise.all([
    getSkinportItems(),
    getSkinportHistory(),
    getSkinMetaMap().catch(() => null),
  ]);

  const items = itemsRaw ?? {};
  const history = Array.isArray(historyRaw) ? historyRaw : [];

  const historyMap = history.reduce<Record<string, SkinportHistoryItem>>(
    (acc, entry) => {
      acc[entry.market_hash_name.toLowerCase()] = entry;
      return acc;
    },
    {}
  );

  const qLower = q?.trim().toLowerCase() ?? "";

  const results: TrendSkin[] = Object.values(items)
    .filter((item) => {
      if (tradable && item.quantity <= 0) return false;
      if (qLower && !item.market_hash_name.toLowerCase().includes(qLower))
        return false;
      const price = item.min_price ?? item.median_price ?? item.suggested_price;
      if (minPrice !== undefined && price !== null && price < minPrice)
        return false;
      if (maxPrice !== undefined && price !== null && price > maxPrice)
        return false;
      return true;
    })
    .map((item) => {
      const hist = historyMap[item.market_hash_name.toLowerCase()];
      const parsed = parseMarketHashName(item.market_hash_name);
      const meta =
        metaMap?.get(normalizeName(`${parsed.weapon} ${parsed.skin}`)) ?? null;
      const price =
        item.min_price ?? item.median_price ?? item.suggested_price ?? null;
      return {
        name: item.market_hash_name,
        price,
        rarity: meta?.rarity ?? resolveRarity(price),
        volume7d: hist?.last_7_days?.volume ?? 0,
        median7d: hist?.last_7_days?.median ?? null,
        quantity: item.quantity,
        itemPage: item.item_page,
        marketPage: item.market_page,
        ...parsed,
      };
    });

  results.sort((a, b) => {
    if (sort === "cheapest") {
      return (a.price ?? Number.MAX_SAFE_INTEGER) - (b.price ?? Number.MAX_SAFE_INTEGER);
    }
    if (sort === "most-expensive") {
      return (b.price ?? Number.MIN_SAFE_INTEGER) - (a.price ?? Number.MIN_SAFE_INTEGER);
    }
    // default: volume
    return (
      (b.volume7d ?? 0) - (a.volume7d ?? 0) ||
      (b.quantity ?? 0) - (a.quantity ?? 0) ||
      (a.price ?? Number.MAX_SAFE_INTEGER) - (b.price ?? Number.MAX_SAFE_INTEGER)
    );
  });

  return results.slice(0, limit);
}

export async function getSkinByName(name: string): Promise<SkinDetail | null> {
  const [itemsRaw, historyRaw, metaMap] = await Promise.all([
    getSkinportItems(),
    getSkinportHistory(),
    getSkinMetaMap().catch(() => null),
  ]);

  const items = itemsRaw ?? {};
  const history = Array.isArray(historyRaw) ? historyRaw : [];

  const normalizedName = name.trim().toLowerCase();

  const itemCandidate =
    items[normalizedName] ??
    items[name] ??
    Object.values(items).find(
      (entry) => entry.market_hash_name.toLowerCase() === normalizedName
    );

  const historyEntry = history.find(
    (entry) => entry.market_hash_name.toLowerCase() === normalizedName
  );

  if (!itemCandidate && !historyEntry) return null;

  const resolvedName =
    itemCandidate?.market_hash_name ?? historyEntry?.market_hash_name ?? name;

  const parsed = parseMarketHashName(resolvedName);
  const meta =
    metaMap?.get(normalizeName(`${parsed.weapon} ${parsed.skin}`)) ?? null;

  const priceCandidate =
    itemCandidate?.min_price ??
    itemCandidate?.median_price ??
    historyEntry?.last_7_days?.median ??
    historyEntry?.last_7_days?.avg ??
    itemCandidate?.suggested_price ??
    null;

  return {
    name: resolvedName,
    price: priceCandidate,
    rarity: meta?.rarity ?? resolveRarity(priceCandidate),
    volume7d: historyEntry?.last_7_days?.volume ?? 0,
    median7d: historyEntry?.last_7_days?.median ?? null,
    quantity: itemCandidate?.quantity ?? null,
    itemPage: itemCandidate?.item_page ?? historyEntry?.item_page,
    marketPage: itemCandidate?.market_page ?? historyEntry?.market_page,
    minPrice: itemCandidate?.min_price ?? null,
    maxPrice: itemCandidate?.max_price ?? null,
    meanPrice: itemCandidate?.mean_price ?? null,
    medianPrice: itemCandidate?.median_price ?? null,
    suggestedPrice: itemCandidate?.suggested_price ?? null,
    ...parsed,
  };
}
import { getSkinMetaMap, lookupSkinMeta, normalizeName } from "./skin-meta";
import { resolveRarity } from "./rarity";
