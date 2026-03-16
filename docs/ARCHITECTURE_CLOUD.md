# BotBrain Cloud Architecture Decision

## Problem Statement

BotBrain needs to support remote robot operation where:
- Operators can log in from any network
- Robots remain on their local networks (homes, offices, facilities)
- Operators can securely control robots without manual port forwarding
- Multiple robots can be managed from a single dashboard

## Architecture Decision

We chose a **Private Mesh Network + Cloud Frontend** architecture using Tailscale/Headscale.

### Components

```
┌─────────────────────────────────────────────────────────────┐
│                      Public Internet                          │
└───────────────┬─────────────────────────────────────────────┘
                │
                │ HTTPS (443)
                │
┌───────────────▼─────────────────────────────────────────────┐
│           Cloud VM (Ubuntu 22.04)                             │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Caddy (Reverse Proxy + Auto HTTPS)                     │  │
│  │  - botbrain.yourdomain.com → frontend:3000             │  │
│  │  - /z4rtc → z4rtc_bridge:8787                          │  │
│  └────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Frontend (Next.js)                                      │  │
│  │  - Supabase Auth/DB                                     │  │
│  │  - Serves web dashboard                                 │  │
│  │  - Port 3000 (internal)                                 │  │
│  └────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ z4rtc_bridge (Python FastAPI)                          │  │
│  │  - Port 8787 (internal)                                 │  │
│  └────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Tailscale Client                                        │  │
│  │  - Private IP: 100.x.x.x                               │  │
│  │  - Can reach all robots in mesh                        │  │
│  └────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                │
                │ Tailscale Mesh (Encrypted)
                │
    ┌───────────┴───────────┬────────────────┐
    │                       │                 │
┌───▼──────────┐   ┌───────▼─────┐   ┌──────▼──────┐
│ Robot 1      │   │ Robot 2      │   │ Robot 3     │
│ (Jetson)     │   │ (Jetson)     │   │ (Pi)        │
│              │   │              │   │             │
│ ROS 2        │   │ ROS 2        │   │ ROS 2       │
│ rosbridge    │   │ rosbridge    │   │ rosbridge   │
│ :9090        │   │ :9090        │   │ :9090       │
│              │   │              │   │             │
│ Tailscale:   │   │ Tailscale:   │   │ Tailscale:  │
│ 100.x.x.1    │   │ 100.x.x.2    │   │ 100.x.x.3   │
└──────────────┘   └──────────────┘   └─────────────┘
```

## Why Tailscale/Headscale?

### Advantages

1. **Zero Configuration NAT Traversal**
   - Works behind residential firewalls
   - No port forwarding required
   - No VPS gateway needed for each robot

2. **Encrypted by Default**
   - WireGuard-based encryption
   - Each connection is authenticated
   - Keys managed automatically

3. **Stable Private IPs**
   - Each device gets a stable 100.x.x.x address
   - Robot addresses remain constant across reboots
   - Easy to store in Supabase `robots.address`

4. **Easy Enrollment**
   - One command to join mesh
   - Works on Jetson, Pi, Ubuntu, Mac, Windows
   - No complex VPN server setup

5. **Production Ready**
   - Used by companies worldwide
   - Excellent reliability
   - Good documentation

6. **Choice of Hosted or Self-Hosted**
   - Use Tailscale cloud (free for personal use)
   - Or self-host with Headscale (fully open source)

### Alternatives Considered

| Solution | Pros | Cons | Why Not Chosen |
|----------|------|------|----------------|
| **Public rosbridge** | Simple | Insecure, easy DDoS | Security risk |
| **SSH Tunnels** | Works everywhere | Manual per robot, breaks often | Not scalable |
| **WireGuard Hub-and-Spoke** | Full control | Complex setup, manual key management | Too much ops work |
| **CloudFlare Tunnel** | Good for HTTP | WebSocket support limited | Not designed for ROS |
| **ngrok** | Fast setup | Paid for production, unstable URLs | Cost and reliability |

## Data Flow

### 1. Operator Login
```
Operator → HTTPS → Caddy → Frontend → Supabase Auth
```

### 2. Robot Connection (Standard ROS)
```
Frontend JS → Tailscale Mesh → Robot:9090 (rosbridge)
         ws://100.x.x.1:9090
```

### 3. Robot Connection (z4rtc)
```
Frontend JS → Caddy → z4rtc_bridge → Unitree Cloud API → Robot
```

### 4. Robot Enrollment
```
Robot → tailscale up → Tailscale Control Plane → Mesh Network
Robot → Supabase → Update robot.address to 100.x.x.x
```

## Security Model

### Cloud VM
- Only ports 80/443 open to public
- Caddy handles HTTPS
- Frontend behind reverse proxy
- z4rtc_bridge behind reverse proxy path

### Robot Connection
- All ROS traffic over encrypted Tailscale mesh
- No public exposure of port 9090
- Supabase RLS enforces user owns robot
- Frontend only connects to user's own robots

### Authentication Flow
1. User authenticates with Supabase
2. Frontend fetches user's robots (RLS enforced)
3. Frontend initiates WebSocket to robot's Tailscale IP
4. Robot accepts connection (no additional auth needed - mesh is pre-authenticated)

## Deployment Model

### Cloud Infrastructure
- **Single Ubuntu 22.04 VM** (1 vCPU, 2GB RAM minimum)
- **Domain with DNS** pointing to VM public IP
- **Supabase SaaS** (managed auth/database)
- **Tailscale or Headscale** (coordination server)

### Edge Infrastructure
- **Each robot or Jetson** runs:
  - ROS 2 workspace
  - rosbridge_server on port 9090
  - Tailscale client
  - Auto-start on boot

## Scalability

### Current Architecture Supports
- **100+ robots** in single Tailscale network
- **Thousands of users** (Supabase scales independently)
- **Multiple operators** per robot (managed by Supabase RLS)

### When to Scale Up
- **1000+ robots**: Consider regional Tailscale networks
- **High traffic**: Add load balancer, multiple frontend replicas
- **Global deployment**: Add regional cloud VMs with GeoDNS

## Cost Estimate

### Minimum Production Setup (Tailscale Cloud + Single VM)
- Cloud VM: $5-10/month (DigitalOcean, Hetzner, etc.)
- Domain: $12/year
- Supabase: Free tier (50GB, 500K API requests)
- Tailscale: Free (personal use, up to 100 devices)

**Total: ~$8/month**

### Self-Hosted Option (Headscale + Single VM)
- Cloud VM: $5-10/month
- Domain: $12/year
- Supabase: Free tier
- Headscale: Free (self-hosted on same VM)

**Total: ~$8/month**

## Migration Path from LAN-only

### Current State
- Frontend assumes robot on same LAN
- Address stored as `192.168.x.x`

### Migration Steps
1. Deploy cloud VM with Caddy + Frontend
2. Install Tailscale on cloud VM
3. Install Tailscale on each robot
4. Update robot addresses in Supabase to `100.x.x.x`
5. Operators can now access from anywhere

### Preserving Local Development
- Local dev still works: `ws://192.168.x.x:9090`
- Cloud deployment uses: `ws://100.x.x.x:9090`
- No code changes needed, just address configuration

## Operational Considerations

### Monitoring
- Tailscale dashboard shows all connected devices
- Caddy logs all access attempts
- Supabase dashboard shows auth events
- Docker Compose logs for debugging

### Backup
- Supabase automatic backups
- Robot addresses stored in database
- Docker volumes for any stateful data

### Disaster Recovery
1. Redeploy VM from scratch
2. Point DNS to new VM
3. Deploy docker-compose
4. Robots reconnect automatically via Tailscale

**Recovery time: <30 minutes**

## Future Enhancements

### Phase 2
- Add Redis for session caching
- Add metrics with Prometheus
- Add alerts with Alertmanager

### Phase 3
- Regional deployments
- Load balancing across regions
- Multi-robot coordination features

## Conclusion

The Tailscale + Cloud Frontend architecture provides the best balance of:
- Security (encrypted mesh, no exposed ports)
- Simplicity (minimal components, easy enrollment)
- Reliability (production-grade components)
- Cost (under $10/month for starter deployment)
- Developer Experience (no complex VPN config, works everywhere)

This architecture enables BotBrain to scale from a single robot to a fleet of hundreds while maintaining security and ease of use.
