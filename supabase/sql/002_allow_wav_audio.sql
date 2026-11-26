-- ============================================================================
-- Miɗo Waawi Pular! — Migration 002: Allow 16 kHz Mono WAV Exports
-- Run once in Supabase Dashboard -> SQL Editor if 001 was already applied
-- ============================================================================

-- 1. Allow audio/wav in the pular-audio Storage bucket
update storage.buckets
set allowed_mime_types = array[
  'audio/wav',
  'audio/mp4',
  'audio/webm',
  'audio/mpeg',
  'audio/ogg'
]
where id = 'pular-audio';

-- 2. Idempotently update mime_type and file_ext check constraints on public.audio_clips
do $$
declare
  rec record;
begin
  for rec in
    select distinct c.conname
    from pg_constraint c
    join pg_attribute a
      on a.attrelid = c.conrelid
     and a.attnum = any(c.conkey)
    where c.conrelid = 'public.audio_clips'::regclass
      and c.contype = 'c'
      and a.attname in ('mime_type', 'file_ext')
  loop
    execute format('alter table public.audio_clips drop constraint %I', rec.conname);
  end loop;

  alter table public.audio_clips
    add constraint audio_clips_mime_type_check
    check (
      mime_type is null
      or mime_type in ('audio/wav', 'audio/mp4', 'audio/webm', 'audio/mpeg', 'audio/ogg')
    );

  alter table public.audio_clips
    add constraint audio_clips_file_ext_check
    check (
      file_ext is null
      or file_ext in ('wav', 'mp4', 'webm', 'mp3', 'ogg')
    );
end $$;
