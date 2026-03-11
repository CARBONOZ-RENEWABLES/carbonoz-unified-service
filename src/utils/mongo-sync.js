import { prisma } from '../config/db'
import { redisClient } from '../config/redis.db'

const MAX_RETRIES = 3
const BASE_DELAY = 1000

const upsertTotalEnergy = async (data) => {
  const { normalizedDate, userId, pvPowerMean, loadPowerMean, gridIn, gridOut, batteryCharged, batteryDischarged } = data

  try {
    // Try to find existing record
    const existing = await prisma.totalEnergy.findUnique({
      where: { date_userId: { date: normalizedDate, userId } }
    })

    if (existing) {
      // Update existing
      await prisma.totalEnergy.update({
        where: { date_userId: { date: normalizedDate, userId } },
        data: { pvPower: pvPowerMean, loadPower: loadPowerMean, gridIn, gridOut, batteryCharged, batteryDischarged }
      })
    } else {
      // Create new
      await prisma.totalEnergy.create({
        data: {
          date: normalizedDate,
          pvPower: pvPowerMean,
          loadPower: loadPowerMean,
          user: { connect: { id: userId } },
          gridIn,
          gridOut,
          batteryCharged,
          batteryDischarged
        }
      })
    }
    console.log(`✅ Wrote to MongoDB: date=${normalizedDate}, userId=${userId}, pvPower=${pvPowerMean}, loadPower=${loadPowerMean}`)
  } catch (error) {
    throw error
  }
}

const upsertWithRetry = async (data, attempts = 0) => {
  try {
    await upsertTotalEnergy(data)
  } catch (error) {
    if (attempts < MAX_RETRIES) {
      const delay = BASE_DELAY * Math.pow(2, attempts)
      console.error(`Retry ${attempts + 1} after ${delay}ms for date ${data.normalizedDate}:`, error.message)
      await new Promise((resolve) => setTimeout(resolve, delay))
      await upsertWithRetry(data, attempts + 1)
    } else {
      console.error(`Max retries reached for date ${data.normalizedDate}:`, error.message)
    }
  }
}

export const syncRedisToMongo = async () => {
  try {
    const dateUserKeys = await redisClient.hKeys('redis-data')
    if (!dateUserKeys || dateUserKeys.length === 0) return

    for (const dateUserKey of dateUserKeys) {
      const concatenatedValues = await redisClient.hGet('redis-data', dateUserKey)
      if (!concatenatedValues || concatenatedValues.includes('[object Object]')) continue

      const [existingPv, existingUserId, existingLoad, existingGridIn, existingGridOut, existingBatteryCharged, existingBatteryDischarged] = concatenatedValues.split(',')
      const fullDate = dateUserKey.split('-').slice(0, 3).join('-')

      await upsertWithRetry({
        normalizedDate: fullDate,
        userId: existingUserId,
        pvPowerMean: existingPv,
        loadPowerMean: existingLoad,
        gridIn: existingGridIn,
        gridOut: existingGridOut,
        batteryCharged: existingBatteryCharged,
        batteryDischarged: existingBatteryDischarged
      })
    }
  } catch (error) {
    console.error('Error syncing Redis to MongoDB:', error.message)
  }
}
