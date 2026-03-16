# BotBrain Cloud Deployment Guide

This guide walks you through deploying BotBrain to production where operators can access robots from anywhere.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Architecture Overview](#architecture-overview)
3. [Cloud VM Setup](#cloud-vm-setup)
4. [Tailscale Network Setup](#tailscale-network-setup)
5. [Application Deployment](#application-deployment)
6. [DNS Configuration](#dns-configuration)
7. [Verification](#verification)
8. [Next Steps](#next-steps)

---

## Prerequisites

### Required

- **Cloud VM**: Ubuntu 22.04 LTS with at least 1 vCPU, 2GB RAM, 20GB disk
  - Recommended providers: DigitalOcean, Hetzner, Vultr, AWS, GCP
  - Public IP address
  - Ports 80 and 443 open

- **Domain Name**: A domain pointing to your VM's public IP
  - Example: `botbrain.yourdomain.com`

- **Supabase Project**: Set up according to [SUPABASE_SETUP.md](./SUPABASE_SETUP.md)
  - Project URL
  - Anon key
  - Database tables created
  - RLS policies enabled

- **Tailscale Account**: Free account at [tailscale.com](https://tailscale.com)
  - Or self-hosted Headscale instance

### Optional

- **z4rtc Support**: If using Unitree robots with z4rtc
  - Unitree cloud credentials
  - z4rtc repository cloned

---

## Architecture Overview

```
Internet → Caddy (HTTPS) → Frontend → Supabase
                         ↓
                    z4rtc_bridge

Tailscale Mesh Network:
  Cloud VM (100.x.x.100) ←→ Robot 1 (100.x.x.1)
                         ←→ Robot 2 (100.x.x.2)
                         ←→ Robot N (100.x.x.N)
```

**Key Points:**
- Frontend is public, served over HTTPS
- ROS traffic goes through encrypted Tailscale mesh
- No public exposure of rosbridge (port 9090)
- Each robot gets a stable private IP

---

## Cloud VM Setup

### 1. Create VM

Create an Ubuntu 22.04 LTS instance with:
- 1 vCPU, 2GB RAM (minimum)
- 20GB disk space
- Public IP address

```bash
# SSH into your VM
ssh root@your-vm-ip
```

### 2. Initial Setup

```bash
# Update system
apt update && apt upgrade -y

# Install required packages
apt install -y \
    git \
    curl \
    ca-certificates \
    gnupg \
    lsb-release

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
apt install -y docker-compose-plugin

# Verify installation
docker --version
docker compose version
```

### 3. Create Application User

```bash
# Create botbrain user
useradd -m -s /bin/bash botbrain
usermod -aG docker botbrain

# Switch to botbrain user
su - botbrain
```

### 4. Clone Repository

```bash
# Clone BotBrain repository
cd ~
git clone https://github.com/yourusername/botbrain.git
cd botbrain

# Or download the starter repo if using that
```

### 5. Configure Firewall

```bash
# Exit botbrain user
exit

# Configure UFW firewall
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw allow 41641/udp # Tailscale
ufw enable

# Verify
ufw status
```

---

## Tailscale Network Setup

### Option A: Tailscale Cloud (Recommended)

```bash
# Install Tailscale
curl -fsSL https://tailscale.com/install.sh | sh

# Start Tailscale
tailscale up

# Follow the link to authenticate
# This will give your VM a 100.x.x.x address

# Verify connection
tailscale status
```

### Option B: Headscale (Self-Hosted)

See [Headscale Setup Guide](./HEADSCALE_SETUP.md) for self-hosted option.

### Get VM Tailscale IP

```bash
# Get your VM's Tailscale IP
tailscale ip -4

# Example output: 100.101.102.100
# Save this IP, you'll need it
```

---

## Application Deployment

### 1. Create Production Environment File

```bash
# Switch to botbrain user
su - botbrain
cd ~/botbrain

# Copy environment template
cp .env.example .env.production

# Edit configuration
nano .env.production
```

**Required Configuration:**

```env
# Domain Configuration
DOMAIN=botbrain.yourdomain.com
CADDY_EMAIL=admin@yourdomain.com

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Application URLs
NEXT_PUBLIC_APP_URL=https://botbrain.yourdomain.com
NEXT_PUBLIC_ROS_PORT=9090

# z4rtc Bridge Configuration (optional)
Z4RTC_BRIDGE_URL=https://botbrain.yourdomain.com/z4rtc
Z4RTC_COMMAND=python3 /opt/z4rtc/z4rtc.py
Z4RTC_ALLOW_RAW_COMMANDS=false

# Unitree Cloud (optional, if using z4rtc cloud mode)
UNITREE_CLOUD_EMAIL=your-email@example.com
UNITREE_CLOUD_PASSWORD=your-password
```

### 2. Set Up z4rtc (Optional)

If you need z4rtc support:

```bash
# Clone z4rtc repository
cd ~/botbrain
git clone https://github.com/z4ziggy/z4rtc.git z4rtc
```

### 3. Build and Deploy

```bash
# Load environment variables
export $(cat .env.production | grep -v '^#' | xargs)

# Build images
docker compose -f docker-compose.production.yaml build

# Start services
docker compose -f docker-compose.production.yaml up -d

# Verify all containers are running
docker compose -f docker-compose.production.yaml ps

# Check logs
docker compose -f docker-compose.production.yaml logs -f
```

### 4. Verify Local Access

```bash
# Test local HTTP access
curl http://localhost

# Should return HTML from Next.js frontend

# Test z4rtc bridge health
curl http://localhost/z4rtc/health

# Should return JSON: {"ok": true, "sessions": 0, ...}
```

---

## DNS Configuration

### 1. Add DNS A Record

In your domain registrar or DNS provider:

```
Type: A
Name: botbrain (or your subdomain)
Value: YOUR_VM_PUBLIC_IP
TTL: 300 (or automatic)
```

### 2. Wait for DNS Propagation

```bash
# Check DNS propagation
nslookup botbrain.yourdomain.com

# Or use online tools:
# https://dnschecker.org
```

### 3. Verify HTTPS

Once DNS propagates, Caddy will automatically:
- Request SSL certificate from Let's Encrypt
- Enable HTTPS
- Redirect HTTP to HTTPS

```bash
# Check Caddy logs
docker logs botbrain_caddy

# Look for successful certificate acquisition:
# "certificate obtained successfully"
```

Access your application:

```
https://botbrain.yourdomain.com
```

---

## Verification

### 1. Test Frontend Access

```bash
# From your local machine (not the VM)
curl https://botbrain.yourdomain.com

# Should return HTML
# Certificate should be valid (check in browser)
```

### 2. Test User Authentication

1. Open `https://botbrain.yourdomain.com` in browser
2. Create a new account
3. Verify you can log in
4. Check Supabase dashboard for new user

### 3. Test z4rtc Bridge (if enabled)

```bash
curl https://botbrain.yourdomain.com/z4rtc/health

# Should return:
# {"ok": true, "sessions": 0, "bridgePort": "8787", ...}
```

### 4. Create Test Robot Entry

1. Log into BotBrain dashboard
2. Go to Fleet
3. Add a robot:
   - Name: `Test Robot`
   - Address: `100.x.x.1` (will be your robot's Tailscale IP)
   - Type: `go2` or appropriate type
4. Save

**Note:** This robot won't connect yet until you enroll it. See [Robot Enrollment Guide](#next-steps).

---

## Deployment Checklist

- [ ] Cloud VM created with Ubuntu 22.04
- [ ] Docker and Docker Compose installed
- [ ] Firewall configured (ports 80, 443, 41641)
- [ ] Tailscale installed and authenticated
- [ ] VM has Tailscale IP (100.x.x.x)
- [ ] DNS A record points to VM public IP
- [ ] `.env.production` configured with all required values
- [ ] Supabase project set up with tables and RLS
- [ ] Docker containers built and running
- [ ] HTTPS working with valid certificate
- [ ] Can access dashboard at https://your-domain.com
- [ ] Can create account and log in
- [ ] z4rtc bridge health check passes (if applicable)

---

## Next Steps

### 1. Enroll Robots

See [ROBOT_ENROLLMENT.md](./ROBOT_ENROLLMENT.md) for detailed instructions on:
- Installing Tailscale on robots
- Configuring rosbridge for remote access
- Updating robot addresses in Supabase
- Testing remote connections

### 2. Configure Monitoring

Set up basic monitoring:

```bash
# Create monitoring script
cat > ~/monitor.sh << 'EOF'
#!/bin/bash
docker compose -f ~/botbrain/docker-compose.production.yaml ps
curl -s https://botbrain.yourdomain.com/health
EOF

chmod +x ~/monitor.sh

# Add to crontab for hourly checks
crontab -e
# Add: 0 * * * * /home/botbrain/monitor.sh >> /home/botbrain/monitor.log 2>&1
```

### 3. Set Up Backups

```bash
# Create backup script
cat > ~/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR=~/backups
mkdir -p $BACKUP_DIR

# Backup .env file
cp ~/botbrain/.env.production $BACKUP_DIR/env-$(date +%Y%m%d).backup

# Backup docker volumes
docker run --rm -v botbrain_caddy_data:/data -v $BACKUP_DIR:/backup \
  alpine tar czf /backup/caddy-data-$(date +%Y%m%d).tar.gz -C /data .

# Keep only last 7 backups
find $BACKUP_DIR -name "*.backup" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete
EOF

chmod +x ~/backup.sh

# Add to crontab for daily backups
# 0 2 * * * /home/botbrain/backup.sh
```

### 4. Update Procedure

```bash
# Pull latest changes
cd ~/botbrain
git pull

# Rebuild and restart
docker compose -f docker-compose.production.yaml build
docker compose -f docker-compose.production.yaml up -d

# Clean up old images
docker system prune -f
```

---

## Troubleshooting

See [TROUBLESHOOTING_CLOUD.md](./TROUBLESHOOTING_CLOUD.md) for common issues and solutions.

### Quick Diagnostics

```bash
# Check all container status
docker compose -f docker-compose.production.yaml ps

# Check logs
docker compose -f docker-compose.production.yaml logs -f

# Check Caddy specifically
docker logs botbrain_caddy --tail 100

# Check Tailscale
tailscale status

# Check firewall
ufw status

# Check DNS
nslookup your-domain.com

# Test HTTPS
curl -I https://your-domain.com
```

---

## Security Considerations

### 1. Keep System Updated

```bash
# Set up automatic security updates
apt install unattended-upgrades
dpkg-reconfigure --priority=low unattended-upgrades
```

### 2. SSH Security

```bash
# Disable root login
nano /etc/ssh/sshd_config
# Set: PermitRootLogin no

# Use SSH keys instead of passwords
# Restart SSH
systemctl restart sshd
```

### 3. Monitor Access Logs

```bash
# Check Caddy access logs
docker exec botbrain_caddy cat /var/log/caddy/access.log | tail -n 50

# Check for suspicious activity
```

### 4. Regular Updates

- Update Docker images monthly
- Update Tailscale client with `tailscale update`
- Monitor Supabase security advisories
- Review access logs weekly

---

## Cost Optimization

### Reduce VM Costs

- Use ARM-based VMs if available (usually cheaper)
- Consider spot/preemptible instances for development
- Use regional pricing (Hetzner often cheaper than AWS)

### Supabase Optimization

- Monitor database size
- Clean up old audit logs periodically
- Use row-level security to prevent data leaks

### Example SQL for Cleanup

```sql
-- Delete audit logs older than 90 days
DELETE FROM public.audit_logs
WHERE created_at < NOW() - INTERVAL '90 days';
```

---

## Production Checklist

Before going live:

- [ ] All secrets in `.env.production` are strong and unique
- [ ] Supabase RLS policies are tested and working
- [ ] HTTPS is working with valid certificate
- [ ] Email confirmation enabled in Supabase (optional but recommended)
- [ ] Backup script is configured and tested
- [ ] Monitoring is set up
- [ ] SSH is secured (keys only, no root login)
- [ ] Firewall is properly configured
- [ ] At least one robot successfully enrolled and tested
- [ ] Documentation is updated with your specific configuration

---

## Support

For issues:
1. Check [TROUBLESHOOTING_CLOUD.md](./TROUBLESHOOTING_CLOUD.md)
2. Review logs: `docker compose logs -f`
3. Check Tailscale status: `tailscale status`
4. Verify DNS: `nslookup your-domain.com`
5. Open an issue on GitHub with logs and configuration (redact secrets!)

---

## Additional Resources

- [Architecture Decision](./ARCHITECTURE_CLOUD.md)
- [Robot Enrollment Guide](./ROBOT_ENROLLMENT.md)
- [Troubleshooting Guide](./TROUBLESHOOTING_CLOUD.md)
- [Supabase Setup](./SUPABASE_SETUP.md)
- [z4rtc Bridge Setup](./z4rtc-bridge.md)
- [Tailscale Documentation](https://tailscale.com/kb/)
- [Caddy Documentation](https://caddyserver.com/docs/)
