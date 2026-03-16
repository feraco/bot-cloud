import type { Json } from '@/types/database.types';
import type { RobotActionTypeName } from '@/types/RobotActionTypes';

export type WaypointActionProvider = 'ros' | 'z4rtc';
export type WaypointExecutionPolicy = 'wait_for_success' | 'continue_on_error';

export interface WaypointActionFields {
  action_provider: WaypointActionProvider | null;
  action_name: string | null;
  action_payload: Json | null;
  execution_policy: WaypointExecutionPolicy | null;
}

export const DEFAULT_WAYPOINT_ACTION_PROVIDER: WaypointActionProvider = 'ros';
export const DEFAULT_WAYPOINT_EXECUTION_POLICY: WaypointExecutionPolicy = 'wait_for_success';

export const WAYPOINT_ACTION_PROVIDER_OPTIONS: Array<{
  value: WaypointActionProvider;
  label: string;
  description: string;
}> = [
  {
    value: 'ros',
    label: 'ROS action',
    description: 'Use the existing ROS-based robot action dispatcher.',
  },
  {
    value: 'z4rtc',
    label: 'z4rtc command',
    description: 'Save a bridge-backed command for future z4rtc mission execution.',
  },
];

export const WAYPOINT_ROS_ACTION_OPTIONS: Array<{ value: RobotActionTypeName; label: string }> = [
  { value: 'getUp', label: 'Get Up' },
  { value: 'getDown', label: 'Stand Down' },
  { value: 'balanceStand', label: 'Balance Stand' },
  { value: 'jointLock', label: 'Joint Lock' },
  { value: 'hello', label: 'Say Hello' },
  { value: 'sit', label: 'Sit' },
  { value: 'riseSit', label: 'Rise Sit' },
  { value: 'stretch', label: 'Stretch' },
  { value: 'dance', label: 'Dance' },
  { value: 'poseOn', label: 'Pose On' },
  { value: 'poseOff', label: 'Pose Off' },
  { value: 'lightOn', label: 'Light On' },
  { value: 'lightOff', label: 'Light Off' },
  { value: 'antiCollisionOn', label: 'Anti-collision On' },
  { value: 'antiCollisionOff', label: 'Anti-collision Off' },
  { value: 'stopMove', label: 'Stop Move' },
  { value: 'damping', label: 'Damping' },
  { value: 'zeroTorque', label: 'Zero Torque' },
];

export const WAYPOINT_Z4RTC_ACTION_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'stand_up', label: 'Stand Up' },
  { value: 'stand_down', label: 'Stand Down' },
  { value: 'balance_stand', label: 'Balance Stand' },
  { value: 'stop_move', label: 'Stop Move' },
  { value: 'hello', label: 'Wave Hello' },
  { value: 'sit', label: 'Sit' },
  { value: 'rise_sit', label: 'Rise Sit' },
  { value: 'stretch', label: 'Stretch' },
  { value: 'light_color', label: 'Set Light Color' },
  { value: 'obstacles_on', label: 'Obstacle Avoidance On' },
  { value: 'obstacles_off', label: 'Obstacle Avoidance Off' },
  { value: 'sound', label: 'Play Sound' },
  { value: 'photo', label: 'Capture Photo' },
];

export const WAYPOINT_EXECUTION_POLICY_OPTIONS: Array<{
  value: WaypointExecutionPolicy;
  label: string;
  description: string;
}> = [
  {
    value: 'wait_for_success',
    label: 'Wait for success',
    description: 'Stop the mission if the waypoint action fails.',
  },
  {
    value: 'continue_on_error',
    label: 'Continue on error',
    description: 'Log the action failure and keep moving to the next waypoint.',
  },
];

export function normalizeWaypointExecutionPolicy(
  value: string | null | undefined
): WaypointExecutionPolicy | null {
  if (value === 'wait_for_success' || value === 'continue_on_error') {
    return value;
  }

  return null;
}

export function normalizeWaypointActionProvider(
  value: string | null | undefined,
  actionName?: string | null
): WaypointActionProvider | null {
  if (value === 'ros' || value === 'z4rtc') {
    return value;
  }

  if (actionName) {
    return DEFAULT_WAYPOINT_ACTION_PROVIDER;
  }

  return null;
}

export function getWaypointActionOptions(
  provider: WaypointActionProvider | null | undefined
): Array<{ value: string; label: string }> {
  if (provider === 'z4rtc') {
    return WAYPOINT_Z4RTC_ACTION_OPTIONS;
  }

  return WAYPOINT_ROS_ACTION_OPTIONS;
}

export function normalizeWaypointActionPayload(actionPayload: Json | null): Json | null {
  if (actionPayload == null) {
    return null;
  }

  if (typeof actionPayload === 'string') {
    const trimmedPayload = actionPayload.trim();

    if (!trimmedPayload) {
      return null;
    }

    return JSON.parse(trimmedPayload) as Json;
  }

  return actionPayload;
}

export function formatWaypointActionPayload(actionPayload: Json | null): string {
  if (actionPayload == null) {
    return '';
  }

  if (typeof actionPayload === 'string') {
    return actionPayload;
  }

  return JSON.stringify(actionPayload, null, 2);
}

export function parseWaypointActionRequest(
  actionPayload: Json | null
): Record<string, unknown> | undefined {
  const normalizedPayload = normalizeWaypointActionPayload(actionPayload);

  if (normalizedPayload == null) {
    return undefined;
  }

  if (typeof normalizedPayload === 'object' && !Array.isArray(normalizedPayload)) {
    return normalizedPayload as Record<string, unknown>;
  }

  return { value: normalizedPayload };
}

export function getWaypointActionLabel(
  actionName: string | null | undefined,
  provider?: WaypointActionProvider | null
): string {
  if (!actionName) {
    return 'No action';
  }

  const scopedOption = getWaypointActionOptions(provider).find((option) => option.value === actionName);
  if (scopedOption) {
    return scopedOption.label;
  }

  const fallbackOption = [...WAYPOINT_ROS_ACTION_OPTIONS, ...WAYPOINT_Z4RTC_ACTION_OPTIONS].find(
    (option) => option.value === actionName
  );

  return fallbackOption?.label || actionName;
}

export function getWaypointActionPayloadPlaceholder(
  provider: WaypointActionProvider | null | undefined
): string {
  if (provider === 'z4rtc') {
    return '{"args":["red","5","500"]}';
  }

  return '{"mode":"dance1"}';
}