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

const toDate = (value) => new Date(value.length > 10 ? value : `${value}T00:00:00Z`);

async function main() {
  const rows = await prisma.priceHistory.findMany({
    where: { skinId: 2218, shopId: 1 },
    orderBy: { capturedAt: "asc" },
    select: { capturedAt: true, price: true },
  });
  const points = rows.map((r) => ({ date: r.capturedAt.toISOString(), price: r.price }));
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const periodDays = 7;
  const windowMs = periodDays * 24 * 60 * 60 * 1000;
  const anchor = toDate(sorted[sorted.length - 1].date);
  const windowStart = new Date(anchor.getTime() - windowMs);
  const filtered = sorted.filter((p) => toDate(p.date) >= windowStart);
  const prices = filtered.map((p) => p.price);
  console.log("total", sorted.length, "filtered", filtered.length);
  console.log("min", Math.min(...prices), "max", Math.max(...prices));
  console.log("windowStart", windowStart.toISOString(), "anchor", anchor.toISOString());
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
