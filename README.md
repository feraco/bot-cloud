# BotBrain Cloud

A cloud-native robotics control platform that enables remote robot operation from anywhere in the world.

## Features

- **Remote Access:** Control robots from any network using secure Tailscale mesh
- **Multi-Robot Fleet:** Manage and operate multiple robots from a single dashboard
- **Secure by Default:** HTTPS, encrypted tunnels, zero public ROS exposure
- **Production Ready:** Automatic SSL, reverse proxy, health monitoring
- **Easy Enrollment:** One-command robot setup with auto-discovery

## Architecture

```
Internet → Caddy (HTTPS) → Next.js Frontend → Supabase Auth/DB
                         ↓
                    z4rtc Bridge (Unitree robots)

Tailscale Private Network:
  Cloud VM ←→ Robot 1 (rosbridge:9090)
          ←→ Robot 2 (rosbridge:9090)
          ←→ Robot N (rosbridge:9090)
```

## Quick Start

### Cloud Deployment (Production)

Deploy BotBrain to the cloud in under 10 minutes:

```bash
# 1. Clone repository
git clone https://github.com/yourusername/botbrain.git
cd botbrain

# 2. Configure environment
cp .env.production.example .env.production
nano .env.production  # Add your domain and Supabase credentials

# 3. Run deployment script
./scripts/deploy-cloud.sh

# 4. Access at https://your-domain.com
```

**Full guide:** [docs/CLOUD_DEPLOYMENT.md](docs/CLOUD_DEPLOYMENT.md)

### Local Development

For local development and testing:

```bash
# 1. Copy environment template
cp .env.example .env

# 2. Configure Supabase
nano .env  # Add your Supabase credentials

# 3. Start services
docker compose up --build

# 4. Access at http://localhost:3000
```

### Robot Enrollment

Connect robots to your cloud deployment:

```bash
# On each robot:
curl -fsSL https://tailscale.com/install.sh | sh
tailscale up

# Note the Tailscale IP, then add robot in dashboard
```

**Full guide:** [docs/ROBOT_ENROLLMENT.md](docs/ROBOT_ENROLLMENT.md)

## Documentation

### Getting Started
- [Cloud Deployment Guide](docs/CLOUD_DEPLOYMENT.md) - Deploy to production
- [Robot Enrollment](docs/ROBOT_ENROLLMENT.md) - Connect robots to your deployment
- [Supabase Setup](docs/SUPABASE_SETUP.md) - Configure database and auth

### Architecture
- [Architecture Decision](docs/ARCHITECTURE_CLOUD.md) - Design rationale and tradeoffs
- [z4rtc Bridge](docs/z4rtc-bridge.md) - Unitree robot support

### Operations
- [Troubleshooting Guide](docs/TROUBLESHOOTING_CLOUD.md) - Fix common issues
- [Verification Script](scripts/verify-deployment.sh) - Health checks

## Project Structure

```text
.
├── docker-compose.yaml              # Local development
├── docker-compose.production.yaml   # Production deployment
├── Caddyfile                        # Reverse proxy + HTTPS
├── frontend/                        # Next.js dashboard
├── z4rtc_bridge/                    # Unitree bridge service
├── z4rtc/                          # z4rtc checkout (optional)
├── docs/                            # Documentation
└── scripts/                         # Deployment scripts
    ├── deploy-cloud.sh             # Automated deployment
    └── verify-deployment.sh        # Health checks
```

## Requirements

### Cloud VM
- Ubuntu 22.04 LTS
- 1 vCPU, 2GB RAM (minimum)
- 20GB disk space
- Public IP address
- Ports 80, 443 open

### Domain
- Domain name pointing to VM
- DNS A record configured

### Services
- Supabase project (free tier works)
- Tailscale account (free for personal use)

### Robots
- Ubuntu 20.04+ (Jetson, Pi, or PC)
- ROS 2 Humble
- rosbridge_server installed
- Internet connection

## Technology Stack

- **Frontend:** Next.js 15, React, TypeScript, Tailwind CSS
- **Backend:** Supabase (Auth, Database, Storage)
- **Reverse Proxy:** Caddy (automatic HTTPS)
- **Networking:** Tailscale (WireGuard-based mesh)
- **Robotics:** ROS 2 Humble, rosbridge_websocket
- **Deployment:** Docker, Docker Compose

## Security

- All HTTP traffic redirected to HTTPS
- Automatic SSL certificate management
- Robot connections over encrypted Tailscale mesh
- No public exposure of rosbridge ports
- Row-level security on all database tables
- Supabase authentication with JWT

## Cost Estimate

**Minimum Production Setup:**
- Cloud VM: $5-10/month
- Domain: $12/year (~$1/month)
- Supabase: Free tier (50GB, 500K requests/month)
- Tailscale: Free (personal use, up to 100 devices)

**Total: ~$8/month**

## Deployment Options

### Single VM (Recommended for Starters)
- All services on one Ubuntu VM
- Caddy + Frontend + z4rtc bridge
- Handles 100+ robots easily
- Cost: ~$8/month

### Kubernetes (Enterprise)
- Multi-node deployment
- Auto-scaling
- Regional distribution
- See enterprise docs (coming soon)

## Support

- **Documentation:** Check [docs/](docs/) folder
- **Issues:** Open a GitHub issue
- **Verification:** Run `./scripts/verify-deployment.sh`
- **Logs:** `docker compose logs -f`

## Development

```bash
# Install dependencies
cd frontend
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Run tests
npm test
```

## Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

See [LICENSE](LICENSE) file.

## Notes

- The frontend expects robots to be reachable via Tailscale private IPs or through z4rtc transport
- For remote ROS control, use Tailscale rather than exposing rosbridge publicly
- If you change any `NEXT_PUBLIC_*` variable, rebuild the frontend image
- This repo is optimized for cloud deployment; the full ROS 2 workspace runs on robot hardware

## Roadmap

- [x] Cloud deployment with HTTPS
- [x] Tailscale mesh networking
- [x] Automated enrollment scripts
- [x] Health monitoring and verification
- [ ] Headscale setup guide (self-hosted Tailscale)
- [ ] Multi-region deployment
- [ ] Kubernetes manifests
- [ ] Observability stack (Prometheus, Grafana)
- [ ] Multi-user collaboration features

## Quick Reference

| Task | Command |
|------|---------|
| Deploy to cloud | `./scripts/deploy-cloud.sh` |
| Verify deployment | `./scripts/verify-deployment.sh` |
| View logs | `docker compose logs -f` |
| Restart services | `docker compose restart` |
| Update deployment | `git pull && docker compose up -d --build` |
| Enroll robot | See [ROBOT_ENROLLMENT.md](docs/ROBOT_ENROLLMENT.md) |