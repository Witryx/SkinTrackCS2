import { NextResponse } from "next/server";
import { withTimeout } from "@/app/lib/async-timeout";
import { getTrendingSkins } from "@/app/lib/skinport";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await withTimeout(getTrendingSkins(), 1800, null);
    if (!data) {
      return NextResponse.json(
        { error: "Nepodarilo se nacist data ze Skinport API." },
        { status: 504 }
      );
    }

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (error) {
    console.error("Skinport trending failed", error);
    return NextResponse.json(
      { error: "Nepodarilo se nacist data ze Skinport API." },
      { status: 500 }
    );
  }
}
