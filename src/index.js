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

// Message queue for batching
const messageQueue = []
const BATCH_SIZE = 50
const BATCH_INTERVAL = 1000 // 1 second
let processingBatch = false

// Process message queue in batches
const processBatch = async () => {
  if (processingBatch || messageQueue.length === 0) return
  
  processingBatch = true
  const batch = messageQueue.splice(0, BATCH_SIZE)
  
  try {
    await Promise.all(batch.map(async ({ topic, message, userId, mqttTopicPrefix, carbonIntensityApiKey }) => {
      try {
        await saveToRedis({ topic, message, userId, mqttTopicPrefix, carbonIntensityApiKey })
        if (topic && message && userId) {
          await writeToInfluxDB({ topic, message, userId, mqttTopicPrefix })
        }
      } catch (error) {
        console.error('Error processing message in batch:', error)
      }
    }))
  } catch (error) {
    console.error('Error processing batch:', error)
  } finally {
    processingBatch = false
  }
}

// Start batch processor
setInterval(processBatch, BATCH_INTERVAL)

const startServer = async () => {
  // Connect to databases
  await redisClient.connect()
  console.log('✅ Redis connected')
  
  await connectDatabase()

  const PORT = process.env.PORT || 8000
  const server = app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`)
  })

  // WebSocket Server with optimizations
  const wsServer = new WebSocketServer({ 
    server,
    perMessageDeflate: false, // Disable compression for better performance
    maxPayload: 100 * 1024 // 100KB max payload
  })

  // Track active connections
  const activeConnections = new Set()

  wsServer.on('connection', (ws) => {
    console.log('WebSocket client connected')
    activeConnections.add(ws)
    
    // Heartbeat with longer interval
    const heartbeatInterval = setInterval(() => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }))
      } else {
        clearInterval(heartbeatInterval)
        activeConnections.delete(ws)
      }
    }, 30000)

    // Rate limiting per connection
    let messageCount = 0
    let lastReset = Date.now()
    const MAX_MESSAGES_PER_SECOND = 100

    ws.on('message', async (obj) => {
      try {
        // Rate limiting
        const now = Date.now()
        if (now - lastReset > 1000) {
          messageCount = 0
          lastReset = now
        }
        
        messageCount++
        if (messageCount > MAX_MESSAGES_PER_SECOND) {
          console.warn('Rate limit exceeded, dropping message')
          return
        }

        const messageString = obj?.toString()
        const parsedMessage = JSON.parse(messageString)
        const { type, topic, message, userId, mqttTopicPrefix, carbonIntensityApiKey } = parsedMessage

        if (type === 'ai-charging') {
          // Process AI charging data immediately (high priority)
          const { status, mode, batteryLevel, targetSOC, lastCommandTime, lastCommandReason } = parsedMessage
          const chargingData = JSON.stringify({
            userId, status, mode, batteryLevel, targetSOC, lastCommandTime, lastCommandReason,
            timestamp: new Date().toISOString()
          })
          await redisClient.setEx(`ai-charging:${userId}`, 3600, chargingData)
          console.log(`✅ Wrote to Redis: ai-charging data (userId: ${userId})`)
        } else {
          // Add to batch queue for regular messages
          messageQueue.push({ topic, message, userId, mqttTopicPrefix, carbonIntensityApiKey })
          
          // Process immediately if queue is full
          if (messageQueue.length >= BATCH_SIZE) {
            processBatch()
          }
        }
      } catch (error) {
        console.error('Error processing message:', error)
      }
    })

    ws.on('close', () => {
      console.log('WebSocket client disconnected')
      clearInterval(heartbeatInterval)
      activeConnections.delete(ws)
    })

    ws.on('error', (err) => {
      console.error('WebSocket error:', err)
      activeConnections.delete(ws)
    })
  })

  // Schedule MongoDB sync every 2 minutes
  scheduleJob('*/2 * * * *', syncRedisToMongo)
  console.log('✅ MongoDB sync scheduled (every 2 minutes)')
  
  // Log connection stats every 30 seconds
  setInterval(() => {
    console.log(`📊 Active connections: ${activeConnections.size}, Queue size: ${messageQueue.length}`)
  }, 30000)
}

// Graceful Shutdown
const shutdown = async () => {
  console.log('Shutting down server...')
  
  // Process remaining messages
  if (messageQueue.length > 0) {
    console.log(`Processing ${messageQueue.length} remaining messages...`)
    await processBatch()
  }
  
  await closeInfluxDB()
  await redisClient.quit()
  await disconnectDatabase()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

redisClient.on('error', (err) => console.error('Redis Client Error:', err))

startServer().catch(console.error)
