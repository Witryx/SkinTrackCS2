import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { normalizeSteamId } from "@/app/lib/user-auth";

export const dynamic = "force-dynamic";

const parseLimit = (value: string | null) => {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed)) return 20;
  return Math.min(Math.max(parsed, 1), 100);
};

const parseNotificationIds = (body: unknown) => {
  if (!body || typeof body !== "object") return [];

  const payload = body as { id?: unknown; ids?: unknown };
  const values = Array.isArray(payload.ids) ? payload.ids : [payload.id];

  return values
    .map((value: unknown) => Number.parseInt(String(value), 10))
    .filter((value: number) => Number.isFinite(value) && value > 0);
};

const mapNotification = (notification: Awaited<ReturnType<typeof fetchNotifications>>[number]) => ({
  id: notification.id,
  type: notification.type,
  title: notification.title,
  message: notification.message,
  previousPrice: notification.previousPrice,
  currentPrice: notification.currentPrice,
  changePercent: notification.changePercent,
  direction: notification.direction,
  currency: notification.currency,
  readAt: notification.readAt?.toISOString() ?? null,
  emailedAt: notification.emailedAt?.toISOString() ?? null,
  createdAt: notification.createdAt.toISOString(),
  skin: {
    id: notification.skin.id,
    name: notification.skin.marketHashName,
    weapon: notification.skin.weapon,
    skin: notification.skin.skin,
    wear: notification.skin.wear,
    rarity: notification.skin.rarity,
    price: notification.skin.price,
  },
});

async function fetchNotifications(userId: number, limit: number) {
  return prisma.notification.findMany({
    where: { userId },
    include: { skin: true },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function GET(req: NextRequest) {
  const steamId = normalizeSteamId(req.nextUrl.searchParams.get("steamId"));
  const limit = parseLimit(req.nextUrl.searchParams.get("limit"));

  if (!steamId) {
    return NextResponse.json(
      { notifications: [], unreadCount: 0, error: "Missing SteamID." },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { steamId },
    select: { id: true },
  });

  if (!user) {
    return NextResponse.json({ notifications: [], unreadCount: 0 });
  }

  const [notifications, unreadCount] = await Promise.all([
    fetchNotifications(user.id, limit),
    prisma.notification.count({
      where: { userId: user.id, readAt: null },
    }),
  ]);

  return NextResponse.json({
    notifications: notifications.map(mapNotification),
    unreadCount,
  });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const steamId = normalizeSteamId(body?.steamId);

  if (!steamId) {
    return NextResponse.json({ error: "Missing SteamID." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { steamId },
    select: { id: true },
  });

  if (!user) {
    return NextResponse.json({ updated: 0 });
  }

  const ids = parseNotificationIds(body);

  const where =
    ids.length > 0
      ? { userId: user.id, id: { in: ids } }
      : { userId: user.id, readAt: null };

  const result = await prisma.notification.updateMany({
    where,
    data: { readAt: new Date() },
  });

  return NextResponse.json({ updated: result.count });
}

export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const steamId = normalizeSteamId(body?.steamId);

  if (!steamId) {
    return NextResponse.json({ error: "Missing SteamID." }, { status: 400 });
  }

  const ids = parseNotificationIds(body);
  if (ids.length === 0) {
    return NextResponse.json({ error: "Missing notification ID." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { steamId },
    select: { id: true },
  });

  if (!user) {
    return NextResponse.json({ deleted: 0 });
  }

  const result = await prisma.notification.deleteMany({
    where: { userId: user.id, id: { in: ids } },
  });

  return NextResponse.json({ deleted: result.count });
}
