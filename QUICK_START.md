# BotBrain Cloud - Quick Start Guide

Get BotBrain running in the cloud in 10 minutes.

## Prerequisites Checklist

- [ ] Ubuntu 22.04 VM with public IP
- [ ] Domain pointing to VM (e.g., `botbrain.yourdomain.com`)
- [ ] Supabase project created
- [ ] SSH access to VM

## Step 1: VM Setup (2 minutes)

```bash
# SSH into your VM
ssh root@your-vm-ip

# Install dependencies
apt update && apt install -y docker.io docker-compose-plugin git curl

# Create user
useradd -m -s /bin/bash botbrain
usermod -aG docker botbrain
su - botbrain
```

## Step 2: Install Tailscale (1 minute)

```bash
# Install
curl -fsSL https://tailscale.com/install.sh | sh

# Authenticate (follow link)
sudo tailscale up

# Note your Tailscale IP
sudo tailscale ip -4
```

## Step 3: Deploy BotBrain (5 minutes)

```bash
# Clone
cd ~
git clone https://github.com/yourusername/botbrain.git
cd botbrain

# Configure
cp .env.production.example .env.production
nano .env.production
```

**Edit these values:**
```env
DOMAIN=botbrain.yourdomain.com
CADDY_EMAIL=admin@yourdomain.com
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
NEXT_PUBLIC_APP_URL=https://botbrain.yourdomain.com
```

**Deploy:**
```bash
./scripts/deploy-cloud.sh
```

## Step 4: Verify (2 minutes)

```bash
# Run verification
./scripts/verify-deployment.sh

# Access dashboard
# https://botbrain.yourdomain.com
```

## Step 5: Enroll Robot (Per Robot)

**On each robot:**
```bash
# Install Tailscale
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up

# Get IP
ROBOT_IP=$(sudo tailscale ip -4)
echo "Add this to dashboard: $ROBOT_IP"

# Install rosbridge (if not already)
sudo apt install -y ros-humble-rosbridge-suite

# Create service
sudo tee /etc/systemd/system/rosbridge.service > /dev/null <<EOF
[Unit]
Description=ROS Bridge WebSocket Server
After=network.target

[Service]
Type=simple
User=$USER
Environment="ROS_DOMAIN_ID=0"
ExecStart=/bin/bash -c "source /opt/ros/humble/setup.bash && ros2 launch rosbridge_server rosbridge_websocket_launch.xml"
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable rosbridge.service
sudo systemctl start rosbridge.service
```

**In dashboard:**
1. Go to Fleet → Add Robot
2. Name: `My Robot`
3. Address: `100.x.x.x` (from above)
4. Save
5. Click Connect

## Done!

You should now be able to:
- Access BotBrain from any network
- Control robots remotely
- Add more robots easily

## Troubleshooting

**Dashboard not loading?**
```bash
# Check containers
docker compose -f docker-compose.production.yaml ps

# Check logs
docker logs botbrain_caddy
```

**SSL certificate error?**
```bash
# Wait 2 minutes for Let's Encrypt
# Check DNS is pointing to VM
nslookup botbrain.yourdomain.com
```

**Robot won't connect?**
```bash
# On robot, check Tailscale
sudo tailscale status

# Check rosbridge
sudo systemctl status rosbridge.service

# From VM, test connection
websocat ws://ROBOT_TAILSCALE_IP:9090
```

## Full Documentation

- [Complete Deployment Guide](docs/CLOUD_DEPLOYMENT.md)
- [Robot Enrollment Guide](docs/ROBOT_ENROLLMENT.md)
- [Troubleshooting Guide](docs/TROUBLESHOOTING_CLOUD.md)
- [Architecture Overview](docs/ARCHITECTURE_CLOUD.md)

## Quick Commands

| Task | Command |
|------|---------|
| View logs | `docker compose -f docker-compose.production.yaml logs -f` |
| Restart all | `docker compose -f docker-compose.production.yaml restart` |
| Check health | `./scripts/verify-deployment.sh` |
| Update | `git pull && docker compose -f docker-compose.production.yaml up -d --build` |

## Need Help?

1. Run verification: `./scripts/verify-deployment.sh`
2. Check logs: `docker compose logs -f`
3. See troubleshooting guide: `docs/TROUBLESHOOTING_CLOUD.md`
4. Open GitHub issue with logs

---

**Total Time:** ~10 minutes for cloud, ~5 minutes per robot

**Cost:** ~$8/month

**Supported:** 100+ robots per deployment
