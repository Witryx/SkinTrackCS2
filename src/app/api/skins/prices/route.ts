import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { normalizeMarketHashForMeta } from "@/app/lib/skin-meta";
import {
  getSkinportHistory,
  getSkinportItems,
  parseMarketHashName,
  SkinportHistoryItem,
  SkinportItem,
} from "@/app/lib/skinport";

type PriceEntry = {
  price: number | null;
  currency: string;
  source: string;
  updatedAt: string | null;
  stale: boolean;
};

type PairingStats = {
  total: number;
  matchedDbFresh: number;
  matchedDbStaleFallback: number;
  matchedSkinport: number;
  missing: number;
};

const DB_PRICE_TTL_MS = 1000 * 60 * 30;

const priceFromItem = (item?: SkinportItem | null) => {
  if (!item) return null;
  return item.min_price ?? item.median_price ?? item.suggested_price ?? null;
};

const priceFromHistory = (item?: SkinportHistoryItem | null) => {
  if (!item) return null;
  return (
    item.last_7_days?.median ??
    item.last_7_days?.avg ??
    item.last_30_days?.median ??
    item.last_30_days?.avg ??
    item.last_90_days?.median ??
    item.last_90_days?.avg ??
    null
  );
};

const buildLookupKey = (marketHashName: string) => {
  const parsed = parseMarketHashName(marketHashName);
  const weaponLower = parsed.weapon.toLowerCase();
  const wear = (parsed.wear ?? "").toLowerCase();
  const stattrak = weaponLower.includes("stattrak") ? "st" : "nost";
  const souvenir = weaponLower.includes("souvenir") ? "sou" : "nos";
  const normalized = normalizeMarketHashForMeta(marketHashName);
  return `${normalized}|${wear}|${stattrak}|${souvenir}`;
};

const emptyStats = (): PairingStats => ({
  total: 0,
  matchedDbFresh: 0,
  matchedDbStaleFallback: 0,
  matchedSkinport: 0,
  missing: 0,
});

const isDbPriceFresh = (updatedAt: Date | null | undefined) => {
  if (!(updatedAt instanceof Date)) return false;
  return Date.now() - updatedAt.getTime() < DB_PRICE_TTL_MS;
};

const unixToIso = (value: number | null | undefined) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const ms = value > 1_000_000_000_000 ? value : value * 1000;
  return new Date(ms).toISOString();
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const names: string[] = Array.isArray(body?.names) ? body.names : [];
    const stats = emptyStats();

    if (!names.length) {
      return NextResponse.json({ prices: {}, stats });
    }

    const unique = Array.from(
      new Set(
        names
          .map((name) => (typeof name === "string" ? name.trim() : ""))
          .filter(Boolean)
      )
    );

    if (!unique.length) {
      return NextResponse.json({ prices: {}, stats });
    }

    stats.total = unique.length;

    const priceMap: Record<string, PriceEntry> = {};
    const found = new Set<string>();
    const staleDbRows = new Map<string, (typeof dbRows)[number]>();

    const dbRows = await prisma.skin.findMany({
      where: { marketHashName: { in: unique } },
      select: {
        marketHashName: true,
        price: true,
        currency: true,
        updatedAt: true,
      },
    });

    const dbByLower = new Map<string, (typeof dbRows)[number]>();
    for (const row of dbRows) {
      dbByLower.set(row.marketHashName.toLowerCase(), row);
    }

    for (const name of unique) {
      const row = dbByLower.get(name.toLowerCase());
      if (!row) continue;
      if (isDbPriceFresh(row.updatedAt)) {
        priceMap[name] = {
          price: row.price ?? null,
          currency: row.currency ?? "EUR",
          source: "db",
          updatedAt: row.updatedAt?.toISOString() ?? null,
          stale: false,
        };
        found.add(name);
        stats.matchedDbFresh += 1;
      } else {
        staleDbRows.set(name.toLowerCase(), row);
      }
    }

    let missing = unique.filter((name) => !found.has(name));
    if (missing.length) {
      const missingSkins = Array.from(
        new Set(
          missing
            .map((name) => parseMarketHashName(name).skin)
            .filter((skin) => skin.length > 0)
        )
      );

      if (missingSkins.length) {
        const dbCandidates = await prisma.skin.findMany({
          where: { skin: { in: missingSkins } },
          select: {
            marketHashName: true,
            price: true,
            currency: true,
            updatedAt: true,
          },
        });

        const dbByLookup = new Map<string, (typeof dbCandidates)[number]>();
        for (const row of dbCandidates) {
          const key = buildLookupKey(row.marketHashName);
          if (!dbByLookup.has(key)) {
            dbByLookup.set(key, row);
          }
        }

        for (const name of missing) {
          const row = dbByLookup.get(buildLookupKey(name));
          if (!row) continue;
          if (isDbPriceFresh(row.updatedAt)) {
            priceMap[name] = {
              price: row.price ?? null,
              currency: row.currency ?? "EUR",
              source: "db-normalized",
              updatedAt: row.updatedAt?.toISOString() ?? null,
              stale: false,
            };
            found.add(name);
            stats.matchedDbFresh += 1;
          } else {
            staleDbRows.set(name.toLowerCase(), row);
          }
        }
      }
    }

    missing = unique.filter((name) => !found.has(name));
    if (missing.length) {
      const [items, history] = await Promise.all([
        getSkinportItems(),
        getSkinportHistory().catch(() => []),
      ]);
      const skinportByLookup = new Map<string, SkinportItem>();
      const historyByLower = new Map<string, SkinportHistoryItem>();
      const historyByLookup = new Map<string, SkinportHistoryItem>();

      for (const item of Object.values(items)) {
        const key = buildLookupKey(item.market_hash_name);
        if (!skinportByLookup.has(key)) {
          skinportByLookup.set(key, item);
        }
      }

      for (const item of history) {
        historyByLower.set(item.market_hash_name.toLowerCase(), item);
        const key = buildLookupKey(item.market_hash_name);
        if (!historyByLookup.has(key)) {
          historyByLookup.set(key, item);
        }
      }

      for (const name of missing) {
        const exact = items[name.toLowerCase()] ?? items[name] ?? null;
        const item = exact ?? skinportByLookup.get(buildLookupKey(name)) ?? null;
        const exactHistory = historyByLower.get(name.toLowerCase()) ?? null;
        const historyItem =
          exactHistory ?? historyByLookup.get(buildLookupKey(name)) ?? null;
        const itemPrice = priceFromItem(item);
        const historyPrice = priceFromHistory(historyItem);

        if (item && itemPrice !== null) {
          priceMap[name] = {
            price: itemPrice,
            currency: item.currency ?? "EUR",
            source: exact ? "skinport" : "skinport-normalized",
            updatedAt: unixToIso(item.updated_at),
            stale: false,
          };
          stats.matchedSkinport += 1;
          continue;
        }

        if (historyPrice !== null) {
          priceMap[name] = {
            price: historyPrice,
            currency: historyItem?.currency ?? item?.currency ?? "EUR",
            source: exactHistory ? "skinport-history" : "skinport-history-normalized",
            updatedAt: null,
            stale: false,
          };
          stats.matchedSkinport += 1;
          continue;
        }

        const staleRow = staleDbRows.get(name.toLowerCase()) ?? null;
        if (staleRow) {
          priceMap[name] = {
            price: staleRow.price ?? null,
            currency: staleRow.currency ?? "EUR",
            source: "db-stale",
            updatedAt: staleRow.updatedAt?.toISOString() ?? null,
            stale: true,
          };
          stats.matchedDbStaleFallback += 1;
          continue;
        }

        if (!item) {
          priceMap[name] = {
            price: null,
            currency: "EUR",
            source: "missing",
            updatedAt: null,
            stale: false,
          };
          stats.missing += 1;
          continue;
        }

        priceMap[name] = {
          price: itemPrice,
          currency: item.currency ?? "EUR",
          source: exact ? "skinport" : "skinport-normalized",
          updatedAt: unixToIso(item.updated_at),
          stale: false,
        };
        stats.matchedSkinport += 1;
      }
    }

    return NextResponse.json({ prices: priceMap, stats });
  } catch (error) {
    console.error("Price lookup failed:", error);
    return NextResponse.json(
      { prices: {}, stats: emptyStats(), error: "Price lookup failed" },
      { status: 500 }
    );
  }
}
