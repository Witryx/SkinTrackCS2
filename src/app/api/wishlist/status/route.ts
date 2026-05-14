import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { normalizeSteamId } from "@/app/lib/user-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const steamId = normalizeSteamId(req.nextUrl.searchParams.get("steamId"));
  const marketHashName = req.nextUrl.searchParams.get("marketHashName")?.trim();

  if (!steamId || !marketHashName) {
    return NextResponse.json({ wished: false });
  }

  const user = await prisma.user.findUnique({
    where: { steamId },
    select: { id: true },
  });

  if (!user) {
    return NextResponse.json({ wished: false });
  }

  const skin = await prisma.skin.findUnique({
    where: { marketHashName },
    select: { id: true },
  });

  if (!skin) {
    return NextResponse.json({ wished: false });
  }

  const favorite = await prisma.favorite.findUnique({
    where: {
      userId_skinId: {
        userId: user.id,
        skinId: skin.id,
      },
    },
    select: { alertsEnabled: true, emailAlertsEnabled: true },
  });

  return NextResponse.json({
    wished: Boolean(favorite),
    alertsEnabled: favorite?.alertsEnabled ?? false,
    emailAlertsEnabled: favorite?.emailAlertsEnabled ?? false,
  });
}
