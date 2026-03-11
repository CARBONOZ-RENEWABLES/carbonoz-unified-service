# Carbonoz Unified Service

Single unified service combining Socket.IO WebSocket server, InfluxDB writer, and MongoDB sync broker.

## Features

- **WebSocket Server**: Receives real-time energy data from Home Assistant, Docker app, and Desktop app
- **Redis Storage**: Stores real-time data in Redis for fast access
- **InfluxDB Integration**: Writes time-series data to InfluxDB for Grafana dashboards
- **MongoDB Sync**: Automatically syncs aggregated data to MongoDB every 2 minutes
- **Comprehensive Logging**: Logs all database write operations (Redis, InfluxDB, MongoDB)

## Architecture Benefits

### Before (2 services):
- `socketio` (192.168.160.185) - WebSocket + Redis + InfluxDB
- `offsettingmongobroker` (192.168.160.160) - MongoDB sync

### After (1 service):
- `unified-service` (single server) - All functionality in one place

### Advantages:
- ✅ Simplified deployment and maintenance
- ✅ Reduced server costs (1 server instead of 2)
- ✅ Easier monitoring and debugging
- ✅ Single codebase to maintain
- ✅ No network latency between services
- ✅ Unified logging

## Installation

```bash
cd unified-service
npm install
npx prisma generate
npm run build
```

## Deployment

```bash
# Copy to server
scp -r unified-service localadmin@192.168.160.190:~/

# SSH to server
ssh localadmin@192.168.160.190

# Install and start
cd ~/unified-service
npm install
npx prisma generate
npm run build
pm2 start ecosystem.config.js
pm2 save
```

## Monitoring

```bash
pm2 logs carbonoz-unified
pm2 status
```

## Environment Variables

- `PORT`: Server port (default: 8000)
- `REDIS_URL`: Redis connection URL
- `DATABASE_URL`: MongoDB connection URL
- `INFLUXDB_URL`: InfluxDB server URL
- `INFLUXDB_TOKEN`: InfluxDB authentication token
- `INFLUXDB_ORG`: InfluxDB organization
- `INFLUXDB_BUCKET`: InfluxDB bucket name

## Migration from Old Services

1. Stop old services:
   ```bash
   pm2 stop socketio carbonoz-mongo-broker
   ```

2. Deploy unified service (see above)

3. Verify logs show all three databases working:
   ```bash
   pm2 logs carbonoz-unified
   ```

4. Once verified, delete old services:
   ```bash
   pm2 delete socketio carbonoz-mongo-broker
   ```
