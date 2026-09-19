-- Additive only. Run in the Supabase SQL Editor for each project using cloud sync.
-- Favorites move from a single folder_id to multi-folder membership (folder_ids),
-- plus richer per-word metadata (part of speech, tags, user-authored examples, image toggle).
ALTER TABLE public.favorites ADD COLUMN IF NOT EXISTS folder_ids text[] NOT NULL DEFAULT ARRAY['default'];
ALTER TABLE public.favorites ADD COLUMN IF NOT EXISTS pos text;
ALTER TABLE public.favorites ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT ARRAY[]::text[];
ALTER TABLE public.favorites ADD COLUMN IF NOT EXISTS examples text[] NOT NULL DEFAULT ARRAY[]::text[];
ALTER TABLE public.favorites ADD COLUMN IF NOT EXISTS has_image boolean NOT NULL DEFAULT false;

-- Backfill folder_ids from the legacy scalar folder_id for rows written before this migration.
UPDATE public.favorites
SET folder_ids = ARRAY[folder_id]
WHERE folder_ids = ARRAY['default'] AND folder_id IS DISTINCT FROM 'default';
