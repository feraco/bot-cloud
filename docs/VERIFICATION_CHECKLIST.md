# BotBrain Cloud Deployment Verification Checklist

This checklist ensures your BotBrain cloud deployment is fully functional and ready for production use.

## Pre-Deployment Checklist

### Infrastructure
- [ ] Cloud VM provisioned (Ubuntu 22.04, min 1 vCPU, 2GB RAM)
- [ ] Public IP address assigned to VM
- [ ] Domain name registered
- [ ] DNS A record created pointing to VM public IP
- [ ] SSH access configured to VM
- [ ] Firewall ports 80, 443 open

### Services
- [ ] Supabase project created
- [ ] Supabase database tables created (see SUPABASE_SETUP.md)
- [ ] Supabase RLS policies enabled
- [ ] Tailscale account created (or Headscale instance ready)

### Configuration
- [ ] Repository cloned to VM
- [ ] `.env.production` file created and configured
- [ ] All required environment variables set
- [ ] Supabase credentials verified
- [ ] Domain name configured in .env.production

## Deployment Checklist

### Installation
- [ ] Docker installed on VM
- [ ] Docker Compose installed on VM
- [ ] Current user added to docker group
- [ ] Tailscale installed on VM
- [ ] Tailscale authenticated and running

### Build and Deploy
- [ ] Environment variables loaded
- [ ] Docker images built successfully
- [ ] All containers started (Caddy, Frontend, z4rtc_bridge)
- [ ] All containers show "Up" status
- [ ] No errors in container logs

### Network Configuration
- [ ] DNS propagated and resolving correctly
- [ ] Localhost HTTP access working (curl http://localhost)
- [ ] Public HTTP access working (curl http://yourdomain.com)
- [ ] HTTPS redirect working (HTTP → HTTPS)
- [ ] HTTPS access working with valid certificate
- [ ] Tailscale mesh network operational
- [ ] VM has stable Tailscale IP (100.x.x.x)

## Functional Verification

### Frontend Application
- [ ] Dashboard loads at https://yourdomain.com
- [ ] No console errors in browser
- [ ] SSL certificate valid (no warnings)
- [ ] User registration working
- [ ] User login working
- [ ] User logout working
- [ ] User profile accessible
- [ ] Fleet page loads

### z4rtc Bridge (if applicable)
- [ ] z4rtc bridge health endpoint responds
- [ ] Bridge shows "ok": true
- [ ] z4rtc repository cloned (if needed)
- [ ] Unitree credentials configured (if using cloud mode)

### Database Connectivity
- [ ] Frontend can query Supabase
- [ ] User data persists correctly
- [ ] RLS policies enforcing access control
- [ ] Can create robot entries
- [ ] Can read robot entries
- [ ] Can update robot entries
- [ ] Can delete robot entries

### Authentication Flow
- [ ] Can create new account
- [ ] Confirmation email received (if enabled)
- [ ] Can log in with email/password
- [ ] Session persists across page reloads
- [ ] Can log out successfully
- [ ] Can reset password (if enabled)

## Robot Enrollment Verification

### Robot Setup
- [ ] Tailscale installed on robot
- [ ] Tailscale authenticated on robot
- [ ] Robot has stable Tailscale IP
- [ ] rosbridge_server installed on robot
- [ ] rosbridge service created and enabled
- [ ] rosbridge running on port 9090
- [ ] Robot can ping cloud VM Tailscale IP
- [ ] Cloud VM can ping robot Tailscale IP

### Dashboard Integration
- [ ] Robot added to Fleet in dashboard
- [ ] Robot address set to Tailscale IP
- [ ] Robot type configured correctly
- [ ] Can select robot from Fleet page
- [ ] Connection button appears

### Remote Connection Test
- [ ] Can click "Connect" in dashboard
- [ ] Connection status changes to "Connecting"
- [ ] Connection succeeds (status: "Connected")
- [ ] No timeout errors
- [ ] WebSocket connection established
- [ ] Can see robot data in dashboard
- [ ] Can send commands to robot
- [ ] Robot responds to commands

### Different Network Test
- [ ] Disconnect from current network
- [ ] Connect to different network (mobile hotspot)
- [ ] Access dashboard from new network
- [ ] Can log in
- [ ] Can connect to robot
- [ ] Robot control works from different network

## Security Verification

### HTTPS and Certificates
- [ ] SSL certificate auto-obtained from Let's Encrypt
- [ ] Certificate valid and trusted
- [ ] Certificate expires more than 30 days from now
- [ ] HTTP automatically redirects to HTTPS
- [ ] HSTS header present
- [ ] No mixed content warnings

### Access Control
- [ ] Cannot access dashboard without login
- [ ] Cannot access other users' robots
- [ ] RLS policies prevent unauthorized access
- [ ] Supabase anon key properly restricted
- [ ] No sensitive data in client-side code

### Network Security
- [ ] Robot rosbridge not exposed on public internet
- [ ] rosbridge only accessible via Tailscale
- [ ] Tailscale network properly configured
- [ ] No unnecessary ports open on firewall
- [ ] SSH properly secured (keys only, no root login)

## Performance Verification

### Response Times
- [ ] Dashboard loads in < 3 seconds
- [ ] API requests complete in < 1 second
- [ ] Robot connection establishes in < 20 seconds
- [ ] Commands sent to robot have low latency
- [ ] Camera streams load quickly (if applicable)

### Resource Usage
- [ ] CPU usage < 70% under normal load
- [ ] Memory usage < 80% of available
- [ ] Disk usage < 70% of available
- [ ] No memory leaks over 24 hours
- [ ] Docker containers stable (no restarts)

### Scalability
- [ ] Can connect multiple robots simultaneously
- [ ] Can have multiple operators logged in
- [ ] System remains responsive with multiple connections
- [ ] Database queries remain fast

## Monitoring and Logging

### Logs
- [ ] Container logs accessible
- [ ] No critical errors in logs
- [ ] Caddy logs showing successful requests
- [ ] Frontend logs clean
- [ ] z4rtc bridge logs clean
- [ ] Tailscale logs clean

### Health Checks
- [ ] Caddy health check responds
- [ ] Frontend health check responds
- [ ] z4rtc health check responds
- [ ] Supabase API reachable
- [ ] All containers healthy

### Monitoring Setup
- [ ] Health check script runs successfully
- [ ] Verification script passes all tests
- [ ] Monitoring cron job configured (optional)
- [ ] Backup script configured (optional)

## Operational Readiness

### Documentation
- [ ] Deployment documented
- [ ] Robot enrollment process documented
- [ ] Troubleshooting steps understood
- [ ] Rollback procedure understood
- [ ] Emergency contacts documented

### Backups
- [ ] Environment file backed up
- [ ] Caddy data backed up
- [ ] Backup restoration tested
- [ ] Backup schedule configured

### Maintenance
- [ ] Update procedure documented
- [ ] Maintenance windows planned
- [ ] Monitoring alerts configured (optional)
- [ ] Incident response plan documented

### Team Readiness
- [ ] Team trained on dashboard use
- [ ] Team knows how to add robots
- [ ] Team knows troubleshooting basics
- [ ] Support contact available

## Production Readiness Gates

All of the following must be true before going live:

- [ ] All Pre-Deployment items complete
- [ ] All Deployment items complete
- [ ] All Functional Verification items complete
- [ ] At least one robot successfully enrolled and tested
- [ ] Remote access verified from different network
- [ ] Security verification passed
- [ ] Performance acceptable
- [ ] Monitoring and logging working
- [ ] Documentation complete
- [ ] Backups configured and tested
- [ ] Team trained and ready

## Post-Deployment Checklist

### First 24 Hours
- [ ] Monitor logs for errors
- [ ] Monitor resource usage
- [ ] Test all major features
- [ ] Verify SSL certificate renewal scheduled
- [ ] Check all robots still connected

### First Week
- [ ] Verify Tailscale connections stable
- [ ] Verify no memory leaks
- [ ] Verify backups running
- [ ] Test rollback procedure
- [ ] Gather user feedback

### First Month
- [ ] Review access logs
- [ ] Optimize performance issues
- [ ] Update documentation with lessons learned
- [ ] Plan scaling if needed
- [ ] Schedule regular maintenance

## Testing Scenarios

### End-to-End Test 1: New User, New Robot

1. [ ] Create new account from remote location
2. [ ] Log in to dashboard
3. [ ] Navigate to Fleet
4. [ ] Add new robot (already enrolled with Tailscale)
5. [ ] Connect to robot
6. [ ] Send basic command
7. [ ] Verify robot responds
8. [ ] Disconnect
9. [ ] Log out

### End-to-End Test 2: Different Networks

1. [ ] Connect from home network
2. [ ] Connect to robot
3. [ ] Operate robot
4. [ ] Switch to mobile network
5. [ ] Verify still connected
6. [ ] Operate robot
7. [ ] Verify low latency

### End-to-End Test 3: Multiple Robots

1. [ ] Add 3 robots to Fleet
2. [ ] Connect to Robot 1
3. [ ] Send command
4. [ ] Switch to Robot 2
5. [ ] Send different command
6. [ ] Switch to Robot 3
7. [ ] Verify all robots responding correctly

### Stress Test

1. [ ] Connect 5+ robots simultaneously
2. [ ] Have 3+ operators logged in
3. [ ] Send continuous commands for 1 hour
4. [ ] Monitor resource usage
5. [ ] Verify no degradation
6. [ ] Check for memory leaks
7. [ ] Verify all connections stable

## Troubleshooting Verification

For each major issue in TROUBLESHOOTING_CLOUD.md:

- [ ] Understand the issue
- [ ] Know the diagnosis steps
- [ ] Know the solution steps
- [ ] Have tested the solution
- [ ] Have documented any custom fixes

## Sign-Off

Before declaring production ready, the following people should sign off:

- [ ] **Technical Lead:** All systems operational
- [ ] **DevOps Engineer:** Infrastructure secure and monitored
- [ ] **QA Engineer:** All tests passed
- [ ] **Product Owner:** Functionality meets requirements
- [ ] **Operations Team:** Ready to support

## Final Verification Command

Run this command to verify everything:

```bash
./scripts/verify-deployment.sh
```

All checks should pass with:
- 0 failures
- Minimal warnings
- "All critical checks passed!" message

## Notes

Record any deviations from standard setup:

```
Date: __________
Deployment ID: __________
Special Configuration:
__________________________________________
__________________________________________

Known Issues:
__________________________________________
__________________________________________

Approved By: __________
```

## Quick Verification (30 seconds)

Fastest way to verify everything works:

```bash
# 1. Check containers
docker compose -f docker-compose.production.yaml ps
# All should be "Up"

# 2. Check HTTPS
curl -I https://yourdomain.com
# Should return 200 OK with valid cert

# 3. Check z4rtc
curl https://yourdomain.com/z4rtc/health
# Should return {"ok": true, ...}

# 4. Check Tailscale
tailscale status
# Should show connected peers

# 5. Test robot connection
# Open dashboard, connect to a robot
# Should connect within 20 seconds
```

If all 5 checks pass, your deployment is healthy!

---

**Checklist Version:** 1.0
**Last Updated:** 2026-03-16
**Next Review:** After first production deployment
