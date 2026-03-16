# BotBrain Cloud Starter

This is a trimmed starter repo extracted from the larger BotBrain project.

It keeps only the folders needed to boot the cloud-side stack:

- `frontend/` for the Next.js dashboard
- `z4rtc_bridge/` for optional Unitree bridge support
- `docs/` for Supabase, SQL, and remote-access setup notes
- `z4rtc/` as the placeholder checkout path expected by the bridge

It intentionally excludes the full ROS 2 workspace, hardware files, and robot-local services.

## Included structure

```text
.
├── docker-compose.yaml
├── frontend/
├── z4rtc_bridge/
├── z4rtc/
└── docs/
```

## Quick start

1. Copy `.env.example` to `.env`.
2. Fill in your Supabase values.
3. Optionally clone the upstream z4rtc repo into `z4rtc/` if you need the bridge.
4. Start the cloud stack:

```bash
docker compose up --build
```

The frontend will be available on port `3000` and the bridge on port `8787`.

## Notes

- The frontend still expects robots to be reachable either through a private mesh/VPN address or through the optional z4rtc transport.
- For remote ROS control across networks, use a private overlay such as Tailscale, Headscale, or WireGuard rather than exposing rosbridge directly.
- If you change any `NEXT_PUBLIC_*` variable, rebuild the frontend image.

## Setup docs

- `docs/SUPABASE_SETUP.md`
- `docs/z4rtc-bridge.md`
- `docs/CLOUD_REMOTE_ACCESS_PROMPT.md`
- `docs/sql/cloud_planner.sql`
- `docs/sql/z4rtc_transport.sql`