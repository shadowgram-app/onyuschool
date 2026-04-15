/**
 * Supabase Edge Function: generate-parenting-report
 * 쉐도우그램 자녀양육 클래스 — AI 가족 리포트 생성
 * HTML이 기대하는 aiData 구조에 정확히 맞춤
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// ── 유형 메타 ──
const TYPE_META: Record<string, any> = {
  SPARK:   { kr:'스파크',   fn:'Ne', icon:'✨',
    oneLiner:'감동으로 사람을 움직이는 사람',
    light:'영감·열정·가능성 탐색', shadow:'소진·미완성·인정 갈망',
    parentingColor:'따뜻한 영감형 양육자',
    caption:'처음엔 당신의 뜨거운 열정에 이끌렸지만, 에너지가 소진된 채 사라지는 그림자를 보면서 처음의 감동이 실망으로 역전됩니다.' },
  VISION:  { kr:'비전',     fn:'Ni', icon:'🔭',
    oneLiner:'큰 그림을 설계하는 전략가',
    light:'통찰·미래설계·원칙', shadow:'고독한 확신·관계 단절',
    parentingColor:'방향 제시형 양육자',
    caption:'처음엔 확신과 결단력에 이끌렸지만, 연약함을 용납하지 못하는 그림자를 보면서 마음을 닫아버립니다.' },
  STEADY:  { kr:'스테디',   fn:'Si', icon:'🌿',
    oneLiner:'한결같은 신뢰로 공동체를 지키는 사람',
    light:'신뢰·일관성·돌봄', shadow:'자기부정·변화 저항·번아웃',
    parentingColor:'안정 기반형 양육자',
    caption:'처음엔 한결같은 성실함에 의지했지만, 아니오를 말하지 못하다 무너지는 그림자를 보면서 죄책감에 멀어집니다.' },
  PLAYER:  { kr:'플레이어', fn:'Se', icon:'🎯',
    oneLiner:'현장에서 빛나는 즉흥의 달인',
    light:'실행력·현장감·유연성', shadow:'깊이 회피·충동·내면 방치',
    parentingColor:'현장 체험형 양육자',
    caption:'처음엔 발 빠른 실행력에 든든함을 느꼈지만, 충동적으로 움직이다 혼란을 만드는 그림자를 보면서 발을 빼게 됩니다.' },
  HARMONY: { kr:'하모니',   fn:'Fe', icon:'🕊️',
    oneLiner:'사람의 마음을 읽고 공동체를 잇는 사람',
    light:'공감·조화·돌봄', shadow:'자기소멸·경계 붕괴·갈등 회피',
    parentingColor:'공감 연결형 양육자',
    caption:'처음엔 따뜻한 공감에 위로받았지만, 경계를 긋지 못하고 지쳐드는 그림자를 보면서 점차 멀어집니다.' },
  SOUL:    { kr:'소울',     fn:'Fi', icon:'🌊',
    oneLiner:'본질을 파고드는 진정성의 사람',
    light:'깊이·진정성·내면 성실', shadow:'고립·자기 은폐·실행 회피',
    parentingColor:'진정성 깊이형 양육자',
    caption:'처음엔 진정성과 깊이에 갈증을 해소했지만, 고립 속으로 사라지는 그림자를 보면서 쓸쓸함에 떠납니다.' },
  LOGIC:   { kr:'로직',     fn:'Ti', icon:'🔬',
    oneLiner:'논리와 원칙으로 세상을 이해하는 분석가',
    light:'논리·정확·체계', shadow:'감정 억압·완벽주의·연결 회피',
    parentingColor:'체계 논리형 양육자',
    caption:'처음엔 치밀한 논리에 신뢰를 보냈지만, 마음을 논리로만 다루는 그림자를 보면서 아픔을 꺼낼 수 없다고 느낍니다.' },
  LEADER:  { kr:'리더',     fn:'Te', icon:'⚡',
    oneLiner:'방향을 정하고 이끄는 결단의 사람',
    light:'추진력·결단·조직화', shadow:'통제욕·약함 혐오·관계 수단화',
    parentingColor:'목표 추진형 양육자',
    caption:'처음엔 확신과 결단력을 믿고 따랐지만, 연약함을 혐오하는 그림자를 보면서 도구로 전락했다고 느끼며 마음을 닫습니다.' },
}

function getAge(birthYear: number): number {
  return new Date().getFullYear() - birthYear
}

function getDevStage(age: number): string {
  if (age <= 6)  return '유아기 — 애착과 안전감이 핵심인 시기. 놀이와 스킨십으로 관계를 쌓아야 합니다.'
  if (age <= 12) return '아동기 — 자아 개념이 형성되는 시기. 칭찬의 언어와 성공 경험이 중요합니다.'
  if (age <= 18) return '청소년기 — 정체성과 자율성을 추구하는 시기. 지시보다 질문과 경청이 훨씬 효과적입니다.'
  return '성인 자녀 — 동반자적 관계를 재정립하는 시기. 부모 역할에서 멘토 역할로 전환이 필요합니다.'
}

// ── Claude API 호출 ──
async function callClaude(systemPrompt: string, userPrompt: string, apiKey: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1800,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Claude API ${res.status}: ${err}`)
  }
  const data = await res.json()
  return data.content?.[0]?.text?.trim() || ''
}

function parseJSON(raw: string): any {
  try {
    const cleaned = raw.replace(/```json\s*/g,'').replace(/```\s*/g,'').trim()
    return JSON.parse(cleaned)
  } catch {
    return null
  }
}

// ── 메인 리포트 생성 ──
async function generateFamilyReport(members: any[], apiKey: string): Promise<Record<string, any>> {
  const parents  = members.filter(m => m.member_type === 'parent')
  const children = members.filter(m => m.member_type === 'child')
  const result: Record<string, any> = {}

  // 구성원 요약 텍스트
  const memberLines = members.map(m => {
    const td = TYPE_META[m.sg_type] || {}
    const ageStr = m.birth_year ? `만 ${getAge(m.birth_year)}세, ${getDevStage(getAge(m.birth_year))}` : ''
    return `• ${m.name}(${m.role}): ${td.kr||m.sg_type} — 빛:${td.light||''} / 그림자:${td.shadow||''} ${ageStr}`
  }).join('\n')

  const SYSTEM = `당신은 온유스쿨 쉐도우그램 8유형 전문가입니다.

[쉐도우그램 핵심 원리]
1. 빛과 그림자 — 각 유형의 강점(빛)이 과잉되거나 미숙할 때 그림자가 된다
2. 빛→그림자 역전 패턴 — "처음엔 빛에 끌렸지만, 그림자를 보고 갈등한다"
3. 개성화 훈련 — "더 많이"가 아닌 "내려놓음과 균형"으로 성장
4. 8유형: 스파크(Ne)·비전(Ni)·스테디(Si)·플레이어(Se)·하모니(Fe)·소울(Fi)·로직(Ti)·리더(Te)

[작성 원칙]
- 유형 조합의 구체적 역동 서술 (일반론 금지)
- 부모-자녀 실제 갈등 상황을 상상해서 묘사
- 가정에서 내일 바로 쓸 수 있는 구체적 언어 예시 포함
- 판단이 아닌 이해의 언어, 따뜻하지만 날카로운 통찰
- 반드시 JSON만 응답 (설명 텍스트 금지)`

  // ─── 1. 부모 양육 성향 ───
  if (parents.length === 1) {
    const p = parents[0]
    const td = TYPE_META[p.sg_type] || {}
    const childTypes = children.map(c => `${c.name}(${TYPE_META[c.sg_type]?.kr||c.sg_type})`).join(', ')

    const raw1 = await callClaude(SYSTEM, `
[양육자 정보]
${p.name}(${p.role}): ${td.kr} — 빛:${td.light} / 그림자:${td.shadow}
자녀: ${childTypes}

[질문] 이 ${td.kr} 유형 양육자의 구체적 양육 패턴을 분석해주세요.
- 이 유형이 자녀에게 자주 하는 말투/행동 패턴
- 자녀가 느끼는 이 부모의 빛과 그림자
- 이 유형 부모의 자녀와의 관계에서 반복되는 갈등 시나리오
- 내일 당장 실천할 소통 개선 방법 2가지 (구체적 언어 예시 포함)

JSON: {"parentingStyle": "3~4문장 서술", "parentingStrength": "2~3문장", "parentingChallenge": "2~3문장", "parentingTips": ["팁1 (예시 대화 포함)", "팁2 (예시 대화 포함)"]}`, apiKey)

    const parsed1 = parseJSON(raw1)
    if (parsed1) Object.assign(result, parsed1)

  } else if (parents.length >= 2) {
    const p1 = parents[0], p2 = parents[1]
    const t1 = TYPE_META[p1.sg_type] || {}, t2 = TYPE_META[p2.sg_type] || {}
    const childTypes = children.map(c => `${c.name}(${TYPE_META[c.sg_type]?.kr||c.sg_type})`).join(', ')

    const raw1 = await callClaude(SYSTEM, `
[부모 정보]
${p1.name}(${p1.role}): ${t1.kr} — 빛:${t1.light} / 그림자:${t1.shadow}
${p2.name}(${p2.role}): ${t2.kr} — 빛:${t2.light} / 그림자:${t2.shadow}
자녀: ${childTypes}

[질문] 이 두 양육자의 조합이 만들어내는 가족 역동을 분석해주세요.
- ${t1.kr}×${t2.kr} 부부의 양육 시너지 — 어떤 순간에 환상의 팀이 되는가
- 두 유형의 그림자가 충돌할 때 자녀에게 미치는 영향
- 자녀 앞에서 서로 다른 메시지를 줄 때 구체적 시나리오
- 부부가 함께 성장하기 위한 핵심 통찰 1가지

JSON: {"coupleDynamics": "3~4문장 서술", "coupleStrength": "2~3문장", "coupleChallenge": "2~3문장", "parentingStyle": "각 부모의 역할 분담 2~3문장"}`, apiKey)

    const parsed1 = parseJSON(raw1)
    if (parsed1) Object.assign(result, parsed1)
  }

  // ─── 2. 자녀 개별 분석 (childrenDetails 배열) ───
  result.childrenDetails = []
  for (const child of children) {
    const td = TYPE_META[child.sg_type] || {}
    const age = child.birth_year ? getAge(child.birth_year) : null
    const devStage = age ? getDevStage(age) : '나이 정보 없음'
    const parentInfo = parents.map(p => `${p.name}(${TYPE_META[p.sg_type]?.kr||p.sg_type})`).join(', ')

    const raw2 = await callClaude(SYSTEM, `
[자녀 정보]
이름: ${child.name} / 유형: ${td.kr}(${child.sg_type}) / ${age ? age+'세' : ''}
발달 단계: ${devStage}
빛: ${td.light} / 그림자: ${td.shadow}
부모 유형: ${parentInfo}

[질문] 이 ${td.kr} 아이를 부모가 진짜 이해하도록 도와주세요.
- 이 아이가 왜 그렇게 행동하는지 (유형의 주기능으로 설명)
- 이 나이와 발달 단계에서 특히 나타나는 패턴
- 부모가 자주 오해하는 이 아이의 행동 1가지와 진짜 의미
- 효과적인 칭찬 방법 2가지 (실제 사용할 수 있는 문장)
- 이 아이가 힘들어하는 상황 2가지
- 부모가 기억할 실천 팁 2가지

JSON: {
  "name": "${child.name}",
  "communicationStyle": "2~3문장",
  "praiseMethod": ["칭찬 문장 예시1", "칭찬 문장 예시2"],
  "challenges": ["힘든 상황1", "힘든 상황2"],
  "parentTips": ["팁1 (구체적 행동 포함)", "팁2 (구체적 행동 포함)"]
}`, apiKey)

    const parsed2 = parseJSON(raw2)
    if (parsed2) result.childrenDetails.push(parsed2)
  }

  // ─── 3. 부모-자녀 소통 가이드 (parentChildGuides 배열) ───
  result.parentChildGuides = []
  for (const parent of parents) {
    for (const child of children) {
      const pt = TYPE_META[parent.sg_type] || {}
      const ct = TYPE_META[child.sg_type] || {}
      const age = child.birth_year ? getAge(child.birth_year) : null

      const raw3 = await callClaude(SYSTEM, `
[관계 정보]
부모: ${parent.name}(${parent.role}) — ${pt.kr} / 빛:${pt.light} / 그림자:${pt.shadow}
자녀: ${child.name}${age ? `(${age}세)` : ''} — ${ct.kr} / 빛:${ct.light} / 그림자:${ct.shadow}

[질문] ${pt.kr} 부모와 ${ct.kr} 자녀의 관계 역동을 분석해주세요.
- 이 두 유형이 자연스럽게 통하는 순간 (구체적 장면)
- 이 두 유형이 충돌하는 전형적인 상황 (구체적 장면)
- 갈등 상황에서 부모가 쓸 수 있는 실제 대화 스크립트 (한 문장)

JSON: {
  "parentName": "${parent.name}",
  "childName": "${child.name}",
  "synergy": ["시너지1 (구체적 장면)", "시너지2"],
  "conflicts": ["갈등1 (구체적 상황)", "갈등2"],
  "resolutionScript": "갈등 시 쓸 수 있는 실제 대화 문장 (따옴표 없이)"
}`, apiKey)

      const parsed3 = parseJSON(raw3)
      if (parsed3) result.parentChildGuides.push(parsed3)
    }
  }

  // ─── 4. 가족 성장 + 미션 ───
  const raw4 = await callClaude(SYSTEM, `
[가족 구성]
${memberLines}

[질문] 이 가족 전체의 집단적 빛과 그림자, 그리고 성장 방향을 분석해주세요.
- 이 가족이 함께 만들어내는 집단적 강점 3가지
- 이 가족이 반복적으로 겪는 집단적 그림자 패턴 2가지
- 이번 주 가족이 함께 할 수 있는 마이크로 미션 3가지 (10분 내, 집에서 가능)
- 이 가족이 1개월 후 달라질 모습 (구체적 장면 묘사)

JSON: {
  "familyStrengths": ["강점1", "강점2", "강점3"],
  "familyShadows": ["그림자1", "그림자2"],
  "familyMissions": ["미션1", "미션2", "미션3"],
  "monthlyChange": "1개월 후 변화 2~3문장"
}`, apiKey)

  const parsed4 = parseJSON(raw4)
  if (parsed4) Object.assign(result, parsed4)

  // ─── 5. 개인 쉐도우그램 캡션 (individualShadowgrams 배열) ───
  result.individualShadowgrams = []
  for (const member of members) {
    const td = TYPE_META[member.sg_type] || {}

    const raw5 = await callClaude(SYSTEM, `
[구성원 정보]
이름: ${member.name}(${member.role}) / 유형: ${td.kr}
빛: ${td.light} / 그림자: ${td.shadow}
기본 캡션 참고: "${td.caption}"

[질문] 이 분의 개인 쉐도우그램을 작성해주세요.
- 이 유형이 가족 안에서 맡는 자연스러운 역할
- 빛과 그림자 요약 (가족 관계 맥락에서)
- 이 분만을 위한 마이크로 미션 2가지

JSON: {
  "name": "${member.name}",
  "shadowCaption": "이 사람의 빛과 그림자를 담은 한 문장 (시적이고 날카롭게)",
  "lightShadowSummary": "가족 맥락에서의 빛과 그림자 2~3문장",
  "microMissions": ["미션1 (내일 바로 실천 가능)", "미션2"]
}`, apiKey)

    const parsed5 = parseJSON(raw5)
    if (parsed5) result.individualShadowgrams.push(parsed5)
  }

  return result
}

// ── 메인 핸들러 ──
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY')
    if (!ANTHROPIC_KEY) throw new Error('ANTHROPIC_API_KEY 미설정')

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { session_code } = await req.json()
    if (!session_code) throw new Error('session_code 필요')

    // 구성원 조회
    const { data: members, error: membersErr } = await supabase
      .from('family_members')
      .select('*')
      .eq('session_code', session_code)
      .order('created_at')

    if (membersErr || !members?.length) throw new Error('구성원 조회 실패')

    // 완료된 구성원만 사용
    const completed = members.filter((m: any) => m.completed_at && m.sg_type)
    if (!completed.length) throw new Error('완료된 구성원 없음')

    // AI 리포트 생성
    const aiData = await generateFamilyReport(completed, ANTHROPIC_KEY)

    // 세션 상태 업데이트
    await supabase
      .from('family_sessions')
      .update({ status: 'reported' })
      .eq('code', session_code)

    return new Response(
      JSON.stringify({ ok: true, aiData }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } }
    )

  } catch(e: any) {
    console.error('generate-parenting-report error:', e)
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  }
})
