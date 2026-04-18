-- ═══════════════════════════════════════════════════════════
--  단기선교 팀빌딩 — Supabase DB 세팅 SQL
--  실행 위치: Supabase Dashboard → SQL Editor
--  순서대로 실행하세요 (1 → 2 → 3)
-- ═══════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────
-- 1. 선교 워크숍(세션) 테이블
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mission_workshops (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code         TEXT UNIQUE NOT NULL,
  church_name  TEXT NOT NULL,
  leader_name  TEXT NOT NULL,
  leader_email TEXT NOT NULL,
  trip_name    TEXT DEFAULT '',
  trip_location TEXT DEFAULT '',
  trip_duration TEXT DEFAULT '',
  max_count    INT  DEFAULT 30,
  status       TEXT DEFAULT 'active',
  report_data  JSONB,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  expires_at   TIMESTAMPTZ DEFAULT NOW() + INTERVAL '60 days'
);

-- ─────────────────────────────────────────────────────────
-- 2. 선교팀 개인 검사 결과 테이블
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mission_results (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id   UUID REFERENCES mission_workshops(id) ON DELETE CASCADE,
  workshop_code TEXT NOT NULL,
  name          TEXT NOT NULL,
  role          TEXT,
  sg_type       TEXT,
  dim_scores    JSONB,
  answers       JSONB,
  submitted_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────
-- 3. 인덱스 & RLS
-- ─────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_mission_results_code ON mission_results(workshop_code);
CREATE INDEX IF NOT EXISTS idx_mission_workshops_code ON mission_workshops(code);

ALTER TABLE mission_workshops ENABLE ROW LEVEL SECURITY;
ALTER TABLE mission_results   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mission_ws_select" ON mission_workshops FOR SELECT USING (true);
CREATE POLICY "mission_ws_insert" ON mission_workshops FOR INSERT WITH CHECK (true);

CREATE POLICY "mission_res_select" ON mission_results FOR SELECT USING (true);
CREATE POLICY "mission_res_insert" ON mission_results FOR INSERT WITH CHECK (true);
