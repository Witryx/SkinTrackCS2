import { PrismaClient } from "@prisma/client";
import { prisma } from "./prisma";
import { calculateChangePercent } from "./price-alerts";
import { sendPriceAlertEmail } from "./email";
import { getSkinDetailPath } from "./skin-images";

export type WishlistPriceChange = {
  skinId: number;
  marketHashName: string;
  previousPrice: number;
  currentPrice: number;
  currency: string;
};

const hasMeaningfulChange = (change: WishlistPriceChange) =>
  Number.isFinite(change.previousPrice) &&
  Number.isFinite(change.currentPrice) &&
  Math.abs(change.currentPrice - change.previousPrice) >= 0.01;

const formatPercent = (value: number | null) =>
  typeof value === "number" && Number.isFinite(value)
    ? `${Math.abs(value).toFixed(1)} %`
    : "? %";

export async function processWishlistPriceChanges(
  priceChanges: WishlistPriceChange[],
  client: PrismaClient = prisma
) {
  const validChanges = priceChanges.filter(hasMeaningfulChange);
  if (!validChanges.length) {
    return {
      changedSkins: 0,
      notificationsCreated: 0,
      emailsSent: 0,
      emailsSkipped: 0,
      emailErrors: 0,
    };
  }

  const changesBySkinId = new Map(
    validChanges.map((change) => [change.skinId, change])
  );
  const favorites = await client.favorite.findMany({
    where: { skinId: { in: [...changesBySkinId.keys()] } },
    include: { user: true, skin: true },
  });
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  let notificationsCreated = 0;
  let emailsSent = 0;
  let emailsSkipped = 0;
  let emailErrors = 0;

  for (const favorite of favorites) {
    const change = changesBySkinId.get(favorite.skinId);
    if (!change) continue;

    const changePercent = calculateChangePercent(
      change.previousPrice,
      change.currentPrice
    );
    const direction = change.currentPrice >= change.previousPrice ? "UP" : "DOWN";
    const directionLabel = direction === "UP" ? "vzrostla" : "klesla";
    const title = `Cena ${directionLabel}: ${favorite.skin.marketHashName}`;
    const message = `Cena se zmenila o ${formatPercent(changePercent)}.`;

    const notification = favorite.alertsEnabled
      ? await client.notification.create({
          data: {
            userId: favorite.userId,
            skinId: favorite.skinId,
            type: "PRICE_CHANGE",
            title,
            message,
            previousPrice: change.previousPrice,
            currentPrice: change.currentPrice,
            changePercent,
            direction,
            currency: change.currency || favorite.skin.currency || "EUR",
          },
        })
      : null;
    if (notification) notificationsCreated += 1;

    const steamAccountEmail = favorite.user.email;
    const shouldSendEmail =
      favorite.emailAlertsEnabled &&
      Boolean(steamAccountEmail) &&
      typeof changePercent === "number";

    if (!shouldSendEmail || !steamAccountEmail) {
      emailsSkipped += 1;
      continue;
    }

    try {
      const detailUrl = new URL(
        getSkinDetailPath(favorite.skin.marketHashName),
        siteUrl
      ).toString();
      const result = await sendPriceAlertEmail({
        to: steamAccountEmail,
        skinName: favorite.skin.marketHashName,
        previousPrice: change.previousPrice,
        currentPrice: change.currentPrice,
        changePercent,
        currency: change.currency || favorite.skin.currency || "EUR",
        detailUrl,
      });

      if (result.sent) {
        const emailedAt = new Date();
        const updates: Array<Promise<unknown>> = [
          client.favorite.update({
            where: {
              userId_skinId: {
                userId: favorite.userId,
                skinId: favorite.skinId,
              },
            },
            data: { lastEmailAlertAt: emailedAt },
          }),
        ];

        if (notification) {
          updates.push(
            client.notification.update({
              where: { id: notification.id },
              data: { emailedAt },
            })
          );
        }

        await Promise.all(updates);
        emailsSent += 1;
      } else {
        emailsSkipped += 1;
      }
    } catch (error) {
      emailErrors += 1;
      console.error("Wishlist price alert email failed", error);
    }
  }

  return {
    changedSkins: validChanges.length,
    notificationsCreated,
    emailsSent,
    emailsSkipped,
    emailErrors,
  };
}
