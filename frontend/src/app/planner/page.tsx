'use client';

import { useEffect, useMemo, useState } from 'react';
import { Download, Map, Plus, Save, Trash2, Upload, Waypoints } from 'lucide-react';
import { missionsService, MissionWithWaypoints } from '@/services/missions';
import { plannerMapsService, MissionMapAsset } from '@/services/planner-maps';
import { useSupabase } from '@/contexts/SupabaseProvider';
import { useNotifications } from '@/contexts/NotificationsContext';
import { parseRosMapYaml } from '@/utils/parse-ros-map-yaml';
import CloudMissionPlannerCanvas, {
  PlannerWaypointDraft,
} from '@/components/planner/cloud-mission-planner-canvas';
import {
  DEFAULT_WAYPOINT_ACTION_PROVIDER,
  DEFAULT_WAYPOINT_EXECUTION_POLICY,
  normalizeWaypointActionPayload,
  normalizeWaypointActionProvider,
  normalizeWaypointExecutionPolicy,
} from '@/types/mission-waypoint';

export const dynamic = 'force-dynamic';

interface MapDraftFormState {
  name: string;
  description: string;
  resolution: number;
  originX: number;
  originY: number;
  originTheta: number;
  mapFormat: string;
}

interface BundledPlannerMap {
  id: string;
  name: string;
  description: string;
  previewPath: string;
  yamlPath: string;
  source: string;
}

const defaultMapDraft: MapDraftFormState = {
  name: '',
  description: '',
  resolution: 0.05,
  originX: 0,
  originY: 0,
  originTheta: 0,
  mapFormat: 'preview-image',
};

const bundledMapsCatalogPath = '/imported-maps/multi-map-navigation/catalog.json';

function mapWaypointsToDraft(mission: MissionWithWaypoints | null): PlannerWaypointDraft[] {
  if (!mission) {
    return [];
  }

  return mission.waypoints
    .slice()
    .sort((left, right) => left.order_index - right.order_index)
    .map((waypoint) => ({
      id: waypoint.id,
      order_index: waypoint.order_index,
      x: waypoint.x,
      y: waypoint.y,
      theta: waypoint.theta,
      action_provider: normalizeWaypointActionProvider(waypoint.action_provider, waypoint.action_name),
      action_name: waypoint.action_name,
      action_payload: waypoint.action_payload,
      execution_policy: normalizeWaypointExecutionPolicy(waypoint.execution_policy),
    }));
}

export default function PlannerPage() {
  const { user, loading: userLoading } = useSupabase();
  const { dispatch } = useNotifications();

  const [missionMaps, setMissionMaps] = useState<MissionMapAsset[]>([]);
  const [missions, setMissions] = useState<MissionWithWaypoints[]>([]);
  const [selectedMapId, setSelectedMapId] = useState<string | null>(null);
  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(null);
  const [mapPreviewUrl, setMapPreviewUrl] = useState<string | null>(null);
  const [isMapPreviewLoading, setIsMapPreviewLoading] = useState(false);
  const [waypointDraft, setWaypointDraft] = useState<PlannerWaypointDraft[]>([]);
  const [mapDraft, setMapDraft] = useState<MapDraftFormState>(defaultMapDraft);
  const [mapImageFile, setMapImageFile] = useState<File | null>(null);
  const [mapImageDimensions, setMapImageDimensions] = useState<{ width: number; height: number } | null>(null);
  const [isUploadingMap, setIsUploadingMap] = useState(false);
  const [isSavingMission, setIsSavingMission] = useState(false);
  const [missionName, setMissionName] = useState('');
  const [missionDescription, setMissionDescription] = useState('');
  const [bundledMaps, setBundledMaps] = useState<BundledPlannerMap[]>([]);
  const [importingBundledMapId, setImportingBundledMapId] = useState<string | null>(null);

  const selectedMap = useMemo(
    () => missionMaps.find((map) => map.id === selectedMapId) ?? null,
    [missionMaps, selectedMapId]
  );

  const selectedMission = useMemo(
    () => missions.find((mission) => mission.id === selectedMissionId) ?? null,
    [missions, selectedMissionId]
  );

  useEffect(() => {
    document.title = 'Cloud Planner - BotBot';
  }, []);

  useEffect(() => {
    const loadBundledMaps = async () => {
      try {
        const response = await fetch(bundledMapsCatalogPath, { cache: 'no-store' });
        if (!response.ok) {
          throw new Error(`Failed to load bundled map catalog: ${response.status}`);
        }

        const catalog = (await response.json()) as BundledPlannerMap[];
        setBundledMaps(catalog);
      } catch (error) {
        console.error('Failed to load bundled planner maps:', error);
      }
    };

    loadBundledMaps();
  }, []);

  useEffect(() => {
    if (!user) {
      return;
    }

    const loadPlannerData = async () => {
      try {
        const [loadedMaps, loadedMissions] = await Promise.all([
          plannerMapsService.getMissionMaps(),
          missionsService.getMissions(),
        ]);

        setMissionMaps(loadedMaps);
        setMissions(loadedMissions);

        const initialMapId = loadedMaps[0]?.id ?? null;
        setSelectedMapId((current) => current ?? initialMapId);

        const initialMissionId = loadedMissions[0]?.id ?? null;
        setSelectedMissionId((current) => current ?? initialMissionId);
      } catch (error) {
        console.error('Failed to load cloud planner data:', error);
        dispatch({
          type: 'ADD_NOTIFICATION',
          payload: {
            type: 'error',
            title: 'Planner load failed',
            message: 'Could not load maps or missions from Supabase.',
          },
        });
      }
    };

    loadPlannerData();
  }, [dispatch, user]);

  useEffect(() => {
    if (!selectedMission) {
      setWaypointDraft([]);
      return;
    }

    setWaypointDraft(mapWaypointsToDraft(selectedMission));

    if (selectedMission.map_asset_id) {
      setSelectedMapId(selectedMission.map_asset_id);
    }
  }, [selectedMission]);

  useEffect(() => {
    if (!selectedMap) {
      setMapPreviewUrl(null);
      setIsMapPreviewLoading(false);
      return;
    }

    const loadPreview = async () => {
      setIsMapPreviewLoading(true);

      try {
        const previewUrl = await plannerMapsService.getMissionMapImageUrl(selectedMap.image_path);
        setMapPreviewUrl(previewUrl);
      } catch (error) {
        console.error('Failed to load planner map preview:', error);
        setMapPreviewUrl(null);
      } finally {
        setIsMapPreviewLoading(false);
      }
    };

    loadPreview();
  }, [selectedMap]);

  const attachSelectedMapToMission = async () => {
    if (!selectedMap || !selectedMission) {
      return;
    }

    try {
      const updatedMission = await missionsService.updateMission(selectedMission.id, {
        map_asset_id: selectedMap.id,
        map_name: selectedMap.name,
        description: selectedMission.description,
      });

      setMissions((current) =>
        current.map((mission) =>
          mission.id === selectedMission.id
            ? { ...mission, ...updatedMission, waypoints: mission.waypoints }
            : mission
        )
      );

      dispatch({
        type: 'ADD_NOTIFICATION',
        payload: {
          type: 'success',
          title: 'Mission map updated',
          message: `Mission now uses ${selectedMap.name}.`,
        },
      });
    } catch (error) {
      console.error('Failed to attach map to mission:', error);
      dispatch({
        type: 'ADD_NOTIFICATION',
        payload: {
          type: 'error',
          title: 'Mission update failed',
          message: 'Could not attach the selected map to this mission.',
        },
      });
    }
  };

  const refreshPlannerData = async () => {
    const [loadedMaps, loadedMissions] = await Promise.all([
      plannerMapsService.getMissionMaps(),
      missionsService.getMissions(),
    ]);

    setMissionMaps(loadedMaps);
    setMissions(loadedMissions);
  };

  const buildFileFromUrl = async (path: string, fileName: string, fallbackType: string): Promise<File> => {
    const response = await fetch(path);

    if (!response.ok) {
      throw new Error(`Failed to fetch ${path}`);
    }

    const blob = await response.blob();
    return new File([blob], fileName, { type: blob.type || fallbackType });
  };

  const readImageDimensions = async (file: File): Promise<{ width: number; height: number }> => {
    const objectUrl = URL.createObjectURL(file);

    try {
      const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
        const image = new Image();
        image.onload = () => {
          resolve({ width: image.naturalWidth, height: image.naturalHeight });
        };
        image.onerror = () => reject(new Error('Failed to read image dimensions'));
        image.src = objectUrl;
      });

      return dimensions;
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  };

  const importBundledMap = async (bundledMap: BundledPlannerMap) => {
    const existingMap = missionMaps.find((map) => map.name === bundledMap.name);

    if (existingMap) {
      setSelectedMapId(existingMap.id);
      dispatch({
        type: 'ADD_NOTIFICATION',
        payload: {
          type: 'info',
          title: 'Map already imported',
          message: `${bundledMap.name} is already available in your planner assets.`,
        },
      });
      return;
    }

    try {
      setImportingBundledMapId(bundledMap.id);

      const [yamlResponse, previewFile] = await Promise.all([
        fetch(bundledMap.yamlPath, { cache: 'no-store' }),
        buildFileFromUrl(
          bundledMap.previewPath,
          bundledMap.previewPath.split('/').pop() || `${bundledMap.id}.png`,
          'image/png'
        ),
      ]);

      if (!yamlResponse.ok) {
        throw new Error(`Failed to fetch ${bundledMap.yamlPath}`);
      }

      const yamlText = await yamlResponse.text();
      const parsedMap = parseRosMapYaml(yamlText);
      const dimensions = await readImageDimensions(previewFile);

      const createdMap = await plannerMapsService.createMissionMapAsset({
        name: bundledMap.name,
        description: bundledMap.description,
        mapFormat: 'ros-yaml-preview',
        resolution: parsedMap.resolution ?? defaultMapDraft.resolution,
        originX: parsedMap.origin?.[0] ?? defaultMapDraft.originX,
        originY: parsedMap.origin?.[1] ?? defaultMapDraft.originY,
        originTheta: parsedMap.origin?.[2] ?? defaultMapDraft.originTheta,
        imageWidth: dimensions.width,
        imageHeight: dimensions.height,
        imageFile: previewFile,
      });

      await refreshPlannerData();
      setSelectedMapId(createdMap.id);

      dispatch({
        type: 'ADD_NOTIFICATION',
        payload: {
          type: 'success',
          title: 'Bundled map imported',
          message: `${bundledMap.name} is ready for mission planning.`,
        },
      });
    } catch (error) {
      console.error('Failed to import bundled planner map:', error);
      dispatch({
        type: 'ADD_NOTIFICATION',
        payload: {
          type: 'error',
          title: 'Bundled map import failed',
          message: `Could not import ${bundledMap.name} into Supabase storage.`,
        },
      });
    } finally {
      setImportingBundledMapId(null);
    }
  };

  const handleMapImageChange = (file: File | null) => {
    setMapImageFile(file);
    setMapImageDimensions(null);

    if (!file) {
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      setMapImageDimensions({ width: image.naturalWidth, height: image.naturalHeight });
      URL.revokeObjectURL(objectUrl);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
    };
    image.src = objectUrl;
  };

  const handleRosYamlImport = async (file: File | null) => {
    if (!file) {
      return;
    }

    const yamlText = await file.text();
    const parsed = parseRosMapYaml(yamlText);

    setMapDraft((current) => ({
      ...current,
      resolution: parsed.resolution ?? current.resolution,
      originX: parsed.origin?.[0] ?? current.originX,
      originY: parsed.origin?.[1] ?? current.originY,
      originTheta: parsed.origin?.[2] ?? current.originTheta,
      mapFormat: 'ros-yaml-preview',
      name: current.name || (file.name.replace(/\.ya?ml$/i, '') || current.name),
    }));

    dispatch({
      type: 'ADD_NOTIFICATION',
      payload: {
        type: 'info',
        title: 'ROS map metadata imported',
        message: 'Resolution and origin values were loaded from the YAML file.',
      },
    });
  };

  const createMissionMap = async () => {
    if (!mapImageFile || !mapDraft.name.trim()) {
      dispatch({
        type: 'ADD_NOTIFICATION',
        payload: {
          type: 'error',
          title: 'Map upload incomplete',
          message: 'A map name and browser-friendly preview image are required.',
        },
      });
      return;
    }

    try {
      setIsUploadingMap(true);

      const createdMap = await plannerMapsService.createMissionMapAsset({
        name: mapDraft.name.trim(),
        description: mapDraft.description.trim(),
        mapFormat: mapDraft.mapFormat,
        resolution: mapDraft.resolution,
        originX: mapDraft.originX,
        originY: mapDraft.originY,
        originTheta: mapDraft.originTheta,
        imageWidth: mapImageDimensions?.width,
        imageHeight: mapImageDimensions?.height,
        imageFile: mapImageFile,
      });

      await refreshPlannerData();
      setSelectedMapId(createdMap.id);
      setMapDraft(defaultMapDraft);
      setMapImageFile(null);
      setMapImageDimensions(null);

      dispatch({
        type: 'ADD_NOTIFICATION',
        payload: {
          type: 'success',
          title: 'Map uploaded',
          message: `Preloaded map ${createdMap.name} is ready for planning.`,
        },
      });
    } catch (error) {
      console.error('Failed to upload mission map:', error);
      dispatch({
        type: 'ADD_NOTIFICATION',
        payload: {
          type: 'error',
          title: 'Map upload failed',
          message: 'Could not create the map asset in Supabase.',
        },
      });
    } finally {
      setIsUploadingMap(false);
    }
  };

  const createMission = async () => {
    if (!missionName.trim()) {
      return;
    }

    try {
      setIsSavingMission(true);

      const createdMission = await missionsService.createMission({
        name: missionName.trim(),
        description: missionDescription.trim() || null,
        robot_id: null,
        map_name: selectedMap?.name ?? null,
        map_asset_id: selectedMap?.id ?? null,
      });

      const missionWithWaypoints: MissionWithWaypoints = {
        ...createdMission,
        waypoints: [],
      };

      setMissions((current) => [missionWithWaypoints, ...current]);
      setSelectedMissionId(createdMission.id);
      setMissionName('');
      setMissionDescription('');

      dispatch({
        type: 'ADD_NOTIFICATION',
        payload: {
          type: 'success',
          title: 'Mission created',
          message: `Mission ${createdMission.name} is ready for waypoint planning.`,
        },
      });
    } catch (error) {
      console.error('Failed to create mission:', error);
      dispatch({
        type: 'ADD_NOTIFICATION',
        payload: {
          type: 'error',
          title: 'Mission creation failed',
          message: 'Could not create the mission in Supabase.',
        },
      });
    } finally {
      setIsSavingMission(false);
    }
  };

  const saveMissionWaypoints = async () => {
    if (!selectedMission) {
      return;
    }

    try {
      setIsSavingMission(true);

      const savedWaypoints = await missionsService.updateWaypoints(
        selectedMission.id,
        waypointDraft.map((waypoint, index) => ({
          order_index: index,
          x: waypoint.x,
          y: waypoint.y,
          theta: waypoint.theta,
          action_provider: waypoint.action_name
            ? normalizeWaypointActionProvider(waypoint.action_provider, waypoint.action_name) ?? DEFAULT_WAYPOINT_ACTION_PROVIDER
            : null,
          action_name: waypoint.action_name ?? null,
          action_payload: normalizeWaypointActionPayload(waypoint.action_payload),
          execution_policy: waypoint.action_name
            ? normalizeWaypointExecutionPolicy(waypoint.execution_policy) ?? DEFAULT_WAYPOINT_EXECUTION_POLICY
            : null,
        }))
      );

      setMissions((current) =>
        current.map((mission) =>
          mission.id === selectedMission.id
            ? {
                ...mission,
                waypoints: savedWaypoints,
              }
            : mission
        )
      );

      dispatch({
        type: 'ADD_NOTIFICATION',
        payload: {
          type: 'success',
          title: 'Waypoints saved',
          message: `Saved ${savedWaypoints.length} waypoint${savedWaypoints.length === 1 ? '' : 's'} to ${selectedMission.name}.`,
        },
      });
    } catch (error) {
      console.error('Failed to save mission waypoints:', error);
      dispatch({
        type: 'ADD_NOTIFICATION',
        payload: {
          type: 'error',
          title: 'Waypoint save failed',
          message: 'Could not write the mission waypoints to Supabase.',
        },
      });
    } finally {
      setIsSavingMission(false);
    }
  };

  const deleteSelectedMap = async () => {
    if (!selectedMap) {
      return;
    }

    try {
      await plannerMapsService.deleteMissionMap(selectedMap);
      await refreshPlannerData();
      setSelectedMapId((current) => (current === selectedMap.id ? null : current));

      dispatch({
        type: 'ADD_NOTIFICATION',
        payload: {
          type: 'success',
          title: 'Map deleted',
          message: `${selectedMap.name} was removed from cloud planning storage.`,
        },
      });
    } catch (error) {
      console.error('Failed to delete planner map:', error);
      dispatch({
        type: 'ADD_NOTIFICATION',
        payload: {
          type: 'error',
          title: 'Map delete failed',
          message: 'Could not remove the selected map asset.',
        },
      });
    }
  };

  if (userLoading) {
    return <div className="p-6 text-sm text-gray-500 dark:text-gray-400">Loading planner...</div>;
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.12),_transparent_35%),linear-gradient(180deg,_#f7fafc_0%,_#eef2f7_100%)] px-4 py-6 dark:bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.12),_transparent_35%),linear-gradient(180deg,_#111827_0%,_#0b1220_100%)]">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-sky-600 dark:text-sky-300">
              Cloud Planning
            </p>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Mission Planner</h1>
            <p className="mt-2 max-w-3xl text-sm text-gray-600 dark:text-gray-300">
              Host this view in the cloud to design missions against preloaded map previews, then sync the mission and waypoint data back to the robot deployment later.
            </p>
          </div>

          <div className="rounded-2xl border border-sky-200 bg-white/80 px-4 py-3 text-sm text-sky-900 shadow-sm backdrop-blur dark:border-sky-900/60 dark:bg-sky-950/20 dark:text-sky-100">
            Planner maps are Supabase-backed. Live ROS map services are not required here.
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <div className="space-y-6">
            <section className="rounded-3xl border border-gray-200 bg-white/85 p-5 shadow-sm backdrop-blur dark:border-gray-800 dark:bg-botbot-dark/90">
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-2xl bg-sky-100 p-2 text-sky-700 dark:bg-sky-950/40 dark:text-sky-200">
                  <Upload className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Preload map</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Upload a preview image and optional ROS YAML metadata.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {bundledMaps.length > 0 && (
                  <div className="rounded-2xl border border-sky-200 bg-sky-50/80 p-4 dark:border-sky-900/60 dark:bg-sky-950/20">
                    <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-sky-900 dark:text-sky-100">
                      <Download className="h-4 w-4" />
                      Bundled sample maps
                    </div>
                    <div className="space-y-3">
                      {bundledMaps.map((bundledMap) => {
                        const existingMap = missionMaps.find((map) => map.name === bundledMap.name);

                        return (
                          <div
                            key={bundledMap.id}
                            className="rounded-2xl border border-sky-100 bg-white/90 p-3 dark:border-sky-900/60 dark:bg-botbot-darkest"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="font-medium text-gray-900 dark:text-white">{bundledMap.name}</div>
                                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{bundledMap.description}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => importBundledMap(bundledMap)}
                                disabled={importingBundledMapId === bundledMap.id}
                                className="inline-flex items-center gap-2 rounded-xl border border-sky-200 px-3 py-2 text-sm font-medium text-sky-700 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-sky-800 dark:text-sky-200 dark:hover:bg-sky-950/50"
                              >
                                <Download className="h-4 w-4" />
                                {existingMap ? 'Select' : importingBundledMapId === bundledMap.id ? 'Importing...' : 'Import'}
                              </button>
                            </div>
                            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                              Source: {bundledMap.source}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <label className="grid gap-1 text-sm text-gray-700 dark:text-gray-300">
                  Map name
                  <input
                    value={mapDraft.name}
                    onChange={(event) => setMapDraft((current) => ({ ...current, name: event.target.value }))}
                    className="rounded-xl border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-botbot-darkest"
                    placeholder="Warehouse A"
                  />
                </label>
                <label className="grid gap-1 text-sm text-gray-700 dark:text-gray-300">
                  Description
                  <textarea
                    value={mapDraft.description}
                    onChange={(event) => setMapDraft((current) => ({ ...current, description: event.target.value }))}
                    className="min-h-24 rounded-xl border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-botbot-darkest"
                    placeholder="South wing inspection route"
                  />
                </label>

                <label className="grid gap-1 text-sm text-gray-700 dark:text-gray-300">
                  Preview image
                  <input
                    type="file"
                    accept=".png,.jpg,.jpeg,.webp,.svg,.bmp"
                    onChange={(event) => handleMapImageChange(event.target.files?.[0] ?? null)}
                    className="rounded-xl border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-botbot-darkest"
                  />
                </label>

                <label className="grid gap-1 text-sm text-gray-700 dark:text-gray-300">
                  Optional ROS YAML
                  <input
                    type="file"
                    accept=".yaml,.yml"
                    onChange={(event) => handleRosYamlImport(event.target.files?.[0] ?? null)}
                    className="rounded-xl border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-botbot-darkest"
                  />
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <label className="grid gap-1 text-sm text-gray-700 dark:text-gray-300">
                    Resolution (m/px)
                    <input
                      type="number"
                      step="0.001"
                      value={mapDraft.resolution}
                      onChange={(event) => setMapDraft((current) => ({ ...current, resolution: Number(event.target.value) }))}
                      className="rounded-xl border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-botbot-darkest"
                    />
                  </label>
                  <label className="grid gap-1 text-sm text-gray-700 dark:text-gray-300">
                    Origin theta
                    <input
                      type="number"
                      step="0.01"
                      value={mapDraft.originTheta}
                      onChange={(event) => setMapDraft((current) => ({ ...current, originTheta: Number(event.target.value) }))}
                      className="rounded-xl border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-botbot-darkest"
                    />
                  </label>
                  <label className="grid gap-1 text-sm text-gray-700 dark:text-gray-300">
                    Origin X
                    <input
                      type="number"
                      step="0.01"
                      value={mapDraft.originX}
                      onChange={(event) => setMapDraft((current) => ({ ...current, originX: Number(event.target.value) }))}
                      className="rounded-xl border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-botbot-darkest"
                    />
                  </label>
                  <label className="grid gap-1 text-sm text-gray-700 dark:text-gray-300">
                    Origin Y
                    <input
                      type="number"
                      step="0.01"
                      value={mapDraft.originY}
                      onChange={(event) => setMapDraft((current) => ({ ...current, originY: Number(event.target.value) }))}
                      className="rounded-xl border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-botbot-darkest"
                    />
                  </label>
                </div>

                <button
                  type="button"
                  onClick={createMissionMap}
                  disabled={isUploadingMap}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Upload className="h-4 w-4" />
                  {isUploadingMap ? 'Uploading...' : 'Create map asset'}
                </button>
              </div>
            </section>

            <section className="rounded-3xl border border-gray-200 bg-white/85 p-5 shadow-sm backdrop-blur dark:border-gray-800 dark:bg-botbot-dark/90">
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-2xl bg-emerald-100 p-2 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200">
                  <Plus className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Mission</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Create an offline mission linked to the selected planner map.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <label className="grid gap-1 text-sm text-gray-700 dark:text-gray-300">
                  Mission name
                  <input
                    value={missionName}
                    onChange={(event) => setMissionName(event.target.value)}
                    className="rounded-xl border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-botbot-darkest"
                    placeholder="Night patrol"
                  />
                </label>
                <label className="grid gap-1 text-sm text-gray-700 dark:text-gray-300">
                  Description
                  <textarea
                    value={missionDescription}
                    onChange={(event) => setMissionDescription(event.target.value)}
                    className="min-h-24 rounded-xl border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-botbot-darkest"
                    placeholder="Starts at dock, sweeps aisle 3, returns to charging zone"
                  />
                </label>
                <button
                  type="button"
                  onClick={createMission}
                  disabled={isSavingMission}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Waypoints className="h-4 w-4" />
                  {isSavingMission ? 'Saving...' : 'Create mission'}
                </button>
              </div>
            </section>

            <section className="rounded-3xl border border-gray-200 bg-white/85 p-5 shadow-sm backdrop-blur dark:border-gray-800 dark:bg-botbot-dark/90">
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-2xl bg-violet-100 p-2 text-violet-700 dark:bg-violet-950/40 dark:text-violet-200">
                  <Map className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Planner assets</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Pick a map and mission to edit.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <label className="grid gap-1 text-sm text-gray-700 dark:text-gray-300">
                  Map
                  <select
                    value={selectedMapId ?? ''}
                    onChange={(event) => setSelectedMapId(event.target.value || null)}
                    className="rounded-xl border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-botbot-darkest"
                  >
                    <option value="">Select a map</option>
                    {missionMaps.map((map) => (
                      <option key={map.id} value={map.id}>
                        {map.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-sm text-gray-700 dark:text-gray-300">
                  Mission
                  <select
                    value={selectedMissionId ?? ''}
                    onChange={(event) => setSelectedMissionId(event.target.value || null)}
                    className="rounded-xl border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-botbot-darkest"
                  >
                    <option value="">Select a mission</option>
                    {missions.map((mission) => (
                      <option key={mission.id} value={mission.id}>
                        {mission.name}
                      </option>
                    ))}
                  </select>
                </label>

                {selectedMap && (
                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600 dark:border-gray-700 dark:bg-botbot-darkest dark:text-gray-300">
                    <div className="font-semibold text-gray-900 dark:text-white">{selectedMap.name}</div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <span>Resolution {selectedMap.resolution} m/px</span>
                      <span>Origin ({selectedMap.origin_x}, {selectedMap.origin_y})</span>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={attachSelectedMapToMission}
                    disabled={!selectedMap || !selectedMission}
                    className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-botbot-darkest"
                  >
                    <Save className="h-4 w-4" />
                    Attach map to mission
                  </button>
                  <button
                    type="button"
                    onClick={deleteSelectedMap}
                    disabled={!selectedMap}
                    className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-950/40"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete map
                  </button>
                </div>
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <section className="rounded-3xl border border-gray-200 bg-white/85 p-5 shadow-sm backdrop-blur dark:border-gray-800 dark:bg-botbot-dark/90">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Mission workspace</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Use the selected preloaded map to lay down mission waypoints before deployment.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={saveMissionWaypoints}
                  disabled={!selectedMission || isSavingMission}
                  className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
                >
                  <Save className="h-4 w-4" />
                  {isSavingMission ? 'Saving...' : 'Save waypoints'}
                </button>
              </div>

              <CloudMissionPlannerCanvas
                imageUrl={mapPreviewUrl}
                isImageLoading={isMapPreviewLoading}
                mapName={selectedMap?.name ?? 'No map selected'}
                resolution={selectedMap?.resolution ?? 0.05}
                originX={selectedMap?.origin_x ?? 0}
                originY={selectedMap?.origin_y ?? 0}
                waypoints={waypointDraft}
                onWaypointsChange={setWaypointDraft}
              />
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}