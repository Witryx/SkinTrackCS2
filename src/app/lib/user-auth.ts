import { PrismaClient } from "@prisma/client";
import { prisma } from "./prisma";

const STEAM_ID_PATTERN = /^\d{15,20}$/;

export function normalizeSteamId(value: unknown) {
  if (typeof value !== "string") return null;
  const steamId = value.trim();
  if (!STEAM_ID_PATTERN.test(steamId)) return null;
  return steamId;
}

export async function getOrCreateSteamUser(
  steamIdInput: unknown,
  client: PrismaClient = prisma
) {
  const steamId = normalizeSteamId(steamIdInput);
  if (!steamId) return null;

  return client.user.upsert({
    where: { steamId },
    update: {},
    create: { steamId },
  });
}
