import { NextRequest, NextResponse } from "next/server";
import {
  recordShopPriceHistory,
} from "@/app/lib/skin-database";
import { getShopPrices, type ShopPrice } from "@/app/lib/shop-prices";

export const dynamic = "force-dynamic";

const sortShopPrices = (shopPrices: ShopPrice[]) =>
  [...shopPrices].sort((a, b) => {
    if (a.price === null && b.price === null) {
      return a.label.localeCompare(b.label);
    }
    if (a.price === null) return 1;
    if (b.price === null) return -1;
    return a.price - b.price;
  });

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("name")?.trim();
  if (!name) {
    return NextResponse.json(
      { shopPrices: [], error: "Missing skin name." },
      { status: 400 }
    );
  }

  try {
    const shopPrices = sortShopPrices(await getShopPrices(name));
    if (shopPrices.length > 0) {
      await recordShopPriceHistory(name, shopPrices).catch((error) => {
        console.error("recordShopPriceHistory async failed", error);
      });
    }

    return NextResponse.json(
      { shopPrices },
      {
        headers: {
          "Cache-Control": "s-maxage=120, stale-while-revalidate=300",
        },
      }
    );
  } catch (error) {
    console.error("Shop prices API failed", error);
    return NextResponse.json(
      { shopPrices: [], error: "Shop prices failed." },
      { status: 200 }
    );
  }
}
