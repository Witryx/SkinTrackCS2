import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { recordPriceHistory } from "@/app/lib/skin-database";

export const dynamic = "force-dynamic";

function isAuthorized(headersList: Headers) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const provided =
    headersList.get("x-cron-secret") || headersList.get("authorization");
  return provided === secret;
}

export async function POST() {
  const headersList = headers();
  if (!isAuthorized(headersList)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await recordPriceHistory();
    return NextResponse.json(
      {
        message: "Historicke ceny ulozeny.",
        inserted: result.inserted,
        total: result.total,
        capturedAt: result.capturedAt,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Price history sync failed", error);
    return NextResponse.json(
      { error: "Ukladani historickych cen selhalo." },
      { status: 500 }
    );
  }
}

export async function GET() {
  return POST();
}
