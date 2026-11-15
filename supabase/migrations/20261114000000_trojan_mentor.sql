-- Trojan Mentor — Postgres / Supabase schema for a server-backed deployment.
-- STATUS: provided for the next phase. The hackathon demo stores state in browser localStorage
-- and does NOT read or write this schema. Raw resumes are intentionally never stored.

create extension if not exists pgcrypto;

create type person_kind as enum ('student', 'mentor');
create type match_stage as enum ('proposed','approved','declined','revoked','introduced','meeting_scheduled','meeting_held');
create type decision as enum ('pending','approved','declined');
create type action_kind as enum ('introduction_email','calendar_invite','follow_up_email');
create type action_status as enum ('awaiting_approval','approved','succeeded','failed','cancelled');
create type approver_role as enum ('coordinator','student','mentor');

create table people (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,               -- links to auth.users once real sign-in exists
  kind person_kind not null,
  name text not null check (char_length(name) <= 80),
  school text not null,
  grad_year int,
  created_at timestamptz not null default now()
);

-- Reviewed fields only. `source` records how the draft was produced before human review.
create table student_profiles (
  person_id uuid primary key references people(id) on delete cascade,
  program text,
  career_goals text not null check (char_length(career_goals) <= 500),
  target_roles text[] not null default '{}',
  industries text[] not null default '{}',
  skills text[] not null default '{}',
  interests text[] not null default '{}',
  communities text[] not null default '{}',
  availability text[] not null default '{}',
  source text not null check (source in ('manual','demo-parser','gemini','seed')),
  reviewed_at timestamptz not null
);

create table mentor_profiles (
  person_id uuid primary key references people(id) on delete cascade,
  headline text,
  trajectory jsonb not null default '[]',
  industries text[] not null default '{}',
  roles text[] not null default '{}',
  expertise text[] not null default '{}',
  communities text[] not null default '{}',
  mentoring_preferences text,
  availability text[] not null default '{}',
  capacity int not null check (capacity between 0 and 10),
  opt_in boolean not null default false,
  visibility text not null default 'visible' check (visibility in ('visible','paused'))
);

-- Three separate consents. `version` increments on processing/matching changes;
-- approvals capture it so a stale approval can never authorize a new action.
create table consents (
  person_id uuid primary key references people(id) on delete cascade,
  profile_processing boolean not null default false,
  external_ai boolean not null default false,
  matching boolean not null default false,
  version int not null default 1,
  updated_at timestamptz not null default now()
);

create table exclusions (
  person_id uuid references people(id) on delete cascade,
  excluded_person_id uuid references people(id) on delete cascade,
  primary key (person_id, excluded_person_id)
);

create table allocation_runs (
  id uuid primary key default gen_random_uuid(),
  run_at timestamptz not null default now(),
  threshold int not null,
  total_score int not null,
  greedy_total int not null,
  result jsonb not null            -- assigned, unmatched (with reasons), ineligible mentors
);

create table matches (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references people(id) on delete cascade,
  mentor_id uuid not null references people(id) on delete cascade,
  allocation_run_id uuid references allocation_runs(id),
  score int not null check (score between 0 and 100),
  stage match_stage not null default 'proposed',
  student_decision decision not null default 'pending',
  student_decided_at timestamptz,
  student_consent_version int,
  mentor_decision decision not null default 'pending',
  mentor_decided_at timestamptz,
  mentor_consent_version int,
  meeting_slot text,
  meeting_starts_at text,
  meeting_held_at timestamptz,
  prep jsonb not null default '[]',
  created_at timestamptz not null default now()
);
-- At most one live match per student.
create unique index one_live_match_per_student on matches(student_id)
  where stage in ('proposed','approved','introduced','meeting_scheduled','meeting_held');

create table milestones (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  title text not null,
  detail text not null,
  basis text not null,
  done boolean not null default false,
  completed_at timestamptz
);

create table coordination_actions (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  kind action_kind not null,
  idempotency_key text not null unique,
  draft jsonb not null,
  required_approver approver_role not null,
  approval jsonb,                  -- {role, by, at, draftHash, consentVersions}
  status action_status not null default 'awaiting_approval',
  attempts int not null default 0,
  last_error text,
  result jsonb,
  created_at timestamptz not null default now()
);

create table action_events (
  id bigserial primary key,
  action_id uuid not null references coordination_actions(id) on delete cascade,
  at timestamptz not null default now(),
  phase text not null check (phase in ('plan','approve','act','observe')),
  message text not null
);

-- Provider ledger: the unique key is what makes retries safe.
create table deliveries (
  idempotency_key text primary key references coordination_actions(idempotency_key) on delete cascade,
  provider_id text not null,
  delivered_at timestamptz not null default now(),
  adapter text not null default 'simulated'
);

-- Row-level security: on by default, no policies yet. Policies must be written alongside real auth.
alter table people enable row level security;
alter table student_profiles enable row level security;
alter table mentor_profiles enable row level security;
alter table consents enable row level security;
alter table exclusions enable row level security;
alter table allocation_runs enable row level security;
alter table matches enable row level security;
alter table milestones enable row level security;
alter table coordination_actions enable row level security;
alter table action_events enable row level security;
alter table deliveries enable row level security;
