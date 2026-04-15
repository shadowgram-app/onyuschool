/**
 * Supabase Edge Function: generate-report
 *
 * 역할: 브라우저 대신 서버에서 Claude API 호출
 * - API 키는 Supabase 환경변수에 안전하게 보관
 * - 워크숍 코드 유효성 검증 후 리포트 생성
 * - CORS 처리
 *
 * 환경변수 (Supabase Dashboard → Settings → Edge Functions):
 *   ANTHROPIC_API_KEY = sk-ant-api03-...
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// ── 쉐도우그램 시스템 프롬프트 ──
const SYSTEM_PROMPT = `당신은 온유스쿨 쉐도우그램의 리포트 생성 전문가입니다.

## 쉐도우그램 3대 핵심 원리

### 1. 주기능 중심 해석
16유형이 아닌 8유형으로 묶는 이유: 주기능이 같은 두 유형은 핵심 소통 패턴이 동일합니다.
강점과 그림자는 반드시 해당 주기능의 특성에서 도출해야 합니다.

### 2. 빛→그림자 역전 구조
"빛을 보고 끌렸는데, 그림자를 보고 갈등한다"
- 빛: 주기능의 긍정적·매력적 발현
- 그림자: 동일 주기능이 과잉·왜곡될 때 나타나는 부정적 발현
- 역전 서사: "처음엔 [빛]에 이끌렸지만 → [그림자]를 보며 → [관계 결과]"

### 3. 개성화(Individuation)
성장 방향 = 주기능의 과잉을 인식하고 열등기능과 균형 잡기.
"더 많이"가 아닌 "내려놓음과 균형" 메시지로 작성.

## 작성 규칙
- 그림자를 병리적으로 묘사하지 않기
- 판단이 아닌 이해의 언어 사용
- 교회 공동체 맥락 유지
- 역할(장로, 교사, 부장 등) 맥락을 자연스럽게 반영
- 분량: 팀 서사 3~4문장, 개인 캡션 2~3문장

## 브랜드 보이스
- 따뜻하지만 직면하는 톤
- 과도한 위로나 칭찬 없이 사실적으로
- "불을 다스리는 사람들의 학교" — 온유스쿨`

// ── 유형 메타데이터 ──
const TYPE_META: Record<string, { fn: string; kr: string; light: string; shadow: string }> = {
  SPARK:   { fn: 'Ne', kr: '스파크',   light: '영감과 열정',    shadow: '소진과 인정 갈망' },
  VISION:  { fn: 'Ni', kr: '비전',     light: '통찰과 전략',    shadow: '고독한 확신과 관계 단절' },
  STEADY:  { fn: 'Si', kr: '스테디',   light: '신뢰와 일관성',  shadow: '자기 부정과 과도한 희생' },
  PLAYER:  { fn: 'Se', kr: '플레이어', light: '실행력과 현장감', shadow: '깊이 회피와 내면 방치' },
  HARMONY: { fn: 'Fe', kr: '하모니',   light: '공감과 연결',    shadow: '자기 소멸과 경계 붕괴' },
  SOUL:    { fn: 'Fi', kr: '소울',     light: '깊이와 진정성',  shadow: '고립과 자기 은폐' },
  LOGIC:   { fn: 'Ti', kr: '로직',     light: '논리와 정확성',  shadow: '감정 억압과 연결 회피' },
  LEADER:  { fn: 'Te', kr: '리더',     light: '추진력과 결단',  shadow: '통제와 약함 혐오' },
}

// ── Claude API 호출 ──
async function callClaude(prompt: string, apiKey: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Claude API 오류: ${res.status} — ${err}`)
  }

  const data = await res.json()
  return data.content?.[0]?.text || ''
}

// ── 팀 서술 생성 ──
async function generateTeamNarrative(
  churchName: string,
  typeDistribution: [string, number][],
  teamStrengths: string[],
  vulnerabilities: string[],
  balanceWarning: string | null,
  apiKey: string
): Promise<{ teamNarrative: string; teamShadow: string; workshopOpening: string }> {
  const typeList = typeDistribution
    .map(([t, n]) => `${TYPE_META[t]?.kr || t}(${t}) ${n}명`)
    .join(', ')

  const prompt = `
다음 팀의 쉐도우그램 리포트 텍스트를 생성해 주세요.

## 팀 정보
- 교회: ${churchName}
- 유형 분포: ${typeList}
- 팀 강점: ${teamStrengths.join(' / ')}
- 취약 영역: ${vulnerabilities.join(' / ') || '없음'}
- 균형 경고: ${balanceWarning || '없음'}

## 생성할 텍스트 (JSON으로 응답)
{
  "teamNarrative": "이 팀의 소통 구조를 3~4문장으로 서술. 유형 분포의 특징과 공동체에 미치는 영향 포함.",
  "teamShadow": "이 팀이 주의해야 할 그림자 패턴을 2~3문장으로 서술. 유형 조합에서 생기는 집단적 그림자.",
  "workshopOpening": "워크숍 시작 시 퍼실리테이터가 읽을 오프닝 멘트 2~3문장. 이 팀의 특성을 반영한 따뜻한 환영사."
}

JSON만 응답하세요.`

  const raw = await callClaude(prompt, apiKey)
  const cleaned = raw.trim().replace(/```json|```/g, '').trim()
  return JSON.parse(cleaned)
}

// ── 개인 서술 생성 (배치) ──
async function generateIndividualNarratives(
  members: Array<{ name: string; role: string; sg_type: string }>,
  apiKey: string
): Promise<Array<{ name: string; personalNarrative: string; shadowCaption: string }>> {
  // 최대 5명씩 배치 처리
  const results = []

  for (const m of members) {
    const meta = TYPE_META[m.sg_type]
    if (!meta) {
      results.push({ name: m.name, personalNarrative: '', shadowCaption: '' })
      continue
    }

    const prompt = `
다음 개인의 쉐도우그램 리포트 텍스트를 생성해 주세요.

## 개인 정보
- 이름: ${m.name}
- 역할: ${m.role || '팀원'}
- 유형: ${m.sg_type} (${meta.kr})
- 주기능: ${meta.fn}
- 빛: ${meta.light}
- 그림자: ${meta.shadow}

## 생성할 텍스트 (JSON으로 응답)
{
  "personalNarrative": "${m.role} 역할 맥락을 반영한 개인 소통 패턴 서술 2~3문장. 역할과 유형이 어떻게 연결되는지 포함.",
  "shadowCaption": "쉐도우그램 캡션 — 빛→그림자 역전 3단 서사. 팀원 관점에서 작성. 2~3문장."
}

JSON만 응답하세요.`

    try {
      const raw = await callClaude(prompt, apiKey)
      const cleaned = raw.trim().replace(/```json|```/g, '').trim()
      const parsed = JSON.parse(cleaned)
      results.push({ name: m.name, ...parsed })
    } catch (e) {
      results.push({ name: m.name, personalNarrative: '', shadowCaption: '' })
    }
  }

  return results
}

// ── 메인 핸들러 ──
serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }

  try {
    // 환경변수에서 API 키 로드 (절대 프론트엔드에 노출 안 됨)
    const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY')
    if (!ANTHROPIC_KEY) {
      return new Response(
        JSON.stringify({ error: 'API 키가 설정되지 않았습니다.' }),
        { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } }
      )
    }

    // Supabase 클라이언트 (워크숍 유효성 검증용)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { code, mode } = await req.json()

    if (!code) {
      return new Response(
        JSON.stringify({ error: '워크숍 코드가 필요합니다.' }),
        { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
      )
    }

    // 1. 워크숍 유효성 검증
    const { data: ws, error: wsErr } = await supabase
      .from('workshops')
      .select('*')
      .eq('code', code)
      .single()

    if (wsErr || !ws) {
      return new Response(
        JSON.stringify({ error: '유효하지 않은 워크숍 코드입니다.' }),
        { status: 404, headers: { ...CORS, 'Content-Type': 'application/json' } }
      )
    }

    // (추후) 결제 완료 여부 검증
    // if (ws.payment_status !== 'paid' && !ws.is_beta) { ... }

    // 2. 검사 결과 조회
    const { data: results, error: rErr } = await supabase
      .from('survey_results')
      .select('name, role, sg_type, group_type')
      .eq('workshop_code', code)

    if (rErr || !results?.length) {
      return new Response(
        JSON.stringify({ error: '완료된 검사 결과가 없습니다.' }),
        { status: 404, headers: { ...CORS, 'Content-Type': 'application/json' } }
      )
    }

    // 3. 팀 분석 (룰 기반)
    const counts: Record<string, number> = {}
    results.forEach((r: any) => {
      if (r.sg_type) counts[r.sg_type] = (counts[r.sg_type] || 0) + 1
    })
    const typeDistribution = Object.entries(counts).sort((a, b) => b[1] - a[1])
    const topTypes = typeDistribution.slice(0, 3).map(([t]) => t)

    const teamStrengths = topTypes.map(t => `${TYPE_META[t]?.kr || t}의 강점`)
    const vulnerabilities: string[] = []
    const balanceWarning = null

    // 4. AI 생성 (mode에 따라)
    let teamAI = null
    let individualAI: any[] = []

    if (mode === 'team' || mode === 'all') {
      teamAI = await generateTeamNarrative(
        ws.church_name,
        typeDistribution,
        teamStrengths,
        vulnerabilities,
        balanceWarning,
        ANTHROPIC_KEY
      )
    }

    if (mode === 'individual' || mode === 'all') {
      individualAI = await generateIndividualNarratives(results, ANTHROPIC_KEY)
    }

    return new Response(
      JSON.stringify({
        ok: true,
        workshop: {
          church_name: ws.church_name,
          title: ws.title,
          product_type: ws.product_type,
          max_count: ws.max_count,
        },
        results,
        typeDistribution,
        teamAI,
        individualAI,
      }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } }
    )

  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  }
})
