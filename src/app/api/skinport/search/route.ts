import { NextRequest, NextResponse } from "next/server";
import { searchSkins } from "@/app/lib/skinport";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const minPrice = parseFloat(searchParams.get("minPrice") ?? "");
  const maxPrice = parseFloat(searchParams.get("maxPrice") ?? "");
  const limit = parseInt(searchParams.get("limit") ?? "");
  const sortParam = searchParams.get("sort") as "volume" | "cheapest" | null;
  const tradable = searchParams.get("tradable") === "1";

  if (!q || q.trim().length < 2) {
    return NextResponse.json({ items: [] });
  }

  try {
    const items = await searchSkins({
      q,
      minPrice: Number.isFinite(minPrice) ? minPrice : undefined,
      maxPrice: Number.isFinite(maxPrice) ? maxPrice : undefined,
      limit: Number.isFinite(limit) ? limit : undefined,
      sort: sortParam ?? "volume",
      tradable,
    });
    return NextResponse.json({ items });
  } catch (error) {
    console.error("Skinport search failed", error);
    return NextResponse.json(
      { error: "Nepodarilo se nacist data ze Skinport API." },
      { status: 500 }
    );
  }
}
