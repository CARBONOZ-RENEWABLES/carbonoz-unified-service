# Deployment Architecture - Where to Host Everything

## Recommended Setup: Single Server (192.168.160.190)

### 🎯 Host Everything on 192.168.160.190 (login.carbonoz.com server)

This server already has:
- ✅ InfluxDB running
- ✅ Grafana running
- ✅ MongoDB (likely)
- ✅ Public access configured

```
┌─────────────────────────────────────────────────────────────────┐
│  Server: 192.168.160.190 (login.carbonoz.com)                   │
│  User: localadmin                                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  📦 Unified Service (Port 8000)                                 │
│     ├─ WebSocket Server                                         │
│     ├─ Redis Client → connects to 192.168.160.185              │
│     ├─ InfluxDB Client → localhost:8086                         │
│     └─ MongoDB Client → localhost:27017                         │
│                                                                 │
│  💾 InfluxDB (Port 8086) - Already Running                      │
│                                                                 │
│  💾 MongoDB (Port 27017) - Local                                │
│                                                                 │
│  📊 Grafana (Port 3000) - Already Running                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  Server: 192.168.160.185 (Redis Server)                         │
│  User: localadmin                                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  💾 Redis (Port 6379) - Keep Running                            │
│     └─ Used by unified service for real-time data              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  Server: 192.168.160.160                                        │
│  Status: Can be decommissioned ✅                               │
│  Reason: MongoDB broker functionality moved to unified service  │
└─────────────────────────────────────────────────────────────────┘
```

## Database Locations

| Database | Location | Port | Purpose |
|----------|----------|------|---------|
| **Redis** | 192.168.160.185 | 6379 | Real-time data cache |
| **InfluxDB** | 192.168.160.190 | 8086 | Time-series data for Grafana |
| **MongoDB** | 192.168.160.190 | 27017 | Persistent storage |

## Why This Setup?

### ✅ Advantages:
1. **Unified service on same server as databases** (190)
   - Zero latency to InfluxDB (localhost)
   - Zero latency to MongoDB (localhost)
   - Fast access to Redis (local network)

2. **Keep Redis separate** (185)
   - Redis is lightweight and fast
   - Already configured and working
   - Can be shared by other services if needed

3. **Decommission server 160**
   - Save costs
   - Reduce maintenance
   - Simplify architecture

## Updated Ecosystem Config

```javascript
module.exports = {
  apps: [{
    name: 'carbonoz-unified',
    script: 'dist/index.js',
    cwd: '/home/localadmin/unified-service',
    env: {
      PORT: '8000',
      REDIS_URL: 'redis://192.168.160.185:6379',
      INFLUXDB_URL: 'http://localhost:8086',
      INFLUXDB_TOKEN: 'XCQzpsuF7Bo-tLY6HA3Z1K3eZ5AhIn4POx1m_vnuG9X1B-zf2NmN5Gxrw___-Lu5h-EaHCyEAP8X--5V96r8Wg==',
      INFLUXDB_ORG: 'carbonoz',
      INFLUXDB_BUCKET: 'home_assistant',
      DATABASE_URL: 'mongodb://localhost:27017/carbonoz'
    }
  }]
}
```

## Deployment Steps

### 1. Deploy to 192.168.160.190
```bash
# From your local machine
sshpass -p 'Adgl5581' scp -r unified-service localadmin@192.168.160.190:~/

# SSH to server
sshpass -p 'Adgl5581' ssh localadmin@192.168.160.190

# Install and start
cd ~/unified-service
npm install
npx prisma generate
npm run build
pm2 start ecosystem.config.js
pm2 save
```

### 2. Verify MongoDB is Running
```bash
# On 192.168.160.190
sudo systemctl status mongod
# If not running:
sudo systemctl start mongod
sudo systemctl enable mongod
```

### 3. Test the Service
```bash
pm2 logs carbonoz-unified
```

You should see:
- ✅ Redis connected
- ✅ Database connected (MongoDB)
- ✅ InfluxDB service initialized
- ✅ Server running on port 8000

### 4. Update Client Applications
Update WebSocket connection in:
- Home Assistant add-on
- Docker app
- Desktop app

Change from: `ws://192.168.160.185:8000`
To: `ws://192.168.160.190:8000`

### 5. Decommission Old Services
```bash
# On 192.168.160.185
pm2 stop socketio
pm2 delete socketio

# On 192.168.160.160
pm2 stop carbonoz-mongo-broker
pm2 delete carbonoz-mongo-broker
# This server can now be shut down
```

## Final Architecture

```
Clients → Unified Service (190:8000) → Redis (185:6379)
                    ↓
                    ├─→ InfluxDB (190:8086) → Grafana (190:3000)
                    └─→ MongoDB (190:27017)
```

## Cost Savings

| Item | Before | After | Savings |
|------|--------|-------|---------|
| Servers | 3 | 2 | 33% |
| Services | 3 | 1 | 66% |
| Maintenance | High | Low | ✅ |

## Network Traffic Reduction

- InfluxDB: Network → Localhost (faster)
- MongoDB: Network → Localhost (faster)
- Redis: Network → Network (same, but acceptable)
