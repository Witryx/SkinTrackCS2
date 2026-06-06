import { NextRequest, NextResponse } from "next/server";
import { withTimeout } from "@/app/lib/async-timeout";
import { searchSkinsDb } from "@/app/lib/skin-database";
import { searchSkinsLocal } from "@/app/lib/skin-catalog";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limitParam = parseInt(searchParams.get("limit") ?? "50", 10);
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 2000) : 50;

  const dbItems = await withTimeout(
    searchSkinsDb({ limit, sort: "volume" }),
    250,
    null
  );
  if (Array.isArray(dbItems) && dbItems.length) {
    return NextResponse.json({ items: dbItems, source: "db" });
  }

  try {
    const items = await searchSkinsLocal({ limit, sort: "volume" });
    return NextResponse.json({ items, fallback: "local" });
  } catch (error) {
    console.error("Local catalog listing failed", error);
    return NextResponse.json({ items: [] });
  }
}
