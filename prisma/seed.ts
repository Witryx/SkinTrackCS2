import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // Obchody
  const steam = await prisma.shop.upsert({
    where: { name: 'Steam' },
    update: {},
    create: { name: 'Steam', url: 'https://store.steampowered.com/' },
  })

  const skinport = await prisma.shop.upsert({
    where: { name: 'Skinport' },
    update: {},
    create: { name: 'Skinport', url: 'https://skinport.com/' },
  })

  // Jeden skin
  const ak = await prisma.skin.create({
    data: {
      weapon: 'AK-47',
      name: 'Redline',
      rarity: 'Classified',
      imageUrl: null,
    },
  })

  // Ceny
  await prisma.priceSnapshot.createMany({
    data: [
      { skinId: ak.id, shopId: steam.id, currency: 'EUR', price: 24.90 },
      { skinId: ak.id, shopId: skinport.id, currency: 'EUR', price: 22.50 },
    ],
  })
}

main()
  .then(() => {
    console.log('Seed hotov!')
    prisma.$disconnect()
  })
  .catch((e) => {
    console.error(e)
    prisma.$disconnect()
  })
