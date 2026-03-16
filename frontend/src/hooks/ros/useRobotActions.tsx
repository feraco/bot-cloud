'use client';

import useRobotActionDispatcher from '@/hooks/ros/useRobotActionDispatcher';
import {
  RobotActionCallbackOptions,
  RobotActionType,
  RobotActionTypeName,
} from '@/types/RobotActionTypes';
import { useLanguage } from '@/contexts/LanguageContext';
import { Mode } from '@/interfaces/ros/Mode';
import { useRobotCustomModeContext } from '@/contexts/RobotCustomModesContext';
import useRobotStatus from './useRobotStatus';
import { useRobotProfile } from '@/contexts/RobotProfileContext';

export default function useRobotActions(): Record<
  RobotActionTypeName,
  RobotActionType
> {
  const dispatchAction = useRobotActionDispatcher();
  const { t } = useLanguage();
  const { setLight, setAntiCollision, setStatusBeforeEmergency } =
    useRobotCustomModeContext();
  const { robotStatus } = useRobotStatus();
  const { currentProfile } = useRobotProfile();

  // Check if G1 robot is connected
  const isG1Robot = currentProfile?.id === 'g1-r1';

  const successCallback = (
    response: any,
    options?: RobotActionCallbackOptions
  ) => {
    if (response.success) options?.callback(response);
    else options?.failedCallback?.(response.message);
  };

  const mergeRequest = (
    defaultRequest: Record<string, unknown>,
    options?: RobotActionCallbackOptions
  ) => {
    if (!options?.request || typeof options.request !== 'object' || Array.isArray(options.request)) {
      return defaultRequest;
    }

    return {
      ...defaultRequest,
      ...options.request,
    };
  };

  // O callback e o failedCallback podem mudar a depender do serviço
  // que estiver sendo chamado, por isso alguns serviços, tai como prompt
  // ou os de emergency variam as suas formas de lidar com os callbacks.
  return {
    getUp: {
      name: 'getUp',
      label: t('actionButtons', 'getUp'),
      icon: 'up.svg',
      action: (options?: RobotActionCallbackOptions) => {
        dispatchAction({
          typeKey: 'mode',
          request: mergeRequest({
            mode: isG1Robot ? 'squat' : 'stand_up',
          }, options),
          callback: (response: Mode) => successCallback(response, options),
          failedCallback: (error?: string) => options?.failedCallback?.(error),
        });
      },
    },
    getDown: {
      name: 'getDown',
      label: t('actionButtons', 'getDown'),
      icon: 'down.svg',
      action: (options?: RobotActionCallbackOptions) => {
        dispatchAction({
          typeKey: 'mode',
          request: mergeRequest({
            mode: isG1Robot ? 'squat' : 'stand_down',
          }, options),
          callback: (response: Mode) => successCallback(response, options),
          failedCallback: (error?: string) => {
            options?.failedCallback?.(error);
          },
        });
      },
    },
    lightOn: {
      name: 'lightOn',
      label: t('actionButtons', 'lightOn'),
      icon: 'bulb_on.svg',
      action: (options?: RobotActionCallbackOptions) => {
        dispatchAction({
          typeKey: 'light',
          request: mergeRequest({
            control: true,
            brightness: 10,
          }, options),
          callback: (response: { success: boolean }) => {
            successCallback(response, options);
            setLight(response.success);
          },
          failedCallback: (error?: string) => {
            options?.failedCallback?.(error);
            setLight(false);
          },
        });
      },
    },
    lightOff: {
      name: 'lightOff',
      label: t('actionButtons', 'lightOff'),
      icon: 'bulb_off.svg',
      action: (options?: RobotActionCallbackOptions) => {
        dispatchAction({
          typeKey: 'light',
          request: mergeRequest({
            control: false,
          }, options),
          callback: (response: { success: boolean }) => {
            setLight(!response.success);
            successCallback(response, options);
          },
          failedCallback: (error?: string) => {
            options?.failedCallback?.(error);
            setLight(true);
          },
        });
      },
    },
    balanceStand: {
      name: 'balanceStand',
      label: t('actionButtons', 'unlock'),
      icon: 'unlock.svg',
      action: (options?: RobotActionCallbackOptions) => {
        dispatchAction({
          typeKey: 'mode',
          request: mergeRequest({
            mode: isG1Robot ? 'run' : 'balance_stand',
          }, options),
          callback: (response: Mode) => successCallback(response, options),
          failedCallback: (error?: string) => options?.failedCallback?.(error),
        });
      },
    },
    hello: {
      name: 'hello',
      label: t('actionButtons', 'hello'),
      icon: 'wave_hand.svg',
      action: (options?: RobotActionCallbackOptions) => {
        dispatchAction({
          typeKey: 'mode',
          request: mergeRequest({
            mode: 'hello',
          }, options),
          callback: (response: { success: boolean }) =>
            successCallback(response, options),
          failedCallback: (error?: string) => options?.failedCallback?.(error),
        });
      },
    },
    stopMove: {
      name: 'stopMove',
      label: t('actionButtons', 'stop'),
      icon: 'stop.svg',
      action: (options?: RobotActionCallbackOptions) => {
        dispatchAction({
          typeKey: 'mode',
          request: mergeRequest({
            mode: 'stop_move',
          }, options),
          callback: (response: { success: boolean }) =>
            successCallback(response, options),
          failedCallback: (error?: string) => options?.failedCallback?.(error),
        });
      },
    },
    jointLock: {
      name: 'jointLock',
      label: t('actionButtons', 'lock'),
      icon: 'lock.svg',
      action: (options?: RobotActionCallbackOptions) => {
        dispatchAction({
          typeKey: 'mode',
          request: mergeRequest({
            mode: isG1Robot ? 'preparation' : 'stand_up',
          }, options),
          callback: (response: { success: boolean }) =>
            successCallback(response, options),
          failedCallback: (error?: string) => options?.failedCallback?.(error),
        });
      },
    },
    sit: {
      name: 'sit',
      label: t('actionButtons', 'sit'),
      icon: 'sit.svg',
      action: (options?: RobotActionCallbackOptions) => {
        dispatchAction({
          typeKey: 'mode',
          request: mergeRequest({
            mode: 'sit',
          }, options),
          callback: (response: { success: boolean }) =>
            successCallback(response, options),
          failedCallback: (error?: string) => options?.failedCallback?.(error),
        });
      },
    },
    riseSit: {
      name: 'riseSit',
      label: t('actionButtons', 'riseSit'),
      icon: 'rise_sit.svg',
      action: (options?: RobotActionCallbackOptions) => {
        dispatchAction({
          typeKey: 'mode',
          request: mergeRequest({
            mode: 'rise_sit',
          }, options),
          callback: (response: { success: boolean }) =>
            successCallback(response, options),
          failedCallback: (error?: string) => options?.failedCallback?.(error),
        });
      },
    },
    stretch: {
      name: 'stretch',
      label: t('actionButtons', 'stretch'),
      icon: 'stretch.svg',
      action: (options?: RobotActionCallbackOptions) => {
        dispatchAction({
          typeKey: 'mode',
          request: mergeRequest({
            mode: 'stretch',
          }, options),
          callback: (response: { success: boolean }) =>
            successCallback(response, options),
          failedCallback: (error?: string) => options?.failedCallback?.(error),
        });
      },
    },
    dance: {
      name: 'dance',
      label: t('actionButtons', 'dance'),
      icon: 'dance.svg',
      action: (options?: RobotActionCallbackOptions) => {
        dispatchAction({
          typeKey: 'mode',
          request: mergeRequest({
            mode: 'dance1',
          }, options),
          callback: (response: { success: boolean }) =>
            successCallback(response, options),
          failedCallback: (error?: string) => options?.failedCallback?.(error),
        });
      },
    },
    poseOn: {
      name: 'poseOn',
      label: t('actionButtons', 'poseOn'),
      icon: 'look_around.svg',
      action: (options?: RobotActionCallbackOptions) => {
        dispatchAction({
          typeKey: 'pose',
          request: mergeRequest({
            flag: true,
          }, options),
          callback: (response: { success: boolean }) =>
            successCallback(response, options),
          failedCallback: (error?: string) => options?.failedCallback?.(error),
        });
      },
    },
    poseOff: {
      name: 'poseOff',
      label: t('actionButtons', 'poseOff'),
      icon: 'look_around_off.svg',
      action: (options?: RobotActionCallbackOptions) => {
        dispatchAction({
          typeKey: 'pose',
          request: mergeRequest({
            flag: false,
          }, options),
          callback: (response: { success: boolean }) =>
            successCallback(response, options),
          failedCallback: (error?: string) => options?.failedCallback?.(error),
        });
      },
    },
    antiCollisionOn: {
      name: 'antiCollisionOn',
      label: t('actionButtons', 'antiCollisionOn'),
      icon: 'shield.svg',
      action: (options?: RobotActionCallbackOptions) => {
        dispatchAction({
          typeKey: 'antiCollision',
          request: mergeRequest({
            control: true,
          }, options),
          callback: (response: { success: boolean }) => {
            successCallback(response, options);
            setAntiCollision(response.success);
          },
          failedCallback: (error?: string) => {
            options?.failedCallback?.(error);
            setAntiCollision(false);
          },
        });
      },
    },
    antiCollisionOff: {
      name: 'antiCollisionOff',
      label: t('actionButtons', 'antiCollisionOff'),
      icon: 'shield_off.svg',
      action: (options?: RobotActionCallbackOptions) => {
        dispatchAction({
          typeKey: 'antiCollision',
          request: mergeRequest({
            control: false,
          }, options),
          callback: (response: { success: boolean }) => {
            successCallback(response, options);
            setAntiCollision(!response.success);
          },
          failedCallback: (error?: string) => {
            options?.failedCallback?.(error);
            setAntiCollision(true);
          },
        });
      },
    },
    prompt: {
      name: 'prompt',
      label: t('actionButtons', 'chat'),
      icon: '',
      action: (options?: RobotActionCallbackOptions) => {
        dispatchAction({
          typeKey: 'prompt',
          request: mergeRequest({
            input: options?.input,
          }, options),
          callback: options?.callback,
          failedCallback: (error?: string) => options?.failedCallback?.(error),
        });
      },
    },
    emergencyOn: {
      name: 'emergencyOn',
      label: t('actionButtons', 'emergencyOn'),
      icon: '',
      action: (options?: RobotActionCallbackOptions) => {
        dispatchAction({
          typeKey: 'stop',
          request: mergeRequest({
            data: true,
          }, options),
          callback: (response: { success: boolean }) => {
            if (response.success) {
              console.log('setRobotStatusBeforeEmergency: ', robotStatus);
              setStatusBeforeEmergency(robotStatus);
            }
            successCallback(response, options);
          },
          failedCallback: (error?: string) => options?.failedCallback?.(error),
        });
      },
    },
    emergencyOff: {
      name: 'emergencyOff',
      label: t('actionButtons', 'emergencyOff'),
      icon: '',
      action: (options?: RobotActionCallbackOptions) => {
        dispatchAction({
          typeKey: 'stop',
          request: mergeRequest({
            data: false,
          }, options),
          callback: (response: { success: boolean }) => {
            if (response.success) {
              console.log('reseting status before emergency to undefined');
              setStatusBeforeEmergency(undefined);
            }
            successCallback(response, options);
          },
          failedCallback: (error?: string) => options?.failedCallback?.(error),
        });
      },
    },
    // G1-specific actions
    damping: {
      name: 'damping',
      label: 'Damping',
      icon: 'waves.svg',
      action: (options?: RobotActionCallbackOptions) => {
        dispatchAction({
          typeKey: 'mode',
          request: mergeRequest({
            mode: 'damp',
          }, options),
          callback: (response: Mode) => successCallback(response, options),
          failedCallback: (error?: string) => options?.failedCallback?.(error),
        });
      },
    },
    zeroTorque: {
      name: 'zeroTorque',
      label: 'Zero Torque',
      icon: 'circle_x.svg',
      action: (options?: RobotActionCallbackOptions) => {
        dispatchAction({
          typeKey: 'mode',
          request: mergeRequest({
            mode: 'zero_torque',
          }, options),
          callback: (response: Mode) => successCallback(response, options),
          failedCallback: (error?: string) => options?.failedCallback?.(error),
        });
      },
    },
  };
}
