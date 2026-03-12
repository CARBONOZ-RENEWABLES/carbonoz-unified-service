module.exports = {
  apps: [{
    name: 'carbonoz-unified',
    script: 'dist/index.js',
    cwd: '/home/localadmin/unified-service',
    interpreter: '/home/localadmin/.nvm/versions/node/v18.19.0/bin/node',
    env: {
      NODE_ENV: 'production',
      PORT: '8000',
      REDIS_URL: 'redis://192.168.160.185:6379',
      INFLUXDB_URL: 'http://192.168.160.190:8086',
      INFLUXDB_TOKEN: 'XCQzpsuF7Bo-tLY6HA3Z1K3eZ5AhIn4POx1m_vnuG9X1B-zf2NmN5Gxrw___-Lu5h-EaHCyEAP8X--5V96r8Wg==',
      INFLUXDB_ORG: 'carbonoz',
      INFLUXDB_BUCKET: 'home_assistant',
      DATABASE_URL: 'mongodb://192.168.160.190:27017/carbonoz'
    }
  }]
}
