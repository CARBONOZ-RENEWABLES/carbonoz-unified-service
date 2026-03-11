import { InfluxDB, Point } from '@influxdata/influxdb-client'

let influxDB = null
let writeApi = null

try {
  influxDB = new InfluxDB({
    url: process.env.INFLUXDB_URL || 'http://192.168.160.190:8086',
    token: process.env.INFLUXDB_TOKEN || 'XCQzpsuF7Bo-tLY6HA3Z1K3eZ5AhIn4POx1m_vnuG9X1B-zf2NmN5Gxrw___-Lu5h-EaHCyEAP8X--5V96r8Wg=='
  })

  const org = process.env.INFLUXDB_ORG || 'carbonoz'
  const bucket = process.env.INFLUXDB_BUCKET || 'home_assistant'

  writeApi = influxDB.getWriteApi(org, bucket, 'ns')
  writeApi.useDefaultTags({ source: 'socketio' })
  console.log('✅ InfluxDB service initialized')
} catch (error) {
  console.warn('⚠️  InfluxDB not configured, data will only be saved to Redis')
}

export const writeToInfluxDB = async ({ topic, message, userId, mqttTopicPrefix }) => {
  if (!writeApi) return
  
  try {
    const value = parseFloat(message)
    if (isNaN(value)) {
      console.log(`Skipping non-numeric value for topic ${topic}: ${message}`)
      return
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
    console.log(`✅ Wrote to InfluxDB: ${topic} = ${value} (userId: ${userId})`)
    
    // Flush more frequently for testing
    if (Math.random() < 0.1) await writeApi.flush()
  } catch (error) {
    console.error('Error writing to InfluxDB:', error.message)
  }
}

export const closeInfluxDB = async () => {
  if (!writeApi) return
  try {
    await writeApi.close()
  } catch (error) {
    console.error('Error closing InfluxDB:', error.message)
  }
}
