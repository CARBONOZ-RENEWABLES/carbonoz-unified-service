import { InfluxDB, Point } from '@influxdata/influxdb-client'

let influxDB = null
let writeApi = null

// Batch configuration
const FLUSH_INTERVAL = 5000 // Flush every 5 seconds
const BATCH_SIZE = 100 // Flush when batch reaches 100 points
let pointCount = 0

try {
  influxDB = new InfluxDB({
    url: process.env.INFLUXDB_URL || 'http://192.168.160.190:8086',
    token: process.env.INFLUXDB_TOKEN || 'XCQzpsuF7Bo-tLY6HA3Z1K3eZ5AhIn4POx1m_vnuG9X1B-zf2NmN5Gxrw___-Lu5h-EaHCyEAP8X--5V96r8Wg==',
    timeout: 10000 // 10 second timeout
  })

  const org = process.env.INFLUXDB_ORG || 'carbonoz'
  const bucket = process.env.INFLUXDB_BUCKET || 'home_assistant'

  writeApi = influxDB.getWriteApi(org, bucket, 'ns', {
    batchSize: BATCH_SIZE,
    flushInterval: FLUSH_INTERVAL,
    maxRetries: 3,
    maxRetryDelay: 5000,
    exponentialBase: 2
  })
  
  writeApi.useDefaultTags({ source: 'socketio' })
  
  // Auto-flush on interval
  setInterval(async () => {
    if (pointCount > 0) {
      try {
        await writeApi.flush()
        console.log(`✅ InfluxDB flushed ${pointCount} points`)
        pointCount = 0
      } catch (error) {
        console.error('Error flushing InfluxDB:', error.message)
      }
    }
  }, FLUSH_INTERVAL)
  
  console.log('✅ InfluxDB service initialized with batching')
} catch (error) {
  console.warn('⚠️  InfluxDB not configured, data will only be saved to Redis')
}

export const writeToInfluxDB = async ({ topic, message, userId, mqttTopicPrefix }) => {
  if (!writeApi) return
  
  try {
    const value = parseFloat(message)
    if (isNaN(value)) {
      return // Skip non-numeric values silently
    }

    const point = new Point('state')
      .tag('userId', userId)
      .tag('topic', topic)
      .floatField('value', value)
      .timestamp(new Date())

    if (mqttTopicPrefix) point.tag('mqttTopicPrefix', mqttTopicPrefix)

    const topicParts = topic.split('/')
    if (topicParts.length >= 3) {
      point.tag('device_type', topicParts[1])
      point.tag('metric', topicParts[2])
    }

    writeApi.writePoint(point)
    pointCount++
    
    // Auto-flush if batch is full
    if (pointCount >= BATCH_SIZE) {
      await writeApi.flush()
      console.log(`✅ InfluxDB batch flushed (${pointCount} points)`)
      pointCount = 0
    }
  } catch (error) {
    console.error('Error writing to InfluxDB:', error.message)
  }
}

export const closeInfluxDB = async () => {
  if (!writeApi) return
  try {
    // Flush remaining points before closing
    if (pointCount > 0) {
      await writeApi.flush()
      console.log(`✅ Final InfluxDB flush (${pointCount} points)`)
    }
    await writeApi.close()
    console.log('✅ InfluxDB connection closed')
  } catch (error) {
    console.error('Error closing InfluxDB:', error.message)
  }
}
