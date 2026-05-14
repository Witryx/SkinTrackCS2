import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { isCronAuthorized } from "@/app/lib/cron-auth";
import { recordPriceHistory } from "@/app/lib/skin-database";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST() {
  const headersList = headers();
  if (!isCronAuthorized(headersList)) {
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
