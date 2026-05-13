import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { getSharpPriceChangeThresholdPercent } from "@/app/lib/price-alerts";
import { upsertSkinFromSkinportName } from "@/app/lib/skin-database";
import { getOrCreateSteamUser, normalizeSteamId } from "@/app/lib/user-auth";

export const dynamic = "force-dynamic";

type FavoriteWithSkin = Prisma.FavoriteGetPayload<{
  include: { skin: true };
}>;

const mapWishlistItem = (favorite: FavoriteWithSkin) => ({
  addedAt: favorite.createdAt.toISOString(),
  emailAlertsEnabled: favorite.emailAlertsEnabled,
  skin: {
    id: favorite.skin.id,
    name: favorite.skin.marketHashName,
    weapon: favorite.skin.weapon,
    skin: favorite.skin.skin,
    wear: favorite.skin.wear,
    rarity: favorite.skin.rarity,
    minFloat: favorite.skin.minFloat,
    maxFloat: favorite.skin.maxFloat,
    price: favorite.skin.price,
    medianPrice: favorite.skin.medianPrice,
    suggestedPrice: favorite.skin.suggestedPrice,
    volume7d: favorite.skin.volume7d,
    median7d: favorite.skin.median7d,
    quantity: favorite.skin.quantity,
    currency: favorite.skin.currency,
    itemPage: favorite.skin.itemPage,
    marketPage: favorite.skin.marketPage,
    imageUrl: favorite.skin.imageUrl,
    updatedAt: favorite.skin.updatedAt.toISOString(),
  },
});

const parseMarketHashName = (value: unknown) =>
  typeof value === "string" && value.trim().length ? value.trim() : null;

const parseSkinId = (value: unknown) => {
  if (typeof value !== "number" && typeof value !== "string") return null;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const parseBoolean = (value: unknown) =>
  typeof value === "boolean" ? value : null;

async function resolveSkin(input: { skinId?: unknown; marketHashName?: unknown }) {
  const skinId = parseSkinId(input.skinId);
  const marketHashName = parseMarketHashName(input.marketHashName);

  if (skinId) {
    const skin = await prisma.skin.findUnique({ where: { id: skinId } });
    if (skin) return skin;
  }

  if (!marketHashName) return null;

  const existing = await prisma.skin.findUnique({
    where: { marketHashName },
  });
  if (existing) return existing;

  return upsertSkinFromSkinportName(marketHashName);
}

export async function GET(req: NextRequest) {
  const steamId = normalizeSteamId(req.nextUrl.searchParams.get("steamId"));
  if (!steamId) {
    return NextResponse.json(
      { items: [], email: null, error: "Missing SteamID." },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { steamId },
    include: {
      favorites: {
        include: { skin: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  return NextResponse.json({
    email: user?.email ?? null,
    sharpThresholdPercent: getSharpPriceChangeThresholdPercent(),
    items: user?.favorites.map(mapWishlistItem) ?? [],
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const user = await getOrCreateSteamUser(body?.steamId);

  if (!user) {
    return NextResponse.json({ error: "Missing SteamID." }, { status: 400 });
  }

  const skin = await resolveSkin({
    skinId: body?.skinId,
    marketHashName: body?.marketHashName,
  });

  if (!skin) {
    return NextResponse.json(
      { error: "Skin se nepodarilo najit v databazi." },
      { status: 404 }
    );
  }

  const favorite = await prisma.favorite.upsert({
    where: {
      userId_skinId: {
        userId: user.id,
        skinId: skin.id,
      },
    },
    update: {},
    create: {
      userId: user.id,
      skinId: skin.id,
    },
    include: { skin: true },
  });

  return NextResponse.json({
    item: mapWishlistItem(favorite),
  });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const steamId = normalizeSteamId(body?.steamId);
  if (!steamId) {
    return NextResponse.json({ error: "Missing SteamID." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { steamId } });
  if (!user) {
    return NextResponse.json({ error: "Uzivatel nebyl nalezen." }, { status: 404 });
  }

  const skin = await resolveSkin({
    skinId: body?.skinId,
    marketHashName: body?.marketHashName,
  });
  if (!skin) {
    return NextResponse.json({ error: "Skin nebyl nalezen." }, { status: 404 });
  }

  const emailAlertsEnabled = parseBoolean(body?.emailAlertsEnabled);
  if (emailAlertsEnabled === null) {
    return NextResponse.json(
      { error: "Neplatna hodnota nastaveni alertu." },
      { status: 400 }
    );
  }

  const existing = await prisma.favorite.findUnique({
    where: {
      userId_skinId: {
        userId: user.id,
        skinId: skin.id,
      },
    },
    select: { userId: true },
  });
  if (!existing) {
    return NextResponse.json(
      { error: "Skin neni ve wishlistu." },
      { status: 404 }
    );
  }

  const favorite = await prisma.favorite.update({
    where: {
      userId_skinId: {
        userId: user.id,
        skinId: skin.id,
      },
    },
    data: { emailAlertsEnabled },
    include: { skin: true },
  });

  return NextResponse.json({
    item: mapWishlistItem(favorite),
  });
}

export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const steamId =
    normalizeSteamId(req.nextUrl.searchParams.get("steamId")) ??
    normalizeSteamId(body?.steamId);
  const marketHashName =
    parseMarketHashName(req.nextUrl.searchParams.get("marketHashName")) ??
    parseMarketHashName(body?.marketHashName);
  const skinId =
    parseSkinId(req.nextUrl.searchParams.get("skinId")) ??
    parseSkinId(body?.skinId);

  if (!steamId) {
    return NextResponse.json({ error: "Missing SteamID." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { steamId } });
  if (!user) return NextResponse.json({ removed: false });

  const skin = skinId
    ? await prisma.skin.findUnique({ where: { id: skinId } })
    : marketHashName
      ? await prisma.skin.findUnique({ where: { marketHashName } })
      : null;

  if (!skin) return NextResponse.json({ removed: false });

  await prisma.favorite.deleteMany({
    where: {
      userId: user.id,
      skinId: skin.id,
    },
  });

  return NextResponse.json({ removed: true });
}
