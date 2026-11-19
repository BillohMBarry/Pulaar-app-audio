-- ============================================================================
-- Miɗo Waawi Pular! — Competences 1–3 Audio Layer Schema & Storage RLS
-- Run in Supabase Dashboard -> SQL Editor
-- ============================================================================

-- 1. Storage bucket for Pular vocabulary audio clips (public read, 5 MB limit)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'pular-audio',
  'pular-audio',
  true,
  5242880,
  array['audio/mp4', 'audio/webm', 'audio/mpeg', 'audio/ogg']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Storage RLS policies on storage.objects
-- Invited speakers upload via short-lived server-generated signed upload URLs
-- (createSignedUploadUrl), so anon has zero direct Storage write permissions.
drop policy if exists "Public read pular-audio" on storage.objects;
create policy "Public read pular-audio"
on storage.objects
for select
to public
using (bucket_id = 'pular-audio');

drop policy if exists "Admin insert pular-audio" on storage.objects;
create policy "Admin insert pular-audio"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'pular-audio'
  and (select (auth.jwt() -> 'app_metadata' ->> 'role')) = 'admin'
);

drop policy if exists "Admin update pular-audio" on storage.objects;
create policy "Admin update pular-audio"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'pular-audio'
  and (select (auth.jwt() -> 'app_metadata' ->> 'role')) = 'admin'
)
with check (
  bucket_id = 'pular-audio'
  and (select (auth.jwt() -> 'app_metadata' ->> 'role')) = 'admin'
);

drop policy if exists "Admin delete pular-audio" on storage.objects;
create policy "Admin delete pular-audio"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'pular-audio'
  and (select (auth.jwt() -> 'app_metadata' ->> 'role')) = 'admin'
);

-- 2. Revocable per-speaker invite links (raw tokens never stored; SHA-256 only)
create table if not exists public.contributor_invites (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  speaker_name text not null,
  dialect_region text,
  default_competence smallint check (default_competence between 1 and 3),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_contributor_invites_created_by
  on public.contributor_invites (created_by);

alter table public.contributor_invites enable row level security;

drop policy if exists "Admin select contributor_invites" on public.contributor_invites;
create policy "Admin select contributor_invites"
on public.contributor_invites
for select
to authenticated
using ((select (auth.jwt() -> 'app_metadata' ->> 'role')) = 'admin');

drop policy if exists "Admin insert contributor_invites" on public.contributor_invites;
create policy "Admin insert contributor_invites"
on public.contributor_invites
for insert
to authenticated
with check ((select (auth.jwt() -> 'app_metadata' ->> 'role')) = 'admin');

drop policy if exists "Admin update contributor_invites" on public.contributor_invites;
create policy "Admin update contributor_invites"
on public.contributor_invites
for update
to authenticated
using ((select (auth.jwt() -> 'app_metadata' ->> 'role')) = 'admin')
with check ((select (auth.jwt() -> 'app_metadata' ->> 'role')) = 'admin');

drop policy if exists "Admin delete contributor_invites" on public.contributor_invites;
create policy "Admin delete contributor_invites"
on public.contributor_invites
for delete
to authenticated
using ((select (auth.jwt() -> 'app_metadata' ->> 'role')) = 'admin');

-- 3. Vocabulary audio clips (45 base + 18 distinct plural = 63 clip keys)
create table if not exists public.audio_clips (
  id bigint generated always as identity primary key,
  clip_key text not null unique check (clip_key ~ '^v[0-9]{2}(_plural)?$'),
  vocab_id text not null check (vocab_id ~ '^v[0-9]{2}$'),
  is_plural boolean not null default false,
  competence smallint not null check (competence between 1 and 3),
  status text not null default 'draft' check (status in ('draft', 'approved', 'rejected', 'flagged')),
  storage_path text,
  public_url text,
  mime_type text check (mime_type is null or mime_type in ('audio/mp4', 'audio/webm', 'audio/mpeg', 'audio/ogg')),
  file_ext text check (file_ext is null or file_ext in ('mp4', 'webm', 'mp3', 'ogg')),
  duration_ms integer check (duration_ms is null or (duration_ms > 0 and duration_ms <= 60000)),
  file_size_bytes integer check (file_size_bytes is null or (file_size_bytes > 0 and file_size_bytes <= 5242880)),
  dialect_note text,
  review_note text,
  invite_id uuid references public.contributor_invites(id) on delete set null,
  speaker_name text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_audio_clips_competence_status
  on public.audio_clips (competence, status);

create index if not exists idx_audio_clips_invite_id
  on public.audio_clips (invite_id);

create index if not exists idx_audio_clips_reviewed_by
  on public.audio_clips (reviewed_by);

create index if not exists idx_audio_clips_approved_key
  on public.audio_clips (clip_key)
  where status = 'approved';

-- Trigger to maintain updated_at
create or replace function public.set_audio_clips_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_audio_clips_updated_at on public.audio_clips;
create trigger trg_audio_clips_updated_at
before update on public.audio_clips
for each row
execute function public.set_audio_clips_updated_at();

alter table public.audio_clips enable row level security;

-- Learners (anon & authenticated) can ONLY read approved clips
drop policy if exists "Public select approved audio_clips" on public.audio_clips;
create policy "Public select approved audio_clips"
on public.audio_clips
for select
to anon, authenticated
using (status = 'approved');

-- Admins have full read/write/review access
drop policy if exists "Admin select all audio_clips" on public.audio_clips;
create policy "Admin select all audio_clips"
on public.audio_clips
for select
to authenticated
using ((select (auth.jwt() -> 'app_metadata' ->> 'role')) = 'admin');

drop policy if exists "Admin insert audio_clips" on public.audio_clips;
create policy "Admin insert audio_clips"
on public.audio_clips
for insert
to authenticated
with check ((select (auth.jwt() -> 'app_metadata' ->> 'role')) = 'admin');

drop policy if exists "Admin update audio_clips" on public.audio_clips;
create policy "Admin update audio_clips"
on public.audio_clips
for update
to authenticated
using ((select (auth.jwt() -> 'app_metadata' ->> 'role')) = 'admin')
with check ((select (auth.jwt() -> 'app_metadata' ->> 'role')) = 'admin');

drop policy if exists "Admin delete audio_clips" on public.audio_clips;
create policy "Admin delete audio_clips"
on public.audio_clips
for delete
to authenticated
using ((select (auth.jwt() -> 'app_metadata' ->> 'role')) = 'admin');

-- Explicit grants for Supabase Data API exposure
grant usage on schema public to anon, authenticated;
grant select on public.audio_clips to anon, authenticated;
grant insert, update, delete on public.audio_clips to authenticated;
grant select, insert, update, delete on public.contributor_invites to authenticated;

-- ============================================================================
-- IMPORTANT: Promote your admin Supabase Auth user after creating them in
-- Authentication -> Users (replace the email below and run once):
--
-- update auth.users
-- set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
-- where email = 'YOUR_ADMIN_EMAIL@example.com';
-- ============================================================================
