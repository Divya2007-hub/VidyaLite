create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('teacher', 'student')),
  teacher_id uuid references public.profiles (id),
  display_name text not null,
  email text not null,
  created_at timestamptz not null default now(),
  constraint student_requires_teacher check (
    (role = 'teacher' and teacher_id is null) or
    (role = 'student' and teacher_id is not null)
  )
);

create table if not exists public.answer_events (
  id uuid primary key,
  student_id uuid not null references public.profiles (id) on delete cascade,
  question_id text not null,
  subject text not null,
  topic text not null,
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard')),
  correct boolean not null,
  answered_at timestamptz not null
);

create index if not exists profiles_teacher_id_idx
  on public.profiles (teacher_id) where role = 'student';
create index if not exists answer_events_student_date_idx
  on public.answer_events (student_id, answered_at desc);

alter table public.profiles enable row level security;
alter table public.answer_events enable row level security;

revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;

drop policy if exists "Users can read their own profile and teachers can read students" on public.profiles;
create policy "Users can read their own profile and teachers can read students"
  on public.profiles for select to authenticated
  using (
    id = auth.uid() or
    (role = 'student' and teacher_id = auth.uid())
  );

drop policy if exists "Users can update their own display name" on public.profiles;
create policy "Users can update their own display name"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

revoke all on public.answer_events from anon, authenticated;
grant select, insert on public.answer_events to authenticated;

drop policy if exists "Students and their teachers can read answer events" on public.answer_events;
create policy "Students and their teachers can read answer events"
  on public.answer_events for select to authenticated
  using (
    student_id = auth.uid() or
    exists (
      select 1 from public.profiles p
      where p.id = answer_events.student_id
        and p.role = 'student'
        and p.teacher_id = auth.uid()
    )
  );

drop policy if exists "Students can add their own answer events" on public.answer_events;
create policy "Students can add their own answer events"
  on public.answer_events for insert to authenticated
  with check (
    student_id = auth.uid() and
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'student'
    )
  );
