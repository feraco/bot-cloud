# z4rtc Bridge Setup

BotBrain integrates z4rtc through a small HTTP bridge service that runs alongside the web server.

## What it does

- validates z4rtc robot connectivity
- stores lightweight in-memory sessions for the frontend
- exposes `connect`, `disconnect`, `status`, and `command` endpoints
- keeps direct Unitree protocol handling out of the browser

## 1. Clone z4rtc into the repo

```bash
git clone https://github.com/z4ziggy/z4rtc ./z4rtc
```

If you already have z4rtc elsewhere, set `Z4RTC_COMMAND` or `Z4RTC_SCRIPT` in `.env`.

## 2. Add environment variables

Recommended `.env` values:

```env
Z4RTC_BRIDGE_URL=http://127.0.0.1:8787
Z4RTC_BRIDGE_PORT=8787
Z4RTC_COMMAND=python3 /opt/z4rtc/z4rtc.py
Z4RTC_ALLOW_RAW_COMMANDS=false
UNITREE_CLOUD_EMAIL=
UNITREE_CLOUD_PASSWORD=
```

## 3. Apply the Supabase SQL migration

Run the SQL from `docs/sql/z4rtc_transport.sql` in Supabase.

## 4. Start the services

```bash
docker compose build z4rtc_bridge
docker compose up -d z4rtc_bridge web_server_prod
```

## 5. Use it from Fleet

When adding a robot in Fleet:

- set transport to `z4rtc`
- set the robot address or serial number depending on local vs cloud mode
- optionally override the bridge URL per robot

## Command support

The bridge currently supports:

- connection validation
- command execution through session-bound requests
- a minimal cockpit quick-control panel

Media streaming and advanced LiDAR/browser streaming still need dedicated UI work on top of this bridge.
