-- ═══════════════════════════════════════════════════════════
--  온유스쿨 팀빌딩 워크숍 — Supabase DB 세팅 SQL
--  실행 위치: Supabase Dashboard → SQL Editor
--  순서대로 실행하세요 (1 → 2 → 3 → 4 → 5)
-- ═══════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────
-- 1. 교회(워크숍 세션) 테이블
--    리더가 신청하면 1개 row 생성. code가 성도 링크에 쓰임.
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workshops (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code         TEXT UNIQUE NOT NULL,          -- 교회 전용 코드 (URL 파라미터)
  church_name  TEXT NOT NULL,                 -- 교회명
  leader_name  TEXT NOT NULL,                 -- 담당자 이름
  leader_email TEXT NOT NULL,                 -- 담당자 이메일
  product_type TEXT DEFAULT 'teachers',       -- 'leadership' | 'teachers' | 'full'
  max_count    INT  DEFAULT 20,               -- 최대 참여 인원
  status       TEXT DEFAULT 'active',         -- 'active' | 'closed' | 'completed' | 'reported'
  report_data  JSONB,                          -- 생성된 AI 리포트 캐시 (1회 생성 후 재사용)
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  expires_at   TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days'
);

-- report_data 컬럼이 없는 기존 DB에 추가 (마이그레이션)
ALTER TABLE workshops ADD COLUMN IF NOT EXISTS report_data JSONB;

-- ─────────────────────────────────────────────────────────
-- 2. 성도 검사 결과 테이블
--    성도가 검사 완료하면 1개 row 생성
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS survey_results (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id   UUID REFERENCES workshops(id) ON DELETE CASCADE,
  workshop_code TEXT NOT NULL,               -- 조회 편의용 denorm
  name          TEXT NOT NULL,
  group_type    TEXT,                        -- 'L' (리더십) | 'T' (교사)
  role          TEXT,                        -- 담임목사 | 교사 | 장로 등
  sg_type       TEXT,                        -- STEADY | SPARK | ...
  dim_scores    JSONB,                       -- { Ne: 3.5, Ni: 2.0, ... }
  answers       JSONB,                       -- 28개 응답값 배열
  submitted_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────
-- 3. 인덱스 (조회 성능)
-- ─────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_survey_workshop_code ON survey_results(workshop_code);
CREATE INDEX IF NOT EXISTS idx_workshops_code       ON workshops(code);

-- ─────────────────────────────────────────────────────────
-- 4. RLS (Row Level Security) — 공개 읽기/쓰기 허용
--    (베타 단계: 인증 없이 code만으로 접근)
--    나중에 리더 로그인 추가 시 정책 강화
-- ─────────────────────────────────────────────────────────
ALTER TABLE workshops      ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_results ENABLE ROW LEVEL SECURITY;

-- workshops: 누구나 code로 조회 가능 (INSERT는 서버사이드에서만)
CREATE POLICY "workshops_select_by_code"
  ON workshops FOR SELECT
  USING (true);

-- survey_results: 같은 workshop_code를 아는 사람만 조회/삽입
CREATE POLICY "results_select_by_code"
  ON survey_results FOR SELECT
  USING (true);

CREATE POLICY "results_insert"
  ON survey_results FOR INSERT
  WITH CHECK (true);

-- ─────────────────────────────────────────────────────────
-- 5. 설문 피드백 테이블 (리포트 하단 설문)
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS survey_feedback (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_code       TEXT,                      -- 워크숍 코드 (연결)
  church_name         TEXT,                      -- 교회명
  q1_usefulness       INT,                       -- 활용도 (1~5)
  q2_accuracy         INT,                       -- 신뢰도 (1~5)
  q3_interest         TEXT,                      -- 관심 서비스 (team/individual/couple/all)
  q4_price_individual TEXT,                      -- 개인 리포트 적정 가격 (주관식)
  q4_price_couple     TEXT,                      -- 부부 리포트 적정 가격 (주관식)
  q4_price_parenting  TEXT,                      -- 자녀양육 리포트 적정 가격 (주관식)
  q4_price_team       TEXT,                      -- 팀빌딩 리포트 적정 가격 (주관식)
  q6_feedback         TEXT,                      -- 자유 의견
  submitted_at        TIMESTAMPTZ DEFAULT NOW(),
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE survey_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feedback_insert"
  ON survey_feedback FOR INSERT
  WITH CHECK (true);

CREATE POLICY "feedback_select"
  ON survey_feedback FOR SELECT
  USING (true);

-- ─────────────────────────────────────────────────────────
-- 6. 베타 샘플 데이터 (새빛교회)
--    실제 운영 시 삭제하거나 상태를 'closed'로 변경
-- ─────────────────────────────────────────────────────────
INSERT INTO workshops (code, church_name, leader_name, leader_email, product_type, max_count)
VALUES ('saebut-2024-x7k9p', '새빛교회', '홍길동', 'test@example.com', 'teachers', 20)
ON CONFLICT (code) DO NOTHING;
