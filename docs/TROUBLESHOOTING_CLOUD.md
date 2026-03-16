# BotBrain Cloud Troubleshooting Guide

This guide helps you diagnose and fix common issues with BotBrain cloud deployments.

## Table of Contents

1. [Quick Diagnostics](#quick-diagnostics)
2. [Container Issues](#container-issues)
3. [Network Issues](#network-issues)
4. [HTTPS and Certificate Issues](#https-and-certificate-issues)
5. [Robot Connection Issues](#robot-connection-issues)
6. [Tailscale Issues](#tailscale-issues)
7. [Database Issues](#database-issues)
8. [Performance Issues](#performance-issues)
9. [Rollback Procedures](#rollback-procedures)

---

## Quick Diagnostics

### Run Verification Script

```bash
cd ~/botbrain
./scripts/verify-deployment.sh
```

This will check all major components and report issues.

### Check All Container Status

```bash
docker compose -f docker-compose.production.yaml ps
```

All containers should show "Up" status.

### View Recent Logs

```bash
# All services
docker compose -f docker-compose.production.yaml logs --tail=100

# Specific service
docker logs botbrain_caddy --tail=50
docker logs botbrain_frontend --tail=50
docker logs botbrain_z4rtc_bridge --tail=50
```

### Check Resource Usage

```bash
# Container resource usage
docker stats --no-stream

# Disk space
df -h

# Memory
free -h
```

---

## Container Issues

### Container Won't Start

**Symptom:** Container exits immediately after starting

**Diagnosis:**

```bash
# Check container status
docker compose -f docker-compose.production.yaml ps

# Check logs
docker logs botbrain_frontend --tail=100

# Check for port conflicts
sudo netstat -tulpn | grep -E ':(80|443|3000|8787)'
```

**Solutions:**

1. **Port already in use:**
   ```bash
   # Find what's using the port
   sudo lsof -i :80
   sudo lsof -i :443

   # Stop conflicting service
   sudo systemctl stop apache2  # or nginx
   sudo systemctl disable apache2
   ```

2. **Environment variable issues:**
   ```bash
   # Verify .env.production
   cat .env.production

   # Rebuild with fresh environment
   docker compose -f docker-compose.production.yaml down
   docker compose -f docker-compose.production.yaml up -d --build
   ```

3. **Build failures:**
   ```bash
   # Clean rebuild
   docker compose -f docker-compose.production.yaml down -v
   docker system prune -f
   docker compose -f docker-compose.production.yaml build --no-cache
   docker compose -f docker-compose.production.yaml up -d
   ```

### Container Keeps Restarting

**Symptom:** Container status shows "Restarting"

**Diagnosis:**

```bash
# Check restart count
docker compose -f docker-compose.production.yaml ps

# Check logs for crash reason
docker logs botbrain_frontend --tail=200

# Check if it's a resource issue
docker stats --no-stream
```

**Solutions:**

1. **Out of memory:**
   ```bash
   # Check memory
   free -h

   # Increase swap if needed
   sudo fallocate -l 2G /swapfile
   sudo chmod 600 /swapfile
   sudo mkswap /swapfile
   sudo swapon /swapfile
   echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
   ```

2. **Missing dependencies:**
   ```bash
   # Rebuild frontend
   docker compose -f docker-compose.production.yaml build frontend --no-cache
   ```

3. **Database connection issues:**
   ```bash
   # Test Supabase connectivity
   curl -I $NEXT_PUBLIC_SUPABASE_URL
   ```

---

## Network Issues

### Cannot Access Dashboard

**Symptom:** Browser cannot load `https://yourdomain.com`

**Diagnosis:**

```bash
# Test from server
curl -I http://localhost

# Test from outside
curl -I https://yourdomain.com

# Check DNS
nslookup yourdomain.com

# Check firewall
sudo ufw status
```

**Solutions:**

1. **Firewall blocking:**
   ```bash
   # Open required ports
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   sudo ufw reload
   ```

2. **DNS not propagated:**
   ```bash
   # Check DNS propagation
   dig yourdomain.com

   # Use online checker
   # https://dnschecker.org
   ```

3. **Container not responding:**
   ```bash
   # Restart services
   docker compose -f docker-compose.production.yaml restart
   ```

### Slow Loading Times

**Diagnosis:**

```bash
# Check response time
time curl -I https://yourdomain.com

# Check container logs for slow queries
docker logs botbrain_frontend --tail=100 | grep -i slow
```

**Solutions:**

1. **Increase container resources:**
   ```bash
   # Edit docker-compose.production.yaml
   # Add resource limits
   ```

2. **Check Supabase performance:**
   - Log into Supabase dashboard
   - Check query performance
   - Add database indexes if needed

3. **Enable caching:**
   - Consider adding Redis
   - Enable CDN for static assets

---

## HTTPS and Certificate Issues

### HTTPS Not Working

**Symptom:** Browser shows security warning or connection refused

**Diagnosis:**

```bash
# Check Caddy logs
docker logs botbrain_caddy | grep -i certificate

# Test HTTPS
curl -I https://yourdomain.com

# Check certificate
echo | openssl s_client -connect yourdomain.com:443 -servername yourdomain.com
```

**Solutions:**

1. **DNS not pointing to server:**
   ```bash
   # Verify DNS
   dig yourdomain.com +short

   # Should return your server's public IP
   curl ifconfig.me
   ```

2. **Let's Encrypt rate limit:**
   ```bash
   # Wait 1 hour and try again
   # Or use staging temporarily (edit Caddyfile)
   ```

3. **Firewall blocking port 443:**
   ```bash
   sudo ufw allow 443/tcp
   ```

4. **Caddy not running:**
   ```bash
   docker compose -f docker-compose.production.yaml restart caddy
   ```

### Certificate Renewal Issues

**Diagnosis:**

```bash
# Check certificate expiry
echo | openssl s_client -connect yourdomain.com:443 -servername yourdomain.com 2>/dev/null | openssl x509 -noout -dates
```

**Solutions:**

```bash
# Force renewal
docker exec botbrain_caddy caddy reload --config /etc/caddy/Caddyfile

# If that doesn't work, restart Caddy
docker compose -f docker-compose.production.yaml restart caddy
```

### Mixed Content Errors

**Symptom:** Browser console shows "Mixed content" errors

**Solution:**

```bash
# Verify NEXT_PUBLIC_APP_URL uses https
grep NEXT_PUBLIC_APP_URL .env.production

# Should be:
# NEXT_PUBLIC_APP_URL=https://yourdomain.com

# Rebuild if needed
docker compose -f docker-compose.production.yaml build frontend
docker compose -f docker-compose.production.yaml up -d
```

---

## Robot Connection Issues

### Cannot Connect to Robot

**Symptom:** Dashboard shows "Connection failed" or timeout

**Diagnosis:**

```bash
# From cloud VM, test robot connectivity
ping ROBOT_TAILSCALE_IP

# Test rosbridge
websocat -n1 ws://ROBOT_TAILSCALE_IP:9090

# Check robot address in dashboard
# Should be Tailscale IP (100.x.x.x)
```

**Solutions:**

1. **Robot not on Tailscale network:**
   ```bash
   # On robot
   sudo tailscale status

   # If not running
   sudo tailscale up
   ```

2. **rosbridge not running on robot:**
   ```bash
   # On robot
   sudo systemctl status rosbridge.service

   # Start if stopped
   sudo systemctl start rosbridge.service
   ```

3. **Wrong address in database:**
   ```sql
   -- In Supabase SQL editor
   SELECT name, address FROM robots WHERE user_id = auth.uid();

   -- Update if wrong
   UPDATE robots SET address = '100.x.x.x' WHERE id = 'robot-id';
   ```

4. **Firewall on robot:**
   ```bash
   # On robot
   sudo ufw status

   # Allow from Tailscale network
   sudo ufw allow in on tailscale0 to any port 9090
   ```

### Connection Drops Frequently

**Diagnosis:**

```bash
# Check network stability
# From cloud VM to robot
ping -i 1 ROBOT_TAILSCALE_IP

# Check for packet loss
mtr ROBOT_TAILSCALE_IP
```

**Solutions:**

1. **Increase Tailscale keepalive:**
   ```bash
   # On both cloud VM and robot
   sudo tailscale set --accept-routes
   ```

2. **Check robot internet connection:**
   ```bash
   # On robot
   ping 8.8.8.8
   speedtest-cli
   ```

3. **Adjust connection timeout:**
   - In BotBrain dashboard, go to Settings
   - Increase "Connection Timeout" value

---

## Tailscale Issues

### Tailscale Not Connecting

**Diagnosis:**

```bash
# Check status
sudo tailscale status

# Check logs
sudo journalctl -u tailscaled -n 50
```

**Solutions:**

1. **Not authenticated:**
   ```bash
   sudo tailscale up
   # Follow authentication link
   ```

2. **Service not running:**
   ```bash
   sudo systemctl start tailscaled
   sudo systemctl enable tailscaled
   ```

3. **Firewall blocking:**
   ```bash
   sudo ufw allow 41641/udp
   ```

### Cannot Reach Peers

**Diagnosis:**

```bash
# List peers
sudo tailscale status

# Try to ping peer
ping PEER_TAILSCALE_IP

# Check routes
sudo tailscale netcheck
```

**Solutions:**

1. **Restart Tailscale:**
   ```bash
   sudo tailscale down
   sudo tailscale up
   ```

2. **Force direct connection:**
   ```bash
   sudo tailscale set --accept-routes
   ```

3. **Check peer is online:**
   ```bash
   # On peer
   sudo tailscale status
   ```

---

## Database Issues

### Cannot Connect to Supabase

**Diagnosis:**

```bash
# Test connectivity
curl -I $NEXT_PUBLIC_SUPABASE_URL

# Test with API key
curl "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY"
```

**Solutions:**

1. **Check environment variables:**
   ```bash
   grep SUPABASE .env.production
   ```

2. **Verify Supabase project is active:**
   - Log into Supabase dashboard
   - Check project status

3. **Check API key:**
   - Regenerate if needed from Supabase dashboard

### Database Queries Slow

**Solutions:**

1. **Add indexes:**
   ```sql
   -- In Supabase SQL editor
   CREATE INDEX IF NOT EXISTS idx_robots_user_id ON robots(user_id);
   CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
   ```

2. **Clean up old data:**
   ```sql
   -- Delete old audit logs
   DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '90 days';
   ```

3. **Check RLS policies:**
   - Ensure policies are efficient
   - Avoid complex subqueries in policies

---

## Performance Issues

### High CPU Usage

**Diagnosis:**

```bash
# Check container CPU usage
docker stats --no-stream

# Check host CPU
top
```

**Solutions:**

1. **Restart services:**
   ```bash
   docker compose -f docker-compose.production.yaml restart
   ```

2. **Increase VM resources:**
   - Upgrade to larger VM instance

3. **Optimize queries:**
   - Check slow database queries
   - Add appropriate indexes

### High Memory Usage

**Diagnosis:**

```bash
# Check memory
free -h

# Check container memory
docker stats --no-stream
```

**Solutions:**

1. **Add swap space:**
   ```bash
   sudo fallocate -l 2G /swapfile
   sudo chmod 600 /swapfile
   sudo mkswap /swapfile
   sudo swapon /swapfile
   ```

2. **Restart containers:**
   ```bash
   docker compose -f docker-compose.production.yaml restart
   ```

3. **Upgrade VM:**
   - Consider VM with more RAM

### Disk Space Full

**Diagnosis:**

```bash
# Check disk usage
df -h

# Find large files
du -sh /* | sort -h
du -sh /var/lib/docker/* | sort -h
```

**Solutions:**

1. **Clean Docker:**
   ```bash
   docker system prune -a -f
   docker volume prune -f
   ```

2. **Clean logs:**
   ```bash
   sudo journalctl --vacuum-time=7d
   docker logs --tail=0 botbrain_caddy
   ```

3. **Upgrade disk:**
   - Increase VM disk size

---

## Rollback Procedures

### Rollback to Previous Version

```bash
# Stop current deployment
docker compose -f docker-compose.production.yaml down

# Pull previous version
git checkout PREVIOUS_COMMIT_HASH

# Rebuild and start
docker compose -f docker-compose.production.yaml build
docker compose -f docker-compose.production.yaml up -d
```

### Restore from Backup

```bash
# Restore environment file
cp ~/backups/env-YYYYMMDD.backup .env.production

# Restore Caddy data
docker run --rm \
  -v botbrain_caddy_data:/data \
  -v ~/backups:/backup \
  alpine tar xzf /backup/caddy-data-YYYYMMDD.tar.gz -C /data

# Restart services
docker compose -f docker-compose.production.yaml up -d
```

### Emergency Shutdown

```bash
# Stop all services immediately
docker compose -f docker-compose.production.yaml down

# Or stop individual container
docker stop botbrain_frontend
```

### Complete Reset

**WARNING: This will delete all data!**

```bash
# Stop and remove everything
docker compose -f docker-compose.production.yaml down -v

# Remove images
docker rmi $(docker images 'botbrain*' -q)

# Start fresh
docker compose -f docker-compose.production.yaml up -d --build
```

---

## Getting Help

### Collect Diagnostic Information

```bash
# Create diagnostics bundle
mkdir ~/botbrain-diagnostics
cd ~/botbrain-diagnostics

# Copy environment (remove secrets!)
grep -v PASSWORD ~/.env.production > env.txt
grep -v KEY ~/.env.production >> env.txt

# Collect logs
docker compose -f ~/botbrain/docker-compose.production.yaml logs > docker-logs.txt

# System info
uname -a > system-info.txt
free -h >> system-info.txt
df -h >> system-info.txt

# Network info
ip addr > network-info.txt
sudo ufw status >> network-info.txt

# Tailscale info
sudo tailscale status > tailscale-info.txt

# Create archive
tar czf botbrain-diagnostics.tar.gz *.txt

# Share this file when asking for help
```

### Community Support

1. **GitHub Issues:** Open an issue with diagnostics
2. **Documentation:** Review all docs in `docs/`
3. **Verification Script:** Run `./scripts/verify-deployment.sh`

---

## Prevention Tips

### Regular Maintenance

```bash
# Weekly tasks
docker system prune -f
sudo apt update && sudo apt upgrade -y

# Monthly tasks
tailscale update
docker compose -f docker-compose.production.yaml pull
```

### Monitoring

```bash
# Set up daily health checks
cat > ~/check-health.sh << 'EOF'
#!/bin/bash
cd ~/botbrain
./scripts/verify-deployment.sh >> ~/health-check.log 2>&1
EOF

chmod +x ~/check-health.sh

# Add to crontab
crontab -e
# Add: 0 6 * * * /home/botbrain/check-health.sh
```

### Backups

```bash
# Daily backup script
cat > ~/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR=~/backups
mkdir -p $BACKUP_DIR

cp ~/botbrain/.env.production $BACKUP_DIR/env-$(date +%Y%m%d).backup

docker run --rm \
  -v botbrain_caddy_data:/data \
  -v $BACKUP_DIR:/backup \
  alpine tar czf /backup/caddy-data-$(date +%Y%m%d).tar.gz -C /data .

find $BACKUP_DIR -name "*.backup" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete
EOF

chmod +x ~/backup.sh

# Add to crontab
# 0 2 * * * /home/botbrain/backup.sh
```

---

## Common Error Messages

| Error | Cause | Solution |
|-------|-------|----------|
| `connection refused` | Service not running | Restart container |
| `certificate error` | DNS not propagated | Wait or check DNS |
| `timeout` | Network issue | Check Tailscale connectivity |
| `permission denied` | Wrong user/permissions | Check file permissions |
| `port already in use` | Port conflict | Stop conflicting service |
| `out of memory` | Insufficient RAM | Add swap or upgrade VM |
| `disk full` | No disk space | Clean up Docker |

---

## Last Resort: Fresh Installation

If nothing works:

1. **Document current state:**
   ```bash
   # Save configuration
   cp .env.production ~/env.backup

   # Export database (from Supabase dashboard)
   ```

2. **Complete cleanup:**
   ```bash
   cd ~/botbrain
   docker compose -f docker-compose.production.yaml down -v
   cd ~
   rm -rf ~/botbrain
   ```

3. **Fresh installation:**
   ```bash
   git clone https://github.com/yourusername/botbrain.git
   cd botbrain
   cp ~/env.backup .env.production
   ./scripts/deploy-cloud.sh
   ```

4. **Restore data:**
   - Robots will reconnect automatically via Tailscale
   - User accounts preserved in Supabase
   - No data loss if Supabase was not affected

---

This troubleshooting guide covers the most common issues. For additional help, run the verification script and check the logs for specific error messages.
