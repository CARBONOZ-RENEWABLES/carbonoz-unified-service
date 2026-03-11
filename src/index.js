import cors from 'cors'
import express from 'express'
import morgan from 'morgan'
import { WebSocketServer } from 'ws'
import { scheduleJob } from 'node-schedule'
import { redisClient } from './config/redis.db'
import { connectDatabase, disconnectDatabase, prisma } from './config/db'
import { saveToRedis } from './utils/redis'
import { writeToInfluxDB, closeInfluxDB } from './services/influxdb.service'
import { syncRedisToMongo } from './utils/mongo-sync'

const app = express()
app.use(cors())
app.use(morgan('dev'))

app.get('/', (req, res) => {
  res.status(200).json({ service: 'Carbonoz Unified Service', status: 'running' })
})

app.get('/health', (req, res) => {
  res.status(200).json({ redis: 'connected', database: 'connected', influxdb: 'connected' })
})

const startServer = async () => {
  // Connect to databases
  await redisClient.connect()
  console.log('✅ Redis connected')
  
  await connectDatabase()

  const PORT = process.env.PORT || 8000
  const server = app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`)
  })

  // WebSocket Server
  const wsServer = new WebSocketServer({ server })

  wsServer.on('connection', (ws) => {
    console.log('WebSocket client connected')
    const heartbeatInterval = setInterval(() => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }))
      } else {
        clearInterval(heartbeatInterval)
      }
    }, 30000)

    ws.on('message', async (obj) => {
      try {
        const messageString = obj?.toString()
        const parsedMessage = JSON.parse(messageString)
        const { type, topic, message, userId, mqttTopicPrefix, carbonIntensityApiKey } = parsedMessage

        if (type === 'ai-charging') {
          const { status, mode, batteryLevel, targetSOC, lastCommandTime, lastCommandReason } = parsedMessage
          const chargingData = JSON.stringify({
            userId, status, mode, batteryLevel, targetSOC, lastCommandTime, lastCommandReason,
            timestamp: new Date().toISOString()
          })
          await redisClient.setEx(`ai-charging:${userId}`, 3600, chargingData)
          console.log(`✅ Wrote to Redis: ai-charging data (userId: ${userId})`)
        } else {
          await saveToRedis({ topic, message, userId, mqttTopicPrefix, carbonIntensityApiKey })
          
          if (topic && message && userId) {
            await writeToInfluxDB({ topic, message, userId, mqttTopicPrefix })
          }
        }
      } catch (error) {
        console.error('Error processing message:', error)
      }
    })

    ws.on('close', () => {
      console.log('WebSocket client disconnected')
      clearInterval(heartbeatInterval)
    })

    ws.on('error', (err) => console.error('WebSocket error:', err))
  })

  // Schedule MongoDB sync every 2 minutes
  scheduleJob('*/2 * * * *', syncRedisToMongo)
  console.log('✅ MongoDB sync scheduled (every 2 minutes)')
}

// Graceful Shutdown
const shutdown = async () => {
  console.log('Shutting down server...')
  await closeInfluxDB()
  await redisClient.quit()
  await disconnectDatabase()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

redisClient.on('error', (err) => console.error('Redis Client Error:', err))

startServer().catch(console.error)
