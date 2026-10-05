begin;

-- Additive changes keep the currently deployed portal working during rollout.
alter table public.lms_lessons add column homework_due_date date;
alter table public.lms_lessons drop constraint lms_lessons_next_steps_check;
alter table public.lms_lessons add constraint lms_lessons_next_steps_check
  check (char_length(next_steps) between 0 and 4000);

create table public.lms_homework_files (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lms_lessons(id),
  student_id uuid not null references public.lms_students(user_id),
  teacher_id uuid not null references public.lms_staff(user_id),
  uploaded_by uuid not null references auth.users(id),
  kind text not null check (kind in ('resource', 'submission')),
  filename text not null check (char_length(filename) between 1 and 180),
  object_path text not null unique check (object_path ~ '^[0-9a-f-]{36}\.(pdf|docx|txt|jpg|jpeg|png|webp|mp3|m4a)$'),
  mime_type text not null check (mime_type in ('application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'image/jpeg', 'image/png', 'image/webp', 'audio/mpeg', 'audio/mp4')),
  size_bytes bigint not null check (size_bytes between 1 and 10485760),
  slot smallint not null check (slot between 1 and 6),
  state text not null default 'pending' check (state in ('pending', 'ready')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  constraint homework_expiry_is_seven_days check (expires_at = created_at + interval '7 days'),
  constraint homework_uploader_matches_kind check (
    (kind = 'resource' and uploaded_by = teacher_id)
    or (kind = 'submission' and uploaded_by = student_id)
  ),
  constraint homework_six_files_per_lesson unique (lesson_id, slot)
);
create index lms_homework_student_index on public.lms_homework_files(student_id);
create index lms_homework_teacher_index on public.lms_homework_files(teacher_id);
create index lms_homework_uploader_index on public.lms_homework_files(uploaded_by);
create index lms_homework_expiry_index on public.lms_homework_files(expires_at);
create index lms_homework_pending_index on public.lms_homework_files(created_at) where state = 'pending';

create table public.lms_homework_progress (
  lesson_id uuid primary key references public.lms_lessons(id) on delete cascade,
  student_id uuid not null references public.lms_students(user_id) on delete cascade,
  teacher_id uuid not null references public.lms_staff(user_id),
  completed_at timestamptz
);
create index lms_homework_progress_student_index on public.lms_homework_progress(student_id);
create index lms_homework_progress_teacher_index on public.lms_homework_progress(teacher_id);

alter table public.lms_homework_files enable row level security;
alter table public.lms_homework_progress enable row level security;
revoke all on public.lms_homework_files, public.lms_homework_progress from public, anon, authenticated;
grant select on public.lms_homework_files, public.lms_homework_progress to authenticated;
grant all on public.lms_homework_files, public.lms_homework_progress to service_role;

-- Only the signed-in learner and their assigned teacher can read these records.
-- Writes go through the server, which validates ownership, types and deadlines.
create policy homework_file_read on public.lms_homework_files for select to authenticated using (
  state = 'ready' and expires_at > now() and exists (
    select 1 from public.lms_students s where s.user_id = student_id and s.active
      and (s.user_id = (select auth.uid()) or s.created_by = (select auth.uid()))
  )
);
create policy homework_progress_read on public.lms_homework_progress for select to authenticated using (
  exists (select 1 from public.lms_students s where s.user_id = student_id and s.active
    and (s.user_id = (select auth.uid()) or s.created_by = (select auth.uid())))
);

-- Keep the bucket private and disallow direct anonymous/authenticated object access.
-- The server issues narrowly scoped, short-lived upload/download capabilities.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('lms-homework', 'lms-homework', false, 10485760,
  array['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'image/jpeg', 'image/png', 'image/webp', 'audio/mpeg', 'audio/mp4']);
create policy homework_private_objects on storage.objects as restrictive for all to anon, authenticated
  using (bucket_id <> 'lms-homework') with check (bucket_id <> 'lms-homework');

comment on table public.lms_homework_files is 'Private lesson-linked files. Downloads expire at seven days. Vercel daily cleanup removes bytes through the Storage API before deleting these rows.';
comment on column public.lms_lessons.focus is 'Weaknesses in the student portal; the existing column is retained for compatibility with previous feedback.';
commit;
