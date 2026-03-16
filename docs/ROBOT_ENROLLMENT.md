# Robot Enrollment Guide

This guide shows you how to enroll robots into your BotBrain cloud deployment so they can be accessed remotely from anywhere.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Quick Start](#quick-start)
4. [Detailed Setup](#detailed-setup)
5. [Verification](#verification)
6. [Troubleshooting](#troubleshooting)

---

## Overview

To enable remote access, each robot needs:
1. **Tailscale installed** - Joins the private mesh network
2. **rosbridge_server running** - Exposes ROS topics via WebSocket
3. **Robot entry in Supabase** - Database record with Tailscale IP

After enrollment, operators can connect to the robot from anywhere using the BotBrain dashboard.

---

## Prerequisites

### On the Robot

- **Ubuntu 20.04 or 22.04** (Jetson, Pi, or regular PC)
- **ROS 2 workspace** set up and working
- **rosbridge_server** installed
- **Internet connection**
- **SSH access** to the robot

### In BotBrain Cloud

- Cloud deployment completed ([CLOUD_DEPLOYMENT.md](./CLOUD_DEPLOYMENT.md))
- Tailscale network set up
- BotBrain dashboard accessible

---

## Quick Start

For experienced users:

```bash
# 1. Install Tailscale on robot
curl -fsSL https://tailscale.com/install.sh | sh
tailscale up

# 2. Get Tailscale IP
ROBOT_IP=$(tailscale ip -4)
echo $ROBOT_IP

# 3. Ensure rosbridge is running
ros2 launch rosbridge_server rosbridge_websocket_launch.xml

# 4. Add robot to BotBrain dashboard
# - Go to Fleet → Add Robot
# - Name: Your Robot Name
# - Address: $ROBOT_IP (from step 2)
# - Save

# 5. Connect from dashboard
# - Select robot
# - Click Connect
# - You should see "Connected" status
```

---

## Detailed Setup

### Step 1: Install Tailscale on Robot

#### Option A: Using Install Script (Recommended)

```bash
# SSH into your robot
ssh robot@robot-hostname

# Install Tailscale
curl -fsSL https://tailscale.com/install.sh | sh

# Start Tailscale
sudo tailscale up

# Follow the authentication link
# Open the URL in a browser and log in with your Tailscale account
```

#### Option B: Manual Installation

For Jetson (ARM64):

```bash
# Add Tailscale repository
curl -fsSL https://pkgs.tailscale.com/stable/ubuntu/focal.noarmor.gpg | sudo tee /usr/share/keyrings/tailscale-archive-keyring.gpg >/dev/null
curl -fsSL https://pkgs.tailscale.com/stable/ubuntu/focal.tailscale-keyring.list | sudo tee /etc/apt/sources.list.d/tailscale.list

# Install
sudo apt update
sudo apt install -y tailscale

# Start
sudo tailscale up
```

For Raspberry Pi (ARM):

```bash
# Add Tailscale repository
curl -fsSL https://pkgs.tailscale.com/stable/ubuntu/focal.noarmor.gpg | sudo tee /usr/share/keyrings/tailscale-archive-keyring.gpg >/dev/null
curl -fsSL https://pkgs.tailscale.com/stable/raspbian/buster.tailscale-keyring.list | sudo tee /etc/apt/sources.list.d/tailscale.list

# Install
sudo apt update
sudo apt install -y tailscale

# Start
sudo tailscale up
```

#### Verify Tailscale Connection

```bash
# Check status
sudo tailscale status

# Get robot's Tailscale IP
sudo tailscale ip -4

# Example output: 100.101.102.105
# Save this IP - you'll use it in BotBrain dashboard
```

#### Set Hostname (Optional but Recommended)

```bash
# Set a friendly hostname
sudo tailscale set --hostname robot-go2-001

# Verify
sudo tailscale status
```

### Step 2: Configure ROS 2 and rosbridge

#### Install rosbridge_server (if not already installed)

```bash
# Source ROS 2
source /opt/ros/humble/setup.bash

# Install rosbridge
sudo apt install -y ros-humble-rosbridge-suite

# Verify installation
ros2 pkg list | grep rosbridge
```

#### Create systemd Service for rosbridge

Create an auto-start service so rosbridge runs on boot:

```bash
# Create service file
sudo nano /etc/systemd/system/rosbridge.service
```

Add this content:

```ini
[Unit]
Description=ROS Bridge WebSocket Server
After=network.target

[Service]
Type=simple
User=YOUR_USERNAME
Environment="ROS_DOMAIN_ID=0"
ExecStart=/bin/bash -c "source /opt/ros/humble/setup.bash && ros2 launch rosbridge_server rosbridge_websocket_launch.xml"
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

**Replace `YOUR_USERNAME` with your robot's username** (e.g., `robot`, `ubuntu`, `nvidia`).

Enable and start the service:

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable service
sudo systemctl enable rosbridge.service

# Start service
sudo systemctl start rosbridge.service

# Check status
sudo systemctl status rosbridge.service

# Should show "active (running)"
```

#### Verify rosbridge is Running

```bash
# Check if port 9090 is listening
sudo netstat -tulpn | grep 9090

# Or use ss
ss -tulpn | grep 9090

# Should show something like:
# tcp  LISTEN  0.0.0.0:9090
```

Test WebSocket connection locally:

```bash
# Install websocat for testing
sudo apt install -y websocat

# Test connection
websocat ws://127.0.0.1:9090

# Should connect successfully
# Press Ctrl+C to exit
```

### Step 3: Configure Firewall (if enabled)

If you have a firewall on the robot:

```bash
# Allow rosbridge port (only from Tailscale network)
sudo ufw allow in on tailscale0 to any port 9090

# Allow Tailscale UDP port
sudo ufw allow 41641/udp

# Verify
sudo ufw status
```

**Note:** rosbridge should only be accessible via Tailscale, not on the public internet.

### Step 4: Add Robot to BotBrain Dashboard

#### Get Robot Information

```bash
# Get Tailscale IP
ROBOT_IP=$(sudo tailscale ip -4)
echo "Robot Tailscale IP: $ROBOT_IP"

# Get hostname
HOSTNAME=$(hostname)
echo "Robot Hostname: $HOSTNAME"

# Verify rosbridge
echo "Testing rosbridge locally..."
timeout 2 websocat ws://127.0.0.1:9090 && echo "rosbridge OK" || echo "rosbridge not responding"
```

#### Add to Dashboard

1. Open BotBrain dashboard: `https://botbrain.yourdomain.com`
2. Log in
3. Navigate to **Fleet** page
4. Click **Add Robot**
5. Fill in details:
   - **Name**: `Robot Go2 001` (or your robot name)
   - **Address**: Paste the Tailscale IP from above (e.g., `100.101.102.105`)
   - **Type**: Select robot type (`go2`, `tita`, `g1`, etc.)
   - **Transport**: `ros` (for standard ROS robots)
   - **Key**: (optional) Leave empty for standard setup
6. Click **Save**

#### Alternative: Use API to Add Robot

```bash
# Set your Supabase credentials
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_ANON_KEY="your-anon-key"
export USER_TOKEN="your-user-jwt-token"  # Get from browser dev tools

# Add robot via API
curl -X POST "$SUPABASE_URL/rest/v1/robots" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Robot Go2 001\",
    \"address\": \"$ROBOT_IP\",
    \"type\": \"go2\",
    \"transport_type\": \"ros\"
  }"
```

---

## Verification

### Step 1: Test Connection from Cloud VM

From your cloud VM:

```bash
# SSH into cloud VM
ssh botbrain@your-vm-ip

# Test connection to robot's rosbridge
websocat ws://100.101.102.105:9090

# Should connect successfully
# Press Ctrl+C to exit
```

### Step 2: Test from Dashboard

1. Open BotBrain dashboard
2. Go to **Fleet** page
3. Find your robot in the list
4. Click **Connect** button
5. Wait for connection (10-20 seconds)
6. Status should change to **Connected** (green)

If connection fails, see [Troubleshooting](#troubleshooting) below.

### Step 3: Test Robot Control

Once connected:

1. Go to **Cockpit** page (or main control interface)
2. You should see:
   - Robot status indicators
   - Camera feeds (if available)
   - Control interface
3. Try basic controls:
   - Move joystick slightly
   - Robot should respond
4. Check for ROS topics:
   - Battery status
   - Odometry
   - Sensor data

### Step 4: Test from Different Network

The real test: can you access from a different network?

1. **Disconnect from your current WiFi**
2. **Connect to mobile hotspot or different network**
3. **Open dashboard** at `https://botbrain.yourdomain.com`
4. **Log in**
5. **Connect to robot**

If this works, your remote access is successfully configured!

---

## Auto-Start Configuration

### Ensure Tailscale Starts on Boot

```bash
# Enable Tailscale to start on boot
sudo systemctl enable tailscaled

# Verify
sudo systemctl is-enabled tailscaled
# Should output: enabled
```

### Ensure rosbridge Starts on Boot

```bash
# Enable rosbridge service
sudo systemctl enable rosbridge.service

# Verify
sudo systemctl is-enabled rosbridge.service
# Should output: enabled

# Test by rebooting
sudo reboot

# After reboot, check services
sudo systemctl status tailscaled
sudo systemctl status rosbridge.service
# Both should be active (running)
```

---

## Multi-Robot Enrollment

For fleets with multiple robots:

### Script for Bulk Enrollment

Save this as `enroll-robot.sh` on each robot:

```bash
#!/bin/bash

# Robot Enrollment Script
set -e

echo "=== BotBrain Robot Enrollment ==="

# Install Tailscale if not present
if ! command -v tailscale &> /dev/null; then
    echo "Installing Tailscale..."
    curl -fsSL https://tailscale.com/install.sh | sh
fi

# Start Tailscale
echo "Starting Tailscale..."
sudo tailscale up

# Get Tailscale IP
ROBOT_IP=$(sudo tailscale ip -4)
echo "Robot Tailscale IP: $ROBOT_IP"

# Set hostname
echo "Enter robot hostname (e.g., robot-go2-001):"
read ROBOT_HOSTNAME
sudo tailscale set --hostname "$ROBOT_HOSTNAME"

# Install rosbridge if needed
if ! ros2 pkg list | grep -q rosbridge; then
    echo "Installing rosbridge..."
    sudo apt install -y ros-humble-rosbridge-suite
fi

# Create rosbridge service
echo "Creating rosbridge service..."
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

# Enable and start services
sudo systemctl daemon-reload
sudo systemctl enable rosbridge.service
sudo systemctl start rosbridge.service

# Verify
echo ""
echo "=== Enrollment Complete ==="
echo "Robot Tailscale IP: $ROBOT_IP"
echo "Robot Hostname: $ROBOT_HOSTNAME"
echo ""
echo "Add this robot to BotBrain dashboard:"
echo "  Name: $ROBOT_HOSTNAME"
echo "  Address: $ROBOT_IP"
echo "  Type: (select appropriate type)"
echo ""
echo "Services status:"
sudo systemctl status tailscaled --no-pager
sudo systemctl status rosbridge.service --no-pager
```

Run on each robot:

```bash
chmod +x enroll-robot.sh
./enroll-robot.sh
```

---

## Troubleshooting

### Tailscale Not Connecting

```bash
# Check Tailscale status
sudo tailscale status

# Check Tailscale logs
sudo journalctl -u tailscaled -n 50

# Try restarting
sudo systemctl restart tailscaled
sudo tailscale up
```

### No Tailscale IP

```bash
# Check if authenticated
sudo tailscale status

# If not authenticated, re-run
sudo tailscale up

# Check network connectivity
ping 8.8.8.8

# Check firewall
sudo ufw status
```

### rosbridge Not Starting

```bash
# Check service status
sudo systemctl status rosbridge.service

# Check logs
sudo journalctl -u rosbridge.service -n 50

# Try manual start
source /opt/ros/humble/setup.bash
ros2 launch rosbridge_server rosbridge_websocket_launch.xml

# Check for port conflicts
sudo netstat -tulpn | grep 9090
```

### Cannot Connect from Dashboard

```bash
# On robot: Check if rosbridge is listening
sudo netstat -tulpn | grep 9090

# Get Tailscale IP
sudo tailscale ip -4

# Test from cloud VM
websocat ws://ROBOT_TAILSCALE_IP:9090

# Check firewall
sudo ufw status

# Verify robot address in Supabase matches Tailscale IP
```

### Connection Times Out

1. **Check Tailscale connectivity:**
   ```bash
   # From cloud VM
   ping ROBOT_TAILSCALE_IP

   # From robot
   ping CLOUD_VM_TAILSCALE_IP
   ```

2. **Check rosbridge is accessible:**
   ```bash
   # From cloud VM
   websocat ws://ROBOT_TAILSCALE_IP:9090
   ```

3. **Check dashboard console:**
   - Open browser dev tools (F12)
   - Check Console tab for errors
   - Look for WebSocket connection errors

4. **Verify address in database:**
   ```sql
   -- In Supabase SQL editor
   SELECT name, address FROM robots WHERE user_id = 'your-user-id';

   -- Update if wrong
   UPDATE robots SET address = '100.x.x.x' WHERE id = 'robot-id';
   ```

### Connection Drops Frequently

```bash
# Increase Tailscale keepalive
sudo tailscale set --advertise-routes= --accept-routes --netfilter-mode=off

# Check network stability
ping -i 5 CLOUD_VM_TAILSCALE_IP

# Check rosbridge service
sudo systemctl status rosbridge.service

# Restart if needed
sudo systemctl restart rosbridge.service
```

---

## Advanced Configuration

### Custom rosbridge Port

If you need to use a different port:

1. **Modify rosbridge launch file:**
   ```bash
   # Copy launch file
   cp /opt/ros/humble/share/rosbridge_server/launch/rosbridge_websocket_launch.xml ~/custom_rosbridge.xml

   # Edit port
   nano ~/custom_rosbridge.xml
   # Change: <arg name="port" default="9090"/>
   # To:     <arg name="port" default="9091"/>
   ```

2. **Update systemd service:**
   ```bash
   sudo nano /etc/systemd/system/rosbridge.service
   # Change ExecStart to use custom launch file
   ```

3. **Update BotBrain dashboard:**
   - Update robot address to include port: `100.x.x.x:9091`
   - Or set `NEXT_PUBLIC_ROS_PORT=9091` in cloud `.env.production`

### Multiple ROS Domains

For robots using different ROS_DOMAIN_IDs:

```bash
# Edit service file
sudo nano /etc/systemd/system/rosbridge.service

# Change Environment line:
Environment="ROS_DOMAIN_ID=5"

# Restart
sudo systemctl daemon-reload
sudo systemctl restart rosbridge.service
```

### Headscale Instead of Tailscale

If using self-hosted Headscale:

```bash
# Install Tailscale client
curl -fsSL https://tailscale.com/install.sh | sh

# Connect to Headscale server
sudo tailscale up --login-server=https://headscale.yourdomain.com

# Follow authentication steps
```

---

## Monitoring

### Check Robot Status

```bash
# Quick health check script
cat > ~/robot-health.sh << 'EOF'
#!/bin/bash
echo "=== Robot Health Check ==="
echo "Hostname: $(hostname)"
echo "Tailscale IP: $(sudo tailscale ip -4)"
echo "Tailscale Status: $(sudo tailscale status | head -1)"
echo "rosbridge Status: $(sudo systemctl is-active rosbridge.service)"
echo "rosbridge Port: $(sudo netstat -tulpn | grep 9090 | head -1)"
EOF

chmod +x ~/robot-health.sh
./robot-health.sh
```

### Remote Monitoring from Cloud

From cloud VM:

```bash
# Ping robot
tailscale ping ROBOT_TAILSCALE_IP

# Check rosbridge
websocat -n1 ws://ROBOT_TAILSCALE_IP:9090

# SSH if needed
ssh robot@ROBOT_TAILSCALE_IP
```

---

## Unenrollment

To remove a robot from the network:

```bash
# Stop services
sudo systemctl stop rosbridge.service
sudo systemctl disable rosbridge.service

# Disconnect from Tailscale
sudo tailscale down

# Remove from dashboard
# Go to Fleet → Select robot → Delete
```

---

## Security Best Practices

1. **Keep software updated:**
   ```bash
   sudo apt update && sudo apt upgrade -y
   tailscale update
   ```

2. **Use SSH keys, not passwords:**
   ```bash
   ssh-copy-id robot@ROBOT_TAILSCALE_IP
   ```

3. **Limit rosbridge access:**
   ```bash
   # Only allow Tailscale network
   sudo ufw allow in on tailscale0 to any port 9090
   sudo ufw deny 9090
   ```

4. **Monitor access logs:**
   ```bash
   sudo journalctl -u rosbridge.service -f
   ```

5. **Rotate Tailscale keys periodically:**
   ```bash
   # From Tailscale admin console
   # Expire old device keys
   ```

---

## Next Steps

After successful enrollment:

1. **Test all robot functions** from remote location
2. **Set up mission planning** and autonomous navigation
3. **Configure camera streams** for remote viewing
4. **Add more robots** to your fleet
5. **Set up monitoring** and alerts

---

## Support

For issues with enrollment:
1. Check robot logs: `sudo journalctl -u rosbridge.service -n 100`
2. Check Tailscale: `sudo tailscale status`
3. Check cloud connectivity: `ping CLOUD_VM_TAILSCALE_IP`
4. Review [TROUBLESHOOTING_CLOUD.md](./TROUBLESHOOTING_CLOUD.md)
5. Open GitHub issue with logs

---

## Quick Reference

| Task | Command |
|------|---------|
| Get Tailscale IP | `sudo tailscale ip -4` |
| Check Tailscale status | `sudo tailscale status` |
| Test rosbridge | `websocat ws://127.0.0.1:9090` |
| Check rosbridge service | `sudo systemctl status rosbridge.service` |
| View rosbridge logs | `sudo journalctl -u rosbridge.service -n 50` |
| Restart rosbridge | `sudo systemctl restart rosbridge.service` |
| Ping cloud VM | `ping CLOUD_VM_TAILSCALE_IP` |
| SSH to robot | `ssh robot@ROBOT_TAILSCALE_IP` |
