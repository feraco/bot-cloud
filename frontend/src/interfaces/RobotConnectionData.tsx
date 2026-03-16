import { Database } from '@/types/database.types';
import * as ROSLIB from 'roslib';
import {
  RobotCapability,
  RobotTransportType,
  Z4rtcSessionInfo,
} from '@/types/robot-transport';

type Robot = Database['public']['Tables']['robots']['Row'];

export default interface RobotConnectionData {
  ros?: ROSLIB.Ros;
  transportType: RobotTransportType;
  capabilities: RobotCapability[];
  online: boolean;
  connectedRobot?: Robot | null;
  z4rtcSession?: Z4rtcSessionInfo | null;
}
