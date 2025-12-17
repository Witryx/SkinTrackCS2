import { PrismaClient } from "@prisma/client";
import { syncSkinDatabase } from "../src/app/lib/skin-database";

const prisma = new PrismaClient();

async function main() {
  console.log("Spoustim import skinu ze Skinport API...");
  const result = await syncSkinDatabase(prisma);
  console.log(`Hotovo: upsertnuto ${result.upserted} skinu (celkem ${result.total} polozek v API).`);
}

main()
  .catch((e) => {
    console.error("Seed selhal", e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
