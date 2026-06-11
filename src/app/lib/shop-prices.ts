import nacl from "tweetnacl";
import { convertCurrency } from "@/app/lib/exchange-rates";
import { normalizeMarketHashForMeta } from "@/app/lib/skin-meta";
import {
  getSkinportItems,
  parseMarketHashName,
  SkinportItem,
} from "@/app/lib/skinport";

type ShopPrice = {
  id: string;
  label: string;
  price: number | null;
  currency: string;
  originalPrice?: number | null;
  originalCurrency?: string | null;
  url?: string;
  note?: string;
};

type CacheEntry = {
  fetchedAt: number;
  data: ShopPrice[];
};

const cache = new Map<string, CacheEntry>();
const TTL_MS = 1000 * 60 * 5;
const CSFLOAT_PRICE_LIST_TTL_MS = 1000 * 60 * 10;
const REQUEST_TIMEOUT_MS = 4000;
const DMARKET_SEARCH_URL =
  "https://dmarket.com/ingame-items/item-list/csgo-skins";
const CSFLOAT_SEARCH_URL = "https://csfloat.com/search";
const CSFLOAT_PRICE_LIST_URL = "https://csfloat.com/api/v1/listings/price-list";

type CsFloatPriceListItem = {
  market_hash_name?: string;
  min_price?: number | string | null;
  quantity?: number | string | null;
};

type CsFloatPriceListCache = {
  fetchedAt: number;
  data: Map<string, CsFloatPriceListItem>;
};

let csFloatPriceListCache: CsFloatPriceListCache | null = null;
let csFloatPriceListPromise: Promise<Map<string, CsFloatPriceListItem> | null> | null =
  null;

const parseMoney = (value?: string | null) => {
  if (!value) return null;
  const cleaned = value.replace(/[^\d.,]/g, "");
  if (!cleaned) return null;
  const hasDot = cleaned.includes(".");
  const hasComma = cleaned.includes(",");

  let normalized = cleaned;
  if (hasDot && hasComma) {
    if (cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")) {
      normalized = cleaned.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = cleaned.replace(/,/g, "");
    }
  } else if (hasComma && !hasDot) {
    normalized = cleaned.replace(",", ".");
  }

  const num = Number.parseFloat(normalized);
  return Number.isFinite(num) ? num : null;
};

const parseNumeric = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") return parseMoney(value);
  return null;
};

const priceFromItem = (item?: SkinportItem | null) => {
  if (!item) return null;
  return item.min_price ?? item.median_price ?? item.suggested_price ?? null;
};

const normalizeMinorUnitPrice = (value: unknown) => {
  const parsed = parseNumeric(value);
  if (parsed === null) return null;
  return Number.isInteger(parsed) ? parsed / 100 : parsed;
};

const joinNotes = (...values: Array<string | null | undefined>) =>
  values
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
    .join(" / ");

const buildDMarketSearchUrl = (marketHashName: string) =>
  `${DMARKET_SEARCH_URL}?title=${encodeURIComponent(marketHashName)}`;

const buildCsFloatSearchUrl = (marketHashName: string) =>
  `${CSFLOAT_SEARCH_URL}?market_hash_name=${encodeURIComponent(marketHashName)}`;

const fetchCsFloatPriceList = async () => {
  const now = Date.now();
  if (
    csFloatPriceListCache &&
    now - csFloatPriceListCache.fetchedAt < CSFLOAT_PRICE_LIST_TTL_MS
  ) {
    return csFloatPriceListCache.data;
  }

  if (csFloatPriceListPromise) {
    return csFloatPriceListPromise;
  }

  csFloatPriceListPromise = (async () => {
    try {
      const res = await fetchWithTimeout(CSFLOAT_PRICE_LIST_URL, {
        cache: "no-store",
        timeoutMs: REQUEST_TIMEOUT_MS,
      });
      if (!res.ok) {
        console.warn("CSFloat price-list error", { status: res.status });
        return null;
      }

      const data = await res.json();
      if (!Array.isArray(data)) return null;

      const mapped = new Map<string, CsFloatPriceListItem>();
      for (const item of data) {
        if (!item || typeof item !== "object") continue;
        const candidate = item as CsFloatPriceListItem;
        const name = candidate.market_hash_name?.trim();
        if (!name) continue;
        mapped.set(name.toLowerCase(), candidate);
      }

      csFloatPriceListCache = {
        fetchedAt: Date.now(),
        data: mapped,
      };
      return mapped;
    } catch (err) {
      console.warn("CSFloat price-list request failed", err);
      return null;
    } finally {
      csFloatPriceListPromise = null;
    }
  })();

  return csFloatPriceListPromise;
};

const buildSkinportLookupKey = (marketHashName: string) => {
  const parsed = parseMarketHashName(marketHashName);
  const weaponLower = parsed.weapon.toLowerCase();
  const wear = (parsed.wear ?? "").toLowerCase();
  const stattrak = weaponLower.includes("stattrak") ? "st" : "nost";
  const souvenir = weaponLower.includes("souvenir") ? "sou" : "nos";
  const normalized = normalizeMarketHashForMeta(marketHashName);
  return `${normalized}|${wear}|${stattrak}|${souvenir}`;
};

const hexToBytes = (value: string) => {
  const hex = value.startsWith("0x") ? value.slice(2) : value;
  if (hex.length % 2 !== 0) {
    throw new Error("Hex string must have an even length.");
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    const parsed = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    if (Number.isNaN(parsed)) {
      throw new Error("Invalid hex string.");
    }
    bytes[i] = parsed;
  }
  return bytes;
};

const signDMarket = (
  method: string,
  path: string,
  body: string,
  timestamp: string,
  secretKeyHex: string
) => {
  const secretBytes = hexToBytes(secretKeyHex);
  const keyPair =
    secretBytes.length === 32
      ? nacl.sign.keyPair.fromSeed(secretBytes)
      : nacl.sign.keyPair.fromSecretKey(secretBytes);
  const message = `${method}${path}${body}${timestamp}`;
  const signature = nacl.sign.detached(
    new TextEncoder().encode(message),
    keyPair.secretKey
  );
  return Buffer.from(signature).toString("hex");
};

const fetchWithTimeout = async (
  input: RequestInfo | URL,
  init: RequestInit & { timeoutMs?: number } = {}
) => {
  const { timeoutMs = REQUEST_TIMEOUT_MS, ...rest } = init;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...rest, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
};

const normalizeHexKey = (value: string) =>
  value.trim().replace(/^0x/i, "").toLowerCase();

const isHexKey = (value: string) => /^[0-9a-f]+$/i.test(value);

const normalizeShopToEur = async (shop: ShopPrice): Promise<ShopPrice> => {
  if (shop.price === null) {
    return {
      ...shop,
      currency: "EUR",
    };
  }

  const originalCurrency = shop.currency.trim().toUpperCase() || "EUR";
  if (originalCurrency === "EUR") {
    return {
      ...shop,
      currency: "EUR",
    };
  }

  const converted = await convertCurrency(shop.price, originalCurrency, "EUR");
  if (converted === null) {
    return {
      ...shop,
      note: joinNotes(shop.note, `Kurz ${originalCurrency}->EUR nedostupný`),
    };
  }

  return {
    ...shop,
    price: converted,
    currency: "EUR",
    originalPrice: shop.price,
    originalCurrency,
    note: joinNotes(shop.note, `Převedeno z ${originalCurrency}`),
  };
};

const fetchSkinport = async (marketHashName: string): Promise<ShopPrice> => {
  try {
    const items = await getSkinportItems();
    const exact =
      items[marketHashName.toLowerCase()] ?? items[marketHashName] ?? null;
    let item: SkinportItem | null = exact;

    if (!item) {
      const skinportByLookup = new Map<string, SkinportItem>();
      for (const candidate of Object.values(items)) {
        const key = buildSkinportLookupKey(candidate.market_hash_name);
        if (!skinportByLookup.has(key)) {
          skinportByLookup.set(key, candidate);
        }
      }
      item = skinportByLookup.get(buildSkinportLookupKey(marketHashName)) ?? null;
    }

    const price = priceFromItem(item);
    return {
      id: "skinport",
      label: "Skinport",
      price,
      currency: item?.currency ?? "EUR",
      note: item
        ? price === null
          ? "Bez ceny v live feedu"
          : exact
            ? undefined
            : "Normalizovany match"
        : "Není v live Skinport tradable feedu",
      url: item?.market_page ?? item?.item_page ?? "https://skinport.com",
    };
  } catch {
    return {
      id: "skinport",
      label: "Skinport",
      price: null,
      currency: "EUR",
      note: "Nedostupné",
      url: "https://skinport.com",
    };
  }
};

const fetchSteamMarket = async (marketHashName: string): Promise<ShopPrice> => {
  const params = new URLSearchParams({
    appid: "730",
    market_hash_name: marketHashName,
    currency: "3",
  });
  const url = `https://steamcommunity.com/market/priceoverview/?${params.toString()}`;
  try {
    const res = await fetchWithTimeout(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Steam market ${res.status}`);
    const data = await res.json();
    const price = parseMoney(data?.lowest_price ?? data?.median_price);
    return {
      id: "steam",
      label: "Steam Market",
      price,
      currency: "EUR",
      url: `https://steamcommunity.com/market/listings/730/${encodeURIComponent(
        marketHashName
      )}`,
    };
  } catch {
    return {
      id: "steam",
      label: "Steam Market",
      price: null,
      currency: "EUR",
      note: "Nedostupné / rate limit",
      url: `https://steamcommunity.com/market/listings/730/${encodeURIComponent(
        marketHashName
      )}`,
    };
  }
};

const fetchCsFloat = async (marketHashName: string): Promise<ShopPrice> => {
  const searchUrl = buildCsFloatSearchUrl(marketHashName);
  const priceList = await fetchCsFloatPriceList();
  const priceListItem = priceList?.get(marketHashName.trim().toLowerCase());
  const priceListPrice = normalizeMinorUnitPrice(priceListItem?.min_price);

  if (priceListPrice !== null) {
    return {
      id: "csfloat",
      label: "CSFloat",
      price: priceListPrice,
      currency: "USD",
      note:
        parseNumeric(priceListItem?.quantity) !== null
          ? `Lowest listing / ${parseNumeric(priceListItem?.quantity)} active`
          : "Lowest listing",
      url: searchUrl,
    };
  }

  const params = new URLSearchParams({
    market_hash_name: marketHashName,
    sort_by: "lowest_price",
    limit: "1",
    type: "buy_now",
  });
  const url = `https://csfloat.com/api/v1/listings?${params.toString()}`;
  const headers: Record<string, string> = {};
  if (process.env.CSFLOAT_API_KEY) {
    headers.Authorization = process.env.CSFLOAT_API_KEY.trim();
  }
  if (!headers.Authorization) {
    return {
      id: "csfloat",
      label: "CSFloat",
      price: null,
      currency: "EUR",
      note: priceList
        ? "Není v CSFloat price-listu"
        : "Price-list nedostupny / chybi API key",
      url: searchUrl,
    };
  }

  try {
    const res = await fetchWithTimeout(url, { cache: "no-store", headers });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.warn("CSFloat API error", { status: res.status, body });
      return {
        id: "csfloat",
        label: "CSFloat",
        price: null,
        currency: "EUR",
        note:
          res.status === 403
            ? "Vyzaduje API key nebo login"
            : `Nedostupné (${res.status})`,
        url: searchUrl,
      };
    }
    const data = await res.json();
    const listing = (() => {
      if (Array.isArray(data)) return data[0] ?? null;
      if (data && typeof data === "object") {
        const record = data as Record<string, unknown>;
        const buckets = ["data", "listings", "results", "items"];
        for (const bucket of buckets) {
          const value = record[bucket];
          if (Array.isArray(value)) {
            return value[0] ?? null;
          }
        }
      }
      return null;
    })();
    const price = normalizeMinorUnitPrice(
      listing && typeof listing === "object"
        ? (listing as Record<string, unknown>).price
        : null
    );

    return {
      id: "csfloat",
      label: "CSFloat",
      price,
      currency: "USD",
      note: "Nejnižší buy now listing",
      url: searchUrl,
    };
  } catch (err) {
    console.warn("CSFloat API request failed", err);
    return {
      id: "csfloat",
      label: "CSFloat",
      price: null,
      currency: "EUR",
      note: "Nedostupné",
      url: searchUrl,
    };
  }
};

type DMarketAggregated = {
  aggregatedPrices?: Array<{
    title?: string;
    offerBestPrice?:
      | string
      | {
          Currency?: string;
          Amount?: string;
        };
    orderBestPrice?:
      | string
      | {
          Currency?: string;
          Amount?: string;
        };
  }>;
};

const parseDMarketMoney = (value: unknown) => {
  if (!value) return { price: null, currency: null as string | null };
  if (typeof value === "string") {
    return {
      price: normalizeMinorUnitPrice(value),
      currency: null as string | null,
    };
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return {
      price: normalizeMinorUnitPrice(record.Amount ?? record.amount ?? null),
      currency:
        typeof record.Currency === "string"
          ? record.Currency
          : typeof record.currency === "string"
            ? record.currency
            : null,
    };
  }
  return { price: null, currency: null as string | null };
};

const fetchDMarket = async (marketHashName: string): Promise<ShopPrice> => {
  const searchUrl = buildDMarketSearchUrl(marketHashName);
  const rawPublicKey = process.env.DMARKET_PUBLIC_KEY;
  const rawSecretKey = process.env.DMARKET_SECRET_KEY;
  const publicKey = rawPublicKey ? normalizeHexKey(rawPublicKey) : "";
  const secretKey = rawSecretKey ? normalizeHexKey(rawSecretKey) : "";
  if (!publicKey || !secretKey) {
    return {
      id: "dmarket",
      label: "DMarket",
      price: null,
      currency: "EUR",
      note: "Přesná cena vyžaduje API klíč",
      url: searchUrl,
    };
  }
  if (!isHexKey(publicKey) || !isHexKey(secretKey)) {
    return {
      id: "dmarket",
      label: "DMarket",
      price: null,
      currency: "EUR",
      note: "Neplatný formát API klíče",
      url: searchUrl,
    };
  }
  if (publicKey.length !== 64 || (secretKey.length !== 64 && secretKey.length !== 128)) {
    return {
      id: "dmarket",
      label: "DMarket",
      price: null,
      currency: "EUR",
      note: "Neplatná délka API klíče",
      url: searchUrl,
    };
  }

  const path = "/marketplace-api/v1/aggregated-prices";
  const body = JSON.stringify({
    filter: { game: "a8db", titles: [marketHashName] },
    limit: 1,
  });
  const timestamp = Math.floor(Date.now() / 1000).toString();

  try {
    const signature = signDMarket("POST", path, body, timestamp, secretKey);
    const res = await fetchWithTimeout(`https://api.dmarket.com${path}`, {
      method: "POST",
      headers: {
        "X-Api-Key": publicKey,
        "X-Sign-Date": timestamp,
        "X-Request-Sign": `dmar ed25519 ${signature}`,
        "Content-Type": "application/json",
      },
      body,
      cache: "no-store",
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn("DMarket API error", { status: res.status, body: text });
      return {
        id: "dmarket",
        label: "DMarket",
        price: null,
        currency: "EUR",
        note: `Nedostupné (${res.status})`,
        url: searchUrl,
      };
    }
    const data = (await res.json()) as DMarketAggregated;
    const entry =
      data.aggregatedPrices?.find(
        (candidate) =>
          candidate.title?.trim().toLowerCase() ===
          marketHashName.trim().toLowerCase()
      ) ?? data.aggregatedPrices?.[0];
    const exactMatch =
      entry?.title?.trim().toLowerCase() === marketHashName.trim().toLowerCase();
    const bestPrice = parseDMarketMoney(
      entry?.offerBestPrice ?? entry?.orderBestPrice ?? null
    );
    return {
      id: "dmarket",
      label: "DMarket",
      price: exactMatch ? bestPrice.price : null,
      currency: bestPrice.currency ?? "USD",
      note:
        entry?.title && !exactMatch
          ? `Nepřesný match: ${entry.title}`
          : "Best offer price",
      url: searchUrl,
    };
  } catch (err) {
    console.warn("DMarket API request failed", err);
    return {
      id: "dmarket",
      label: "DMarket",
      price: null,
      currency: "EUR",
      note: "Nedostupné / chybí práva",
      url: searchUrl,
    };
  }
};

export async function getShopPrices(marketHashName: string) {
  if (!marketHashName) return [];
  const key = marketHashName.trim().toLowerCase();
  const cached = cache.get(key);
  const now = Date.now();
  if (cached && now - cached.fetchedAt < TTL_MS) {
    return cached.data;
  }

  const [skinport, steam, dmarket, csfloat] = await Promise.all([
    fetchSkinport(marketHashName),
    fetchSteamMarket(marketHashName),
    fetchDMarket(marketHashName),
    fetchCsFloat(marketHashName),
  ]);

  const data = await Promise.all(
    [skinport, steam, dmarket, csfloat].map((shop) => normalizeShopToEur(shop))
  );
  cache.set(key, { data, fetchedAt: now });
  return data;
}

export type { ShopPrice };
