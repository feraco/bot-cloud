import { Json } from '@/types/database.types';

export type RobotTransportType = 'ros' | 'z4rtc' | 'hybrid';

export type RobotCapability =
  | 'motion'
  | 'video'
  | 'audio_listen'
  | 'audio_upload'
  | 'megaphone'
  | 'lidar'
  | 'slam'
  | 'uslam'
  | 'gpt'
  | 'pet'
  | 'diagnostics'
  | 'map_download'
  | 'services'
  | 'console';

export interface Z4rtcConnectionConfig {
  bridgeUrl?: string;
  serialNumber?: string;
  useCloud?: boolean;
  g1Mode?: boolean;
}

export interface Z4rtcViewerUrls {
  videoUrl?: string;
  audioUrl?: string;
  lidarUrl?: string;
}

export interface Z4rtcSessionInfo {
  sessionId: string;
  connectedAt?: string;
  bridgeUrl?: string;
  mode?: 'local' | 'cloud';
}

export const DEFAULT_ROBOT_TRANSPORT: RobotTransportType = 'ros';

function isRecord(value: Json | null | undefined): value is Record<string, Json | undefined> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function getRobotTransportType(robot?: {
  transport_type?: string | null;
} | null): RobotTransportType {
  if (robot?.transport_type === 'z4rtc' || robot?.transport_type === 'hybrid') {
    return robot.transport_type;
  }

  return DEFAULT_ROBOT_TRANSPORT;
}

export function isZ4rtcRobot(robot?: {
  transport_type?: string | null;
} | null): boolean {
  return getRobotTransportType(robot) === 'z4rtc';
}

export function getZ4rtcConnectionConfig(robot?: {
  connection_config?: Json | null;
  serial_number?: string | null;
} | null): Z4rtcConnectionConfig {
  const base = isRecord(robot?.connection_config) ? robot.connection_config : undefined;

  return {
    bridgeUrl: typeof base?.bridgeUrl === 'string' ? base.bridgeUrl : undefined,
    serialNumber:
      typeof base?.serialNumber === 'string'
        ? base.serialNumber
        : robot?.serial_number ?? undefined,
    useCloud: typeof base?.useCloud === 'boolean' ? base.useCloud : false,
    g1Mode: typeof base?.g1Mode === 'boolean' ? base.g1Mode : false,
  };
}

export function getZ4rtcViewerUrls(robot?: {
  connection_config?: Json | null;
} | null): Z4rtcViewerUrls {
  const base = isRecord(robot?.connection_config) ? robot.connection_config : undefined;

  return {
    videoUrl: typeof base?.videoUrl === 'string' ? base.videoUrl : undefined,
    audioUrl: typeof base?.audioUrl === 'string' ? base.audioUrl : undefined,
    lidarUrl: typeof base?.lidarUrl === 'string' ? base.lidarUrl : undefined,
  };
}
