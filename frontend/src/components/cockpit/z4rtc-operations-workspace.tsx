'use client';

import { useEffect, useMemo, useState } from 'react';
import Container from '@/ui/container';
import { useRobotConnection } from '@/contexts/RobotConnectionContext';
import {
  getZ4rtcViewerUrls,
  RobotCapability,
} from '@/types/robot-transport';
import {
  Z4rtcUploadMode,
  z4rtcBridgeService,
} from '@/services/z4rtc-bridge';
import {
  Activity,
  Bot,
  Brain,
  Camera,
  Compass,
  Cpu,
  Map,
  Mic,
  Radio,
  Sparkles,
  Upload,
  Waves,
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

type WorkspaceTab = 'media' | 'navigation' | 'ai' | 'diagnostics';

interface QuickAction {
  command: string;
  label: string;
  capability: RobotCapability;
  args?: string[];
}

const TAB_REQUIREMENTS: Record<WorkspaceTab, RobotCapability[]> = {
  media: ['video', 'audio_listen', 'audio_upload', 'megaphone'],
  navigation: ['lidar', 'slam', 'uslam', 'map_download'],
  ai: ['gpt', 'pet'],
  diagnostics: ['diagnostics', 'services', 'console'],
};

const QUICK_ACTIONS: Record<'media' | 'navigation' | 'diagnostics', QuickAction[]> = {
  media: [
    { command: 'video_show', label: 'videoShow', capability: 'video' as RobotCapability },
    { command: 'photo', label: 'takePhoto', capability: 'video' as RobotCapability, args: ['snapshot.jpg'] },
    { command: 'audio_listen', label: 'listenAudio', capability: 'audio_listen' as RobotCapability },
    { command: 'audio_listen_stop', label: 'stopAudio', capability: 'audio_listen' as RobotCapability },
  ],
  navigation: [
    { command: 'lidar_show', label: 'openLidar', capability: 'lidar' as RobotCapability },
    { command: 'slam_start', label: 'slamStart', capability: 'slam' as RobotCapability },
    { command: 'slam_stop', label: 'slamStop', capability: 'slam' as RobotCapability },
    { command: 'get_map_file', label: 'downloadMap', capability: 'map_download' as RobotCapability },
    { command: 'obstacles_on', label: 'obstaclesOn', capability: 'slam' as RobotCapability },
    { command: 'obstacles_off', label: 'obstaclesOff', capability: 'slam' as RobotCapability },
  ],
  diagnostics: [
    { command: 'run_hw_version', label: 'hardwareVersion', capability: 'diagnostics' as RobotCapability },
    { command: 'run_pkg_version', label: 'firmwareVersion', capability: 'diagnostics' as RobotCapability },
    { command: 'run_self_test', label: 'selfTest', capability: 'diagnostics' as RobotCapability },
    { command: 'run_ip_address', label: 'ipAddress', capability: 'diagnostics' as RobotCapability },
    { command: 'service_list', label: 'serviceList', capability: 'services' as RobotCapability },
  ],
};

const USLAM_COMMANDS = [
  'common/get_map_id',
  'common/get_map_file',
  'common/get_localization_status',
  'navigation/get_global_path',
  'patrol/get_patrol_status',
];

function hasAnyCapability(capabilities: RobotCapability[], required: RobotCapability[]) {
  return required.some((capability) => capabilities.includes(capability));
}

export default function Z4rtcOperationsWorkspace() {
  const { connection } = useRobotConnection();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('media');
  const [activityLog, setActivityLog] = useState<string>('');
  const [isBusy, setIsBusy] = useState<string | null>(null);
  const [gptPrompt, setGptPrompt] = useState('');
  const [petPrompt, setPetPrompt] = useState('');
  const [uslamCommand, setUslamCommand] = useState(USLAM_COMMANDS[0]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadMode, setUploadMode] = useState<Z4rtcUploadMode>('audio_upload');
  const [diagnosticOutput, setDiagnosticOutput] = useState<Record<string, string>>({});

  const capabilities = connection.capabilities;
  const viewerUrls = useMemo(
    () => getZ4rtcViewerUrls(connection.connectedRobot),
    [connection.connectedRobot]
  );
  const visibleTabs = useMemo(
    () =>
      (Object.keys(TAB_REQUIREMENTS) as WorkspaceTab[]).filter((tab) =>
        hasAnyCapability(capabilities, TAB_REQUIREMENTS[tab])
      ),
    [capabilities]
  );

  useEffect(() => {
    if (!visibleTabs.includes(activeTab) && visibleTabs.length > 0) {
      setActiveTab(visibleTabs[0]);
    }
  }, [activeTab, visibleTabs]);

  const runCommand = async (
    command: string,
    args: string[] = [],
    options?: { storeAs?: string }
  ) => {
    if (!connection.z4rtcSession?.sessionId) {
      setActivityLog('No z4rtc session is active. Connect from Fleet first.');
      return;
    }

    setIsBusy(command);

    try {
      const response = await z4rtcBridgeService.command(
        connection.z4rtcSession.sessionId,
        command,
        args,
        connection.z4rtcSession.bridgeUrl
      );
      const text = [response.result.stdout, response.result.stderr]
        .filter(Boolean)
        .join('\n') || `${command} completed.`;

      setActivityLog(text);
      if (options?.storeAs) {
        setDiagnosticOutput((prev) => ({ ...prev, [options.storeAs as string]: text }));
      }
    } catch (error) {
      const text = error instanceof Error ? error.message : `${command} failed`;
      setActivityLog(text);
      if (options?.storeAs) {
        setDiagnosticOutput((prev) => ({ ...prev, [options.storeAs as string]: text }));
      }
    } finally {
      setIsBusy(null);
    }
  };

  const handleUpload = async () => {
    if (!connection.z4rtcSession?.sessionId || !selectedFile) {
      setActivityLog('Select a file and connect a z4rtc robot first.');
      return;
    }

    setIsBusy(uploadMode);

    try {
      const response = await z4rtcBridgeService.uploadAudio(
        connection.z4rtcSession.sessionId,
        selectedFile,
        uploadMode,
        connection.z4rtcSession.bridgeUrl
      );
      setActivityLog(
        [response.result.stdout, response.result.stderr]
          .filter(Boolean)
          .join('\n') || `${uploadMode} completed.`
      );
    } catch (error) {
      setActivityLog(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setIsBusy(null);
    }
  };

  const renderFeatureTag = (capability: RobotCapability) => (
    <span
      key={capability}
      className="rounded-full border border-gray-200 dark:border-black bg-white/70 dark:bg-botbot-darker px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300"
    >
      {capability}
    </span>
  );

  const renderMediaTab = () => (
    <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_0.9fr] gap-4">
      <div className="rounded-default-border border border-gray-200 dark:border-black overflow-hidden bg-black min-h-[320px] relative">
        {viewerUrls.videoUrl ? (
          <iframe src={viewerUrls.videoUrl} className="w-full h-full min-h-[320px]" title="z4rtc video" />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(34,197,94,0.18),_transparent_35%),linear-gradient(135deg,_#0f172a,_#020617_65%)] text-white p-6 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs uppercase tracking-[0.25em] text-white/60">
              <span>{t('z4rtc', 'videoSurface')}</span>
              <span className="rounded-full bg-red-500/80 px-2 py-1 text-[10px] font-bold">LIVE READY</span>
            </div>
            <div>
              <div className="text-2xl font-semibold">{connection.connectedRobot?.name || 'z4rtc robot'}</div>
              <div className="mt-2 max-w-md text-sm text-white/70">{t('z4rtc', 'videoPlaceholder')}</div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-10 rounded-lg bg-white/10" />
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div className="rounded-default-border border border-gray-200 dark:border-black bg-white dark:bg-botbot-dark p-4">
          <div className="flex items-center gap-2 mb-3">
            <Camera className="w-4 h-4" />
            <h3 className="heading-text">{t('z4rtc', 'mediaControls')}</h3>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {QUICK_ACTIONS.media
              .filter((action) => capabilities.includes(action.capability))
              .map((action) => (
                <button
                  key={action.command}
                  type="button"
                  onClick={() => runCommand(action.command, action.args || [])}
                  disabled={isBusy !== null}
                  className="rounded-default-border border border-gray-200 dark:border-black bg-gray-50 dark:bg-botbot-darker px-3 py-2 text-xs font-semibold hover:bg-gray-100 dark:hover:bg-botbot-dark disabled:opacity-50"
                >
                  {t('z4rtc', action.label as never)}
                </button>
              ))}
          </div>
        </div>

        <div className="rounded-default-border border border-gray-200 dark:border-black bg-white dark:bg-botbot-dark p-4">
          <div className="flex items-center gap-2 mb-3">
            <Mic className="w-4 h-4" />
            <h3 className="heading-text">{t('z4rtc', 'audioUpload')}</h3>
          </div>
          <div className="space-y-3">
            <input
              type="file"
              accept="audio/*"
              onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
              className="block w-full text-sm"
            />
            <select
              value={uploadMode}
              onChange={(event) => setUploadMode(event.target.value as Z4rtcUploadMode)}
              className="w-full rounded-full border border-gray-300 dark:border-botbot-darker bg-white dark:bg-botbot-dark px-3 py-2 text-sm"
            >
              <option value="audio_upload">{t('z4rtc', 'uploadToAudioHub')}</option>
              <option value="megaphone_play">{t('z4rtc', 'playMegaphone')}</option>
            </select>
            <button
              type="button"
              onClick={handleUpload}
              disabled={isBusy !== null || !selectedFile}
              className="w-full rounded-full bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-focus disabled:opacity-50"
            >
              <span className="inline-flex items-center gap-2">
                <Upload className="w-4 h-4" />
                {t('z4rtc', 'sendAudio')}
              </span>
            </button>
            <div className="flex items-end gap-1 h-12">
              {Array.from({ length: 18 }).map((_, index) => (
                <div
                  key={index}
                  className="flex-1 rounded-t bg-emerald-400/70"
                  style={{ height: `${20 + ((index * 13) % 70)}%` }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderNavigationTab = () => (
    <div className="grid grid-cols-1 xl:grid-cols-[1.3fr_1fr] gap-4">
      <div className="rounded-default-border border border-gray-200 dark:border-black overflow-hidden min-h-[320px] bg-[radial-gradient(circle_at_center,_rgba(56,189,248,0.18),_transparent_40%),linear-gradient(160deg,_#0f172a,_#111827_55%,_#030712)] text-white p-5 flex flex-col justify-between">
        {viewerUrls.lidarUrl ? (
          <iframe src={viewerUrls.lidarUrl} className="w-full h-full min-h-[320px]" title="z4rtc lidar" />
        ) : (
          <>
            <div className="flex items-center justify-between text-xs uppercase tracking-[0.25em] text-white/60">
              <span>{t('z4rtc', 'lidarSurface')}</span>
              <Activity className="w-4 h-4" />
            </div>
            <div className="grid grid-cols-8 gap-2 opacity-70">
              {Array.from({ length: 64 }).map((_, index) => (
                <div
                  key={index}
                  className="aspect-square rounded-full bg-cyan-300/70"
                  style={{ transform: `scale(${0.4 + ((index % 7) / 10)})` }}
                />
              ))}
            </div>
            <div className="text-sm text-white/70">{t('z4rtc', 'lidarPlaceholder')}</div>
          </>
        )}
      </div>

      <div className="space-y-4">
        <div className="rounded-default-border border border-gray-200 dark:border-black bg-white dark:bg-botbot-dark p-4">
          <div className="flex items-center gap-2 mb-3">
            <Compass className="w-4 h-4" />
            <h3 className="heading-text">{t('z4rtc', 'slamUslam')}</h3>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {QUICK_ACTIONS.navigation
              .filter((action) => capabilities.includes(action.capability))
              .map((action) => (
                <button
                  key={action.command}
                  type="button"
                  onClick={() => runCommand(action.command, action.args || [])}
                  disabled={isBusy !== null}
                  className="rounded-default-border border border-gray-200 dark:border-black bg-gray-50 dark:bg-botbot-darker px-3 py-2 text-xs font-semibold hover:bg-gray-100 dark:hover:bg-botbot-dark disabled:opacity-50"
                >
                  {t('z4rtc', action.label as never)}
                </button>
              ))}
          </div>
        </div>

        <div className="rounded-default-border border border-gray-200 dark:border-black bg-white dark:bg-botbot-dark p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Map className="w-4 h-4" />
            <h3 className="heading-text">{t('z4rtc', 'uslamCommand')}</h3>
          </div>
          <select
            value={uslamCommand}
            onChange={(event) => setUslamCommand(event.target.value)}
            className="w-full rounded-full border border-gray-300 dark:border-botbot-darker bg-white dark:bg-botbot-dark px-3 py-2 text-sm"
          >
            {USLAM_COMMANDS.map((command) => (
              <option key={command} value={command}>
                {command}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => runCommand('uslam_cmd', [uslamCommand])}
            disabled={isBusy !== null}
            className="w-full rounded-full bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-focus disabled:opacity-50"
          >
            {t('z4rtc', 'runUslam')}
          </button>
        </div>
      </div>
    </div>
  );

  const renderAiTab = () => (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <div className="rounded-default-border border border-gray-200 dark:border-black bg-white dark:bg-botbot-dark p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4" />
          <h3 className="heading-text">{t('z4rtc', 'gptPanel')}</h3>
        </div>
        <textarea
          value={gptPrompt}
          onChange={(event) => setGptPrompt(event.target.value)}
          placeholder={t('z4rtc', 'gptPlaceholder')}
          className="min-h-32 w-full rounded-2xl border border-gray-300 dark:border-botbot-darker bg-white dark:bg-botbot-dark px-3 py-3 text-sm outline-none"
        />
        <button
          type="button"
          onClick={() => runCommand('gpt', [gptPrompt])}
          disabled={isBusy !== null || gptPrompt.trim().length === 0}
          className="w-full rounded-full bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-focus disabled:opacity-50"
        >
          {t('z4rtc', 'sendGpt')}
        </button>
      </div>

      <div className="rounded-default-border border border-gray-200 dark:border-black bg-white dark:bg-botbot-dark p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4" />
          <h3 className="heading-text">{t('z4rtc', 'petPanel')}</h3>
        </div>
        <textarea
          value={petPrompt}
          onChange={(event) => setPetPrompt(event.target.value)}
          placeholder={t('z4rtc', 'petPlaceholder')}
          className="min-h-32 w-full rounded-2xl border border-gray-300 dark:border-botbot-darker bg-white dark:bg-botbot-dark px-3 py-3 text-sm outline-none"
        />
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => runCommand('pet_switch')}
            disabled={isBusy !== null}
            className="rounded-full border border-gray-300 dark:border-botbot-darker px-3 py-2 text-sm font-semibold hover:bg-gray-100 dark:hover:bg-botbot-darker disabled:opacity-50"
          >
            {t('z4rtc', 'togglePet')}
          </button>
          <button
            type="button"
            onClick={() => runCommand('pet_ask', [petPrompt])}
            disabled={isBusy !== null || petPrompt.trim().length === 0}
            className="rounded-full bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-focus disabled:opacity-50"
          >
            {t('z4rtc', 'sendPet')}
          </button>
        </div>
      </div>
    </div>
  );

  const renderDiagnosticsTab = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
        {QUICK_ACTIONS.diagnostics
          .filter((action) => capabilities.includes(action.capability))
          .map((action) => (
            <button
              key={action.command}
              type="button"
              onClick={() => runCommand(action.command, action.args || [], { storeAs: action.command })}
              disabled={isBusy !== null}
              className="rounded-default-border border border-gray-200 dark:border-black bg-white dark:bg-botbot-dark p-4 text-left hover:bg-gray-50 dark:hover:bg-botbot-darker disabled:opacity-50"
            >
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Cpu className="w-4 h-4" />
                {t('z4rtc', action.label as never)}
              </div>
              <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 line-clamp-4">
                {diagnosticOutput[action.command] || t('z4rtc', 'clickToInspect')}
              </div>
            </button>
          ))}
      </div>

      <div className="rounded-default-border border border-gray-200 dark:border-black bg-white dark:bg-botbot-dark p-4">
        <div className="flex items-center gap-2 mb-2">
          <Radio className="w-4 h-4" />
          <h3 className="heading-text">{t('z4rtc', 'commandOutput')}</h3>
        </div>
        <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words text-xs text-gray-700 dark:text-gray-300">
          {activityLog || t('z4rtc', 'outputEmpty')}
        </pre>
      </div>
    </div>
  );

  return (
    <Container
      className="w-full h-full"
      customContentClasses="h-full overflow-auto"
      title={
        <div className="flex items-center">
          <Bot className="mr-2 w-5 h-5" />
          <span>{t('z4rtc', 'workspaceTitle')}</span>
        </div>
      }
      customActions={
        <div className="flex flex-wrap gap-2">
          {visibleTabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                activeTab === tab
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-botbot-darker dark:text-gray-300 dark:hover:bg-botbot-dark'
              }`}
            >
              {t('z4rtc', tab as never)}
            </button>
          ))}
        </div>
      }
    >
      <div className="space-y-4">
        <div className="rounded-default-border border border-gray-200 dark:border-black bg-gradient-to-r from-emerald-50 via-cyan-50 to-sky-50 dark:from-botbot-dark dark:via-botbot-darker dark:to-botbot-dark p-4">
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
            <div>
              <div className="heading-text">{connection.connectedRobot?.name || t('z4rtc', 'noRobot')}</div>
              <div className="body-text text-gray-600 dark:text-gray-400">
                {connection.connectedRobot?.address || t('z4rtc', 'notConnected')}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {capabilities.map(renderFeatureTag)}
            </div>
          </div>
        </div>

        {activeTab === 'media' && renderMediaTab()}
        {activeTab === 'navigation' && renderNavigationTab()}
        {activeTab === 'ai' && renderAiTab()}
        {activeTab === 'diagnostics' && renderDiagnosticsTab()}

        {activeTab !== 'diagnostics' && (
          <div className="rounded-default-border border border-gray-200 dark:border-black bg-white dark:bg-botbot-dark p-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {t('z4rtc', 'commandOutput')}
            </div>
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words text-xs text-gray-700 dark:text-gray-300">
              {activityLog || t('z4rtc', 'outputEmpty')}
            </pre>
          </div>
        )}
      </div>
    </Container>
  );
}
