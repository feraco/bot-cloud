'use client';

import { useMemo, useState } from 'react';
import Container from '@/ui/container';
import { useRobotConnection } from '@/contexts/RobotConnectionContext';
import { z4rtcBridgeService } from '@/services/z4rtc-bridge';
import { Cpu, Radio, Terminal, Waves } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { RobotCapability } from '@/types/robot-transport';

const QUICK_COMMANDS = [
  { command: 'stand_up', icon: Waves, requires: ['motion'] as RobotCapability[] },
  { command: 'stand_down', icon: Waves, requires: ['motion'] as RobotCapability[] },
  { command: 'balance_stand', icon: Waves, requires: ['motion'] as RobotCapability[] },
  { command: 'hello', icon: Waves, requires: ['motion'] as RobotCapability[] },
  { command: 'run_ip_address', icon: Radio, requires: ['diagnostics'] as RobotCapability[] },
  { command: 'run_hw_version', icon: Cpu, requires: ['diagnostics'] as RobotCapability[] },
];

export default function Z4rtcQuickPanel() {
  const { connection } = useRobotConnection();
  const { t } = useLanguage();
  const [isRunning, setIsRunning] = useState<string | null>(null);
  const [output, setOutput] = useState('');
  const [advancedCommand, setAdvancedCommand] = useState('');

  const capabilityLabel = useMemo(() => connection.capabilities.join(', '), [connection.capabilities]);
  const visibleQuickCommands = useMemo(
    () => QUICK_COMMANDS.filter((item) => item.requires.some((capability) => connection.capabilities.includes(capability))),
    [connection.capabilities]
  );

  const runQuickCommand = async (command: string, args: string[] = []) => {
    if (!connection.z4rtcSession?.sessionId) {
      setOutput('No z4rtc session is active. Connect from Fleet first.');
      return;
    }

    setIsRunning(command);

    try {
      const result = await z4rtcBridgeService.command(
        connection.z4rtcSession.sessionId,
        command,
        args,
        connection.z4rtcSession.bridgeUrl
      );
      const stdout = result.result.stdout || '';
      const stderr = result.result.stderr || '';
      setOutput([stdout, stderr].filter(Boolean).join('\n') || `${command} completed successfully.`);
    } catch (error) {
      setOutput(error instanceof Error ? error.message : 'z4rtc command failed');
    } finally {
      setIsRunning(null);
    }
  };

  const runAdvancedCommand = async () => {
    const parts = advancedCommand.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) {
      return;
    }

    const [command, ...args] = parts;
    await runQuickCommand(command, args);
  };

  return (
    <Container
      title={
        <div className="flex items-center">
          <Terminal className="mr-2 w-5 h-5" />
          <span>{t('z4rtc', 'title')}</span>
        </div>
      }
      className="w-full h-full flex flex-col"
      customContentClasses="h-full overflow-auto"
    >
      <div className="space-y-4 text-sm text-gray-700 dark:text-gray-300">
        <div className="rounded-default-border border border-gray-200 dark:border-black p-3">
          <div className="font-semibold text-gray-900 dark:text-white">
            {connection.connectedRobot?.name || t('z4rtc', 'noRobot')}
          </div>
          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {t('z4rtc', 'mode')}: {connection.z4rtcSession?.mode || 'local'}
          </div>
          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400 break-all">
            {t('z4rtc', 'session')}: {connection.z4rtcSession?.sessionId || t('z4rtc', 'notConnected')}
          </div>
          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            {t('z4rtc', 'capabilities')}: {capabilityLabel || t('z4rtc', 'noCapabilities')}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {visibleQuickCommands.map(({ command, icon: Icon }) => (
            <button
              key={command}
              type="button"
              onClick={() => runQuickCommand(command)}
              disabled={isRunning !== null}
              className="flex items-center justify-center gap-2 rounded-default-border border border-gray-200 dark:border-black bg-gray-50 dark:bg-botbot-darker px-3 py-2 text-xs font-semibold text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-botbot-dark disabled:opacity-50"
            >
              <Icon className="w-4 h-4" />
              <span>{command}</span>
            </button>
          ))}
        </div>

        <div className="rounded-default-border border border-gray-200 dark:border-black p-3 space-y-2">
          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {t('z4rtc', 'advancedCommand')}
          </label>
          <input
            type="text"
            value={advancedCommand}
            onChange={(event) => setAdvancedCommand(event.target.value)}
            placeholder={t('z4rtc', 'advancedPlaceholder')}
            className="w-full rounded-full border border-gray-300 dark:border-botbot-darker bg-white dark:bg-botbot-dark px-3 py-2 text-sm outline-none"
          />
          <button
            type="button"
            onClick={runAdvancedCommand}
            disabled={isRunning !== null || advancedCommand.trim().length === 0}
            className="w-full rounded-full bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-focus disabled:opacity-50"
          >
            {isRunning ? `${t('z4rtc', 'running')} ${isRunning}` : t('z4rtc', 'runCommand')}
          </button>
        </div>

        <div className="rounded-default-border border border-gray-200 dark:border-black p-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {t('z4rtc', 'output')}
          </div>
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words text-xs text-gray-700 dark:text-gray-300">
            {output || t('z4rtc', 'outputEmpty')}
          </pre>
        </div>
      </div>
    </Container>
  );
}
