import { createSupabaseClient } from '@/utils/supabase-client';
import { Database } from '@/types/database.types';
import { auditLogger } from '@/utils/audit-logger';
import {
  createLocalMissionRecord,
  createLocalWaypointRecord,
  isLocalDevDataEnabled,
  readLocalDevState,
  subscribeToLocalDevChanges,
  updateLocalDevState,
} from '@/utils/local-dev-data';

type Mission = Database['public']['Tables']['missions']['Row'];
type MissionInsert = Database['public']['Tables']['missions']['Insert'];
type MissionUpdate = Database['public']['Tables']['missions']['Update'];

type Waypoint = Database['public']['Tables']['waypoints']['Row'];
type WaypointInsert = Database['public']['Tables']['waypoints']['Insert'];
type WaypointUpdate = Database['public']['Tables']['waypoints']['Update'];

export interface MissionWithWaypoints extends Mission {
  waypoints: Waypoint[];
}

// Helper to properly serialize Supabase errors
function serializeSupabaseError(error: any): Error {
  if (error instanceof Error) {
    return error;
  }
  
  // Handle PostgrestError structure
  if (error && typeof error === 'object') {
    const message = error.message || error.error || error.details || 'Database operation failed';
    const err = new Error(message);
    // Preserve additional error properties
    if (error.code) err.name = error.code;
    return err;
  }
  
  return new Error(String(error));
}

class MissionsService {
  private supabase = createSupabaseClient();

  private buildMissionWithWaypoints(mission: Mission, waypoints: Waypoint[]): MissionWithWaypoints {
    return {
      ...mission,
      waypoints: [...waypoints].sort((left, right) => left.order_index - right.order_index),
    };
  }

  async getMissions(): Promise<MissionWithWaypoints[]> {
    if (isLocalDevDataEnabled()) {
      const state = readLocalDevState();
      return [...state.missions]
        .sort((left, right) => (right.created_at || '').localeCompare(left.created_at || ''))
        .map((mission) =>
          this.buildMissionWithWaypoints(
            mission,
            state.waypoints.filter((waypoint) => waypoint.mission_id === mission.id)
          )
        );
    }

    const { data, error } = await this.supabase
      .from('missions')
      .select(`
        *,
        waypoints (*)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching missions:', error);
      throw error;
    }

    // Sort waypoints by order_index
    const missions = data?.map(mission => ({
      ...mission,
      waypoints: mission.waypoints.sort((a: Waypoint, b: Waypoint) => a.order_index - b.order_index)
    })) || [];

    return missions;
  }

  async getMission(id: string): Promise<MissionWithWaypoints | null> {
    if (isLocalDevDataEnabled()) {
      const state = readLocalDevState();
      const mission = state.missions.find((entry) => entry.id === id);
      if (!mission) {
        return null;
      }

      return this.buildMissionWithWaypoints(
        mission,
        state.waypoints.filter((waypoint) => waypoint.mission_id === mission.id)
      );
    }

    const { data, error } = await this.supabase
      .from('missions')
      .select(`
        *,
        waypoints (*)
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching mission:', error);
      throw error;
    }

    if (data) {
      // Sort waypoints by order_index
      data.waypoints = data.waypoints.sort((a: Waypoint, b: Waypoint) => a.order_index - b.order_index);
    }

    return data;
  }

  async createMission(mission: Omit<MissionInsert, 'user_id'>): Promise<Mission> {
    if (isLocalDevDataEnabled()) {
      const createdMission = createLocalMissionRecord({
        name: mission.name,
        description: mission.description,
        map_asset_id: mission.map_asset_id,
        map_name: mission.map_name,
        robot_id: mission.robot_id,
      });

      updateLocalDevState((state) => ({
        ...state,
        missions: [createdMission, ...state.missions],
      }));

      return createdMission;
    }

    const { data: { user } } = await this.supabase.auth.getUser();
    
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await this.supabase
      .from('missions')
      .insert({
        ...mission,
        user_id: user.id
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating mission:', error);
      throw error;
    }

    // Log mission creation
    await auditLogger.logMissionCreated(data.id, data.name, data.robot_id || undefined);

    return data;
  }

  async updateMission(id: string, update: MissionUpdate): Promise<Mission> {
    if (isLocalDevDataEnabled()) {
      let updatedMission: Mission | null = null;

      updateLocalDevState((state) => ({
        ...state,
        missions: state.missions.map((mission) => {
          if (mission.id !== id) {
            return mission;
          }

          updatedMission = {
            ...mission,
            ...update,
            updated_at: new Date().toISOString(),
          };

          return updatedMission;
        }),
      }));

      if (!updatedMission) {
        throw new Error('Mission not found');
      }

      return updatedMission;
    }

    const { data, error } = await this.supabase
      .from('missions')
      .update(update)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating mission:', error);
      throw error;
    }

    // Log mission update
    await auditLogger.logMissionUpdated(data.id, data.name, update);

    return data;
  }

  async deleteMission(id: string): Promise<void> {
    if (isLocalDevDataEnabled()) {
      updateLocalDevState((state) => ({
        ...state,
        missions: state.missions.filter((mission) => mission.id !== id),
        waypoints: state.waypoints.filter((waypoint) => waypoint.mission_id !== id),
      }));
      return;
    }

    // Get mission details before deletion for logging
    const { data: mission } = await this.supabase
      .from('missions')
      .select('name')
      .eq('id', id)
      .single();

    const { error } = await this.supabase
      .from('missions')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting mission:', error);
      throw error;
    }

    // Log mission deletion
    if (mission) {
      await auditLogger.logMissionDeleted(id, mission.name);
    }
  }

  async setActiveMission(id: string | null): Promise<void> {
    if (isLocalDevDataEnabled()) {
      updateLocalDevState((state) => ({
        ...state,
        missions: state.missions.map((mission) => ({
          ...mission,
          is_active: id ? mission.id === id : false,
          updated_at: new Date().toISOString(),
        })),
      }));
      return;
    }

    console.log('setActiveMission called with id:', id);
    
    try {
      // If stopping a mission (id is null), first get the currently active mission for logging
      let stoppingMission = null;
      if (!id) {
        console.log('Stopping mission - fetching currently active mission...');
        const { data: activeMissions, error: fetchError } = await this.supabase
          .from('missions')
          .select('id, name, robot_id')
          .eq('is_active', true)
          .single();
        
        if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = no rows returned
          console.error('Error fetching active mission:', fetchError);
        }
        
        stoppingMission = activeMissions;
        console.log('Currently active mission:', stoppingMission);
      }

      // First, deactivate all missions
      console.log('Deactivating all missions...');
      
      // Get user's missions first to ensure we only update our own
      const { data: userMissions, error: fetchMissionsError } = await this.supabase
        .from('missions')
        .select('id')
        .eq('is_active', true);
        
      if (fetchMissionsError) {
        console.error('Error fetching user missions:', fetchMissionsError);
        throw serializeSupabaseError(fetchMissionsError);
      }
      
      // If there are active missions to deactivate
      if (userMissions && userMissions.length > 0) {
        const missionIds = userMissions.map(m => m.id);
        console.log('Deactivating missions:', missionIds);
        
        // Update only the missions we own
        const { error: deactivateError } = await this.supabase
          .from('missions')
          .update({ is_active: false })
          .in('id', missionIds);

        if (deactivateError) {
          console.error('Error deactivating missions:', deactivateError);
          console.error('Deactivate error details:', {
            code: deactivateError.code,
            message: deactivateError.message,
            details: deactivateError.details,
            hint: deactivateError.hint
          });
          throw serializeSupabaseError(deactivateError);
        }
        
        console.log('Missions deactivated successfully');
      } else {
        console.log('No active missions to deactivate');
      }

      // Log mission stop if we were stopping an active mission
      if (!id && stoppingMission) {
        console.log('Logging mission stop...');
        try {
          await auditLogger.logMissionStopped(
            stoppingMission.id, 
            stoppingMission.name, 
            stoppingMission.robot_id || undefined
          );
        } catch (logError) {
          console.error('Error logging mission stop:', logError);
          // Don't throw here, just log the error
        }
      }

      // Then activate the selected mission if id is provided
      if (id) {
        console.log('Activating mission:', id);
        const { data: mission, error: activateError } = await this.supabase
          .from('missions')
          .update({ is_active: true })
          .eq('id', id)
          .select('name, robot_id')
          .single();

        if (activateError) {
          console.error('Error activating mission:', activateError);
          throw serializeSupabaseError(activateError);
        }

        // Log mission start
        if (mission) {
          try {
            await auditLogger.logMissionStarted(id, mission.name, mission.robot_id || undefined);
          } catch (logError) {
            console.error('Error logging mission start:', logError);
            // Don't throw here, just log the error
          }
        }
      }
      
      console.log('setActiveMission completed successfully');
    } catch (error) {
      console.error('setActiveMission error:', error);
      throw serializeSupabaseError(error);
    }
  }

  async updateWaypoints(missionId: string, waypoints: Array<Omit<WaypointInsert, 'mission_id'>>): Promise<Waypoint[]> {
    if (isLocalDevDataEnabled()) {
      const validWaypoints = waypoints.filter((waypoint) =>
        typeof waypoint.x === 'number' &&
        typeof waypoint.y === 'number' &&
        typeof waypoint.theta === 'number'
      );

      let createdWaypoints: Waypoint[] = [];

      updateLocalDevState((state) => {
        createdWaypoints = validWaypoints.map((waypoint, index) =>
          createLocalWaypointRecord({
            missionId,
            x: waypoint.x,
            y: waypoint.y,
            theta: waypoint.theta,
            orderIndex: waypoint.order_index ?? index,
            actionProvider: waypoint.action_provider,
            actionName: waypoint.action_name,
            actionPayload: waypoint.action_payload ?? null,
            executionPolicy: waypoint.execution_policy,
          })
        );

        return {
          ...state,
          waypoints: [
            ...state.waypoints.filter((waypoint) => waypoint.mission_id !== missionId),
            ...createdWaypoints,
          ],
          missions: state.missions.map((mission) =>
            mission.id === missionId
              ? { ...mission, updated_at: new Date().toISOString() }
              : mission
          ),
        };
      });

      return createdWaypoints;
    }

    // Check if user is authenticated
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Validate inputs
    if (!missionId) {
      throw new Error('Mission ID is required');
    }

    // Delete existing waypoints
    const { error: deleteError } = await this.supabase
      .from('waypoints')
      .delete()
      .eq('mission_id', missionId);

    if (deleteError) {
      console.error('Error deleting waypoints:', deleteError);
      console.error('Delete error details:', { missionId, deleteError });
      throw deleteError;
    }

    // Insert new waypoints
    if (waypoints.length === 0) {
      return [];
    }

    // Validate waypoints have required fields
    const validWaypoints = waypoints.filter(wp => 
      typeof wp.x === 'number' && 
      typeof wp.y === 'number' && 
      typeof wp.theta === 'number'
    );

    if (validWaypoints.length !== waypoints.length) {
      console.warn('Some waypoints were invalid and filtered out:', {
        total: waypoints.length,
        valid: validWaypoints.length
      });
    }

    const waypointsWithMissionId = validWaypoints.map(wp => ({
      ...wp,
      mission_id: missionId
    }));

    const { data, error: insertError } = await this.supabase
      .from('waypoints')
      .insert(waypointsWithMissionId)
      .select();

    if (insertError) {
      console.error('Error inserting waypoints:', insertError);
      console.error('Insert error details:', { missionId, waypointsWithMissionId, insertError });
      throw insertError;
    }

    // Get mission details for logging
    const { data: mission } = await this.supabase
      .from('missions')
      .select('name')
      .eq('id', missionId)
      .single();

    if (mission) {
      await auditLogger.logWaypointsUpdated(missionId, mission.name, validWaypoints.length);
    }

    return data || [];
  }

  async markWaypointReached(waypointId: string, missionId?: string): Promise<void> {
    if (isLocalDevDataEnabled()) {
      updateLocalDevState((state) => ({
        ...state,
        waypoints: state.waypoints.map((waypoint) =>
          waypoint.id === waypointId
            ? {
                ...waypoint,
                is_reached: true,
                reached_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              }
            : waypoint
        ),
        missions: missionId
          ? state.missions.map((mission) =>
              mission.id === missionId
                ? { ...mission, updated_at: new Date().toISOString() }
                : mission
            )
          : state.missions,
      }));
      return;
    }

    const { error } = await this.supabase
      .from('waypoints')
      .update({ 
        is_reached: true,
        reached_at: new Date().toISOString()
      })
      .eq('id', waypointId);

    if (error) {
      console.error('Error marking waypoint as reached:', error);
      throw error;
    }
    
    // Check if all waypoints are reached to log mission completion
    if (missionId) {
      const { data: waypoints } = await this.supabase
        .from('waypoints')
        .select('is_reached')
        .eq('mission_id', missionId);
        
      if (waypoints && waypoints.every(wp => wp.is_reached)) {
        const { data: mission } = await this.supabase
          .from('missions')
          .select('name, robot_id')
          .eq('id', missionId)
          .single();
          
        if (mission) {
          await auditLogger.logMissionCompleted(missionId, mission.name, mission.robot_id || undefined);
        }
      }
    }
  }

  async resetWaypointsStatus(missionId: string): Promise<void> {
    if (isLocalDevDataEnabled()) {
      updateLocalDevState((state) => ({
        ...state,
        waypoints: state.waypoints.map((waypoint) =>
          waypoint.mission_id === missionId
            ? {
                ...waypoint,
                is_reached: false,
                reached_at: null,
                updated_at: new Date().toISOString(),
              }
            : waypoint
        ),
      }));
      return;
    }

    const { error } = await this.supabase
      .from('waypoints')
      .update({ 
        is_reached: false,
        reached_at: null
      })
      .eq('mission_id', missionId);

    if (error) {
      console.error('Error resetting waypoints status:', error);
      throw error;
    }
  }

  subscribeToMissionChanges(callback: (payload: any) => void) {
    if (isLocalDevDataEnabled()) {
      return subscribeToLocalDevChanges(() => callback({ source: 'local-dev' }));
    }

    return this.supabase
      .channel('missions_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'missions' },
        callback
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'waypoints' },
        callback
      )
      .subscribe();
  }
}

export const missionsService = new MissionsService();