-- BotBrain z4rtc integration columns for transport-aware robot records.

ALTER TABLE public.robots ADD COLUMN IF NOT EXISTS transport_type TEXT DEFAULT 'ros';
ALTER TABLE public.robots ADD COLUMN IF NOT EXISTS connection_config JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.robots ADD COLUMN IF NOT EXISTS capabilities_cache JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.robots ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;
ALTER TABLE public.robots ADD COLUMN IF NOT EXISTS serial_number TEXT;
ALTER TABLE public.robots ADD COLUMN IF NOT EXISTS model_family TEXT;
ALTER TABLE public.robots ADD COLUMN IF NOT EXISTS firmware_version TEXT;

CREATE INDEX IF NOT EXISTS idx_robots_transport_type ON public.robots(transport_type);
CREATE INDEX IF NOT EXISTS idx_robots_last_seen_at ON public.robots(last_seen_at DESC);
