import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { recordPriceHistory, syncSkinDatabase } from "@/app/lib/skin-database";

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
    const syncResult = await syncSkinDatabase();
    const historyResult = await recordPriceHistory();
    return NextResponse.json(
      {
        message: "Skin sync + price history done.",
        sync: syncResult,
        history: historyResult,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Cron sync failed", error);
    return NextResponse.json(
      { error: "Cron sync failed." },
      { status: 500 }
    );
  }
}

export async function GET() {
  return POST();
}
