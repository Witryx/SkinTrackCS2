import { NextRequest, NextResponse } from "next/server";
import { searchSkinsDb } from "@/app/lib/skin-database";
import { searchSkins } from "@/app/lib/skinport";

const parseNumberParam = (value: string | null) => {
  if (value === null) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const parseIntParam = (value: string | null) => {
  if (value === null) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export async function GET(req: NextRequest) {
  try {
    if (!req?.url) {
      return NextResponse.json(
        { items: [], error: "Invalid request: missing URL." },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(req.url);

    const rawQ = searchParams.get("q");
    if (rawQ === null) {
      return NextResponse.json(
        { items: [], error: "Missing required query parameter 'q'." },
        { status: 400 }
      );
    }

    const q = rawQ.trim();
    const rarity = searchParams.get("rarity") ?? undefined;
    const minPrice = parseNumberParam(searchParams.get("minPrice"));
    const maxPrice = parseNumberParam(searchParams.get("maxPrice"));
    const limit = parseIntParam(searchParams.get("limit"));
    const sortParam = searchParams.get("sort");
    const sort: "volume" | "cheapest" | "most-expensive" =
      sortParam === "cheapest" || sortParam === "most-expensive" ? sortParam : "volume";
    const tradable = searchParams.get("tradable") === "1";

    const hasFilters =
      (rarity && rarity !== "all") ||
      minPrice !== undefined ||
      maxPrice !== undefined;

    if (q.length < 2 && !hasFilters) {
      return NextResponse.json({ items: [] });
    }

    const baseFilters = {
      q,
      rarity,
      minPrice,
      maxPrice,
      limit,
      sort,
      tradable,
    };

    try {
      const items = await searchSkinsDb(baseFilters);
      if (!Array.isArray(items)) {
        console.error("Skin DB search returned a non-array response", { items });
        // Continue to fallback
      } else {
        return NextResponse.json({ items });
      }
    } catch (error) {
      console.error("Skin DB search failed, falling back to Skinport live API", error);
    }

    // Fallback to external API
    try {
      const items = await searchSkins(baseFilters);
      if (!Array.isArray(items)) {
        console.error("Skinport fallback returned a non-array response", { items });
        return NextResponse.json({ items: [], fallback: "skinport" });
      }

      return NextResponse.json({ items, fallback: "skinport" });
    } catch (fallbackErr) {
      console.error("Skinport fallback search failed", fallbackErr);
      return NextResponse.json({ items: [], fallback: "skinport" });
    }
  } catch (err) {
    console.error("Unhandled error in skins search handler", err);
    return NextResponse.json(
      { items: [], error: "Unexpected server error while processing skin search." },
      { status: 200 }
    );
  }
}
