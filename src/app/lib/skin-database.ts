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
  normalizeParsedForMeta,
} from "./skin-meta";

const SKINPORT_SHOP_NAME = "Skinport";

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

let cachedSkinportShopId: number | null = null;

async function getSkinportShopId(client: PrismaClient) {
  if (cachedSkinportShopId) return cachedSkinportShopId;
  const shop = await client.shop.upsert({
    where: { name: SKINPORT_SHOP_NAME },
    update: {},
    create: { name: SKINPORT_SHOP_NAME, url: "https://skinport.com" },
  });
  cachedSkinportShopId = shop.id;
  return shop.id;
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
  let snapshots = 0;
  const skinportShopId = await getSkinportShopId(client);

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

    const priceForSnapshot =
      payload.price ?? payload.medianPrice ?? payload.suggestedPrice;
    if (priceForSnapshot !== null) {
      await client.priceSnapshot.create({
        data: {
          skinId: record.id,
          shopId: skinportShopId,
          currency: payload.currency,
          price: priceForSnapshot,
        },
      });
      snapshots += 1;
    }
  }

  return { total: items.length, upserted, snapshots };
}

export async function searchSkinsDb(
  {
    q,
    minPrice,
    maxPrice,
    rarity,
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
      take: limit,
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
      if (!rarity || rarity === "all") return true;
      return item.rarity === rarity;
    })
    .sort(comparator)
    .slice(0, limit);

  return normalized;
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
