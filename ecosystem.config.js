module.exports = {
  apps: [{
    name: 'carbonoz-unified',
    script: 'dist/index.js',
    cwd: '/home/localadmin/carbonoz-unified-service',
    interpreter: '/home/localadmin/.nvm/versions/node/v18.19.0/bin/node',
    env: {
      NODE_ENV: 'production',
      PORT: '8000',
      REDIS_URL: 'redis://192.168.160.185:6379',
      INFLUXDB_URL: 'http://192.168.160.190:8086',
      // Exported from the password manager before `pm2 start/restart ecosystem.config.js`.
      INFLUXDB_TOKEN: process.env.INFLUXDB_TOKEN,
      INFLUXDB_ORG: 'carbonoz',
      INFLUXDB_BUCKET: 'home_assistant',
      DATABASE_URL: 'mongodb://192.168.160.190:27017/carbonoz'
    }
  }]
}
