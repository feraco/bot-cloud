import { Database } from '@/types/database.types';
import { getLocalAuthUser, isLocalAuthEnabled } from '@/utils/local-auth';

type Mission = Database['public']['Tables']['missions']['Row'];
type MissionMap = Database['public']['Tables']['mission_maps']['Row'];
type Waypoint = Database['public']['Tables']['waypoints']['Row'];

export interface LocalMissionMapRecord extends MissionMap {
  preview_data_url: string;
}

interface LocalDevState {
  missionMaps: LocalMissionMapRecord[];
  missions: Mission[];
  waypoints: Waypoint[];
}

const STORAGE_KEY = 'botbrain-local-dev-data';
const CHANGE_EVENT = 'botbrain-local-dev-data-change';

function getEmptyState(): LocalDevState {
  return {
    missionMaps: [],
    missions: [],
    waypoints: [],
  };
}

function canUseBrowserStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function cloneState(state: LocalDevState): LocalDevState {
  return {
    missionMaps: [...state.missionMaps],
    missions: [...state.missions],
    waypoints: [...state.waypoints],
  };
}

export function isLocalDevDataEnabled() {
  return isLocalAuthEnabled();
}

export function getLocalDevUserId() {
  return getLocalAuthUser().id;
}

export function readLocalDevState(): LocalDevState {
  if (!canUseBrowserStorage()) {
    return getEmptyState();
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return getEmptyState();
    }

    const parsed = JSON.parse(raw) as Partial<LocalDevState>;
    return {
      missionMaps: Array.isArray(parsed.missionMaps) ? parsed.missionMaps : [],
      missions: Array.isArray(parsed.missions) ? parsed.missions : [],
      waypoints: Array.isArray(parsed.waypoints) ? parsed.waypoints : [],
    };
  } catch (error) {
    console.error('Failed to read local dev data:', error);
    return getEmptyState();
  }
}

export function writeLocalDevState(nextState: LocalDevState) {
  if (!canUseBrowserStorage()) {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

export function updateLocalDevState(updater: (state: LocalDevState) => LocalDevState) {
  const current = readLocalDevState();
  const next = updater(cloneState(current));
  writeLocalDevState(next);
  return next;
}

export function subscribeToLocalDevChanges(callback: () => void) {
  if (typeof window === 'undefined') {
    return {
      unsubscribe() {},
    };
  }

  const handler = () => callback();
  window.addEventListener(CHANGE_EVENT, handler);

  return {
    unsubscribe() {
      window.removeEventListener(CHANGE_EVENT, handler);
    },
  };
}

export function createLocalMissionMapRecord(input: {
  name: string;
  description?: string;
  mapFormat?: string;
  resolution: number;
  originX: number;
  originY: number;
  originTheta: number;
  imageWidth?: number;
  imageHeight?: number;
  previewDataUrl: string;
}): LocalMissionMapRecord {
  const timestamp = new Date().toISOString();
  const id = generateId();

  return {
    id,
    user_id: getLocalDevUserId(),
    name: input.name,
    description: input.description || null,
    image_path: `local-dev://${id}`,
    image_width: input.imageWidth ?? null,
    image_height: input.imageHeight ?? null,
    map_format: input.mapFormat || 'preview-image',
    resolution: input.resolution,
    origin_x: input.originX,
    origin_y: input.originY,
    origin_theta: input.originTheta,
    created_at: timestamp,
    updated_at: timestamp,
    preview_data_url: input.previewDataUrl,
  };
}

export function createLocalMissionRecord(input: {
  name: string;
  description?: string | null;
  map_asset_id?: string | null;
  map_name?: string | null;
  robot_id?: string | null;
}): Mission {
  const timestamp = new Date().toISOString();

  return {
    id: generateId(),
    user_id: getLocalDevUserId(),
    name: input.name,
    description: input.description || null,
    map_asset_id: input.map_asset_id || null,
    map_name: input.map_name || null,
    robot_id: input.robot_id || null,
    is_active: false,
    created_at: timestamp,
    updated_at: timestamp,
  };
}

export function createLocalWaypointRecord(input: {
  missionId: string;
  x: number;
  y: number;
  theta: number;
  orderIndex: number;
  actionProvider?: string | null;
  actionName?: string | null;
  actionPayload?: Database['public']['Tables']['waypoints']['Row']['action_payload'];
  executionPolicy?: string | null;
}): Waypoint {
  const timestamp = new Date().toISOString();

  return {
    id: generateId(),
    mission_id: input.missionId,
    x: input.x,
    y: input.y,
    theta: input.theta,
    order_index: input.orderIndex,
    action_provider: input.actionProvider || null,
    action_name: input.actionName || null,
    action_payload: input.actionPayload ?? null,
    execution_policy: input.executionPolicy || null,
    is_reached: false,
    reached_at: null,
    created_at: timestamp,
    updated_at: timestamp,
  };
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}