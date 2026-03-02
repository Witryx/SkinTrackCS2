const fs = require("fs");
const path = require("path");

function loadEnv() {
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    if (!line) continue;
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

loadEnv();

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const since = new Date();
  since.setDate(since.getDate() - 7);
  const rows = await prisma.priceHistory.findMany({
    where: { skinId: 2218, capturedAt: { gte: since } },
    orderBy: { capturedAt: "asc" },
    select: { capturedAt: true, price: true },
  });
  const unique = Array.from(new Set(rows.map((r) => r.price)));
  console.log("rows", rows.length, "unique prices", unique.length, unique.sort((a,b)=>a-b));
  console.log(rows.map((r) => `${r.capturedAt.toISOString()} ${r.price}`).join("\n"));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
