import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { normalizeMarketHashForMeta } from "@/app/lib/skin-meta";
import {
  getSkinportItems,
  parseMarketHashName,
  SkinportItem,
} from "@/app/lib/skinport";

type PriceEntry = {
  price: number | null;
  currency: string;
  source: string;
};

type PairingStats = {
  total: number;
  matchedDb: number;
  matchedSkinport: number;
  missing: number;
};

const priceFromItem = (item?: SkinportItem | null) => {
  if (!item) return null;
  return item.min_price ?? item.median_price ?? item.suggested_price ?? null;
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
  matchedDb: 0,
  matchedSkinport: 0,
  missing: 0,
});

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

    const dbRows = await prisma.skin.findMany({
      where: { marketHashName: { in: unique } },
      select: { marketHashName: true, price: true, currency: true },
    });

    const dbByLower = new Map<string, (typeof dbRows)[number]>();
    for (const row of dbRows) {
      dbByLower.set(row.marketHashName.toLowerCase(), row);
    }

    for (const name of unique) {
      const row = dbByLower.get(name.toLowerCase());
      if (!row) continue;
      priceMap[name] = {
        price: row.price ?? null,
        currency: row.currency ?? "EUR",
        source: "db",
      };
      found.add(name);
      stats.matchedDb += 1;
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
          select: { marketHashName: true, price: true, currency: true },
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
          priceMap[name] = {
            price: row.price ?? null,
            currency: row.currency ?? "EUR",
            source: "db-normalized",
          };
          found.add(name);
          stats.matchedDb += 1;
        }
      }
    }

    missing = unique.filter((name) => !found.has(name));
    if (missing.length) {
      const items = await getSkinportItems();
      const skinportByLookup = new Map<string, SkinportItem>();

      for (const item of Object.values(items)) {
        const key = buildLookupKey(item.market_hash_name);
        if (!skinportByLookup.has(key)) {
          skinportByLookup.set(key, item);
        }
      }

      for (const name of missing) {
        const exact = items[name.toLowerCase()] ?? items[name] ?? null;
        const item = exact ?? skinportByLookup.get(buildLookupKey(name)) ?? null;

        if (!item) {
          priceMap[name] = {
            price: null,
            currency: "EUR",
            source: "missing",
          };
          stats.missing += 1;
          continue;
        }

        priceMap[name] = {
          price: priceFromItem(item),
          currency: item.currency ?? "EUR",
          source: exact ? "skinport" : "skinport-normalized",
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
