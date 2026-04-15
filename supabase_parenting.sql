-- ─────────────────────────────────────────────────────────
-- 자녀양육 클래스 DB 스키마
-- Supabase SQL Editor에서 실행
-- ─────────────────────────────────────────────────────────

-- 1. 가족 세션 테이블
CREATE TABLE IF NOT EXISTS family_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code          TEXT UNIQUE NOT NULL,        -- 세션 코드 (URL용)
  leader_name   TEXT NOT NULL,               -- 신청자 이름
  leader_email  TEXT NOT NULL,               -- 신청자 이메일 (리포트 발송)
  status        TEXT DEFAULT 'active',       -- active | completed | reported
  report_html   TEXT,                        -- 생성된 리포트 HTML
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  expires_at    TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days'
);

-- 2. 가족 구성원 테이블
CREATE TABLE IF NOT EXISTS family_members (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID REFERENCES family_sessions(id) ON DELETE CASCADE,
  session_code  TEXT NOT NULL,
  member_type   TEXT NOT NULL,               -- 'parent' | 'child'
  name          TEXT NOT NULL,
  gender        TEXT,                        -- 'M' | 'F' | 'other'
  birth_year    INT,                         -- 자녀 출생연도
  role          TEXT,                        -- 아버지|어머니|자녀1|자녀2...
  sg_type       TEXT,                        -- 검사 완료 후 채워짐
  dim_scores    JSONB,
  answers       JSONB,
  survey_token  TEXT UNIQUE,                 -- 개인 링크 토큰
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 인덱스
CREATE INDEX IF NOT EXISTS idx_family_members_session  ON family_members(session_code);
CREATE INDEX IF NOT EXISTS idx_family_members_token    ON family_members(survey_token);
CREATE INDEX IF NOT EXISTS idx_family_sessions_code    ON family_sessions(code);

-- 4. RLS
ALTER TABLE family_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_members  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "family_sessions_select" ON family_sessions FOR SELECT USING (true);
CREATE POLICY "family_sessions_insert" ON family_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "family_sessions_update" ON family_sessions FOR UPDATE USING (true);

CREATE POLICY "family_members_select"  ON family_members  FOR SELECT USING (true);
CREATE POLICY "family_members_insert"  ON family_members  FOR INSERT WITH CHECK (true);
CREATE POLICY "family_members_update"  ON family_members  FOR UPDATE USING (true);
