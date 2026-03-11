import dayjs from 'dayjs'
import { redisClient } from '../config/redis.db'

import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'

dayjs.extend(utc)
dayjs.extend(timezone)



export const saveToRedis = async ({ topic, message, userId, mqttTopicPrefix, carbonIntensityApiKey }) => {
  try {
    const now = dayjs()
    const date = now.format('YYYY-MM-DD')

    let existingData = await redisClient.hGet('redis-data', `${date}-${userId}`)

    let load = 0
    let pv = 0
    let gridIn = 0
    let gridOut = 0
    let batteryCharged = 0
    let batteryDischarged = 0

    if (existingData) {
      const [
        existingPv,
        existingUserId,
        existingLoad,
        existingGridIn,
        existingGridOut,
        existingBatteryCharged,
        existingBatteryDischarged,
      ] = existingData.split(',').map(parseFloat)

      load = existingLoad
      pv = existingPv
      gridIn = existingGridIn
      gridOut = existingGridOut
      batteryCharged = existingBatteryCharged
      batteryDischarged = existingBatteryDischarged
    }

    let updated = false
    switch (topic) {
      case `${mqttTopicPrefix}/total/load_energy/state`:
        const newLoad = parseFloat(message)
        if (newLoad !== load) {
          load = newLoad
          updated = true
        }
        break
      case `${mqttTopicPrefix}/total/pv_energy/state`:
        const newPv = parseFloat(message)
        if (newPv !== pv) {
          pv = newPv
          updated = true
        }
        break
      case `${mqttTopicPrefix}/total/battery_energy_in/state`:
        const newBatteryCharged = parseFloat(message)
        if (newBatteryCharged !== batteryCharged) {
          batteryCharged = newBatteryCharged
          updated = true
        }
        break
      case `${mqttTopicPrefix}/total/battery_energy_out/state`:
        const newBatteryDischarged = parseFloat(message)
        if (newBatteryDischarged !== batteryDischarged) {
          batteryDischarged = newBatteryDischarged
          updated = true
        }
        break
      case `${mqttTopicPrefix}/total/grid_energy_in/state`:
        const newGridIn = parseFloat(message)
        if (newGridIn !== gridIn) {
          gridIn = newGridIn
          updated = true
        }
        break
      case `${mqttTopicPrefix}/total/grid_energy_out/state`:
        const newGridOut = parseFloat(message)
        if (newGridOut !== gridOut) {
          gridOut = newGridOut
          updated = true
        }
        break
      default:
        return
    }

    if (updated || !existingData) {
      const concatenatedValues = `${pv},${userId},${load},${gridIn},${gridOut},${batteryCharged},${batteryDischarged}`
      await redisClient.hSet('redis-data', `${date}-${userId}`, concatenatedValues)
      console.log(`✅ Wrote to Redis: ${topic} = ${message} (userId: ${userId})`)
    }

    // Store carbon intensity API key
    if (carbonIntensityApiKey) {
      await redisClient.hSet('carbon-settings', userId, JSON.stringify({
        apiKey: carbonIntensityApiKey,
        lastUpdated: now.toISOString()
      }))
      console.log(`✅ Wrote to Redis: carbon-settings for userId: ${userId}`)
    }
  } catch (error) {
    console.error('Error saving data to Redis:', error)
  }
}
