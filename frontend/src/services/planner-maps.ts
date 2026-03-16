import { createSupabaseClient } from '@/utils/supabase-client';
import { Database } from '@/types/database.types';
import {
  createLocalMissionMapRecord,
  fileToDataUrl,
  isLocalDevDataEnabled,
  readLocalDevState,
  updateLocalDevState,
} from '@/utils/local-dev-data';

type MissionMapRow = Database['public']['Tables']['mission_maps']['Row'];
type MissionMapInsert = Database['public']['Tables']['mission_maps']['Insert'];
type MissionMapUpdate = Database['public']['Tables']['mission_maps']['Update'];

export interface CreateMissionMapAssetInput {
  name: string;
  description?: string;
  mapFormat?: string;
  resolution: number;
  originX: number;
  originY: number;
  originTheta: number;
  imageWidth?: number;
  imageHeight?: number;
  imageFile: File;
}

function sanitizeFileSegment(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'map';
}

class PlannerMapsService {
  private supabase = createSupabaseClient();
  private readonly bucketName = 'mission-maps';

  async getMissionMaps(): Promise<MissionMapRow[]> {
    if (isLocalDevDataEnabled()) {
      return readLocalDevState().missionMaps.sort((left, right) => {
        const leftDate = left.created_at || '';
        const rightDate = right.created_at || '';
        return rightDate.localeCompare(leftDate);
      });
    }

    const { data, error } = await this.supabase
      .from('mission_maps')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return data || [];
  }

  async createMissionMapAsset(input: CreateMissionMapAssetInput): Promise<MissionMapRow> {
    if (isLocalDevDataEnabled()) {
      const previewDataUrl = await fileToDataUrl(input.imageFile);
      const createdMap = createLocalMissionMapRecord({
        name: input.name,
        description: input.description,
        mapFormat: input.mapFormat,
        resolution: input.resolution,
        originX: input.originX,
        originY: input.originY,
        originTheta: input.originTheta,
        imageWidth: input.imageWidth,
        imageHeight: input.imageHeight,
        previewDataUrl,
      });

      updateLocalDevState((state) => ({
        ...state,
        missionMaps: [createdMap, ...state.missionMaps],
      }));

      return createdMap;
    }

    const {
      data: { user },
    } = await this.supabase.auth.getUser();

    if (!user) {
      throw new Error('User not authenticated');
    }

    const extension = input.imageFile.name.split('.').pop()?.toLowerCase() || 'png';
    const filename = `${Date.now()}-${sanitizeFileSegment(input.name)}.${extension}`;
    const storagePath = `${user.id}/${filename}`;

    const { error: uploadError } = await this.supabase.storage
      .from(this.bucketName)
      .upload(storagePath, input.imageFile, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      throw uploadError;
    }

    const insertPayload: MissionMapInsert = {
      user_id: user.id,
      name: input.name,
      description: input.description || null,
      image_path: storagePath,
      image_width: input.imageWidth ?? null,
      image_height: input.imageHeight ?? null,
      map_format: input.mapFormat || 'preview-image',
      resolution: input.resolution,
      origin_x: input.originX,
      origin_y: input.originY,
      origin_theta: input.originTheta,
    };

    const { data, error } = await this.supabase
      .from('mission_maps')
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      await this.supabase.storage.from(this.bucketName).remove([storagePath]);
      throw error;
    }

    return data;
  }

  async updateMissionMap(id: string, update: MissionMapUpdate): Promise<MissionMapRow> {
    if (isLocalDevDataEnabled()) {
      let updatedMap: MissionMapRow | null = null;

      updateLocalDevState((state) => {
        const missionMaps = state.missionMaps.map((missionMap) => {
          if (missionMap.id !== id) {
            return missionMap;
          }

          updatedMap = {
            ...missionMap,
            ...update,
            updated_at: new Date().toISOString(),
          };

          return {
            ...missionMap,
            ...update,
            updated_at: new Date().toISOString(),
          };
        });

        return {
          ...state,
          missionMaps,
        };
      });

      if (!updatedMap) {
        throw new Error('Mission map not found');
      }

      return updatedMap;
    }

    const { data, error } = await this.supabase
      .from('mission_maps')
      .update(update)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  async deleteMissionMap(map: Pick<MissionMapRow, 'id' | 'image_path'>): Promise<void> {
    if (isLocalDevDataEnabled()) {
      updateLocalDevState((state) => ({
        ...state,
        missionMaps: state.missionMaps.filter((missionMap) => missionMap.id !== map.id),
        missions: state.missions.map((mission) =>
          mission.map_asset_id === map.id
            ? { ...mission, map_asset_id: null, map_name: null, updated_at: new Date().toISOString() }
            : mission
        ),
      }));
      return;
    }

    const { error: dbError } = await this.supabase
      .from('mission_maps')
      .delete()
      .eq('id', map.id);

    if (dbError) {
      throw dbError;
    }

    const { error: storageError } = await this.supabase.storage
      .from(this.bucketName)
      .remove([map.image_path]);

    if (storageError) {
      throw storageError;
    }
  }

  async getMissionMapImageUrl(storagePath: string, expiresIn: number = 3600): Promise<string | null> {
    if (isLocalDevDataEnabled()) {
      const match = readLocalDevState().missionMaps.find((missionMap) => missionMap.image_path === storagePath);
      return match?.preview_data_url || null;
    }

    const { data, error } = await this.supabase.storage
      .from(this.bucketName)
      .createSignedUrl(storagePath, expiresIn);

    if (error) {
      throw error;
    }

    return data?.signedUrl || null;
  }
}

export const plannerMapsService = new PlannerMapsService();
export type MissionMapAsset = MissionMapRow;