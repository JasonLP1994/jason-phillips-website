begin;

create table public.lms_staff (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 150),
  created_at timestamptz not null default now()
);

create table public.lms_students (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_by uuid not null references public.lms_staff(user_id),
  display_name text not null check (char_length(display_name) between 1 and 150),
  email text not null check (char_length(email) between 3 and 254),
  active boolean not null default true,
  activated_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index lms_students_email_unique on public.lms_students(lower(email));
create index lms_students_teacher_index on public.lms_students(created_by);

create table public.lms_lessons (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.lms_students(user_id) on delete cascade,
  teacher_id uuid not null references public.lms_staff(user_id),
  lesson_date date not null,
  title text not null check (char_length(title) between 1 and 160),
  strengths text not null check (char_length(strengths) between 1 and 4000),
  focus text not null check (char_length(focus) between 1 and 4000),
  next_steps text not null check (char_length(next_steps) between 1 and 4000),
  corrections jsonb not null default '[]'::jsonb check (jsonb_typeof(corrections) = 'array' and jsonb_array_length(corrections) <= 12),
  created_at timestamptz not null default now()
);
create index lms_lessons_student_date on public.lms_lessons(student_id, lesson_date desc, created_at desc, id desc);
create index lms_lessons_teacher_index on public.lms_lessons(teacher_id);

create table public.lms_goals (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.lms_students(user_id) on delete cascade,
  teacher_id uuid not null references public.lms_staff(user_id),
  title text not null check (char_length(title) between 1 and 240),
  due_date date,
  status text not null default 'in_progress' check (status in ('not_started', 'in_progress', 'achieved')),
  created_at timestamptz not null default now()
);
create index lms_goals_student_index on public.lms_goals(student_id);
create index lms_goals_teacher_index on public.lms_goals(teacher_id);

create table public.lms_assessments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.lms_students(user_id) on delete cascade,
  teacher_id uuid not null references public.lms_staff(user_id),
  assessed_on date not null,
  pronunciation smallint check (pronunciation between 1 and 5),
  fluency smallint check (fluency between 1 and 5),
  accuracy smallint check (accuracy between 1 and 5),
  vocabulary smallint check (vocabulary between 1 and 5),
  notes text not null default '' check (char_length(notes) <= 4000),
  created_at timestamptz not null default now(),
  constraint lms_assessment_has_skill check (num_nonnulls(pronunciation, fluency, accuracy, vocabulary) > 0)
);
create index lms_assessments_student_date on public.lms_assessments(student_id, assessed_on, created_at);
create index lms_assessments_teacher_index on public.lms_assessments(teacher_id);

-- Apply access rules atomically. There is no anonymous access to learner data.
alter table public.lms_staff enable row level security;
alter table public.lms_students enable row level security;
alter table public.lms_lessons enable row level security;
alter table public.lms_goals enable row level security;
alter table public.lms_assessments enable row level security;

revoke all on public.lms_staff, public.lms_students, public.lms_lessons, public.lms_goals, public.lms_assessments from public, anon, authenticated;
grant select on public.lms_staff, public.lms_students to authenticated;
grant select, insert, update on public.lms_lessons, public.lms_goals, public.lms_assessments to authenticated;
grant all on public.lms_staff, public.lms_students, public.lms_lessons, public.lms_goals, public.lms_assessments to service_role;

create policy staff_can_read_own_role on public.lms_staff for select to authenticated
  using (user_id = (select auth.uid()));

create policy students_and_their_teacher_can_read_profiles on public.lms_students for select to authenticated
  using (
    (user_id = (select auth.uid()) and active)
    or (created_by = (select auth.uid()) and exists (select 1 from public.lms_staff where user_id = (select auth.uid())))
  );

-- The same ownership model applies to feedback, goals and skill check-ins.
-- These are invoker policies: no SECURITY DEFINER function bypasses RLS.
do $$
declare table_name text;
begin
  foreach table_name in array array['lms_lessons', 'lms_goals', 'lms_assessments'] loop
    execute format(
      'create policy own_records_or_assigned_teacher on public.%I for select to authenticated using (
        (student_id = (select auth.uid()) and exists (
          select 1 from public.lms_students s where s.user_id = student_id and s.active
        ))
        or (teacher_id = (select auth.uid()) and exists (
          select 1 from public.lms_staff where user_id = (select auth.uid())
        ))
      )', table_name);
    execute format(
      'create policy assigned_teacher_can_insert on public.%I for insert to authenticated with check (
        teacher_id = (select auth.uid()) and exists (
          select 1 from public.lms_staff where user_id = (select auth.uid())
        ) and exists (
          select 1 from public.lms_students s where s.user_id = student_id and s.created_by = (select auth.uid()) and s.active
        )
      )', table_name);
    execute format(
      'create policy assigned_teacher_can_update on public.%I for update to authenticated using (
        teacher_id = (select auth.uid()) and exists (
          select 1 from public.lms_staff where user_id = (select auth.uid())
        )
      ) with check (
        teacher_id = (select auth.uid()) and exists (
          select 1 from public.lms_staff where user_id = (select auth.uid())
        ) and exists (
          select 1 from public.lms_students s where s.user_id = student_id and s.created_by = (select auth.uid()) and s.active
        )
      )', table_name);
  end loop;
end $$;

comment on table public.lms_assessments is 'Teacher coaching observations on a 1 to 5 support scale; not CEFR, IELTS or an examination grade.';
comment on table public.lms_staff is 'Server-managed roles. User-editable metadata never grants teacher access.';
commit;
