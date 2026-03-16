'use client';

import MapsAndCams from '@/components/robot-cams';
import { useRobotConnection } from '@/contexts/RobotConnectionContext';
import Z4rtcOperationsWorkspace from '@/components/cockpit/z4rtc-operations-workspace';

interface RobotPrimarySurfaceProps {
  isMobile?: boolean;
}

export default function RobotPrimarySurface({ isMobile = false }: RobotPrimarySurfaceProps) {
  const { connection } = useRobotConnection();

  if (connection.transportType === 'z4rtc' && connection.online) {
    return <Z4rtcOperationsWorkspace />;
  }

  return <MapsAndCams isMobile={isMobile} />;
}
