# Architecture Comparison: Unified vs Separate Services

## Current Architecture (2 Services)

```
┌─────────────────────────────────────────────────────────────┐
│                     Client Applications                      │
│  (Home Assistant, Docker App, Desktop App)                  │
└────────────────────┬────────────────────────────────────────┘
                     │ WebSocket
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  Socket.IO Service (192.168.160.185)                        │
│  ├─ WebSocket Server                                        │
│  ├─ Redis Writer ✅ (with logging)                          │
│  └─ InfluxDB Writer ✅ (with logging)                       │
└────────────────────┬────────────────────────────────────────┘
                     │ Redis
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  MongoDB Broker (192.168.160.160)                           │
│  ├─ Scheduled Job (every 2 min)                            │
│  ├─ Read from Redis                                         │
│  └─ Write to MongoDB ✅ (with logging)                      │
└─────────────────────────────────────────────────────────────┘

Servers Required: 2
Network Hops: 2
Maintenance Points: 2
```

## Proposed Unified Architecture (1 Service)

```
┌─────────────────────────────────────────────────────────────┐
│                     Client Applications                      │
│  (Home Assistant, Docker App, Desktop App)                  │
└────────────────────┬────────────────────────────────────────┘
                     │ WebSocket
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  Unified Service (192.168.160.190)                          │
│  ├─ WebSocket Server                                        │
│  ├─ Redis Writer ✅ (with logging)                          │
│  ├─ InfluxDB Writer ✅ (with logging)                       │
│  └─ MongoDB Sync ✅ (with logging, every 2 min)             │
└─────────────────────────────────────────────────────────────┘

Servers Required: 1
Network Hops: 0
Maintenance Points: 1
```

## Comparison Table

| Aspect | Current (2 Services) | Unified (1 Service) | Improvement |
|--------|---------------------|---------------------|-------------|
| **Servers** | 2 | 1 | 50% reduction |
| **Deployment Complexity** | High | Low | ✅ Simpler |
| **Network Latency** | Redis over network | Local | ✅ Faster |
| **Monitoring** | 2 PM2 processes | 1 PM2 process | ✅ Easier |
| **Debugging** | Check 2 services | Check 1 service | ✅ Simpler |
| **Code Maintenance** | 2 codebases | 1 codebase | ✅ Easier |
| **Server Costs** | 2x | 1x | 50% savings |
| **Single Point of Failure** | Distributed | Centralized | ⚠️ Consider HA |
| **Resource Usage** | Distributed | Consolidated | ✅ More efficient |

## Benefits of Unified Service

### 1. **Operational Simplicity**
- Single deployment process
- One service to monitor
- Unified logging in one place
- Single configuration file

### 2. **Performance**
- No network latency between Socket.IO and MongoDB sync
- Faster data processing
- Reduced Redis connection overhead

### 3. **Cost Efficiency**
- One server instead of two
- Reduced infrastructure costs
- Lower maintenance overhead

### 4. **Development**
- Single codebase to maintain
- Easier to add new features
- Consistent coding standards
- Shared utilities and configurations

### 5. **Reliability**
- Fewer network dependencies
- Simpler failure scenarios
- Easier to implement retry logic
- Better error handling

## Migration Strategy

### Phase 1: Deploy Unified Service
```bash
bash deploy-unified.sh
```

### Phase 2: Test in Parallel
- Keep old services running
- Monitor unified service logs
- Verify all three databases receiving data

### Phase 3: Switch Traffic
- Update client applications to point to new server
- Monitor for 24 hours

### Phase 4: Decommission Old Services
```bash
pm2 stop socketio carbonoz-mongo-broker
pm2 delete socketio carbonoz-mongo-broker
```

## Rollback Plan

If issues occur:
```bash
# Stop unified service
pm2 stop carbonoz-unified

# Restart old services
pm2 restart socketio carbonoz-mongo-broker
```

## Recommendation

✅ **Proceed with unified service** for:
- Simplified operations
- Cost savings
- Better performance
- Easier maintenance

⚠️ **Consider** adding:
- Health check endpoints
- Prometheus metrics
- Automated backups
- High availability setup (if critical)
