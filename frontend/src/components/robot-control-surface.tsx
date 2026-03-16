'use client';

import { useRobotConnection } from '@/contexts/RobotConnectionContext';
import RobotControls from '@/components/robot-controls';
import Z4rtcQuickPanel from '@/components/cockpit/z4rtc-quick-panel';

export default function RobotControlSurface() {
  const { connection } = useRobotConnection();

  if (connection.transportType === 'z4rtc' && connection.online) {
    return <Z4rtcQuickPanel />;
  }

  return <RobotControls />;
}
