-- =============================================================
-- Migration: 20241019000001_create_schema.sql
-- Concept Check — Five Application Tables + RLS
--
-- Paste this ENTIRE block into:
-- Supabase Dashboard → SQL Editor → New Query → Run
--
-- Safe to re-run (uses IF NOT EXISTS / DROP IF EXISTS).
-- auth.users is the Supabase built-in; NOT created here.
-- =============================================================


-- ---------------------------------------------------------------
-- EXTENSIONS
-- gen_random_uuid() is built-in in Postgres 13+; pgcrypto for older.
-- ---------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- =========================================================
-- TABLE 1: public.users
-- One row per learner, tied to auth.users via anonymous auth.
-- user_id is never typed by the person — comes from Auth.
-- =========================================================
CREATE TABLE IF NOT EXISTS public.users (
  user_id    UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL,
  username   TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Username must contain no whitespace
  CONSTRAINT users_username_no_whitespace CHECK (username !~ '\s'),
  -- Username must not be blank
  CONSTRAINT users_username_nonempty      CHECK (length(trim(username)) > 0)
);

-- Case-insensitive uniqueness: 'Akash' and 'akash' are the same username.
-- Prevents duplicates at the DB level, not just frontend.
CREATE UNIQUE INDEX IF NOT EXISTS users_username_ci_idx
  ON public.users (lower(username));


-- =========================================================
-- TABLE 2: public.golden_pairs
-- 10 prepared question/answer pairs. expected_answer is PRIVATE.
-- Column-level grants (below) ensure anon/authenticated roles
-- can NEVER SELECT expected_answer. Only service_role (Edge
-- Functions) can read it.
-- =========================================================
CREATE TABLE IF NOT EXISTS public.golden_pairs (
  golden_pair_id  UUID PRIMARY KEY,
  question        TEXT NOT NULL,
  expected_answer TEXT NOT NULL   -- private; column grants restrict this
);


-- =========================================================
-- TABLE 3: public.sessions
-- One row per question round (one Golden Pair per session).
-- run_id groups 10 rounds into one assessment — no separate runs table.
-- =========================================================
CREATE TABLE IF NOT EXISTS public.sessions (
  session_id     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES public.users(user_id)             ON DELETE CASCADE,
  golden_pair_id UUID        NOT NULL REFERENCES public.golden_pairs(golden_pair_id),
  run_id         UUID        NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- At most one instance of a Golden Pair within a single user's run
  CONSTRAINT sessions_unique_pair_per_run UNIQUE (user_id, run_id, golden_pair_id)
);

-- Fast retrieval of all sessions for a user's run (sidebar, loadAssessment)
CREATE INDEX IF NOT EXISTS sessions_user_run_idx
  ON public.sessions (user_id, run_id);


-- =========================================================
-- TABLE 4: public.messages
-- Created WITHOUT gap_id first (circular dep with gaps).
-- gap_id FK is added below after public.gaps is created.
-- =========================================================
CREATE TABLE IF NOT EXISTS public.messages (
  message_id   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   UUID        NOT NULL REFERENCES public.sessions(session_id) ON DELETE CASCADE,
  role         TEXT        NOT NULL,
  message_type TEXT        NOT NULL,
  content      TEXT        NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Only these two roles
  CONSTRAINT messages_role_check
    CHECK (role IN ('assistant', 'learner')),

  -- Only these four types
  CONSTRAINT messages_type_check
    CHECK (message_type IN ('question', 'first_attempt', 'follow_up', 'retry')),

  -- Content must be non-empty
  CONSTRAINT messages_content_nonempty
    CHECK (length(trim(content)) > 0),

  -- Role ↔ type consistency:
  --   assistant  → question or follow_up only
  --   learner    → first_attempt or retry only
  CONSTRAINT messages_role_type_consistency CHECK (
    (role = 'assistant' AND message_type IN ('question', 'follow_up'))
    OR
    (role = 'learner'   AND message_type IN ('first_attempt', 'retry'))
  )
);

-- At most ONE message of each type per session
-- (one question, one first_attempt, one follow_up, one retry per round)
CREATE UNIQUE INDEX IF NOT EXISTS messages_one_per_type_per_session
  ON public.messages (session_id, message_type);

-- Chronological retrieval per session
CREATE INDEX IF NOT EXISTS messages_session_created_idx
  ON public.messages (session_id, created_at ASC);


-- =========================================================
-- TABLE 5: public.gaps
-- At most one gap per first_attempt message.
-- message_id FK points to the FIRST ATTEMPT message that
-- may contain a conceptual gap.
-- =========================================================
CREATE TABLE IF NOT EXISTS public.gaps (
  gap_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The first_attempt message that triggered this gap
  message_id      UUID NOT NULL UNIQUE REFERENCES public.messages(message_id) ON DELETE CASCADE,
  phrase          TEXT NOT NULL,
  gap_description TEXT NOT NULL
);


-- =========================================================
-- ALTER TABLE messages — add gap_id FK back-reference to gaps.
-- Done AFTER gaps table exists (resolves circular dependency).
-- Only populated on retry rows when a genuine gap exists.
-- =========================================================
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS gap_id UUID
  REFERENCES public.gaps(gap_id) ON DELETE SET NULL;

-- gap_id is only meaningful on retry message rows
ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS messages_gap_id_only_on_retry;
ALTER TABLE public.messages
  ADD CONSTRAINT messages_gap_id_only_on_retry
  CHECK (gap_id IS NULL OR message_type = 'retry');


-- =============================================================
-- ROW LEVEL SECURITY — Enable on all five tables
-- =============================================================
ALTER TABLE public.users         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.golden_pairs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gaps          ENABLE ROW LEVEL SECURITY;


-- =============================================================
-- RLS POLICIES
-- =============================================================

-- ----- public.users -----
-- A learner can only read and write their own profile row.
DROP POLICY IF EXISTS "users_select_own"  ON public.users;
DROP POLICY IF EXISTS "users_insert_own"  ON public.users;
DROP POLICY IF EXISTS "users_update_own"  ON public.users;

CREATE POLICY "users_select_own"
  ON public.users FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "users_insert_own"
  ON public.users FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_update_own"
  ON public.users FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ----- public.golden_pairs -----
-- Authenticated users may read rows (question text only).
-- expected_answer is blocked by column-level grants below —
-- not by this row-level policy.
DROP POLICY IF EXISTS "golden_pairs_select_authenticated" ON public.golden_pairs;

CREATE POLICY "golden_pairs_select_authenticated"
  ON public.golden_pairs FOR SELECT
  TO authenticated
  USING (true);

-- anon (unauthenticated visitors) cannot read golden_pairs at all
-- (no policy created for anon role → denied by default)


-- ----- public.sessions -----
-- A learner can only read or create their own sessions.
DROP POLICY IF EXISTS "sessions_select_own" ON public.sessions;
DROP POLICY IF EXISTS "sessions_insert_own" ON public.sessions;

CREATE POLICY "sessions_select_own"
  ON public.sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "sessions_insert_own"
  ON public.sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);


-- ----- public.messages -----
-- Ownership goes through the parent session.
-- A learner can only read/write messages for their own sessions.
DROP POLICY IF EXISTS "messages_select_own_session" ON public.messages;
DROP POLICY IF EXISTS "messages_insert_own_session" ON public.messages;

CREATE POLICY "messages_select_own_session"
  ON public.messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.session_id = messages.session_id
        AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "messages_insert_own_session"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.session_id = messages.session_id
        AND s.user_id = auth.uid()
    )
  );


-- ----- public.gaps -----
-- Ownership goes through the linked first_attempt message → session.
DROP POLICY IF EXISTS "gaps_select_own" ON public.gaps;

CREATE POLICY "gaps_select_own"
  ON public.gaps FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.messages m
      JOIN public.sessions s ON s.session_id = m.session_id
      WHERE m.message_id = gaps.message_id
        AND s.user_id = auth.uid()
    )
  );


-- =============================================================
-- COLUMN-LEVEL SECURITY for public.golden_pairs
--
-- Remove expected_answer from the SELECT grant for anon and
-- authenticated roles. Only service_role (used by Edge Functions)
-- can read all columns including expected_answer.
-- =============================================================

-- Revoke all column access on the whole table first
REVOKE SELECT ON public.golden_pairs FROM anon, authenticated;

-- Re-grant only the safe columns (no expected_answer)
GRANT SELECT (golden_pair_id, question)
  ON public.golden_pairs TO authenticated;

-- anon gets no column access at all (cannot even see question text)
-- Frontend must be authenticated before fetching questions.


-- =============================================================
-- GRANT table-level access for Edge Functions (service_role
-- already bypasses RLS; these grants are for authenticated role
-- in the current stage before Edge Functions take over writes)
-- =============================================================
GRANT SELECT, INSERT        ON public.users         TO authenticated;
GRANT SELECT, INSERT        ON public.sessions      TO authenticated;
GRANT SELECT, INSERT        ON public.messages      TO authenticated;
GRANT SELECT                ON public.gaps          TO authenticated;  -- gaps written by Edge Fn only
