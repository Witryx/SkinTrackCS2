import { NextRequest, NextResponse } from "next/server";
import { searchSkinsDb } from "@/app/lib/skin-database";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limitParam = parseInt(searchParams.get("limit") ?? "50", 10);
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 200) : 50;

  const items = await searchSkinsDb({ limit, sort: "volume" });
  return NextResponse.json({ items });
}
