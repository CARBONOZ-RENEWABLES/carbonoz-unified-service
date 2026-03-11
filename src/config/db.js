import { PrismaClient } from '@prisma/client'

export const prisma = new PrismaClient()

export const connectDatabase = async () => {
  try {
    await prisma.$connect()
    console.log('✅ Database connected')
  } catch (error) {
    console.error('❌ Failed to connect to database:', error)
    process.exit(1)
  }
}

export const disconnectDatabase = async () => {
  await prisma.$disconnect()
  console.log('Database disconnected')
}
