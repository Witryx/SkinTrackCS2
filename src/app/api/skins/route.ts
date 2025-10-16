import { PrismaClient } from '@prisma/client'
import { NextResponse } from 'next/server'

const prisma = new PrismaClient()

export async function GET() {
  const skins = await prisma.skin.findMany({
    include: {
      prices: {
        orderBy: { capturedAt: 'desc' },
        take: 1,
      },
    },
  })
  return NextResponse.json(skins)
}
