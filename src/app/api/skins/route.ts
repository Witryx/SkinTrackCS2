import { NextRequest, NextResponse } from "next/server";
import { searchSkinsDb } from "@/app/lib/skin-database";
import { searchSkinsLocal } from "@/app/lib/skin-catalog";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limitParam = parseInt(searchParams.get("limit") ?? "50", 10);
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 2000) : 50;

  try {
    const items = await searchSkinsDb({ limit, sort: "volume" });
    if (Array.isArray(items) && items.length) {
      return NextResponse.json({ items });
    }
  } catch (error) {
    console.error("Skin DB listing failed, falling back to local catalog", error);
  }

  try {
    const items = await searchSkinsLocal({ limit, sort: "volume" });
    return NextResponse.json({ items, fallback: "local" });
  } catch (error) {
    console.error("Local catalog listing failed", error);
    return NextResponse.json({ items: [] });
  }
}
