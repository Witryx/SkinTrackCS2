import nacl from "tweetnacl";
import { getSkinportItems, SkinportItem } from "@/app/lib/skinport";

type ShopPrice = {
  id: string;
  label: string;
  price: number | null;
  currency: string;
  url?: string;
  note?: string;
};

type CacheEntry = {
  fetchedAt: number;
  data: ShopPrice[];
};

const cache = new Map<string, CacheEntry>();
const TTL_MS = 1000 * 60 * 5;
const REQUEST_TIMEOUT_MS = 4000;

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

const priceFromItem = (item?: SkinportItem | null) => {
  if (!item) return null;
  return item.min_price ?? item.median_price ?? item.suggested_price ?? null;
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

const fetchSkinport = async (marketHashName: string): Promise<ShopPrice> => {
  try {
    const items = await getSkinportItems();
    const item =
      items[marketHashName.toLowerCase()] ?? items[marketHashName] ?? null;
    const price = priceFromItem(item);
    return {
      id: "skinport",
      label: "Skinport",
      price,
      currency: item?.currency ?? "EUR",
      url: item?.market_page ?? item?.item_page ?? "https://skinport.com",
    };
  } catch (err) {
    return {
      id: "skinport",
      label: "Skinport",
      price: null,
      currency: "EUR",
      note: "Nedostupne",
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
  } catch (err) {
    return {
      id: "steam",
      label: "Steam Market",
      price: null,
      currency: "EUR",
      note: "Nedostupne / rate limit",
      url: `https://steamcommunity.com/market/listings/730/${encodeURIComponent(
        marketHashName
      )}`,
    };
  }
};

const fetchCsFloat = async (marketHashName: string): Promise<ShopPrice> => {
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
      currency: "USD",
      note: "Chybi API key",
      url: "https://csfloat.com/market",
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
        currency: "USD",
        note: `Nedostupne (${res.status})`,
        url: "https://csfloat.com/market",
      };
    }
    const data = await res.json();
    const listing = Array.isArray(data) ? data[0] : null;
    const priceCents = listing?.price ?? null;
    const price =
      typeof priceCents === "number" ? Math.round(priceCents) / 100 : null;

    return {
      id: "csfloat",
      label: "CSFloat",
      price,
      currency: "USD",
      note: "Nejnizsi listing (buy now)",
      url: "https://csfloat.com/market",
    };
  } catch (err) {
    console.warn("CSFloat API request failed", err);
    return {
      id: "csfloat",
      label: "CSFloat",
      price: null,
      currency: "USD",
      note: "Nedostupne",
      url: "https://csfloat.com/market",
    };
  }
};

type DMarketAggregated = {
  aggregatedPrices?: Array<{
    title?: string;
    offerBestPrice?: string;
    orderBestPrice?: string;
  }>;
};

const fetchDMarket = async (marketHashName: string): Promise<ShopPrice> => {
  const rawPublicKey = process.env.DMARKET_PUBLIC_KEY;
  const rawSecretKey = process.env.DMARKET_SECRET_KEY;
  const publicKey = rawPublicKey ? normalizeHexKey(rawPublicKey) : "";
  const secretKey = rawSecretKey ? normalizeHexKey(rawSecretKey) : "";
  if (!publicKey || !secretKey) {
    return {
      id: "dmarket",
      label: "DMarket",
      price: null,
      currency: "USD",
      note: "Chybi API klic",
      url: "https://dmarket.com/ingame-items/item-list/csgo-skins",
    };
  }
  if (!isHexKey(publicKey) || !isHexKey(secretKey)) {
    return {
      id: "dmarket",
      label: "DMarket",
      price: null,
      currency: "USD",
      note: "Neplatny format API klice",
      url: "https://dmarket.com/ingame-items/item-list/csgo-skins",
    };
  }
  if (publicKey.length !== 64 || (secretKey.length !== 64 && secretKey.length !== 128)) {
    return {
      id: "dmarket",
      label: "DMarket",
      price: null,
      currency: "USD",
      note: "Neplatna delka API klice",
      url: "https://dmarket.com/ingame-items/item-list/csgo-skins",
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
        currency: "USD",
        note: `Nedostupne (${res.status})`,
        url: "https://dmarket.com/ingame-items/item-list/csgo-skins",
      };
    }
    const data = (await res.json()) as DMarketAggregated;
    const entry = data.aggregatedPrices?.[0];
    const price = parseMoney(entry?.offerBestPrice ?? entry?.orderBestPrice ?? null);
    return {
      id: "dmarket",
      label: "DMarket",
      price,
      currency: "USD",
      note: "Best offer price",
      url: "https://dmarket.com/ingame-items/item-list/csgo-skins",
    };
  } catch (err) {
    console.warn("DMarket API request failed", err);
    return {
      id: "dmarket",
      label: "DMarket",
      price: null,
      currency: "USD",
      note: "Nedostupne / chybi prava",
      url: "https://dmarket.com/ingame-items/item-list/csgo-skins",
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

  const data = [skinport, steam, dmarket, csfloat];
  cache.set(key, { data, fetchedAt: now });
  return data;
}

export type { ShopPrice };
