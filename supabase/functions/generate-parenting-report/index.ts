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
      model: 'claude-sonnet-4-6',
      max_tokens: 900,
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

// ── 프롬프트 빌더들 (병렬 호출을 위해 분리) ──
function buildParentPrompt(parents: any[], children: any[], SYSTEM: string, apiKey: string): Promise<any> {
  const childTypes = children.map((c: any) => `${c.name}(${TYPE_META[c.sg_type]?.kr||c.sg_type})`).join(', ')

  if (parents.length === 1) {
    const p = parents[0]; const td = TYPE_META[p.sg_type] || {}
    return callClaude(SYSTEM, `
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
  }

  const p1 = parents[0], p2 = parents[1]
  const t1 = TYPE_META[p1.sg_type] || {}, t2 = TYPE_META[p2.sg_type] || {}
  return callClaude(SYSTEM, `
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
}

function buildChildPrompt(child: any, parents: any[], SYSTEM: string, apiKey: string): Promise<string> {
  const td = TYPE_META[child.sg_type] || {}
  const age = child.birth_year ? getAge(child.birth_year) : null
  const devStage = age ? getDevStage(age) : '나이 정보 없음'
  const parentInfo = parents.map((p: any) => `${p.name}(${TYPE_META[p.sg_type]?.kr||p.sg_type})`).join(', ')
  return callClaude(SYSTEM, `
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
}

function buildGuidePrompt(parent: any, child: any, SYSTEM: string, apiKey: string): Promise<string> {
  const pt = TYPE_META[parent.sg_type] || {}
  const ct = TYPE_META[child.sg_type] || {}
  const age = child.birth_year ? getAge(child.birth_year) : null
  return callClaude(SYSTEM, `
[관계 정보]
부모: ${parent.name}(${parent.role}) — ${pt.kr} / 빛:${pt.light} / 그림자:${pt.shadow}
자녀: ${child.name}${age ? `(${age}세)` : ''} — ${ct.kr} / 빛:${ct.light} / 그림자:${ct.shadow}

⚠️ 반드시 "${parent.name}"과 "${child.name}" 이름을 모든 문장에 명시하세요. "부모", "자녀" 같은 익명 표현 절대 금지.
⚠️ ${pt.kr}의 특성(${pt.light}/${pt.shadow})과 ${ct.kr}의 특성(${ct.light}/${ct.shadow})이 만나는 구체적 역동을 서술하세요.

${parent.name}(${pt.kr})과 ${child.name}(${ct.kr})의 관계 역동:
[시너지] ${parent.name}의 ${pt.light}와 ${child.name}의 ${ct.light}가 맞닿는 순간 2가지 (집에서 일어날 법한 구체적 장면)
[갈등] ${parent.name}의 ${pt.shadow}와 ${child.name}의 ${ct.shadow}가 부딪히는 상황 2가지 (실제 가정 상황)
[해결] 갈등 시 ${parent.name}가 ${child.name}에게 말할 수 있는 실제 한 문장

JSON: {
  "parentName": "${parent.name}",
  "childName": "${child.name}",
  "synergy": ["${parent.name}와 ${child.name} 시너지 장면1", "시너지 장면2"],
  "conflicts": ["${parent.name}와 ${child.name} 갈등 상황1", "갈등 상황2"],
  "resolutionScript": "${parent.name}가 ${child.name}에게 하는 실제 대화 문장"
}`, apiKey)
}

function buildMemberPrompt(member: any, members: any[], SYSTEM: string, apiKey: string): Promise<string> {
  const td = TYPE_META[member.sg_type] || {}
  const otherNames = members.filter((m: any) => m.name !== member.name).map((m: any) => `${m.name}(${TYPE_META[m.sg_type]?.kr||m.sg_type})`).join(', ')
  return callClaude(SYSTEM, `
[구성원 정보]
이름: ${member.name}(${member.role}) / 유형: ${td.kr}
빛: ${td.light} / 그림자: ${td.shadow}
캡션 참고: "${td.caption||''}"
가족 내 다른 구성원: ${otherNames}

⚠️ 반드시 "${member.name}"이라는 이름을 모든 문장에 사용하세요. "이 분", "이 유형" 절대 금지.
⚠️ ${td.kr}의 구체적 특성(빛:${td.light} / 그림자:${td.shadow})을 반드시 내용에 녹여내세요.

${member.name}(${td.kr})의 개인 쉐도우그램:
[캡션] ${member.name}의 빛(${td.light})과 그림자(${td.shadow})를 담은 시적이고 날카로운 한 문장
[빛과 그림자] ${member.name}가 ${otherNames}와의 관계에서 빛날 때와 그림자가 드러날 때
[미션] ${member.name}가 내일 바로 실천할 개인 미션 2가지

JSON: {
  "name": "${member.name}",
  "shadowCaption": "${member.name} 이름 포함 시적 한 문장",
  "lightShadowSummary": "${member.name} 이름 포함, 가족 맥락 2~3문장",
  "microMissions": ["${member.name}의 내일 실천 미션1 (구체적 행동)", "미션2"]
}`, apiKey)
}

// ── DB에서 유형 조합 데이터 로드 ──
async function loadTypeCombinations(supabase: any, types: string[]): Promise<string> {
  try {
    const pairs: string[] = []
    const checked = new Set<string>()
    for (let i = 0; i < types.length; i++) {
      for (let j = i; j < types.length; j++) {
        const key = [types[i], types[j]].sort().join('_')
        if (!checked.has(key)) {
          checked.add(key)
          pairs.push(`(type1.eq.${types[i]},type2.eq.${types[j]})`)
          if (types[i] !== types[j]) pairs.push(`(type1.eq.${types[j]},type2.eq.${types[i]})`)
        }
      }
    }
    const { data } = await supabase
      .from('sg_type_combinations')
      .select('type1,type2,attraction,conflict,superpower,growth')
      .in('type1', types)

    if (!data || data.length === 0) return ''

    return data.map((r: any) =>
      `[${r.type1}×${r.type2}] 끌림: ${r.attraction?.substring(0,150)||''} | 갈등: ${r.conflict?.substring(0,200)||''} | 슈퍼파워: ${r.superpower?.substring(0,120)||''}`
    ).join('\n')
  } catch(e) {
    return ''
  }
}

// ── 메인 리포트 생성 (모든 API 호출 병렬화) ──
async function generateFamilyReport(members: any[], apiKey: string, supabase: any): Promise<Record<string, any>> {
  const parents  = members.filter(m => m.member_type === 'parent')
  const children = members.filter(m => m.member_type === 'child')
  const result: Record<string, any> = {}

  // 구성원 요약 텍스트
  const memberLines = members.map(m => {
    const td = TYPE_META[m.sg_type] || {}
    const ageStr = m.birth_year ? `만 ${getAge(m.birth_year)}세, ${getDevStage(getAge(m.birth_year))}` : ''
    return `• ${m.name}(${m.role}): ${td.kr||m.sg_type} — 빛:${td.light||''} / 그림자:${td.shadow||''} ${ageStr}`
  }).join('\n')

  // DB에서 이 가족의 유형 조합 데이터 로드
  const memberTypes = [...new Set(members.map(m => m.sg_type))]
  const combinationData = await loadTypeCombinations(supabase, memberTypes)

  const SYSTEM = `당신은 온유스쿨 쉐도우그램 8유형 전문가입니다. 아래의 쉐도우그램 고유 지식을 반드시 활용하여 분석하세요.

[쉐도우그램 핵심 원리]
- 각 유형은 주기능(빛)과 열등기능(그림자)의 2축 긴장으로 작동한다
- 행동 패턴은 의지력 문제가 아니라 심리 구조의 자연스러운 발현이다
- 개성화: "더 많이"가 아니라 열등기능을 통합하는 "내려놓음과 균형"으로 성장
- 빛이 강할수록 그림자도 깊어진다

[8유형 고유 심리 구조]

SPARK (Ne↔Si):
- 빛: 새로운 가능성 발견, 영감 전파, 열정으로 분위기 전환
- 반복 패턴: 에너지 소진 후 갑자기 냉랭, 시작은 강렬하지만 마무리가 약함
- 양육 그림자: 약속을 자주 바꾸거나 흥분했다가 식어버려 자녀가 일관성을 기대 못함
- 개성화: 하나를 끝내는 경험, "지쳤어"라고 말하는 연습

VISION (Ni↔Se):
- 빛: 큰 그림 설계, 미래 통찰, 높은 원칙과 기준
- 반복 패턴: 완벽한 계획을 기다리다 실행 미룸, 높은 기준이 자녀에게 압박
- 양육 그림자: 감정보다 논리를 앞세워 자녀가 마음을 꺼내지 못함
- 개성화: 자녀 감정 먼저 묻기, "완벽하지 않아도 시작" 연습

STEADY (Si↔Ne):
- 빛: 약속 이행, 한결같은 돌봄, 신뢰의 닻
- 반복 패턴: 아니오를 못 해서 혼자 감당하다 번아웃, 변화에 과도한 불안
- 양육 그림자: 루틴 붕괴 시 불안 전달, 자녀의 새 도전을 무의식적으로 막음
- 개성화: 작은 변화 체험, "싫어요" 한 번 말하기

PLAYER (Se↔Ni):
- 빛: 현장 즉각 반응, 유연한 적응력, 지금 이 순간의 활력
- 반복 패턴: 충동적 결정 후 후회, 계획 자주 바뀌어 가족이 불안
- 양육 그림자: 감정 대화 회피, 장기 일관성 부족으로 자녀가 "내일 어떻게 될지 모름"
- 개성화: 저녁에 내일 계획 5분 이야기, 감정을 말로 표현하는 연습

HARMONY (Fe↔Ti):
- 빛: 감정 정확히 읽기, 갈등 중재, 따뜻한 분위기 조성
- 반복 패턴: 갈등 회피 → 쌓인 감정이 한꺼번에 터짐, 경계를 못 그어 지침
- 양육 그림자: 자기 소실(타인을 맞추다 내가 사라짐), 자녀의 감정에 과몰입
- 개성화: "나 오늘 힘들어"라고 먼저 말하기, 불편한 진실을 부드럽게 말하기

SOUL (Fi↔Te):
- 빛: 깊은 공명, 진정성, 내면 가치 지킴, 진짜 대화 이끌기
- 반복 패턴: 이해받지 못한다는 느낌 → 내면으로 고립, 힘들 때 혼자 삭임
- 양육 그림자: 감정 과부하로 자녀 앞에서 갑자기 위축, 실행력 부족으로 약속 미이행
- 개성화: 힘든 것 한 마디라도 말하기, 작은 행동 하나 즉시 실행

LOGIC (Ti↔Fe):
- 빛: 치밀한 분석, 논리적 설명, 원칙 일관성
- 반복 패턴: 오류 즉각 지적 → 상대가 공격받은 느낌, 감정 연결 어려움
- 양육 그림자: 자녀 감정을 논리로 해결하려 함 → 자녀가 "말해봤자 이유만 들어"
- 개성화: "그렇구나, 힘들었겠다"만 먼저 말하기, 감정 질문 1개씩

LEADER (Te↔Fi):
- 빛: 빠른 결단, 효율적 조직화, 명확한 방향 제시
- 반복 패턴: 결과를 위해 관계 도구화, 가족이 상처받는데 인지 못함
- 양육 그림자: 자녀를 목표 달성 수단으로 보는 패턴, 약함 못 참아 자녀 위축
- 개성화: 결정 전 "어떻게 생각해?" 먼저 묻기, 자녀의 약함 인정해주기

[이 가족의 유형 조합 데이터 — 반드시 참고]
${combinationData || '(조합 데이터 없음 — 위 유형별 패턴에서 추론)'}

[절대 규칙]
- 이름 명시 필수: "이 부모/이 아이/한 부모" 금지, 실제 이름 사용
- 위의 유형별 고유 패턴 + 조합 데이터를 반드시 서술에 녹여낼 것 (일반론 금지)
- 실제 가정 장면 묘사 + 바로 쓸 수 있는 대화 문장 포함
- JSON만 응답 (설명 텍스트 금지)`

  // ══════════════════════════════════════════════════════════════
  // 모든 Claude API 호출을 Promise.all로 병렬 실행 → 타임아웃 방지
  // 4인 가족 기준: 부모1 + 자녀2 + 가이드4 + 가족1 + 개인4 = 최대 12개 동시 → ~30~40초
  // ══════════════════════════════════════════════════════════════
  const familyNames = members.map(m => m.name).join(', ')

  // 가족 성장 프롬프트 빌드
  const growthPromise = callClaude(SYSTEM, `
[가족 구성]
${memberLines}

⚠️ 강점·그림자·미션 모두 가족 구성원 이름(${familyNames})을 명시하세요. "이 가족", "가족 구성원" 같은 익명 표현 절대 금지.
⚠️ 각 유형의 구체적 특성에서 도출된 내용이어야 합니다. 일반론 절대 금지.

이 가족의 유형 조합이 만들어내는 집단 역동:
[강점 3가지] 구성원 이름과 유형 특성이 어우러져 만들어내는 이 가족만의 강점 (이름 포함)
[그림자 2가지] 반복적으로 나타나는 갈등 패턴 (이름 포함, 실제 가정 상황 묘사)
[마이크로 미션 3가지] 특정 구성원 이름 포함, 10분 내 실천 가능
[1개월 후] 미션을 실천했을 때의 구체적 변화 장면 (이름 명시)

JSON: {
  "familyStrengths": ["이름 포함 강점1", "이름 포함 강점2", "이름 포함 강점3"],
  "familyShadows": ["이름 포함 그림자 패턴1", "이름 포함 그림자 패턴2"],
  "familyMissions": ["이름 포함 미션1", "이름 포함 미션2", "이름 포함 미션3"],
  "monthlyChange": "이름 포함 1개월 후 변화 장면 2~3문장"
}`, apiKey)

  // ── 병렬 실행: 부모양육 + 자녀분석 + 가족성장 + 개인캡션 (4인 가족 최대 8개)
  // 부모-자녀 가이드는 HTML 섹션 삭제됨 → API 호출 제거
  const [
    parentRaw,
    ...parallelResults
  ] = await Promise.all([
    parents.length > 0 ? buildParentPrompt(parents, children, SYSTEM, apiKey) : Promise.resolve('{}'),
    ...children.map(c => buildChildPrompt(c, parents, SYSTEM, apiKey)),
    growthPromise,
    ...members.map(m => buildMemberPrompt(m, members, SYSTEM, apiKey)),
  ])

  // 결과 분배
  const parentParsed = parseJSON(typeof parentRaw === 'string' ? parentRaw : JSON.stringify(parentRaw))
  if (parentParsed) Object.assign(result, parentParsed)

  let idx = 0
  result.childrenDetails = children.map(() => parseJSON(parallelResults[idx++])).filter(Boolean)
  result.parentChildGuides = [] // 섹션 삭제됨

  const growthParsed = parseJSON(parallelResults[idx++])
  if (growthParsed) Object.assign(result, growthParsed)

  result.individualShadowgrams = members.map(() => parseJSON(parallelResults[idx++])).filter(Boolean)

  return result
}

// ── 더 이상 사용되지 않는 순차 코드 제거 — 아래는 구버전 잔여 코드 제거용 더미 ──
function _unused_sequential_placeholder() {
  // 이 함수는 호출되지 않음. 아래 return result 를 위한 구조적 닫기.
  const result: any = {}
  // ─── (구버전 순차 코드 제거됨) ───
  // 개인 쉐도우그램 캡션 — 이제 병렬 처리됨 (위 Promise.all 참고)
  // 아래는 컴파일러를 위한 더미 코드
  const members: any[] = []
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
    const aiData = await generateFamilyReport(completed, ANTHROPIC_KEY, supabase)

    // 세션 상태 + aiData 저장 (1회만 생성, 이후 DB에서 로드)
    await supabase
      .from('family_sessions')
      .update({ status: 'reported', report_data: aiData })
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
