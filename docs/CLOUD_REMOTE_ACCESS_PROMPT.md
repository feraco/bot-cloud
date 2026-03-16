# BotBrain Cloud Remote Access Prompt

## What the repository already supports

This prompt is based on the current BotBrain codebase.

- The frontend is a Next.js 15 app in `frontend/` and uses Supabase for auth, database, and storage.
- The robot-side stack runs in `botbrain_ws/` on the robot or Jetson and launches `rosbridge_server` through `bot_bringup`.
- The default ROS connection path is browser to robot `rosbridge` over WebSocket, usually on port `9090`.
- The repo also includes an optional `z4rtc_bridge` service for Unitree integrations, with support for local mode and Unitree cloud mode.
- The project already has a cloud planner route and Supabase-backed fleet storage, but full cross-network ROS access is not solved by default.

## Important constraint

For standard ROS robots, BotBrain currently assumes the browser can reach the robot's `rosbridge` WebSocket directly. That works on the same LAN, but it is not sufficient for secure internet access across different networks. A cloud deployment therefore needs an edge-to-cloud connectivity layer such as a VPN mesh, reverse tunnel, or robot-side relay. Do not expose raw ROS 2 DDS or raw `rosbridge` publicly to the internet.

## Copy-paste prompt

Use the following prompt with an engineering agent or DevOps-focused model:

```text
You are a senior cloud, DevOps, and robotics engineer. Investigate and implement a production-oriented cloud deployment for the BotBrain repository so operators can log in from anywhere and access robots that are not on the same local network.

Repository facts you must honor:
- Frontend: Next.js 15 app in `frontend/`
- Auth/data: Supabase
- Robot runtime: ROS 2 workspace in `botbrain_ws/`
- Default robot connection: browser connects to robot `rosbridge_server` WebSocket, typically port 9090
- Optional transport: `z4rtc_bridge` in `z4rtc_bridge/` with Unitree cloud support through `UNITREE_CLOUD_EMAIL` and `UNITREE_CLOUD_PASSWORD`
- Existing deployment pieces: `docker-compose.yaml`, `install.sh`, `docs/SUPABASE_SETUP.md`, `docs/z4rtc-bridge.md`

Objective:
Deploy BotBrain so the web app is hosted in the cloud with HTTPS and login, while robots remain on their own networks and connect outward securely. Operators must be able to access robots remotely without requiring the operator device to be on the same LAN as the robot.

Required architecture:
1. Keep the ROS 2 stack on each robot or Jetson at the edge.
2. Host the web frontend in the cloud.
3. Keep Supabase as the managed auth/database backend.
4. For standard ROS transport robots, add a secure edge-to-cloud connectivity layer. Use one of these acceptable approaches:
   - Tailscale or Headscale-based private mesh
   - WireGuard-based site-to-site or hub-and-spoke VPN
   - Robot-side outbound relay or reverse tunnel that supports WebSocket traffic
5. Do not expose raw ROS 2 DDS ports publicly.
6. Do not expose raw rosbridge on the public internet without an authenticated private tunnel or zero-trust layer.
7. Preserve support for `z4rtc` robots and allow Unitree cloud mode where applicable.

Preferred implementation path:
- Use a single Ubuntu cloud VM first for the smallest viable production setup.
- Put Caddy or Nginx in front for TLS and reverse proxy.
- Run the BotBrain frontend in Docker.
- Run `z4rtc_bridge` in Docker on the same cloud host.
- Use Supabase as managed SaaS.
- For ROS robots, use a private mesh network so the cloud host can reach each robot's rosbridge endpoint over a private IP or stable private DNS name.
- Store the robot's private tunnel address in the BotBrain fleet record `address` field.
- Support `wss` if needed through the reverse proxy, but prefer private overlay access over direct public exposure.

What I need you to produce:
1. A short architecture decision with rationale.
2. A deployment plan for the cloud host.
3. A deployment plan for each robot or Jetson edge node.
4. Any required code changes in this repo.
5. Any new environment variables, `.env` examples, and secret handling guidance.
6. Docker Compose or deployment manifests for production.
7. Reverse proxy configuration with HTTPS.
8. A secure remote-access design for ROS WebSocket traffic.
9. A setup flow for Supabase and any SQL migrations required.
10. A verification checklist proving remote login and remote robot connectivity work from a different network.
11. Clear rollback and troubleshooting steps.

Implementation requirements:
- Favor the smallest set of changes that works reliably.
- Fix the root deployment gap rather than adding temporary port-forwarding steps.
- If the existing frontend assumes LAN-only robot addresses, update it only as needed to support stable private tunnel hostnames or URLs.
- Preserve current support for local deployments.
- Document every new moving part.
- Use production-safe defaults: TLS, authenticated access, least privilege, secret isolation, and explicit firewall rules.

Specific repo behaviors to account for:
- `frontend/src/contexts/RobotConnectionContext.tsx` builds the ROS WebSocket URL from the robot `address` field and `NEXT_PUBLIC_ROS_PORT`.
- `botbrain_ws/src/bot_bringup/launch/bringup.launch.py` launches `rosbridge_websocket_launch.xml`.
- `z4rtc_bridge/app.py` supports local IP mode and Unitree cloud mode.
- `docker-compose.yaml` already defines `web_server_prod` and `z4rtc_bridge` services.

Deliverables:
- Actual file edits in the repo, not just advice.
- New or updated docs for cloud deployment.
- Exact commands to deploy on a fresh Ubuntu server.
- Exact commands to enroll a robot into the secure remote connectivity layer.
- A final operator workflow: log in to BotBrain in the cloud, select a robot, connect remotely, and operate it from a different network.

If you need to choose between multiple remote-connectivity options, choose one primary path and explain why it is the best tradeoff for this repository. Default to a private mesh or outbound tunnel solution rather than public inbound ports.
```

## Recommendation

If you want the fastest path to a working result for this repo, use:

- Supabase for auth and data
- One Ubuntu cloud VM for the frontend, reverse proxy, and `z4rtc_bridge`
- Tailscale or Headscale for private robot-to-cloud connectivity
- Local BotBrain ROS stack on each robot

That matches the current code better than trying to move ROS itself into the cloud.