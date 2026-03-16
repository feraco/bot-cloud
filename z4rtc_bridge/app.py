from __future__ import annotations

import base64
import os
import shlex
import subprocess
import tempfile
import time
import uuid
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field


def build_capabilities(g1_mode: bool) -> list[str]:
    capabilities = [
        "motion",
        "video",
        "audio_listen",
        "audio_upload",
        "megaphone",
        "lidar",
        "slam",
        "uslam",
        "diagnostics",
        "map_download",
        "services",
        "console",
    ]

    if g1_mode:
        capabilities.append("gpt")
    else:
        capabilities.extend(["gpt", "pet"])

    return capabilities


def get_command_prefix() -> list[str]:
    command = os.getenv("Z4RTC_COMMAND")
    if command:
      return shlex.split(command)

    script_path = Path(os.getenv("Z4RTC_SCRIPT", "/opt/z4rtc/z4rtc.py"))
    python_bin = os.getenv("Z4RTC_PYTHON", "python3")

    return [python_bin, str(script_path)]


def resolve_cloud_credentials() -> tuple[str, str]:
    email = os.getenv("UNITREE_CLOUD_EMAIL", "").strip()
    password = os.getenv("UNITREE_CLOUD_PASSWORD", "").strip()

    if not email or not password:
        raise HTTPException(
            status_code=400,
            detail="Unitree cloud credentials are not configured for z4rtc bridge",
        )

    return email, password


def build_robot_args(payload: "RobotTargetPayload") -> list[str]:
    command_prefix = get_command_prefix()

    if not command_prefix:
        raise HTTPException(status_code=500, detail="Invalid z4rtc command configuration")

    if payload.g1Mode:
        command_prefix.append("--g1")

    if payload.useCloud:
        email, password = resolve_cloud_credentials()
        command_prefix.extend(["--user", email, "--pass", password])
        if payload.serialNumber:
            command_prefix.extend(["--sn", payload.serialNumber])
    else:
        if not payload.address:
            raise HTTPException(status_code=400, detail="Robot address is required")
        command_prefix.extend(["--ip", payload.address])

    return command_prefix


def run_z4rtc(payload: "RobotTargetPayload", command: str, args: list[str] | None = None, timeout: int | None = None) -> dict[str, Any]:
    resolved_args = args or []
    base_command = build_robot_args(payload)
    final_command = [*base_command, command, *resolved_args]
    command_path = Path(final_command[1]) if len(final_command) > 1 else None

    if command_path and final_command[0].startswith("python") and not command_path.exists():
        raise HTTPException(
            status_code=500,
            detail=(
                f"z4rtc entrypoint not found at {command_path}. "
                "Clone https://github.com/z4ziggy/z4rtc into ./z4rtc or set Z4RTC_COMMAND/Z4RTC_SCRIPT."
            ),
        )

    start = time.time()
    proc = subprocess.run(
        final_command,
        capture_output=True,
        text=True,
        timeout=timeout or int(os.getenv("Z4RTC_COMMAND_TIMEOUT", "20")),
        check=False,
    )
    duration_ms = int((time.time() - start) * 1000)

    return {
        "command": final_command,
        "stdout": proc.stdout.strip(),
        "stderr": proc.stderr.strip(),
        "exitCode": proc.returncode,
        "durationMs": duration_ms,
    }


@dataclass
class SessionRecord:
    sessionId: str
    robotId: str
    name: str
    address: str
    serialNumber: str | None
    useCloud: bool
    g1Mode: bool
    connectedAt: str
    capabilities: list[str]


class RobotTargetPayload(BaseModel):
    robotId: str
    name: str
    address: str
    serialNumber: str | None = None
    useCloud: bool = False
    g1Mode: bool = False
    transportType: str | None = None


class DisconnectPayload(BaseModel):
    sessionId: str


class CommandPayload(BaseModel):
    sessionId: str
    command: str
    args: list[str] = Field(default_factory=list)


app = FastAPI(title="BotBrain z4rtc Bridge", version="0.1.0")
sessions: dict[str, SessionRecord] = {}
HEALTHCHECK_COMMAND = os.getenv("Z4RTC_HEALTHCHECK_COMMAND", "run_ip_address")
ALLOW_RAW_COMMANDS = os.getenv("Z4RTC_ALLOW_RAW_COMMANDS", "false").lower() in {"1", "true", "yes", "on"}


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "ok": True,
        "sessions": len(sessions),
        "bridgePort": os.getenv("Z4RTC_BRIDGE_PORT", "8787"),
        "z4rtcCommand": os.getenv("Z4RTC_COMMAND", "python3 /opt/z4rtc/z4rtc.py"),
    }


@app.post("/status")
def status(payload: RobotTargetPayload) -> dict[str, Any]:
    result = run_z4rtc(payload, HEALTHCHECK_COMMAND, timeout=15)

    return {
        "available": result["exitCode"] == 0,
        "capabilities": build_capabilities(payload.g1Mode),
        "result": result,
    }


@app.post("/connect")
def connect(payload: RobotTargetPayload) -> dict[str, Any]:
    result = run_z4rtc(payload, HEALTHCHECK_COMMAND, timeout=20)

    if result["exitCode"] != 0:
        raise HTTPException(
            status_code=502,
            detail=result["stderr"] or result["stdout"] or "z4rtc connection validation failed",
        )

    session_id = uuid.uuid4().hex
    record = SessionRecord(
        sessionId=session_id,
        robotId=payload.robotId,
        name=payload.name,
        address=payload.address,
        serialNumber=payload.serialNumber,
        useCloud=payload.useCloud,
        g1Mode=payload.g1Mode,
        connectedAt=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        capabilities=build_capabilities(payload.g1Mode),
    )
    sessions[session_id] = record

    return {
        "session": {
            "sessionId": record.sessionId,
            "connectedAt": record.connectedAt,
            "mode": "cloud" if record.useCloud else "local",
        },
        "capabilities": record.capabilities,
        "validation": result,
    }


@app.post("/disconnect")
def disconnect(payload: DisconnectPayload) -> dict[str, Any]:
    existed = sessions.pop(payload.sessionId, None)
    return {
        "disconnected": existed is not None,
        "sessionId": payload.sessionId,
    }


@app.post("/command")
def command(payload: CommandPayload) -> dict[str, Any]:
    session = sessions.get(payload.sessionId)

    if session is None:
        raise HTTPException(status_code=404, detail="z4rtc session not found")

    if payload.command in {"raw", "msg", "req", "rtc_inner_req"} and not ALLOW_RAW_COMMANDS:
        raise HTTPException(
            status_code=403,
            detail="Raw z4rtc commands are disabled. Set Z4RTC_ALLOW_RAW_COMMANDS=true to enable them.",
        )

    result = run_z4rtc(
        RobotTargetPayload(
            robotId=session.robotId,
            name=session.name,
            address=session.address,
            serialNumber=session.serialNumber,
            useCloud=session.useCloud,
            g1Mode=session.g1Mode,
        ),
        payload.command,
        payload.args,
        timeout=45,
    )

    return {
        "session": asdict(session),
        "result": result,
    }


@app.post("/upload")
async def upload(
    sessionId: str = Form(...),
    mode: str = Form(...),
    file: UploadFile = File(...),
) -> dict[str, Any]:
    session = sessions.get(sessionId)

    if session is None:
        raise HTTPException(status_code=404, detail="z4rtc session not found")

    if mode not in {"audio_upload", "megaphone_play"}:
        raise HTTPException(status_code=400, detail="Unsupported upload mode")

    suffix = Path(file.filename or "upload.bin").suffix or ".bin"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
        temp_path = Path(temp_file.name)
        content = await file.read()
        temp_file.write(content)

    try:
        result = run_z4rtc(
            RobotTargetPayload(
                robotId=session.robotId,
                name=session.name,
                address=session.address,
                serialNumber=session.serialNumber,
                useCloud=session.useCloud,
                g1Mode=session.g1Mode,
            ),
            mode,
            [str(temp_path)],
            timeout=90,
        )
    finally:
        temp_path.unlink(missing_ok=True)

    return {
        "sessionId": sessionId,
        "mode": mode,
        "result": result,
    }
