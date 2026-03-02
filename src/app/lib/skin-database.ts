import { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "./prisma";
import {
  getSkinportHistory,
  getSkinportItems,
  parseMarketHashName,
  SkinportHistoryItem,
  SkinportItem,
} from "./skinport";
import { resolveRarity } from "./rarity";
import {
  getSkinMetaMap,
  lookupSkinMetaFromParsed,
} from "./skin-meta";
import type { ShopPrice } from "./shop-prices";
import {
  isWeaponMatchingFilter,
  isWeaponInSkinCategory,
  resolveSkinCategory,
  resolveSkinWeaponKey,
} from "./skin-categories";

const SKINPORT_SHOP_NAME = "Skinport";
const SHOP_URLS: Record<string, string> = {
  Skinport: "https://skinport.com",
  "Steam Market": "https://steamcommunity.com/market",
  DMarket: "https://dmarket.com/ingame-items/item-list/csgo-skins",
  CSFloat: "https://csfloat.com/market",
};

const wearFloatRanges: Record<string, { min: number; max: number }> = {
  "Factory New": { min: 0, max: 0.07 },
  "Minimal Wear": { min: 0.07, max: 0.15 },
  "Field-Tested": { min: 0.15, max: 0.38 },
  "Well-Worn": { min: 0.38, max: 0.45 },
  "Battle-Scarred": { min: 0.45, max: 1 },
};

const getFloatRange = (wear?: string | null) => {
  if (!wear) return null;
  const normalized = wear.trim();
  return wearFloatRanges[normalized] ?? null;
};

const priceFromItem = (
  item: SkinportItem,
  history?: SkinportHistoryItem | null
): number | null => {
  return (
    item.min_price ??
    item.median_price ??
    history?.last_7_days?.median ??
    history?.last_7_days?.avg ??
    item.suggested_price ??
    null
  );
};

export type SkinSearchFilters = {
  q?: string;
  minPrice?: number;
  maxPrice?: number;
  rarity?: string;
  category?: string;
  weapon?: string;
  tradable?: boolean;
  sort?: "volume" | "cheapest" | "most-expensive";
  limit?: number;
};

export type SkinSearchResult = {
  id: number;
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

const shopIdCache = new Map<string, number>();

async function getShopId(
  client: PrismaClient,
  name: string,
  url?: string | null
) {
  const normalized = name.trim();
  const cached = shopIdCache.get(normalized);
  if (cached) return cached;
  const shop = await client.shop.upsert({
    where: { name: normalized },
    update: url ? { url } : {},
    create: { name: normalized, url: url ?? null },
  });
  shopIdCache.set(normalized, shop.id);
  return shop.id;
}

async function getSkinportShopId(client: PrismaClient) {
  return getShopId(client, SKINPORT_SHOP_NAME, SHOP_URLS[SKINPORT_SHOP_NAME]);
}

export async function syncSkinDatabase(client: PrismaClient = prisma) {
  const [itemsMap, history, externalSkins] = await Promise.all([
    getSkinportItems(),
    getSkinportHistory(),
    getSkinMetaMap().catch(() => null),
  ]);

  const historyMap = history.reduce<Map<string, SkinportHistoryItem>>(
    (acc, entry) => {
      acc.set(entry.market_hash_name.toLowerCase(), entry);
      return acc;
    },
    new Map()
  );

  const items = Object.values(itemsMap);
  let upserted = 0;
  for (const item of items) {
    const historyEntry =
      historyMap.get(item.market_hash_name.toLowerCase()) ?? null;
    const parsed = parseMarketHashName(item.market_hash_name);
    const floats = getFloatRange(parsed.wear);
    const price = priceFromItem(item, historyEntry);
    const external = lookupSkinMetaFromParsed(externalSkins, parsed.weapon, parsed.skin);
    const rarity = external?.rarity ?? resolveRarity(price);
    const minFloat = external?.minFloat ?? floats?.min ?? null;
    const maxFloat = external?.maxFloat ?? floats?.max ?? null;
    const imageUrl = external?.imageUrl ?? null;

    const payload = {
      marketHashName: item.market_hash_name,
      weapon: parsed.weapon,
      skin: parsed.skin,
      wear: parsed.wear,
      rarity,
      minFloat,
      maxFloat,
      price,
      medianPrice: item.median_price ?? null,
      suggestedPrice: item.suggested_price ?? null,
      quantity: item.quantity ?? null,
      volume7d: historyEntry?.last_7_days?.volume ?? null,
      median7d: historyEntry?.last_7_days?.median ?? null,
      currency: item.currency ?? "EUR",
      itemPage: item.item_page ?? historyEntry?.item_page ?? null,
      marketPage: item.market_page ?? historyEntry?.market_page ?? null,
      imageUrl,
    };

    const record = await client.skin.upsert({
      where: { marketHashName: item.market_hash_name },
      update: payload,
      create: payload,
    });
    upserted += 1;

  }

  return { total: items.length, upserted };
}

export async function upsertSkinFromSkinportName(
  name: string,
  client: PrismaClient = prisma
) {
  if (!name) return null;

  try {
    const [itemsMap, history, externalSkins] = await Promise.all([
      getSkinportItems(),
      getSkinportHistory(),
      getSkinMetaMap().catch(() => null),
    ]);

  const normalized = name.trim().toLowerCase();
  const itemCandidate =
    itemsMap[normalized] ??
    itemsMap[name] ??
    Object.values(itemsMap).find(
      (entry) => entry.market_hash_name.toLowerCase() === normalized
    );

  if (!itemCandidate) return null;

  const historyMap = history.reduce<Map<string, SkinportHistoryItem>>(
    (acc, entry) => {
      acc.set(entry.market_hash_name.toLowerCase(), entry);
      return acc;
    },
    new Map()
  );

  const historyEntry =
    historyMap.get(itemCandidate.market_hash_name.toLowerCase()) ?? null;
  const parsed = parseMarketHashName(itemCandidate.market_hash_name);
  const floats = getFloatRange(parsed.wear);
  const price = priceFromItem(itemCandidate, historyEntry);
  const external = lookupSkinMetaFromParsed(
    externalSkins,
    parsed.weapon,
    parsed.skin
  );
  const rarity = external?.rarity ?? resolveRarity(price);
  const minFloat = external?.minFloat ?? floats?.min ?? null;
  const maxFloat = external?.maxFloat ?? floats?.max ?? null;
  const imageUrl = external?.imageUrl ?? null;

  const payload = {
    marketHashName: itemCandidate.market_hash_name,
    weapon: parsed.weapon,
    skin: parsed.skin,
    wear: parsed.wear,
    rarity,
    minFloat,
    maxFloat,
    price,
    medianPrice: itemCandidate.median_price ?? null,
    suggestedPrice: itemCandidate.suggested_price ?? null,
    quantity: itemCandidate.quantity ?? null,
    volume7d: historyEntry?.last_7_days?.volume ?? null,
    median7d: historyEntry?.last_7_days?.median ?? null,
    currency: itemCandidate.currency ?? "EUR",
    itemPage: itemCandidate.item_page ?? historyEntry?.item_page ?? null,
    marketPage: itemCandidate.market_page ?? historyEntry?.market_page ?? null,
    imageUrl,
  };

    return client.skin.upsert({
      where: { marketHashName: itemCandidate.market_hash_name },
      update: payload,
      create: payload,
    });
  } catch (err) {
    console.error("upsertSkinFromSkinportName failed", err);
    return null;
  }
}

export async function searchSkinsDb(
  {
    q,
    minPrice,
    maxPrice,
    rarity,
    category,
    weapon,
    tradable,
    sort = "volume",
    limit = 60,
  }: SkinSearchFilters,
  client: PrismaClient = prisma
): Promise<SkinSearchResult[]> {
  const where: Prisma.SkinWhereInput = {};

  if (q && q.trim().length >= 2) {
    const search = q.trim();
    where.OR = [
      { marketHashName: { contains: search } },
      { weapon: { contains: search } },
      { skin: { contains: search } },
    ];
  }

  const priceFilter: Prisma.FloatFilter = {};
  if (typeof minPrice === "number" && Number.isFinite(minPrice)) {
    priceFilter.gte = minPrice;
  }
  if (typeof maxPrice === "number" && Number.isFinite(maxPrice)) {
    priceFilter.lte = maxPrice;
  }
  if (Object.keys(priceFilter).length) {
    where.price = priceFilter;
  }

  if (rarity && rarity !== "all") {
    where.rarity = rarity;
  }

  if (tradable) {
    where.quantity = { gt: 0 };
  }
  const resolvedCategory = resolveSkinCategory(category);
  const resolvedWeapon = resolveSkinWeaponKey(weapon);
  const broadCategorySearch = resolvedCategory && (!q || q.trim().length < 2);
  const broadWeaponSearch = resolvedWeapon && (!q || q.trim().length < 2);

  const orderBy =
    sort === "cheapest"
      ? [
          { price: "asc" as const },
          { volume7d: "desc" as const },
        ]
      : sort === "most-expensive"
        ? [
            { price: "desc" as const },
            { volume7d: "desc" as const },
          ]
        : [
            { volume7d: "desc" as const },
            { quantity: "desc" as const },
            { price: "asc" as const },
          ];

  const [results, metaMap] = await Promise.all([
    client.skin.findMany({
      where,
      take:
        broadCategorySearch || broadWeaponSearch
          ? Math.max(limit, 2000)
          : limit,
      orderBy,
    }),
    getSkinMetaMap().catch(() => null),
  ]);

  const comparator =
    sort === "cheapest"
      ? (a: SkinSearchResult, b: SkinSearchResult) =>
          (a.price ?? Number.MAX_SAFE_INTEGER) -
          (b.price ?? Number.MAX_SAFE_INTEGER)
      : sort === "most-expensive"
        ? (a: SkinSearchResult, b: SkinSearchResult) =>
            (b.price ?? Number.MIN_SAFE_INTEGER) -
            (a.price ?? Number.MIN_SAFE_INTEGER)
        : (a: SkinSearchResult, b: SkinSearchResult) =>
            (b.volume7d ?? 0) - (a.volume7d ?? 0) ||
            (b.quantity ?? 0) - (a.quantity ?? 0) ||
            (a.price ?? Number.MAX_SAFE_INTEGER) -
              (b.price ?? Number.MAX_SAFE_INTEGER);

  const normalized = results
    .map<SkinSearchResult>((skin) => {
      const meta = lookupSkinMetaFromParsed(
        metaMap,
        skin.weapon,
        skin.skin,
        skin.marketHashName
      );
      const resolvedRarity =
        meta?.rarity ?? skin.rarity ?? resolveRarity(skin.price);
      return {
        id: skin.id,
        name: skin.marketHashName,
        weapon: skin.weapon,
        skin: skin.skin,
        wear: skin.wear,
        rarity: resolvedRarity,
        minFloat: skin.minFloat ?? meta?.minFloat ?? null,
        maxFloat: skin.maxFloat ?? meta?.maxFloat ?? null,
        price: skin.price ?? null,
        medianPrice: skin.medianPrice ?? null,
        suggestedPrice: skin.suggestedPrice ?? null,
        volume7d: skin.volume7d ?? null,
        median7d: skin.median7d ?? null,
        quantity: skin.quantity ?? null,
        itemPage: skin.itemPage,
        marketPage: skin.marketPage,
      };
    })
    .filter((item) => {
      if (!resolvedCategory) return true;
      return isWeaponInSkinCategory(item.weapon, item.name, resolvedCategory);
    })
    .filter((item) => {
      if (!resolvedWeapon) return true;
      return isWeaponMatchingFilter(item.weapon, item.name, resolvedWeapon);
    })
    .filter((item) => {
      if (!rarity || rarity === "all") return true;
      return item.rarity === rarity;
    })
    .sort(comparator)
    .slice(0, limit);

  return normalized;
}

export async function getTrendingSkinsFromDb(limit = 33) {
  const results = await searchSkinsDb({ limit, sort: "volume" });
  const mapped = results.map((skin) => ({
    name: skin.name,
    weapon: skin.weapon,
    skin: skin.skin,
    wear: skin.wear ?? null,
    price: skin.price ?? null,
    volume7d: skin.volume7d ?? null,
    median7d: skin.median7d ?? null,
    quantity: skin.quantity ?? null,
    rarity: skin.rarity,
    itemPage: skin.itemPage ?? undefined,
    marketPage: skin.marketPage ?? undefined,
  }));

  return {
    featured: mapped.slice(0, 3),
    trending: mapped.slice(3, limit),
  };
}

export async function getSkinFromDb(
  name: string,
  client: PrismaClient = prisma
) {
  if (!name) return null;

  const [record, metaMap] = await Promise.all([
    client.skin.findFirst({
      where: { marketHashName: name },
    }),
    getSkinMetaMap().catch(() => null),
  ]);

  if (!record) return null;

  const meta = lookupSkinMetaFromParsed(
    metaMap,
    record.weapon,
    record.skin,
    record.marketHashName
  );

  return {
    id: record.id,
    name: record.marketHashName,
    weapon: record.weapon,
    skin: record.skin,
    wear: record.wear,
    rarity: meta?.rarity ?? record.rarity ?? resolveRarity(record.price),
    minFloat: record.minFloat ?? meta?.minFloat ?? null,
    maxFloat: record.maxFloat ?? meta?.maxFloat ?? null,
    price: record.price ?? null,
    minPrice: null,
    maxPrice: null,
    meanPrice: null,
    medianPrice: record.medianPrice ?? null,
    suggestedPrice: record.suggestedPrice ?? null,
    quantity: record.quantity ?? null,
    volume7d: record.volume7d ?? null,
    median7d: record.median7d ?? null,
    itemPage: record.itemPage,
    marketPage: record.marketPage,
    currency: record.currency,
  };
}

export type PriceHistoryPoint = {
  date: string;
  price: number;
};

const getPriceHistoryModel = (client: PrismaClient) => {
  const anyClient = client as PrismaClient & {
    priceHistory?: {
      createMany: (args: { data: Array<Record<string, unknown>> }) => Promise<{ count: number }>;
      findMany: (args: Record<string, unknown>) => Promise<Array<Record<string, unknown>>>;
    };
    priceSnapshot?: {
      createMany: (args: { data: Array<Record<string, unknown>> }) => Promise<{ count: number }>;
      findMany: (args: Record<string, unknown>) => Promise<Array<Record<string, unknown>>>;
    };
  };
  return anyClient.priceHistory ?? anyClient.priceSnapshot ?? null;
};

export async function recordPriceHistory(client: PrismaClient = prisma) {
  const skinportShopId = await getSkinportShopId(client);
  const model = getPriceHistoryModel(client);
  if (!model) {
    return { total: 0, inserted: 0, capturedAt: new Date() };
  }
  const skins = await client.skin.findMany({
    where: { price: { not: null } },
    select: { id: true, price: true, currency: true },
  });

  const capturedAt = new Date();
  const data: Array<{
    skinId: number;
    shopId: number;
    currency: string;
    price: number;
    capturedAt: Date;
  }> = [];

  for (const skin of skins) {
    if (skin.price === null) continue;
    data.push({
      skinId: skin.id,
      shopId: skinportShopId,
      currency: skin.currency ?? "EUR",
      price: skin.price,
      capturedAt,
    });
  }

  const BATCH_SIZE = 1000;
  let inserted = 0;
  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    const chunk = data.slice(i, i + BATCH_SIZE);
    const result = await model.createMany({ data: chunk });
    inserted += result.count;
  }

  return { total: data.length, inserted, capturedAt };
}

export async function recordSkinPriceHistory(
  marketHashName: string,
  client: PrismaClient = prisma
) {
  if (!marketHashName) return { inserted: 0 };
  const model = getPriceHistoryModel(client);
  if (!model) return { inserted: 0 };

  try {
    const skin = await client.skin.findUnique({
      where: { marketHashName },
      select: { id: true, price: true, currency: true },
    });

    if (!skin || skin.price === null) return { inserted: 0 };

    const skinportShopId = await getSkinportShopId(client);
    const result = await model.createMany({
      data: [
        {
          skinId: skin.id,
          shopId: skinportShopId,
          currency: skin.currency ?? "EUR",
          price: skin.price,
          capturedAt: new Date(),
        },
      ],
    });

    return { inserted: result.count };
  } catch (err) {
    console.error("recordSkinPriceHistory failed", err);
    return { inserted: 0 };
  }
}

export async function recordShopPriceHistory(
  marketHashName: string,
  shopPrices: ShopPrice[],
  client: PrismaClient = prisma
) {
  if (!marketHashName || !shopPrices.length) return { inserted: 0 };
  const model = getPriceHistoryModel(client);
  if (!model) return { inserted: 0 };

  try {
    const skin = await client.skin.findUnique({
      where: { marketHashName },
      select: { id: true },
    });
    if (!skin) return { inserted: 0 };

    const hasNumericPrice = (
      shop: ShopPrice
    ): shop is ShopPrice & { price: number } =>
      typeof shop.price === "number" && Number.isFinite(shop.price);
    const valid = shopPrices.filter(hasNumericPrice);
    if (!valid.length) return { inserted: 0 };

    const shopIds = await Promise.all(
      valid.map((shop) =>
        getShopId(
          client,
          shop.label,
          shop.url ?? SHOP_URLS[shop.label] ?? null
        )
      )
    );

    const capturedAt = new Date();
    const recentSince = new Date(capturedAt.getTime() - 1000 * 60 * 10);
    const recentRows = (await model.findMany({
      where: {
        skinId: skin.id,
        shopId: { in: shopIds },
        capturedAt: { gte: recentSince },
      },
      orderBy: { capturedAt: "desc" },
      select: { shopId: true, price: true, capturedAt: true },
    })) as Array<{ shopId: number; price: number; capturedAt: Date }>;

    const recentByShop = new Map<number, { price: number; capturedAt: Date }>();
    for (const row of recentRows) {
      if (!recentByShop.has(row.shopId)) {
        recentByShop.set(row.shopId, { price: row.price, capturedAt: row.capturedAt });
      }
    }

    const data: Array<{
      skinId: number;
      shopId: number;
      currency: string;
      price: number;
      capturedAt: Date;
    }> = [];

    valid.forEach((shop, index) => {
      const shopId = shopIds[index];
      const recent = recentByShop.get(shopId);
      if (recent && recent.price === shop.price) return;
      data.push({
        skinId: skin.id,
        shopId,
        currency: shop.currency ?? "EUR",
        price: shop.price as number,
        capturedAt,
      });
    });

    if (!data.length) return { inserted: 0 };
    const result = await model.createMany({ data });
    return { inserted: result.count };
  } catch (err) {
    console.error("recordShopPriceHistory failed", err);
    return { inserted: 0 };
  }
}

export async function getSkinPriceHistory(
  marketHashName: string,
  days = 90,
  shopName: string | null = SKINPORT_SHOP_NAME,
  client: PrismaClient = prisma
) {
  if (!marketHashName) return { points: [], currency: "EUR" };

  try {
    const skin = await client.skin.findUnique({
      where: { marketHashName },
      select: { id: true, currency: true },
    });

    if (!skin) return { points: [], currency: "EUR" };

    const model = getPriceHistoryModel(client);
    if (!model) return { points: [], currency: skin.currency ?? "EUR" };

    const shopId =
      shopName && shopName.trim().length
        ? await getShopId(client, shopName, SHOP_URLS[shopName])
        : null;

    const since = new Date();
    since.setDate(since.getDate() - days);

    const where: {
      skinId: number;
      capturedAt: { gte: Date };
      shopId?: number;
    } = {
      skinId: skin.id,
      capturedAt: { gte: since },
    };
    if (shopId) {
      where.shopId = shopId;
    }

    const rows = (await model.findMany({
      where,
      orderBy: { capturedAt: "asc" },
      select: { capturedAt: true, price: true, currency: true },
    })) as Array<{ capturedAt: Date; price: number; currency: string }>;

    const points = rows.map((row) => ({
      date: row.capturedAt.toISOString(),
      price: row.price,
    }));
    const currency = rows.at(-1)?.currency ?? skin.currency ?? "EUR";

    return { points, currency };
  } catch (err) {
    console.error("getSkinPriceHistory failed", err);
    return { points: [], currency: "EUR" };
  }
}
