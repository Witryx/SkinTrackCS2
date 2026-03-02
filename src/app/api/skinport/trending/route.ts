import { NextResponse } from "next/server";
import { getTrendingSkins } from "@/app/lib/skinport";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getTrendingSkins();
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
