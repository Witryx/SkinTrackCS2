import { PrismaClient } from "@prisma/client";
import { recordPriceHistory, syncSkinDatabase } from "../src/app/lib/skin-database";

const prisma = new PrismaClient();

async function main() {
  console.log("Spoustim import skinu ze Skinport API...");
  const result = await syncSkinDatabase(prisma, {
    onProgress: (message) => console.log(message),
  });
  console.log(
    `Hotovo: upsertnuto ${result.upserted} skinu (nove ${result.created}, aktualizovano ${result.updated}, celkem ${result.total} polozek v API).`
  );
  console.log("Ukladam prvni cenovou historii...");
  const history = await recordPriceHistory(prisma);
  console.log(`Ulozeno ${history.inserted} historickych zaznamu.`);
}

main()
  .catch((e) => {
    console.error("Seed selhal", e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
