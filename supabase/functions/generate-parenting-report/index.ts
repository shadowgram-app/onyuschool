/**
 * Supabase Edge Function: generate-parenting-report
 * 자녀양육 클래스 가족 리포트 생성
 *
 * 환경변수: ANTHROPIC_API_KEY
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// ── 유형 메타데이터 ──
const TYPE_META: Record<string, {
  fn: string; kr: string; icon: string; color: string;
  keywords: string[]; oneLiner: string;
  strengths: string[]; shadows: string[];
  light: string; shadow: string; caption: string;
}> = {
  SPARK:   { fn:'Ne', kr:'스파크',   icon:'✨', color:'#8A6400',
    keywords:['열정','영감','감화','가능성'],
    oneLiner:'감동으로 사람을 움직이는 사람. 한 마디로 분위기가 바뀝니다.',
    strengths:['영감을 주는 말과 태도','상대의 잠재력을 발견하는 능력','창의적인 아이디어와 기획력'],
    shadows:['시작은 강하지만 마무리가 약한 패턴','감정 소진 후 갑자기 에너지 바닥'],
    light:'영감과 열정', shadow:'소진과 인정 갈망',
    caption:'처음엔 당신의 뜨거운 열정에 이끌렸지만, 에너지가 소진된 채 사라지는 그림자를 보면서 처음의 감동이 실망으로 역전됩니다.' },
  VISION:  { fn:'Ni', kr:'비전',     icon:'🔭', color:'#4A235A',
    keywords:['통찰','미래','구조','개념'],
    oneLiner:'큰 그림을 그리는 사람. 10년 후를 설계합니다.',
    strengths:['중장기 방향을 설계하는 전략적 사고','문제의 본질을 꿰뚫는 통찰력','높은 기준과 원칙의 리더십'],
    shadows:['관계적 거리감 — 차갑게 느껴지는 상황','피드백 수용의 어려움'],
    light:'통찰과 전략', shadow:'고독한 확신과 관계 단절',
    caption:'처음엔 확신과 결단력에 이끌렸지만, 연약함을 용납하지 못하는 그림자를 보면서 마음을 닫아버립니다.' },
  STEADY:  { fn:'Si', kr:'스테디',   icon:'🌿', color:'#256060',
    keywords:['안정','신뢰','꾸준함','성실'],
    oneLiner:'한결같은 신뢰로 공동체를 지키는 사람.',
    strengths:['약속을 지키는 신뢰감','이름과 어려움을 오래 기억하는 돌봄','안정적인 분위기 조성'],
    shadows:['변화에 대한 저항','자기 의견 표현의 어려움','번아웃의 은밀함'],
    light:'신뢰와 일관성', shadow:'자기 부정과 과도한 희생',
    caption:'처음엔 한결같은 성실함에 의지했지만, 아니오를 말하지 못하다 무너지는 그림자를 보면서 죄책감에 멀어집니다.' },
  PLAYER:  { fn:'Se', kr:'플레이어', icon:'🎯', color:'#3D4D1C',
    keywords:['실행','현장','즉흥','적응'],
    oneLiner:'현장에서 빛나는 사람. 지금 이 순간에 강합니다.',
    strengths:['실제 필요를 빠르게 파악하고 즉각 행동','위기 대응력','유연한 적응력'],
    shadows:['장기 계획의 어려움','감정 대화에서 거리를 두는 경향'],
    light:'실행력과 현장감', shadow:'깊이 회피와 내면 방치',
    caption:'처음엔 발 빠른 실행력에 든든함을 느꼈지만, 충동적으로 움직이다 혼란을 만드는 그림자를 보면서 발을 빼게 됩니다.' },
  HARMONY: { fn:'Fe', kr:'하모니',   icon:'🕊️', color:'#7B1A1A',
    keywords:['공감','조화','돌봄','연결'],
    oneLiner:'사람의 마음을 읽고 공동체를 하나로 잇는 사람.',
    strengths:['감정을 정확하게 읽고 언어화','갈등 중재 능력','따뜻한 분위기 조성'],
    shadows:['경계 설정의 어려움','갈등 회피','감정 흡수'],
    light:'공감과 연결', shadow:'자기 소멸과 경계 붕괴',
    caption:'처음엔 따뜻한 공감에 위로받았지만, 경계를 긋지 못하고 지쳐드는 그림자를 보면서 점차 멀어집니다.' },
  SOUL:    { fn:'Fi', kr:'소울',     icon:'🌊', color:'#555555',
    keywords:['깊이','의미','진정성','내면'],
    oneLiner:'본질을 파고드는 사람. 내면의 진정성을 추구합니다.',
    strengths:['고통에 대한 깊은 공명','자신의 연약함을 나누는 진정성','형식을 넘어 본질로 이끄는 능력'],
    shadows:['공적 리더십의 불편함','실행력의 약점','고립 경향'],
    light:'깊이와 진정성', shadow:'고립과 자기 은폐',
    caption:'처음엔 진정성과 깊이에 갈증을 해소했지만, 고립 속으로 사라지는 그림자를 보면서 쓸쓸함에 떠납니다.' },
  LOGIC:   { fn:'Ti', kr:'로직',     icon:'🔬', color:'#2C3E50',
    keywords:['분석','정확','원칙','체계'],
    oneLiner:'논리와 원칙으로 공동체를 세우는 사람.',
    strengths:['치밀한 연구와 분석력','체계적이고 설득력 있는 소통','일관된 기준 유지'],
    shadows:['감정적 연결의 어려움','완벽주의','설명이 길어지는 패턴'],
    light:'논리와 정확성', shadow:'감정 억압과 연결 회피',
    caption:'처음엔 치밀한 논리에 신뢰를 보냈지만, 마음을 논리로만 다루는 그림자를 보면서 아픔을 꺼낼 수 없다고 느낍니다.' },
  LEADER:  { fn:'Te', kr:'리더',     icon:'⚡', color:'#1A3055',
    keywords:['추진','결단','영향력','목표'],
    oneLiner:'방향을 정하고 이끄는 사람. 결단이 필요한 순간 망설이지 않습니다.',
    strengths:['빠르고 명확한 결정력','효율적 조직화 능력','당당한 리더십'],
    shadows:['관계보다 결과를 우선시하는 위험','권위주의적 경향','약함에 대한 낮은 인내'],
    light:'추진력과 결단', shadow:'통제와 약함 혐오',
    caption:'처음엔 확신과 결단력을 믿고 따랐지만, 연약함을 혐오하는 그림자를 보면서 도구로 전락했다고 느끼며 마음을 닫습니다.' },
}

// ── 나이 계산 ──
function getAge(birthYear: number): number {
  return new Date().getFullYear() - birthYear + 1
}

// ── 나이대별 발달 맥락 ──
function getDevelopmentContext(age: number): string {
  if (age <= 6)  return '유아기(영유아): 애착과 안전감이 핵심인 시기'
  if (age <= 12) return '아동기: 규칙과 또래 관계를 배우는 시기'
  if (age <= 18) return '청소년기: 정체성을 형성하고 자율성을 추구하는 시기'
  return '성인 자녀: 독립적 관계를 재정립하는 시기'
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
      max_tokens: 2048,
      system: `당신은 온유스쿨 쉐도우그램의 자녀양육 클래스 리포트 전문가입니다.

쉐도우그램 핵심 원리:
1. 주기능 중심 해석 — 8유형의 빛과 그림자는 주기능에서 도출
2. 빛→그림자 역전 — "처음엔 빛에 이끌렸지만, 그림자를 보며 갈등한다"
3. 개성화 — "더 많이"가 아닌 "내려놓음과 균형"

작성 규칙:
- 부모-자녀 관계 맥락 유지
- 아이의 나이와 발달 단계 반영
- 판단이 아닌 이해의 언어
- 따뜻하지만 사실적인 톤
- 가정에서 바로 실천 가능한 구체적 조언`,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!res.ok) throw new Error(`Claude API 오류: ${res.status}`)
  const data = await res.json()
  return data.content?.[0]?.text || ''
}

// ── 가족 리포트 생성 ──
async function generateFamilyReport(
  session: any,
  members: any[],
  apiKey: string
): Promise<Record<string, string>> {
  const parents  = members.filter(m => m.member_type === 'parent')
  const children = members.filter(m => m.member_type === 'child')

  const memberSummary = members.map(m => {
    const td = TYPE_META[m.sg_type] || {}
    const age = m.birth_year ? `(${getAge(m.birth_year)}세, ${getDevelopmentContext(getAge(m.birth_year))})` : ''
    return `${m.name}(${m.role}): ${m.sg_type}/${td.kr} — 빛:${td.light}, 그림자:${td.shadow} ${age}`
  }).join('\n')

  const results: Record<string, string> = {}

  // 1. 가족 소통 구조 서사
  const p1 = await callClaude(`
가족 구성:
${memberSummary}

이 가족의 소통 구조를 3~4문장으로 서술해주세요.
- 전체 유형 조합의 특징
- 이 가족만의 강점
- 주의해야 할 집단적 그림자

JSON: {"familyNarrative": "...", "familyStrength": "...", "familyShadow": "..."}
JSON만 응답.`, apiKey)

  try { Object.assign(results, JSON.parse(p1.replace(/```json|```/g,''))) } catch(e) {}

  // 2. 부모 양육 성향
  if (parents.length > 0) {
    const parentInfo = parents.map(p => {
      const td = TYPE_META[p.sg_type] || {}
      return `${p.name}(${p.role}): ${p.sg_type}/${td.kr}`
    }).join(', ')

    const p2 = await callClaude(`
부모 정보: ${parentInfo}
자녀 정보: ${children.map(c => `${c.name}(${c.role}, ${c.birth_year ? getAge(c.birth_year)+'세' : ''}): ${c.sg_type}`).join(', ')}

부모 양육 성향을 분석해주세요:
${parents.length === 2 ? '- 두 부모의 양육 스타일 조합과 시너지/충돌' : '- 한부모로서의 강점과 주의점'}
- 자녀들에게 미치는 영향

JSON: {"parentingStyle": "...", "parentingStrength": "...", "parentingChallenge": "..."}
JSON만 응답.`, apiKey)

    try { Object.assign(results, JSON.parse(p2.replace(/```json|```/g,''))) } catch(e) {}
  }

  // 3. 자녀 개별 분석
  for (const child of children) {
    const td = TYPE_META[child.sg_type] || {}
    const age = child.birth_year ? getAge(child.birth_year) : null
    const devCtx = age ? getDevelopmentContext(age) : ''
    const parentTypes = parents.map(p => `${p.name}:${p.sg_type}`).join(', ')

    const p3 = await callClaude(`
자녀: ${child.name}(${child.role}${age ? ', '+age+'세' : ''}), 유형: ${child.sg_type}/${td.kr}
발달 단계: ${devCtx}
부모 유형: ${parentTypes}

이 아이를 이해하는 리포트를 작성해주세요:
- 이 아이가 이렇게 행동하는 이유 (유형 기반)
- 나이와 발달 단계 맥락 반영
- 부모가 이 아이와 소통하는 구체적인 방법 2가지

JSON: {"childUnderstanding_${child.name}": "...", "childParentingTip_${child.name}": "..."}
JSON만 응답.`, apiKey)

    try { Object.assign(results, JSON.parse(p3.replace(/```json|```/g,''))) } catch(e) {}
  }

  // 4. 가족 마이크로 미션
  const p4 = await callClaude(`
가족 구성:
${memberSummary}

이 가족이 이번 주 함께 실천할 수 있는 마이크로 미션 3가지를 제안해주세요.
- 각 미션은 10분 이내, 집에서 바로 가능
- 각 유형의 특성을 살린 활동

JSON: {"familyMissions": ["미션1", "미션2", "미션3"], "familyGrowth": "가족 전체 성장 방향 2~3문장"}
JSON만 응답.`, apiKey)

  try { Object.assign(results, JSON.parse(p4.replace(/```json|```/g,''))) } catch(e) {}

  return results
}

// ── 메인 핸들러 ──
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY')
    if (!ANTHROPIC_KEY) throw new Error('API 키 미설정')

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { session_code } = await req.json()
    if (!session_code) throw new Error('세션 코드 필요')

    // 세션 조회
    const { data: session } = await supabase
      .from('family_sessions')
      .select('*')
      .eq('code', session_code)
      .single()
    if (!session) throw new Error('세션 없음')

    // 구성원 조회
    const { data: members } = await supabase
      .from('family_members')
      .select('*')
      .eq('session_code', session_code)
      .order('created_at')

    if (!members?.length) throw new Error('구성원 없음')

    // 미완료 체크
    const incomplete = members.filter((m: any) => !m.completed_at)
    if (incomplete.length > 0) {
      return new Response(
        JSON.stringify({ error: '아직 완료하지 않은 구성원이 있습니다.', incomplete: incomplete.map((m:any)=>m.name) }),
        { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
      )
    }

    // AI 리포트 생성
    const aiData = await generateFamilyReport(session, members, ANTHROPIC_KEY)

    // 세션에 report_html 저장 표시
    await supabase
      .from('family_sessions')
      .update({ status: 'reported' })
      .eq('code', session_code)

    return new Response(
      JSON.stringify({ ok: true, session, members, aiData, TYPE_META }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } }
    )

  } catch(e: any) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  }
})
