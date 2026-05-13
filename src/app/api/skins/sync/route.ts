import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { syncSkinDatabase } from "@/app/lib/skin-database";
import { processWishlistPriceChanges } from "@/app/lib/wishlist-notifications";

export const dynamic = "force-dynamic";

function isAuthorized(headersList: Headers) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // open when no secret configured
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
    const result = await syncSkinDatabase();
    const notifications = await processWishlistPriceChanges(result.priceChanges);
    return NextResponse.json(
      {
        message: "Skin databaze aktualizovana ze Skinport API",
        upserted: result.upserted,
        total: result.total,
        priceChanges: result.priceChanges.length,
        notifications,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Skin sync failed", error);
    return NextResponse.json(
      { error: "Synchronizace skinu selhala." },
      { status: 500 }
    );
  }
}

export async function GET() {
  return POST();
}
