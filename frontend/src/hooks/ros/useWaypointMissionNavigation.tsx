'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as ROSLIB from 'roslib';
import { useRobotConnection } from '@/contexts/RobotConnectionContext';
import useMapPose from '@/hooks/ros/useMapPose';
import {
  FollowWaypointsErrorCode,
  type NavigationError,
  type NavigationProgress,
  type NavigationStatus,
} from '@/hooks/ros/useFollowWaypoints';
import { ROSTopicFactory } from '@/utils/ros/topics-and-services';

interface MissionWaypointBase {
  x: number;
  y: number;
  theta: number;
}

interface NavigationConfig {
  stopOnFailure?: boolean;
  onWaypointReached?: (waypoint: MissionWaypointBase, index: number) => Promise<void> | void;
}

interface PoseStamped {
  header: {
    stamp: {
      sec: number;
      nanosec: number;
    };
    frame_id: string;
  };
  pose: {
    position: {
      x: number;
      y: number;
      z: number;
    };
    orientation: {
      x: number;
      y: number;
      z: number;
      w: number;
    };
  };
}

const GOAL_REACHED_THRESHOLD = {
  position: 0.5,
  orientation: 0.5,
};

function yawToQuaternion(theta: number) {
  return {
    x: 0,
    y: 0,
    z: Math.sin(theta / 2),
    w: Math.cos(theta / 2),
  };
}

export default function useWaypointMissionNavigation() {
  const { connection } = useRobotConnection();
  const robotPose = useMapPose();

  const [status, setStatus] = useState<NavigationStatus>('idle');
  const [progress, setProgress] = useState<NavigationProgress>({
    currentWaypointIndex: 0,
    totalWaypoints: 0,
    missedWaypoints: [],
    startTime: null,
    elapsedTime: 0,
  });
  const [error, setError] = useState<NavigationError | null>(null);

  const goalTopicRef = useRef<ROSLIB.Topic<unknown> | null>(null);
  const activeWaypointsRef = useRef<MissionWaypointBase[]>([]);
  const activeConfigRef = useRef<NavigationConfig>({ stopOnFailure: true });
  const currentWaypointIndexRef = useRef(0);
  const navigationStartTimeRef = useRef<number | null>(null);
  const isProcessingWaypointRef = useRef(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const isConnected = !!connection.ros && !!connection.online;

  const ensureGoalTopic = useCallback(() => {
    if (!connection.ros || !connection.online) {
      return null;
    }

    if (!goalTopicRef.current) {
      const topicFactory = new ROSTopicFactory(connection.ros, false);
      goalTopicRef.current = topicFactory.createAndSubscribeTopic<PoseStamped>('goalPose', () => {});
    }

    return goalTopicRef.current;
  }, [connection.online, connection.ros]);

  const publishGoal = useCallback(
    (waypoint: MissionWaypointBase) => {
      const goalTopic = ensureGoalTopic();

      if (!goalTopic) {
        setError({
          code: FollowWaypointsErrorCode.UNKNOWN,
          message: 'ROS connection not available for waypoint navigation',
          failedWaypointIndices: [],
        });
        setStatus('failed');
        return false;
      }

      const goalMessage: PoseStamped = {
        header: {
          stamp: {
            sec: 0,
            nanosec: 0,
          },
          frame_id: 'map',
        },
        pose: {
          position: {
            x: waypoint.x,
            y: waypoint.y,
            z: 0,
          },
          orientation: yawToQuaternion(waypoint.theta),
        },
      };

      try {
        goalTopic.advertise();
        goalTopic.publish(goalMessage);
        return true;
      } catch (publishError) {
        setError({
          code: FollowWaypointsErrorCode.UNKNOWN,
          message: publishError instanceof Error ? publishError.message : 'Failed to publish waypoint goal',
          failedWaypointIndices: [currentWaypointIndexRef.current],
        });
        setStatus('failed');
        return false;
      }
    },
    [ensureGoalTopic]
  );

  const startNavigation = useCallback(
    <T extends MissionWaypointBase>(waypoints: T[], config: {
      stopOnFailure?: boolean;
      onWaypointReached?: (waypoint: T, index: number) => Promise<void> | void;
    } = {}) => {
      if (!isConnected) {
        setError({
          code: FollowWaypointsErrorCode.UNKNOWN,
          message: 'Not connected to robot',
          failedWaypointIndices: [],
        });
        return false;
      }

      if (waypoints.length === 0) {
        setError({
          code: FollowWaypointsErrorCode.NO_VALID_WAYPOINTS,
          message: 'No waypoints provided',
          failedWaypointIndices: [],
        });
        return false;
      }

      activeWaypointsRef.current = waypoints;
      activeConfigRef.current = {
        stopOnFailure: true,
        ...config,
        onWaypointReached: config.onWaypointReached as NavigationConfig['onWaypointReached'],
      };
      currentWaypointIndexRef.current = 0;
      isProcessingWaypointRef.current = false;
      navigationStartTimeRef.current = Date.now();

      setError(null);
      setProgress({
        currentWaypointIndex: 0,
        totalWaypoints: waypoints.length,
        missedWaypoints: [],
        startTime: navigationStartTimeRef.current,
        elapsedTime: 0,
      });
      setStatus('navigating');

      return publishGoal(waypoints[0]);
    },
    [isConnected, publishGoal]
  );

  const cancelNavigation = useCallback(() => {
    activeWaypointsRef.current = [];
    currentWaypointIndexRef.current = 0;
    isProcessingWaypointRef.current = false;
    setStatus('cancelled');
    return true;
  }, []);

  useEffect(() => {
    if (status !== 'navigating' || !navigationStartTimeRef.current) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    timerRef.current = setInterval(() => {
      setProgress((currentProgress) => ({
        ...currentProgress,
        elapsedTime: Math.floor((Date.now() - (navigationStartTimeRef.current || Date.now())) / 1000),
      }));
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [status]);

  useEffect(() => {
    if (status !== 'navigating' || !robotPose || isProcessingWaypointRef.current) {
      return;
    }

    const waypoint = activeWaypointsRef.current[currentWaypointIndexRef.current];

    if (!waypoint) {
      return;
    }

    const dx = robotPose.x - waypoint.x;
    const dy = robotPose.y - waypoint.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const deltaTheta = Math.abs(robotPose.theta - waypoint.theta);
    const orientationDiff = Math.min(deltaTheta, 2 * Math.PI - deltaTheta);

    if (distance >= GOAL_REACHED_THRESHOLD.position || orientationDiff >= GOAL_REACHED_THRESHOLD.orientation) {
      return;
    }

    isProcessingWaypointRef.current = true;

    const handleReachedWaypoint = async () => {
      const waypointIndex = currentWaypointIndexRef.current;
      const activeWaypoint = activeWaypointsRef.current[waypointIndex];

      try {
        await activeConfigRef.current.onWaypointReached?.(activeWaypoint, waypointIndex);
      } catch (callbackError) {
        if (activeConfigRef.current.stopOnFailure) {
          setError({
            code: FollowWaypointsErrorCode.TASK_EXECUTOR_FAILED,
            message: callbackError instanceof Error ? callbackError.message : 'Waypoint action failed',
            failedWaypointIndices: [waypointIndex],
          });
          setStatus('failed');
          return;
        }
      }

      const nextWaypointIndex = waypointIndex + 1;

      if (nextWaypointIndex >= activeWaypointsRef.current.length) {
        setProgress((currentProgress) => ({
          ...currentProgress,
          currentWaypointIndex: activeWaypointsRef.current.length,
        }));
        setStatus('completed');
        return;
      }

      currentWaypointIndexRef.current = nextWaypointIndex;

      if (!publishGoal(activeWaypointsRef.current[nextWaypointIndex])) {
        return;
      }

      setProgress((currentProgress) => ({
        ...currentProgress,
        currentWaypointIndex: nextWaypointIndex,
      }));
    };

    void handleReachedWaypoint().finally(() => {
      isProcessingWaypointRef.current = false;
    });
  }, [publishGoal, robotPose, status]);

  useEffect(() => {
    if (!connection.online && status === 'navigating') {
      setStatus('failed');
      setError({
        code: FollowWaypointsErrorCode.UNKNOWN,
        message: 'Robot connection lost during mission execution',
        failedWaypointIndices: [currentWaypointIndexRef.current],
      });
    }
  }, [connection.online, status]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      if (goalTopicRef.current) {
        goalTopicRef.current.unsubscribe();
        goalTopicRef.current = null;
      }
    };
  }, []);

  return {
    startNavigation,
    cancelNavigation,
    status,
    progress,
    error,
    isConnected,
    isActionServerAvailable: isConnected,
  };
}