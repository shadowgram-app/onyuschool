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

[절대 규칙 — 반드시 지킬 것]
- 모든 문장에서 "이 부모", "한 부모", "다른 부모", "이 아이", "이 유형" 같은 익명 표현 절대 금지
- 반드시 실제 이름을 사용하여 서술 (예: "민철님의 스파크 기질이", "은율이가 힘들어하는 상황은")
- "부모의 창의성"이 아니라 "민철님의 창의성", "자녀의 안정감"이 아니라 "은율이의 안정감"처럼 구체적으로
- 일반론·뻔한 표현 절대 금지 (예: "서로를 이해하는 것이 중요합니다" 같은 표현 금지)
- 실제 가정에서 일어날 법한 구체적 장면 묘사 필수
- 바로 쓸 수 있는 실제 대화 문장 예시 포함
- 반드시 JSON만 응답 (설명 텍스트 절대 금지)`

  // ─── 1. 부모 양육 성향 ───
  if (parents.length === 1) {
    const p = parents[0]
    const td = TYPE_META[p.sg_type] || {}
    const childTypes = children.map(c => `${c.name}(${TYPE_META[c.sg_type]?.kr||c.sg_type})`).join(', ')

    const raw1 = await callClaude(SYSTEM, `
[양육자 정보]
이름: ${p.name} / 역할: ${p.role} / 유형: ${td.kr}
빛: ${td.light} / 그림자: ${td.shadow}
자녀: ${childTypes}

⚠️ 모든 문장에서 반드시 "${p.name}"이라는 이름을 사용하세요. "이 부모", "이 유형" 절대 금지.

${p.name}님의 ${td.kr} 기질이 양육에서 어떻게 드러나는지 분석:
- ${p.name}님이 자녀에게 자주 하는 말투·행동 (실제 장면 묘사)
- ${p.name}님의 빛이 자녀에게 어떻게 전달되는가 (구체적 순간)
- ${p.name}님의 그림자가 자녀와의 관계에서 반복되는 갈등 패턴
- ${p.name}님이 내일 바로 실천할 소통 방법 2가지 (실제 대화 문장 포함)

JSON: {"parentingStyle":"${p.name}님 이름 포함 3~4문장","parentingStrength":"${p.name}님 이름 포함 2~3문장","parentingChallenge":"${p.name}님 이름 포함 2~3문장","parentingTips":["${p.name}님 팁1 (대화예시포함)","${p.name}님 팁2 (대화예시포함)"]}`, apiKey)

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

⚠️ 모든 문장에서 반드시 "${p1.name}", "${p2.name}" 이름을 명시하세요. "한 부모", "다른 부모", "이 유형" 절대 금지.

${p1.name}님(${t1.kr})과 ${p2.name}님(${t2.kr})의 부부 양육 역동 분석:
- ${p1.name}님의 ${t1.light}와 ${p2.name}님의 ${t2.light}가 만나 시너지를 내는 구체적 장면
- ${p1.name}님의 그림자(${t1.shadow})와 ${p2.name}님의 그림자(${t2.shadow})가 충돌할 때 자녀에게 미치는 영향
- ${p1.name}님과 ${p2.name}님이 자녀 앞에서 엇갈린 메시지를 줄 때의 실제 시나리오
- 두 분이 함께 성장하기 위한 핵심 통찰 1가지 (이름 명시)

JSON: {
  "coupleDynamics": "${p1.name}님과 ${p2.name}님 이름 포함 3~4문장",
  "coupleStrength": "이름 포함 2~3문장 (시너지 장면)",
  "coupleChallenge": "이름 포함 2~3문장 (충돌 패턴)",
  "parentingStyle": "${p1.name}님 역할 + ${p2.name}님 역할 각각 명시 2~3문장"
}`, apiKey)

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
이름: ${child.name} / 유형: ${td.kr} / ${age ? age+'세' : ''}
발달 단계: ${devStage}
빛: ${td.light} / 그림자: ${td.shadow}
부모: ${parentInfo}

⚠️ 모든 문장에서 반드시 "${child.name}"이라는 이름을 사용하세요. "이 아이", "이 유형의 아이" 절대 금지.
⚠️ ${td.kr} 유형의 구체적 특성(${td.light}, ${td.shadow})을 반드시 내용에 녹여내세요. 유형과 무관한 일반론 금지.

${child.name}의 ${td.kr} 기질 이해:
- ${child.name}가 왜 그런 행동을 하는지 — ${td.kr}의 주기능(${td.light})으로 설명 (구체적 장면)
- ${age ? age+'세' : ''} ${devStage.split('—')[0]}에서 ${td.kr} 기질이 어떻게 드러나는가
- ${child.name}의 행동 중 부모가 가장 자주 오해하는 것 1가지 + ${td.kr} 관점에서의 진짜 의미
- ${child.name}에게 효과적인 칭찬 방법 2가지 — ${td.kr} 유형에 맞는 실제 문장
- ${child.name}가 특히 힘들어하는 상황 2가지 — ${td.shadow}와 연결해서
- ${parentInfo}가 ${child.name}와 소통할 때 기억할 실천 팁 2가지

JSON: {
  "name": "${child.name}",
  "communicationStyle": "${child.name} 이름 포함, ${td.kr} 특성 반영 2~3문장",
  "praiseMethod": ["${child.name}에게 바로 쓸 수 있는 칭찬 문장1", "칭찬 문장2"],
  "challenges": ["${child.name}가 힘들어하는 구체적 상황1", "상황2"],
  "parentTips": ["${child.name}와 소통 팁1 (구체적 행동+문장)", "팁2"]
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

⚠️ 반드시 "${parent.name}"과 "${child.name}" 이름을 모든 문장에 명시하세요. "부모", "자녀" 같은 익명 표현 절대 금지.
⚠️ ${pt.kr}의 특성(${pt.light}/${pt.shadow})과 ${ct.kr}의 특성(${ct.light}/${ct.shadow})이 만나는 구체적 역동을 서술하세요. 유형과 무관한 일반론 절대 금지.

${parent.name}(${pt.kr})과 ${child.name}(${ct.kr})의 관계 역동:

[시너지] ${parent.name}의 ${pt.light}와 ${child.name}의 ${ct.light}가 자연스럽게 맞닿는 순간 2가지
→ 각각 집에서 일어날 법한 구체적 장면으로 묘사

[갈등] ${parent.name}의 ${pt.shadow}와 ${child.name}의 ${ct.shadow}가 부딪히는 전형적 상황 2가지
→ 각각 "저녁 식사 중", "숙제 시간에" 같은 실제 가정 상황으로 묘사

[해결 스크립트] 갈등이 생겼을 때 ${parent.name}가 ${child.name}에게 실제로 말할 수 있는 한 문장
→ ${pt.kr} 특성을 살리되 ${ct.kr}의 마음을 열 수 있는 말

JSON: {
  "parentName": "${parent.name}",
  "childName": "${child.name}",
  "synergy": ["${parent.name}와 ${child.name} 이름 포함 시너지 장면1", "시너지 장면2"],
  "conflicts": ["${parent.name}와 ${child.name} 이름 포함 갈등 상황1", "갈등 상황2"],
  "resolutionScript": "${parent.name}가 ${child.name}에게 실제로 하는 대화 문장"
}`, apiKey)

      const parsed3 = parseJSON(raw3)
      if (parsed3) result.parentChildGuides.push(parsed3)
    }
  }

  // ─── 4. 가족 성장 + 미션 ───
  const familyNames = members.map(m => m.name).join(', ')
  const raw4 = await callClaude(SYSTEM, `
[가족 구성]
${memberLines}

⚠️ 강점·그림자·미션 모두 가족 구성원 이름(${familyNames})을 명시하세요. "이 가족", "가족 구성원" 같은 익명 표현 절대 금지.
⚠️ 각 유형의 구체적 특성에서 도출된 내용이어야 합니다. 일반론("서로 이해하는 것이 중요") 절대 금지.

이 가족의 유형 조합이 만들어내는 집단 역동:

[강점 3가지] 각 구성원 이름과 유형 특성이 어우러져 만들어내는 이 가족만의 강점
→ 예: "${familyNames.split(',')[0]}님의 ~과 ~의 ~이 만나 ~한다"

[집단적 그림자 2가지] 이 유형 조합에서 반복적으로 나타나는 갈등 패턴
→ 특정 구성원 이름을 언급하며 실제 가정 상황으로 묘사

[마이크로 미션 3가지] 각 미션에 특정 구성원 이름 포함, 10분 내 집에서 실천 가능
→ 예: "${familyNames.split(',')[0]}님이 ~에게 ~ 해보기"

[1개월 후] 이 가족이 미션을 실천했을 때의 구체적 변화 장면 (이름 명시)

JSON: {
  "familyStrengths": ["이름 포함 강점1", "이름 포함 강점2", "이름 포함 강점3"],
  "familyShadows": ["이름 포함 그림자 패턴1", "이름 포함 그림자 패턴2"],
  "familyMissions": ["이름 포함 미션1", "이름 포함 미션2", "이름 포함 미션3"],
  "monthlyChange": "이름 포함 1개월 후 변화 장면 2~3문장"
}`, apiKey)

  const parsed4 = parseJSON(raw4)
  if (parsed4) Object.assign(result, parsed4)

  // ─── 5. 개인 쉐도우그램 캡션 (individualShadowgrams 배열) ───
  result.individualShadowgrams = []
  for (const member of members) {
    const td = TYPE_META[member.sg_type] || {}

    const otherNames = members.filter(m => m.name !== member.name).map(m => `${m.name}(${TYPE_META[m.sg_type]?.kr||m.sg_type})`).join(', ')
    const raw5 = await callClaude(SYSTEM, `
[구성원 정보]
이름: ${member.name}(${member.role}) / 유형: ${td.kr}
빛: ${td.light} / 그림자: ${td.shadow}
캡션 참고: "${td.caption}"
가족 내 다른 구성원: ${otherNames}

⚠️ 반드시 "${member.name}"이라는 이름을 모든 문장에 사용하세요. "이 분", "이 유형" 절대 금지.
⚠️ ${td.kr}의 구체적 특성(빛:${td.light} / 그림자:${td.shadow})을 반드시 내용에 녹여내세요.

${member.name}(${td.kr})의 개인 쉐도우그램:

[캡션] ${member.name}의 빛(${td.light})과 그림자(${td.shadow})를 담은 시적이고 날카로운 한 문장
→ 참고 캡션보다 더 ${member.name}의 가족 맥락에 맞게

[빛과 그림자 요약] ${member.name}가 가족 안에서 빛날 때와 그림자가 드러날 때의 구체적 모습
→ ${otherNames}와의 관계 맥락에서 서술

[마이크로 미션 2가지] ${member.name}가 내일 바로 실천할 수 있는 개인 미션
→ ${td.kr}의 그림자를 인식하고 개성화 방향으로 나아가는 행동

JSON: {
  "name": "${member.name}",
  "shadowCaption": "${member.name} 이름 포함 시적 한 문장",
  "lightShadowSummary": "${member.name} 이름 포함, 가족 맥락 2~3문장",
  "microMissions": ["${member.name}의 내일 실천 미션1 (구체적 행동)", "미션2"]
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
