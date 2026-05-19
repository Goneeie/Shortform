-- ============================================
-- 1. sessions 테이블 생성
-- ============================================
create table sessions (
  id uuid default gen_random_uuid() primary key,
  participant_id text,

  -- 사전 설문
  pre_survey jsonb,
  experiment_type text, -- 'A', 'B', 'C'

  -- 대조군 로그
  control_total_seconds integer,
  control_videos_watched integer,
  control_video_times jsonb,
  control_exit_type text,
  control_exited_at_seconds integer,
  control_exited_on_video integer,
  control_recording_url text,

  -- 중간 설문
  mid_survey jsonb,

  -- 실험군 로그
  experiment_total_seconds integer,
  experiment_videos_watched integer,
  experiment_video_times jsonb,
  experiment_exit_type text,
  experiment_exited_at_seconds integer,
  experiment_exited_on_video integer,
  experiment_recording_url text,
  experiment_exited_during_friction boolean default false,
  experiment_wrong_swipe_count integer default 0,

  -- 사후 설문
  post_survey jsonb,

  created_at timestamptz default now()
);

-- ============================================
-- 2. RLS (Row Level Security) - 누구나 삽입 가능
-- ============================================
alter table sessions enable row level security;

create policy "Anyone can insert"
  on sessions for insert
  with check (true);

create policy "Anyone can select"
  on sessions for select
  using (true);

-- ============================================
-- 3. Storage bucket 생성 (Supabase 대시보드에서 직접 생성하거나 아래 SQL 사용)
-- ============================================
insert into storage.buckets (id, name, public)
values ('recordings', 'recordings', true);

create policy "Anyone can upload recordings"
  on storage.objects for insert
  with check (bucket_id = 'recordings');

create policy "Anyone can read recordings"
  on storage.objects for select
  using (bucket_id = 'recordings');
