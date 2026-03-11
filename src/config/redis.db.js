import { createClient } from 'redis'

export const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://192.168.160.185'
})

redisClient.on('error', (err) => console.error('Redis Client Error:', err))
