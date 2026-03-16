'use client';

import { useMemo, useRef, useState } from 'react';
import { Minus, Plus, RotateCcw, Trash2 } from 'lucide-react';
import {
  DEFAULT_WAYPOINT_ACTION_PROVIDER,
  DEFAULT_WAYPOINT_EXECUTION_POLICY,
  formatWaypointActionPayload,
  getWaypointActionLabel,
  getWaypointActionOptions,
  getWaypointActionPayloadPlaceholder,
  normalizeWaypointActionProvider,
  type WaypointActionFields,
  WAYPOINT_ACTION_PROVIDER_OPTIONS,
  WAYPOINT_EXECUTION_POLICY_OPTIONS,
} from '@/types/mission-waypoint';

export interface PlannerWaypointDraft extends WaypointActionFields {
  id: string;
  order_index: number;
  x: number;
  y: number;
  theta: number;
}

interface CloudMissionPlannerCanvasProps {
  imageUrl: string | null;
  isImageLoading?: boolean;
  mapName: string;
  resolution: number;
  originX: number;
  originY: number;
  waypoints: PlannerWaypointDraft[];
  onWaypointsChange: (waypoints: PlannerWaypointDraft[]) => void;
}

function reorderWaypoints(waypoints: PlannerWaypointDraft[]): PlannerWaypointDraft[] {
  return waypoints.map((waypoint, index) => ({
    ...waypoint,
    order_index: index,
  }));
}

export default function CloudMissionPlannerCanvas({
  imageUrl,
  isImageLoading = false,
  mapName,
  resolution,
  originX,
  originY,
  waypoints,
  onWaypointsChange,
}: CloudMissionPlannerCanvasProps) {
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [selectedWaypointId, setSelectedWaypointId] = useState<string | null>(null);
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });

  const selectedWaypoint = useMemo(
    () => waypoints.find((waypoint) => waypoint.id === selectedWaypointId) ?? null,
    [selectedWaypointId, waypoints]
  );

  const viewportWidth = naturalSize.width || 1200;
  const viewportHeight = naturalSize.height || 800;

  const toPixelPosition = (waypoint: PlannerWaypointDraft) => {
    const px = (waypoint.x - originX) / resolution;
    const py = viewportHeight - (waypoint.y - originY) / resolution;

    return {
      left: `${(px / viewportWidth) * 100}%`,
      top: `${(py / viewportHeight) * 100}%`,
      angle: -waypoint.theta,
    };
  };

  const addWaypointFromClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!imageRef.current || !imageUrl) {
      return;
    }

    const rect = imageRef.current.getBoundingClientRect();
    const rawX = (event.clientX - rect.left) / zoom;
    const rawY = (event.clientY - rect.top) / zoom;

    const px = Math.min(Math.max(rawX, 0), viewportWidth);
    const py = Math.min(Math.max(rawY, 0), viewportHeight);
    const x = originX + px * resolution;
    const y = originY + (viewportHeight - py) * resolution;

    const nextWaypoint: PlannerWaypointDraft = {
      id: crypto.randomUUID(),
      order_index: waypoints.length,
      x,
      y,
      theta: 0,
      action_provider: null,
      action_name: null,
      action_payload: null,
      execution_policy: null,
    };

    const updated = reorderWaypoints([...waypoints, nextWaypoint]);
    onWaypointsChange(updated);
    setSelectedWaypointId(nextWaypoint.id);
  };

  const updateWaypoint = (waypointId: string, patch: Partial<PlannerWaypointDraft>) => {
    const updated = waypoints.map((waypoint) =>
      waypoint.id === waypointId ? { ...waypoint, ...patch } : waypoint
    );
    onWaypointsChange(updated);
  };

  const deleteSelectedWaypoint = () => {
    if (!selectedWaypointId) {
      return;
    }

    const updated = reorderWaypoints(
      waypoints.filter((waypoint) => waypoint.id !== selectedWaypointId)
    );
    onWaypointsChange(updated);
    setSelectedWaypointId(updated[0]?.id ?? null);
  };

  const clearWaypoints = () => {
    onWaypointsChange([]);
    setSelectedWaypointId(null);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-botbot-dark">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{mapName}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Click the map to add waypoints in world coordinates.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setZoom((value) => Math.max(0.5, Number((value - 0.25).toFixed(2))))}
              className="rounded-lg border border-gray-200 p-2 text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-botbot-darker"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="min-w-14 text-center text-sm font-medium text-gray-600 dark:text-gray-300">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((value) => Math.min(4, Number((value + 0.25).toFixed(2))))}
              className="rounded-lg border border-gray-200 p-2 text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-botbot-darker"
            >
              <Plus className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setZoom(1)}
              className="rounded-lg border border-gray-200 p-2 text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-botbot-darker"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="overflow-auto rounded-xl border border-dashed border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-botbot-darkest/60">
          <div
            className="relative inline-block origin-top-left"
            onClick={addWaypointFromClick}
            style={{ transform: `scale(${zoom})` }}
          >
            {imageUrl ? (
              <img
                ref={imageRef}
                src={imageUrl}
                alt={mapName}
                className="max-w-none select-none"
                onLoad={(event) => {
                  setNaturalSize({
                    width: event.currentTarget.naturalWidth,
                    height: event.currentTarget.naturalHeight,
                  });
                }}
              />
            ) : (
              <div className="flex h-[480px] w-[720px] items-center justify-center text-sm text-gray-500 dark:text-gray-400">
                {isImageLoading ? 'Loading map preview...' : 'Select a preloaded map to start planning.'}
              </div>
            )}

            {imageUrl && (
              <div className="pointer-events-none absolute inset-0">
                {waypoints.map((waypoint, index) => {
                  const position = toPixelPosition(waypoint);
                  const isSelected = waypoint.id === selectedWaypointId;

                  return (
                    <button
                      key={waypoint.id}
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedWaypointId(waypoint.id);
                      }}
                      className={`pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 ${isSelected ? 'z-20' : 'z-10'}`}
                      style={{ left: position.left, top: position.top }}
                    >
                      <div
                        className={`relative flex h-7 w-7 items-center justify-center rounded-full border-2 text-[11px] font-semibold text-white shadow ${
                          isSelected ? 'border-orange-200 bg-orange-500' : 'border-sky-200 bg-sky-600'
                        }`}
                      >
                        {index + 1}
                        <div
                          className="absolute left-1/2 top-1/2 h-0.5 w-8 origin-left bg-white/90"
                          style={{ transform: `translateY(-50%) rotate(${position.angle}rad)` }}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-botbot-dark">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Waypoints</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {waypoints.length} planned waypoint{waypoints.length === 1 ? '' : 's'}
            </p>
          </div>
          <button
            type="button"
            onClick={clearWaypoints}
            className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-950/40"
          >
            Clear all
          </button>
        </div>

        <div className="space-y-3">
          {waypoints.map((waypoint, index) => {
            const isSelected = waypoint.id === selectedWaypointId;

            return (
              <button
                key={waypoint.id}
                type="button"
                onClick={() => setSelectedWaypointId(waypoint.id)}
                className={`w-full rounded-xl border p-3 text-left transition ${
                  isSelected
                    ? 'border-orange-300 bg-orange-50 dark:border-orange-700 dark:bg-orange-950/30'
                    : 'border-gray-200 bg-gray-50 hover:bg-gray-100 dark:border-gray-700 dark:bg-botbot-darkest dark:hover:bg-botbot-darker'
                }`}
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">Waypoint {index + 1}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {waypoint.x.toFixed(2)}, {waypoint.y.toFixed(2)}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <span>x {waypoint.x.toFixed(2)}</span>
                  <span>y {waypoint.y.toFixed(2)}</span>
                  <span>theta {waypoint.theta.toFixed(2)}</span>
                </div>
                <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  action {getWaypointActionLabel(waypoint.action_name, waypoint.action_provider)}
                </div>
              </button>
            );
          })}

          {waypoints.length === 0 && (
            <div className="rounded-xl border border-dashed border-gray-200 px-4 py-6 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
              No waypoints yet. Click on the map to place the first one.
            </div>
          )}
        </div>

        {selectedWaypoint && (
          <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-botbot-darkest">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Selected waypoint</h4>
              <button
                type="button"
                onClick={deleteSelectedWaypoint}
                className="rounded-lg border border-red-200 p-2 text-red-600 transition hover:bg-red-50 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-950/40"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-3">
              <label className="grid gap-1 text-sm text-gray-700 dark:text-gray-300">
                Action provider
                <select
                  value={selectedWaypoint.action_provider ?? ''}
                  onChange={(event) => {
                    const nextProvider = normalizeWaypointActionProvider(event.target.value);
                    updateWaypoint(selectedWaypoint.id, {
                      action_provider: nextProvider,
                      action_name: null,
                      action_payload: null,
                      execution_policy: null,
                    });
                  }}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-botbot-dark"
                >
                  <option value="">Choose provider</option>
                  {WAYPOINT_ACTION_PROVIDER_OPTIONS.map((providerOption) => (
                    <option key={providerOption.value} value={providerOption.value}>
                      {providerOption.label}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {
                    WAYPOINT_ACTION_PROVIDER_OPTIONS.find(
                      (providerOption) => providerOption.value === selectedWaypoint.action_provider
                    )?.description ?? 'Choose how this waypoint action should be executed.'
                  }
                </span>
              </label>
              <label className="grid gap-1 text-sm text-gray-700 dark:text-gray-300">
                X (meters)
                <input
                  type="number"
                  step="0.01"
                  value={selectedWaypoint.x}
                  onChange={(event) => updateWaypoint(selectedWaypoint.id, { x: Number(event.target.value) })}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-botbot-dark"
                />
              </label>
              <label className="grid gap-1 text-sm text-gray-700 dark:text-gray-300">
                Y (meters)
                <input
                  type="number"
                  step="0.01"
                  value={selectedWaypoint.y}
                  onChange={(event) => updateWaypoint(selectedWaypoint.id, { y: Number(event.target.value) })}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-botbot-dark"
                />
              </label>
              <label className="grid gap-1 text-sm text-gray-700 dark:text-gray-300">
                Heading (radians)
                <input
                  type="number"
                  step="0.01"
                  value={selectedWaypoint.theta}
                  onChange={(event) => updateWaypoint(selectedWaypoint.id, { theta: Number(event.target.value) })}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-botbot-dark"
                />
              </label>
              <label className="grid gap-1 text-sm text-gray-700 dark:text-gray-300">
                Waypoint action
                <select
                  value={selectedWaypoint.action_name ?? ''}
                  disabled={!selectedWaypoint.action_provider}
                  onChange={(event) => {
                    const nextAction = event.target.value;
                    const actionProvider =
                      selectedWaypoint.action_provider ?? DEFAULT_WAYPOINT_ACTION_PROVIDER;
                    updateWaypoint(selectedWaypoint.id, {
                      action_provider: nextAction ? actionProvider : selectedWaypoint.action_provider,
                      action_name: nextAction ? nextAction : null,
                      action_payload: nextAction ? selectedWaypoint.action_payload : null,
                      execution_policy: nextAction
                        ? selectedWaypoint.execution_policy ?? DEFAULT_WAYPOINT_EXECUTION_POLICY
                        : null,
                    });
                  }}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-botbot-dark"
                >
                  <option value="">No action</option>
                  {getWaypointActionOptions(selectedWaypoint.action_provider).map((actionOption) => (
                    <option key={actionOption.value} value={actionOption.value}>
                      {actionOption.label}
                    </option>
                  ))}
                </select>
              </label>
              {selectedWaypoint.action_name && (
                <>
                  <label className="grid gap-1 text-sm text-gray-700 dark:text-gray-300">
                    Execution policy
                    <select
                      value={selectedWaypoint.execution_policy ?? DEFAULT_WAYPOINT_EXECUTION_POLICY}
                      onChange={(event) =>
                        updateWaypoint(selectedWaypoint.id, {
                          execution_policy: event.target.value as PlannerWaypointDraft['execution_policy'],
                        })
                      }
                      className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-botbot-dark"
                    >
                      {WAYPOINT_EXECUTION_POLICY_OPTIONS.map((policyOption) => (
                        <option key={policyOption.value} value={policyOption.value}>
                          {policyOption.label}
                        </option>
                      ))}
                    </select>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {
                        WAYPOINT_EXECUTION_POLICY_OPTIONS.find(
                          (policyOption) =>
                            policyOption.value ===
                            (selectedWaypoint.execution_policy ?? DEFAULT_WAYPOINT_EXECUTION_POLICY)
                        )?.description
                      }
                    </span>
                  </label>
                  <label className="grid gap-1 text-sm text-gray-700 dark:text-gray-300">
                    Action payload JSON
                    <textarea
                      rows={4}
                      value={formatWaypointActionPayload(selectedWaypoint.action_payload)}
                      onChange={(event) =>
                        updateWaypoint(selectedWaypoint.id, {
                          action_payload: event.target.value,
                        })
                      }
                      placeholder={getWaypointActionPayloadPlaceholder(selectedWaypoint.action_provider)}
                      className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-mono dark:border-gray-700 dark:bg-botbot-dark"
                    />
                  </label>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}