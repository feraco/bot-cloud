import { Database } from '@/types/database.types';
import {
  RobotCapability,
  Z4rtcConnectionConfig,
  Z4rtcSessionInfo,
  getZ4rtcConnectionConfig,
} from '@/types/robot-transport';

type Robot = Database['public']['Tables']['robots']['Row'];

interface Z4rtcBridgeRequest {
  action: 'connect' | 'disconnect' | 'status' | 'command';
  robot?: Robot;
  sessionId?: string;
  command?: string;
  args?: string[];
  bridgeUrl?: string;
}

interface Z4rtcBridgeEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

export type Z4rtcUploadMode = 'audio_upload' | 'megaphone_play';

export interface Z4rtcConnectResponse {
  session: Z4rtcSessionInfo;
  capabilities: RobotCapability[];
}

export interface Z4rtcStatusResponse {
  available: boolean;
  capabilities?: RobotCapability[];
}

export interface Z4rtcCommandResponse {
  session: {
    sessionId: string;
    robotId: string;
    name: string;
    address: string;
    serialNumber?: string | null;
    useCloud: boolean;
    g1Mode: boolean;
    connectedAt: string;
    capabilities: RobotCapability[];
  };
  result: {
    command: string[];
    stdout: string;
    stderr: string;
    exitCode: number;
    durationMs: number;
  };
}

export interface Z4rtcUploadResponse {
  sessionId: string;
  mode: Z4rtcUploadMode;
  result: {
    command: string[];
    stdout: string;
    stderr: string;
    exitCode: number;
    durationMs: number;
  };
}

async function requestBridge<T>(payload: Z4rtcBridgeRequest): Promise<T> {
  const response = await fetch('/api/z4rtc', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const envelope = (await response.json()) as Z4rtcBridgeEnvelope<T>;

  if (!response.ok || !envelope.ok || !envelope.data) {
    throw new Error(envelope.error || 'Z4RTC bridge request failed');
  }

  return envelope.data;
}

async function uploadBridgeFile<T>(
  sessionId: string,
  file: File,
  mode: Z4rtcUploadMode,
  bridgeUrl?: string
): Promise<T> {
  const formData = new FormData();
  formData.append('sessionId', sessionId);
  formData.append('mode', mode);
  formData.append('bridgeUrl', bridgeUrl || '');
  formData.append('file', file);

  const response = await fetch('/api/z4rtc/upload', {
    method: 'POST',
    body: formData,
  });

  const envelope = (await response.json()) as Z4rtcBridgeEnvelope<T>;

  if (!response.ok || !envelope.ok || !envelope.data) {
    throw new Error(envelope.error || 'Z4RTC upload failed');
  }

  return envelope.data;
}

export function buildZ4rtcPayload(robot: Robot): {
  address: string;
  name: string;
  robotId: string;
  transportType: string | null;
  config: Z4rtcConnectionConfig;
} {
  return {
    address: robot.address,
    name: robot.name,
    robotId: robot.id,
    transportType: robot.transport_type,
    config: getZ4rtcConnectionConfig(robot),
  };
}

export const z4rtcBridgeService = {
  connect(robot: Robot) {
    return requestBridge<Z4rtcConnectResponse>({
      action: 'connect',
      robot,
    });
  },

  disconnect(sessionId: string, bridgeUrl?: string) {
    return requestBridge<{ disconnected: boolean }>({
      action: 'disconnect',
      sessionId,
      bridgeUrl,
    });
  },

  status(robot: Robot) {
    return requestBridge<Z4rtcStatusResponse>({
      action: 'status',
      robot,
    });
  },

  command(sessionId: string, command: string, args: string[] = [], bridgeUrl?: string) {
    return requestBridge<Z4rtcCommandResponse>({
      action: 'command',
      sessionId,
      command,
      args,
      bridgeUrl,
    });
  },

  uploadAudio(sessionId: string, file: File, mode: Z4rtcUploadMode, bridgeUrl?: string) {
    return uploadBridgeFile<Z4rtcUploadResponse>(sessionId, file, mode, bridgeUrl);
  },
};
