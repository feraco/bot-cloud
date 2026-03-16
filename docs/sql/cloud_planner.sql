-- BotBrain cloud planner schema.
-- Run this after the base Supabase schema in docs/SUPABASE_SETUP.md.

CREATE TABLE IF NOT EXISTS public.mission_maps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    image_path TEXT NOT NULL,
    image_width INTEGER,
    image_height INTEGER,
    map_format TEXT DEFAULT 'preview-image',
    resolution DOUBLE PRECISION NOT NULL DEFAULT 0.05,
    origin_x DOUBLE PRECISION NOT NULL DEFAULT 0,
    origin_y DOUBLE PRECISION NOT NULL DEFAULT 0,
    origin_theta DOUBLE PRECISION DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.missions
    ADD COLUMN IF NOT EXISTS map_asset_id UUID REFERENCES public.mission_maps(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_mission_maps_user_id ON public.mission_maps(user_id);
CREATE INDEX IF NOT EXISTS idx_missions_map_asset_id ON public.missions(map_asset_id);

ALTER TABLE public.mission_maps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own mission maps"
    ON public.mission_maps FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own mission maps"
    ON public.mission_maps FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own mission maps"
    ON public.mission_maps FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own mission maps"
    ON public.mission_maps FOR DELETE
    USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_mission_maps_updated_at ON public.mission_maps;
CREATE TRIGGER update_mission_maps_updated_at
    BEFORE UPDATE ON public.mission_maps
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

INSERT INTO storage.buckets (id, name, public)
VALUES ('mission-maps', 'mission-maps', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can read their own planner map files"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'mission-maps'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Users can upload their own planner map files"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'mission-maps'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Users can update their own planner map files"
    ON storage.objects FOR UPDATE
    USING (
        bucket_id = 'mission-maps'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Users can delete their own planner map files"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'mission-maps'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );