import { NextRequest, NextResponse } from "next/server";
import { getSkinPriceHistory } from "@/app/lib/skin-database";

export const dynamic = "force-dynamic";

const parseDays = (value: string | null) => {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed)) return 90;
  return Math.min(Math.max(parsed, 1), 365);
};

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("name")?.trim();
  if (!name) {
    return NextResponse.json(
      { points: [], currency: "EUR", error: "Missing skin name." },
      { status: 400 }
    );
  }

  const days = parseDays(req.nextUrl.searchParams.get("days"));

  try {
    const history = await getSkinPriceHistory(name, days);
    return NextResponse.json(history, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Price history API failed", error);
    return NextResponse.json(
      { points: [], currency: "EUR", error: "Price history failed." },
      { status: 200 }
    );
  }
}
