import dayjs from 'dayjs'
import { redisClient } from '../config/redis.db'

import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'

dayjs.extend(utc)
dayjs.extend(timezone)

// Cache for reducing Redis reads
const dataCache = new Map()
const CACHE_TTL = 5000 // 5 seconds

export const saveToRedis = async ({ topic, message, userId, mqttTopicPrefix, carbonIntensityApiKey }) => {
  try {
    const now = dayjs()
    const date = now.format('YYYY-MM-DD')
    const cacheKey = `${date}-${userId}`

    let load = 0
    let pv = 0
    let gridIn = 0
    let gridOut = 0
    let batteryCharged = 0
    let batteryDischarged = 0

    // Check cache first
    const cached = dataCache.get(cacheKey)
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
      ({ load, pv, gridIn, gridOut, batteryCharged, batteryDischarged } = cached.data)
    } else {
      // Read from Redis if not in cache
      const existingData = await redisClient.hGet('redis-data', cacheKey)
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
    }

    let updated = false
    const value = parseFloat(message)
    
    if (isNaN(value)) return // Skip invalid values

    switch (topic) {
      case `${mqttTopicPrefix}/total/load_energy/state`:
        if (value !== load) {
          load = value
          updated = true
        }
        break
      case `${mqttTopicPrefix}/total/pv_energy/state`:
        if (value !== pv) {
          pv = value
          updated = true
        }
        break
      case `${mqttTopicPrefix}/total/battery_energy_in/state`:
        if (value !== batteryCharged) {
          batteryCharged = value
          updated = true
        }
        break
      case `${mqttTopicPrefix}/total/battery_energy_out/state`:
        if (value !== batteryDischarged) {
          batteryDischarged = value
          updated = true
        }
        break
      case `${mqttTopicPrefix}/total/grid_energy_in/state`:
        if (value !== gridIn) {
          gridIn = value
          updated = true
        }
        break
      case `${mqttTopicPrefix}/total/grid_energy_out/state`:
        if (value !== gridOut) {
          gridOut = value
          updated = true
        }
        break
      default:
        return
    }

    if (updated || !cached) {
      const concatenatedValues = `${pv},${userId},${load},${gridIn},${gridOut},${batteryCharged},${batteryDischarged}`
      
      // Update cache
      dataCache.set(cacheKey, {
        data: { load, pv, gridIn, gridOut, batteryCharged, batteryDischarged },
        timestamp: Date.now()
      })
      
      // Write to Redis (non-blocking)
      redisClient.hSet('redis-data', cacheKey, concatenatedValues).catch(err => {
        console.error('Error writing to Redis:', err)
      })
    }

    // Store carbon intensity API key (less frequent operation)
    if (carbonIntensityApiKey) {
      redisClient.hSet('carbon-settings', userId, JSON.stringify({
        apiKey: carbonIntensityApiKey,
        lastUpdated: now.toISOString()
      })).catch(err => {
        console.error('Error writing carbon settings to Redis:', err)
      })
    }
  } catch (error) {
    console.error('Error saving data to Redis:', error)
  }
}

// Clean up old cache entries periodically
setInterval(() => {
  const now = Date.now()
  for (const [key, value] of dataCache.entries()) {
    if (now - value.timestamp > CACHE_TTL * 2) {
      dataCache.delete(key)
    }
  }
}, 60000) // Clean every minute
