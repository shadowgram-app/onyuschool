/**
 * report-engine.js
 * 온유스쿨 쉐도우그램 팀빌딩 리포트 생성 엔진
 *
 * 구조:
 *   1. RULE_ENGINE  — 팀 조합 분석 + 뼈대 JSON 생성 (룰 기반, 즉시 실행)
 *   2. AI_ENGINE    — Claude API로 서술 텍스트 생성 (하이브리드)
 *   3. generateTeamReport(results, wsData, apiKey)  — 메인 진입점
 */

// ══════════════════════════════════════════════
//  1. 정본 데이터 (type-data.md 기반)
// ══════════════════════════════════════════════

const TYPE_MASTER = {
  SPARK: {
    fn: 'Ne', icon: '✨', kr: '스파크',
    keywords: ['열정', '영감', '비전', '감화'],
    oneLiner: '감동으로 사람을 움직이는 사람. 한 마디로 분위기가 바뀌고, 가능성을 보게 합니다.',
    strengths: [
      '영감을 주는 말 — 사람의 마음을 건드리고 새로운 가능성을 보게 함',
      '관계의 깊이 — 상대의 잠재력을 발견하고 진심으로 격려하는 능력',
      '창의적 아이디어 — 새로운 사역 방식, 프로그램 기획에 탁월함',
      '비전 제시 — 공동체가 나아갈 방향을 생생하게 그려줌',
    ],
    shadows: [
      '실행 후의 공백 — 시작은 강하지만 유지·마무리가 약한 패턴',
      '감정 소진 — 많이 주다 갑자기 에너지가 바닥나는 경험',
      '집중력 분산 — 너무 많은 일에 관심이 분산되어 깊이가 옅어지는 위험',
    ],
    light: '영감과 열정',
    shadow: '소진과 인정 갈망',
    cowork: ['STEADY', 'LOGIC'],
    caption: '성도들은 처음엔 당신의 뜨거운 열정과 영감이라는 빛에 이끌려 모여듭니다. 그러나 당신이 에너지가 소진된 채 약속을 마무리 짓지 못하고 홀연히 사라지는 그림자를 보면서, 처음의 감동이 실망과 배신감으로 역전되어 공동체를 떠납니다.',
    growth: '스파크 유형의 성장은 빛의 절제에 있습니다. 모든 열정이 다 태워지기 전에 멈추는 법, 혼자 감당하지 않는 구조를 만드는 것이 개성화의 핵심입니다.',
    missions: [
      '감정이 격해지는 순간 타이머 24시간을 설정하고, 그 전에는 중요한 메시지·결정 보류하기',
      '이번 주 시작한 프로젝트 1개의 완료 기준을 문장 하나로 적고 동역자와 공유하기',
    ],
  },
  VISION: {
    fn: 'Ni', icon: '🔭', kr: '비전',
    keywords: ['통찰', '미래', '구조', '개념'],
    oneLiner: '큰 그림을 그리는 사람. 지금 보이지 않는 것을 보고, 10년 후를 설계합니다.',
    strengths: [
      '전략적 사고 — 교회의 중장기 비전과 구조를 설계하는 능력',
      '통찰력 — 문제의 본질을 꿰뚫어 보고 핵심을 짚는 설교와 상담',
      '높은 기준 — 타협하지 않는 원칙으로 공동체를 이끌어가는 리더십',
      '독립적 판단 — 외부의 압력에 흔들리지 않는 결단력',
    ],
    shadows: [
      '관계적 거리감 — 높은 기준이 성도들에게 차갑게 느껴지는 상황',
      '피드백 수용의 어려움 — 자신의 판단에 대한 도전을 위협으로 받아들이는 경향',
      '세부 실행의 간과 — 큰 그림에 집중하다 현장의 작은 필요를 놓치는 경우',
    ],
    light: '통찰과 전략',
    shadow: '고독한 확신과 관계 단절',
    cowork: ['HARMONY'],
    caption: '성도들은 처음엔 당신의 확신과 결단력이라는 빛을 믿고 따릅니다. 그러나 당신이 타인의 연약함을 용납하지 못하며 자신처럼 몰아붙이는 그림자를 보면서, 자신이 사역의 도구로 전락했다고 느끼며 마음을 굳게 닫아버립니다.',
    growth: '비전 유형의 성장은 통제의 내려놓음에 있습니다. 완벽한 구조보다 불완전한 사람과 함께 걷는 법을 배우는 것이 개성화의 핵심입니다.',
    missions: [
      '회의 중 반대 의견이 나왔을 때 즉각 방어 대신 "분석해보겠습니다"라고만 말하고 24시간 뒤 응답하기',
      '이번 주 팀원 1명에게 업무 지시가 아닌 안부 묻는 대화 5분 먼저 시작해보기',
    ],
  },
  STEADY: {
    fn: 'Si', icon: '🌿', kr: '스테디',
    keywords: ['안정', '신뢰', '꾸준함', '성실'],
    oneLiner: '한결같은 신뢰로 공동체를 지키는 사람. 말보다 행동으로, 선언보다 일관성으로.',
    strengths: [
      '약속을 지키는 신뢰감 — "저 사람은 믿을 수 있다"는 느낌을 주는 능력',
      '디테일한 돌봄 — 이름, 생일, 어려움을 오래 기억하는 목양',
      '오래 버티는 힘 — 단기 성과보다 장기 관계를 쌓는 사역',
      '안정적인 분위기 조성 — 공동체가 편안한 공간으로 느껴지게 함',
    ],
    shadows: [
      '변화에 대한 저항 — 새로운 시도보다 기존 방식을 고수하는 경향',
      '자기 의견 표현의 어려움 — 갈등을 피하다 소통이 막히는 상황',
      '번아웃의 은밀함 — 묵묵히 감당하다 갑자기 소진되는 패턴',
    ],
    light: '신뢰와 일관성',
    shadow: '자기 부정과 과도한 희생',
    cowork: ['LOGIC', 'LEADER'],
    caption: '성도들은 처음엔 당신의 한결같은 성실함이라는 빛에 마음 놓고 의지합니다. 그러나 당신이 아니오를 말하지 못한 채 모든 부탁을 감당하다 한계에 부딪쳐 무너지는 그림자를 보면서, 오히려 당신에게 너무 무거운 짐을 지웠다는 죄책감에 멀어집니다.',
    growth: '스테디 유형의 성장은 더 많이 하는 것이 아니라 경계를 긋는 용기에서 시작됩니다. 나를 소진시키는 섬김과 나를 살리는 섬김을 구분하는 것이 개성화의 핵심입니다.',
    missions: [
      '이번 주 들어온 섬김 요청 중 정중히 거절해야 할 것 1개를 Not-To-Do 리스트에 적기',
      '오늘 감사 표현을 받을 때 아니에요 대신 감사합니다로만 대답해보기',
    ],
  },
  PLAYER: {
    fn: 'Se', icon: '🎯', kr: '플레이어',
    keywords: ['실행', '현장', '즉흥', '적응'],
    oneLiner: '현장에서 빛나는 사람. 이론보다 실제, 계획보다 지금 이 순간에 강합니다.',
    strengths: [
      '현장 감각 — 성도의 실제 필요를 빠르게 파악하고 즉각 행동',
      '위기 대응력 — 예상치 못한 상황에서도 당황하지 않고 해결책을 찾음',
      '실용적 돌봄 — 말보다 행동으로 섬기는 목양 (이사 도움, 병원 동행 등)',
      '유연성 — 상황에 맞게 방식을 빠르게 바꾸는 적응력',
    ],
    shadows: [
      '장기 계획의 어려움 — 큰 그림보다 눈앞의 일에 집중하는 경향',
      '감정 표현의 불편함 — 깊은 감정을 다루는 대화에서 거리를 두려는 경향',
      '규칙·형식과의 충돌 — 정해진 절차나 반복적인 의식에서 에너지가 떨어짐',
    ],
    light: '실행력과 현장감',
    shadow: '깊이 회피와 내면 방치',
    cowork: ['VISION'],
    caption: '성도들은 처음엔 당신의 발 빠른 실행력과 현장감이라는 빛에 든든함을 느낍니다. 그러나 당신이 불안을 행동으로 덮으며 충동적으로 움직이다 수습이 안 되는 혼란을 만드는 그림자를 보면서, 믿고 따르는 것이 오히려 위험하다는 생각에 발을 빼게 됩니다.',
    growth: '플레이어 유형의 성장은 멈추는 연습에 있습니다. 행동 이전의 내면, 감정의 언어를 배우는 것이 개성화의 핵심입니다.',
    missions: [
      '돌발 상황에서 즉각 개입하기 전에 타이머 5분을 맞추고 내 감정 상태만 관찰하기',
      '이번 주 안에 3개월 후 이루고 싶은 것 한 문장을 적고 신뢰할 수 있는 동역자에게 보내기',
    ],
  },
  HARMONY: {
    fn: 'Fe', icon: '🕊️', kr: '하모니',
    keywords: ['공감', '조화', '돌봄', '연결'],
    oneLiner: '사람의 마음을 읽고 공동체를 하나로 잇는 사람. 갈등 속에서 다리를 놓습니다.',
    strengths: [
      '공감 능력 — 성도의 감정을 정확하게 읽고 언어화하는 능력',
      '관계 회복 — 갈등하는 두 사람 사이에서 연결고리를 찾아내는 중재 능력',
      '공동체 정서 관리 — 예배와 모임의 분위기를 따뜻하게 만드는 능력',
      '개인 목양 — 한 사람 한 사람에게 진심으로 집중하는 섬세한 돌봄',
    ],
    shadows: [
      '경계 설정의 어려움 — 모든 사람을 기쁘게 하려다 자신을 잃는 패턴',
      '갈등 회피 — 평화를 유지하기 위해 필요한 직면을 미루는 경향',
      '감정 흡수 — 성도의 고통을 너무 깊이 받아들여 함께 무너지는 위험',
    ],
    light: '공감과 연결',
    shadow: '자기 소멸과 경계 붕괴',
    cowork: ['LOGIC', 'LEADER'],
    caption: '상대방은 처음엔 당신의 따뜻한 공감이라는 빛에 위로받습니다. 그러나 당신이 명확한 선을 긋지 못하고 남의 감정까지 흡수하다 지쳐드는 그림자를 보면서, 오히려 당신에게 무거운 짐을 지웠다는 죄책감과 수치스러운 부담을 느끼고 점차 멀어집니다.',
    growth: '하모니 유형의 성장은 건강한 자기 표현에 있습니다. 모두가 행복한 것이 목표가 아니라 진실한 관계가 목표임을 배우는 것이 개성화의 핵심입니다.',
    missions: [
      '오늘 하루 누군가의 부탁에 아니오를 딱 한 번 말하고, 그 경험을 저녁에 한 문장으로 기록하기',
      '상담 또는 심방 후 30분 내에 혼자만의 회복 시간(산책, 묵상 등)을 의무적으로 갖기',
    ],
  },
  SOUL: {
    fn: 'Fi', icon: '🌊', kr: '소울',
    keywords: ['깊이', '의미', '진정성', '내면'],
    oneLiner: '본질을 파고드는 사람. 표면적인 신앙이 아닌 내면의 진정성을 추구합니다.',
    strengths: [
      '내면 깊이 — 인간의 영혼과 고통에 대한 깊은 이해와 공명 능력',
      '진정성 — 연기하지 않고 자신의 연약함을 나눌 수 있는 투명한 목회',
      '의미 추구 — 형식적인 신앙을 넘어 본질적 물음으로 성도를 이끄는 능력',
      '창의적 표현 — 예술, 글, 상징을 통해 말씀을 깊이 전달하는 능력',
    ],
    shadows: [
      '공적 리더십의 불편함 — 많은 사람 앞에서 이끄는 역할에서 소진',
      '경계의 모호함 — 깊은 공감이 지나쳐 개인 정체성이 흔들리는 경험',
      '실행력의 약점 — 내면의 풍요로움이 외부 행동으로 이어지지 않는 경우',
    ],
    light: '깊이와 진정성',
    shadow: '고립과 자기 은폐',
    cowork: ['LEADER', 'LOGIC'],
    caption: '성도들은 처음엔 당신의 진정성과 깊이라는 빛에 영적으로 목말랐던 갈증을 해소합니다. 그러나 당신이 고립 속으로 사라지며 공동체를 이끄는 역할을 회피하는 그림자를 보면서, 이 목회자와는 진짜 관계가 불가능하다는 쓸쓸함에 떠납니다.',
    growth: '소울 유형의 성장은 내면의 풍요를 세상으로 가져오는 것입니다. 깊은 내면을 숨기지 않고 공동체에 나누는 용기가 개성화의 핵심입니다.',
    missions: [
      '이번 주 내 내면에서 떠오른 통찰이나 묵상을 짧은 글(3~5문장)로 써서 팀 채팅방에 공유하기',
      '대규모 행사 기획이 필요한 일이 생기면, 스스로 맡기 전에 먼저 LEADER/LOGIC 유형에게 위임 요청하기',
    ],
  },
  LOGIC: {
    fn: 'Ti', icon: '🔬', kr: '로직',
    keywords: ['분석', '정확', '원칙', '체계'],
    oneLiner: '논리와 원칙으로 공동체를 세우는 사람. 말씀을 치밀하게 연구하고 체계를 잡습니다.',
    strengths: [
      '깊은 성경 연구 — 말씀의 원어, 문맥, 신학적 배경을 꼼꼼하게 파고드는 능력',
      '논리적 설교 — 체계적이고 설득력 있는 구조로 진리를 전달',
      '원칙 중심의 리더십 — 감정에 흔들리지 않고 일관된 기준을 유지',
      '문제 분석 능력 — 갈등 상황에서 감정을 배제하고 구조적으로 접근',
    ],
    shadows: [
      '감정적 연결의 어려움 — 상처받은 성도가 논리보다 공감을 필요로 할 때 놓치는 경우',
      '완벽주의적 경향 — 불완전한 것에 대한 높은 기준이 스트레스로 이어짐',
      '설명이 길어지는 패턴 — 핵심보다 이론이 많아 성도가 길을 잃는 경우',
    ],
    light: '논리와 정확성',
    shadow: '감정 억압과 연결 회피',
    cowork: ['HARMONY'],
    caption: '성도들은 처음엔 당신의 치밀한 논리와 정확한 말씀 해석이라는 빛에 신뢰를 보냅니다. 그러나 당신이 상처받은 마음을 논리로만 다루며 차단하는 그림자를 보면서, 이 목회자에겐 내 아픔을 꺼낼 수 없다고 느끼고 멀어집니다.',
    growth: '로직 유형의 성장은 감정의 언어를 배우는 것입니다. 옳고 그름의 세계에서 아프고 슬프고 기쁜 세계로 내려오는 것이 개성화의 핵심입니다.',
    missions: [
      '성도가 어려움을 나눌 때 해결책을 말하기 전에 "그랬군요, 많이 힘드셨겠네요"를 반드시 먼저 한 번 말하기',
      '이번 주 설교 또는 성경공부에서 결론 한 문장을 가장 먼저 말하고 설명은 그 다음에 하기',
    ],
  },
  LEADER: {
    fn: 'Te', icon: '⚡', kr: '리더',
    keywords: ['추진', '결단', '영향력', '목표'],
    oneLiner: '방향을 정하고 이끄는 사람. 결단이 필요한 순간 망설이지 않습니다.',
    strengths: [
      '결단력 — 필요한 순간 빠르고 명확한 결정을 내리는 능력',
      '조직화 능력 — 사람과 자원을 효과적으로 배치하고 구조를 세우는 능력',
      '목표 달성 — 교회 성장, 시설 확장, 프로그램 실행에서 탁월한 결과',
      '당당한 리더십 — 외부 압력에 흔들리지 않는 강한 중심',
    ],
    shadows: [
      '성도를 수단으로 보는 위험 — 목표 달성 과정에서 관계보다 결과를 우선시',
      '권위주의적 경향 — 의견 수렴보다 결정 집행을 선호하는 패턴',
      '약함에 대한 낮은 인내 — 느리거나 망설이는 성도에게 답답함을 느낌',
    ],
    light: '추진력과 결단',
    shadow: '통제 경향과 약함에 대한 불편함',
    cowork: ['HARMONY'],
    caption: '성도들은 처음엔 당신의 확신과 결단력이라는 빛을 믿고 따릅니다. 그러나 당신이 타인의 연약함을 불편해하며 몰아붙이는 그림자를 보면서, 자신이 사역의 도구로 전락했다고 느끼며 마음을 굳게 닫아버립니다.',
    growth: '리더 유형의 성장은 약함을 품는 것에 있습니다. 효율과 목표가 아닌 느리고 불완전한 사람과 함께 걷는 법을 배우는 것이 개성화의 핵심입니다.',
    missions: [
      '이번 주 결정 사항 1개를 실행하기 전에 팀원 2명에게 "어떻게 생각해요?"라고 묻고 그 대답을 기록하기',
      '느리게 반응하는 팀원에게 답답함을 느낄 때, 개입 전에 속으로 "이 사람의 속도가 나쁜 게 아니다"를 3번 말하기',
    ],
  },
};

// ── 주기능 시너지/충돌 매트릭스 ──
// 같은 주기능(Je/Ji/Pe/Pi) 계열 간의 관계 정의
const FN_FAMILY = {
  Ne: 'Pe', Ni: 'Pi', Se: 'Pe', Si: 'Pi',
  Fe: 'Je', Fi: 'Ji', Te: 'Je', Ti: 'Ji',
};

// 유형 간 동역 시너지 점수 (0~3)
const SYNERGY = {
  SPARK:   { STEADY:3, LOGIC:3, HARMONY:2, VISION:1, SOUL:2, PLAYER:1, LEADER:1, SPARK:0 },
  VISION:  { HARMONY:3, PLAYER:2, STEADY:1, SPARK:1, SOUL:2, LOGIC:2, LEADER:1, VISION:0 },
  STEADY:  { LOGIC:3, LEADER:2, SPARK:3, HARMONY:2, VISION:1, PLAYER:1, SOUL:1, STEADY:0 },
  PLAYER:  { VISION:3, STEADY:2, HARMONY:2, SPARK:1, LOGIC:1, LEADER:1, SOUL:1, PLAYER:0 },
  HARMONY: { LOGIC:3, LEADER:3, VISION:3, STEADY:2, SOUL:2, SPARK:2, PLAYER:2, HARMONY:0 },
  SOUL:    { LEADER:3, LOGIC:3, VISION:2, HARMONY:2, SPARK:2, STEADY:1, PLAYER:1, SOUL:0 },
  LOGIC:   { HARMONY:3, SPARK:3, LEADER:2, STEADY:3, SOUL:3, VISION:2, PLAYER:1, LOGIC:0 },
  LEADER:  { HARMONY:3, SOUL:3, STEADY:2, LOGIC:2, VISION:1, SPARK:1, PLAYER:1, LEADER:0 },
};

// ── 역할(role)에 따른 맥락 수식어 ──
const ROLE_CONTEXT = {
  '담임목사':   '공동체 전체를 책임지는 목회자로서',
  '부교역자':   '목회 팀의 동역자로서',
  '장로':       '교회의 중직자로서',
  '안수집사':   '헌신된 중직자로서',
  '권사':       '공동체를 섬기는 중직자로서',
  '담당교역자': '부서를 이끄는 교역자로서',
  '부장':       '부서의 행정 책임자로서',
  '총무':       '팀의 운영을 맡은 리더로서',
  '회계':       '팀의 재정을 맡은 리더로서',
  '교사':       '다음 세대를 섬기는 교사로서',
};

// ══════════════════════════════════════════════
//  2. RULE ENGINE — 팀 분석 & 뼈대 JSON 생성
// ══════════════════════════════════════════════

function analyzeTeam(results) {
  const types = results.map(r => r.sg_type).filter(Boolean);
  const counts = {};
  types.forEach(t => { counts[t] = (counts[t] || 0) + 1; });

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const topTypes = sorted.slice(0, 3).map(([t]) => t);
  const bottomTypes = sorted.slice(-2).map(([t]) => t);

  // 주기능 분포
  const fnCounts = {};
  types.forEach(t => {
    const fn = TYPE_MASTER[t]?.fn;
    if (fn) fnCounts[fn] = (fnCounts[fn] || 0) + 1;
  });

  // Je/Ji/Pe/Pi 계열 분포
  const familyCounts = {};
  Object.entries(fnCounts).forEach(([fn, n]) => {
    const f = FN_FAMILY[fn];
    familyCounts[f] = (familyCounts[f] || 0) + n;
  });

  // 시너지 쌍 발견
  const synergyPairs = [];
  topTypes.forEach((t1, i) => {
    topTypes.slice(i + 1).forEach(t2 => {
      const score = (SYNERGY[t1]?.[t2] || 0) + (SYNERGY[t2]?.[t1] || 0);
      if (score >= 4) synergyPairs.push({ pair: [t1, t2], score });
    });
  });

  // 취약 영역 (전혀 없는 주기능 계열)
  const allFamilies = ['Je', 'Ji', 'Pe', 'Pi'];
  const missingFamilies = allFamilies.filter(f => !familyCounts[f]);

  // 위험 조합 (같은 계열이 너무 많을 때)
  const dominantFamily = Object.entries(familyCounts).sort((a, b) => b[1] - a[1])[0];
  const isImbalanced = dominantFamily && dominantFamily[1] / types.length > 0.6;

  return {
    total: types.length,
    counts,
    sorted,
    topTypes,
    bottomTypes,
    fnCounts,
    familyCounts,
    synergyPairs,
    missingFamilies,
    isImbalanced,
    dominantFamily: dominantFamily?.[0],
  };
}

function buildTeamSkeleton(results, wsData, analysis) {
  const { sorted, topTypes, synergyPairs, missingFamilies, isImbalanced, dominantFamily } = analysis;
  const orgType = wsData?.product_type || '';
  const churchName = wsData?.church_name || '';

  // 팀 강점 룰
  const teamStrengths = topTypes.map(t => {
    const td = TYPE_MASTER[t];
    return `${td.icon} ${td.kr} — ${td.strengths[0]}`;
  });

  // 시너지 룰
  const synergyInsights = synergyPairs.map(({ pair }) => {
    const [t1, t2] = pair;
    return `${TYPE_MASTER[t1].kr}(${t1})와 ${TYPE_MASTER[t2].kr}(t2)의 조합: ${TYPE_MASTER[t1].keywords[0]}과 ${TYPE_MASTER[t2].keywords[0]}이 서로를 보완합니다.`;
  });

  // 취약 영역 룰
  const familyDesc = {
    Je: '실행·목표 추진력', Ji: '분석·가치 판단',
    Pe: '현장·가능성 탐색', Pi: '통찰·장기 비전',
  };
  const vulnerabilities = missingFamilies.map(f =>
    `팀에 ${familyDesc[f]} 유형이 없습니다. 외부 동역자나 의도적 역할 분담이 필요합니다.`
  );

  // 불균형 경고
  const balanceWarning = isImbalanced
    ? `팀의 60% 이상이 ${familyDesc[dominantFamily]} 계열입니다. 같은 방식으로 문제를 접근하는 경향이 강할 수 있습니다.`
    : null;

  // 동역 구조 제안
  const coworkStructure = topTypes.map(t => {
    const td = TYPE_MASTER[t];
    const complements = td.cowork.filter(c => analysis.counts[c] > 0);
    if (complements.length === 0) return null;
    return `${td.kr}의 약점(${td.shadow.split('과')[0]})을 ${complements.map(c => TYPE_MASTER[c].kr).join('·')}이 보완`;
  }).filter(Boolean);

  return {
    churchName,
    orgType,
    total: analysis.total,
    typeDistribution: sorted,
    teamStrengths,
    synergyInsights,
    vulnerabilities,
    balanceWarning,
    coworkStructure,
    // AI가 채울 영역
    teamNarrative: null,     // AI 생성: 팀 전체 서사 (3~4문장)
    teamShadow: null,        // AI 생성: 팀 그림자 서사 (2~3문장)
    workshopOpening: null,   // AI 생성: 워크숍 오프닝 멘트
  };
}

function buildIndividualSkeleton(member) {
  const td = TYPE_MASTER[member.sg_type];
  if (!td) return null;

  const roleCtx = ROLE_CONTEXT[member.role] || `${member.role || '팀원'}으로서`;

  return {
    name: member.name,
    role: member.role || '',
    type: member.sg_type,
    typeKr: td.kr,
    icon: td.icon,
    oneLiner: td.oneLiner,
    keywords: td.keywords,
    roleContext: roleCtx,
    strengths: td.strengths,
    shadows: td.shadows,
    light: td.light,
    shadow: td.shadow,
    cowork: td.cowork,
    missions: td.missions,
    growth: td.growth,
    // AI가 채울 영역
    personalNarrative: null,  // AI 생성: 역할 맥락 반영한 개인 서사
    shadowCaption: null,      // AI 생성: 쉐도우그램 캡션 (역할 맥락 반영)
  };
}

// ══════════════════════════════════════════════
//  3. AI ENGINE — Claude API 호출
// ══════════════════════════════════════════════

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
- "불을 다스리는 사람들의 학교" — 온유스쿨
- 따뜻하지만 직면하는 톤
- 과도한 위로나 칭찬 없이 사실적으로`;

async function callClaude(userPrompt, apiKey) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API 오류: ${res.status} — ${err}`);
  }

  const data = await res.json();
  return data.content?.[0]?.text || '';
}

async function enrichTeamReport(skeleton, apiKey) {
  const typeList = skeleton.typeDistribution
    .map(([t, n]) => `${TYPE_MASTER[t].kr}(${t}) ${n}명`)
    .join(', ');

  const prompt = `
다음 팀의 쉐도우그램 리포트 텍스트를 생성해 주세요.

## 팀 정보
- 교회: ${skeleton.churchName}
- 조직: ${skeleton.orgType}
- 유형 분포: ${typeList}
- 팀 강점: ${skeleton.teamStrengths.join(' / ')}
- 취약 영역: ${skeleton.vulnerabilities.join(' / ') || '없음'}
- 균형 경고: ${skeleton.balanceWarning || '없음'}

## 생성할 텍스트 (JSON으로 응답)

{
  "teamNarrative": "이 팀의 소통 구조를 3~4문장으로 서술. 유형 분포의 특징과 그것이 공동체에 미치는 영향 포함.",
  "teamShadow": "이 팀이 주의해야 할 그림자 패턴을 2~3문장으로 서술. 유형 조합에서 생기는 집단적 그림자.",
  "workshopOpening": "워크숍 시작 시 퍼실리테이터가 읽을 오프닝 멘트 2~3문장. 이 팀의 특성을 반영한 따뜻한 환영사."
}

JSON만 응답하세요.`;

  try {
    const raw = await callClaude(prompt, apiKey);
    const json = JSON.parse(raw.trim().replace(/```json|```/g, ''));
    skeleton.teamNarrative    = json.teamNarrative    || null;
    skeleton.teamShadow       = json.teamShadow       || null;
    skeleton.workshopOpening  = json.workshopOpening  || null;
  } catch (e) {
    console.warn('팀 AI 생성 실패, 룰 기반 텍스트 사용:', e.message);
  }

  return skeleton;
}

async function enrichIndividualReport(skeleton, apiKey) {
  const td = TYPE_MASTER[skeleton.type];

  const prompt = `
다음 개인의 쉐도우그램 리포트 텍스트를 생성해 주세요.

## 개인 정보
- 이름: ${skeleton.name}
- 역할: ${skeleton.role} (${skeleton.roleContext})
- 유형: ${skeleton.type} (${skeleton.typeKr})
- 주기능: ${td.fn}
- 빛: ${skeleton.light}
- 그림자: ${skeleton.shadow}

## 생성할 텍스트 (JSON으로 응답)

{
  "personalNarrative": "${skeleton.role} 역할 맥락을 반영한 개인 소통 패턴 서술 2~3문장. 역할과 유형이 어떻게 연결되는지 포함.",
  "shadowCaption": "쉐도우그램 캡션 — 빛→그림자 역전 3단 서사. 팀원 또는 성도 관점에서 작성. 2~3문장."
}

JSON만 응답하세요.`;

  try {
    const raw = await callClaude(prompt, apiKey);
    const json = JSON.parse(raw.trim().replace(/```json|```/g, ''));
    skeleton.personalNarrative = json.personalNarrative || null;
    skeleton.shadowCaption     = json.shadowCaption     || null;
  } catch (e) {
    // 룰 기반 캡션으로 폴백
    skeleton.personalNarrative = `${skeleton.roleContext} ${skeleton.oneLiner}`;
    skeleton.shadowCaption     = td.caption;
  }

  return skeleton;
}

// ══════════════════════════════════════════════
//  4. 메인 진입점 — generateReport(results, wsData, apiKey)
// ══════════════════════════════════════════════

/**
 * @param {Array}  results  — Supabase survey_results 배열
 * @param {Object} wsData   — Supabase workshops row
 * @param {string} apiKey   — Anthropic API 키 (없으면 룰 기반만)
 * @param {Function} onProgress — 진행 콜백 (선택)
 * @returns {Object} { team, individuals }
 */
async function generateReport(results, wsData, apiKey = '', onProgress = null) {
  const report = { team: null, individuals: [] };
  const useAI  = !!apiKey;

  onProgress?.('분석 중...', 10);

  // 1. 팀 분석
  const analysis = analyzeTeam(results);
  onProgress?.('팀 구조 분석 완료', 20);

  // 2. 팀 뼈대 생성
  let teamSkeleton = buildTeamSkeleton(results, wsData, analysis);
  onProgress?.('팀 뼈대 생성 완료', 35);

  // 3. 개인 뼈대 생성
  const indSkeletons = results.map(r => buildIndividualSkeleton(r)).filter(Boolean);
  onProgress?.('개인 뼈대 생성 완료', 45);

  if (useAI) {
    // 4. AI 팀 서술 생성
    onProgress?.('AI 팀 서술 생성 중...', 55);
    teamSkeleton = await enrichTeamReport(teamSkeleton, apiKey);
    onProgress?.('AI 팀 서술 완료', 65);

    // 5. AI 개인 서술 생성 (병렬)
    onProgress?.(`AI 개인 리포트 생성 중 (${indSkeletons.length}명)...`, 70);
    const enriched = await Promise.all(
      indSkeletons.map(s => enrichIndividualReport(s, apiKey))
    );
    report.individuals = enriched;
    onProgress?.('AI 개인 리포트 완료', 90);
  } else {
    // AI 없음 — 룰 기반 텍스트로 채우기
    teamSkeleton.teamNarrative   = `이 팀은 ${teamSkeleton.typeDistribution.slice(0,2).map(([t])=>TYPE_MASTER[t].kr).join('과 ')} 중심의 구조입니다. ${teamSkeleton.teamStrengths[0]}`;
    teamSkeleton.teamShadow      = teamSkeleton.vulnerabilities[0] || '팀 균형이 양호합니다.';
    teamSkeleton.workshopOpening = `오늘 이 자리는 서로를 판단하는 자리가 아닙니다. 각자의 빛을 발견하고, 함께 더 잘 일하는 방법을 찾는 시간입니다.`;

    indSkeletons.forEach(s => {
      const td = TYPE_MASTER[s.type];
      s.personalNarrative = `${s.roleContext} ${s.oneLiner}`;
      s.shadowCaption     = td.caption;
    });
    report.individuals = indSkeletons;
  }

  report.team     = teamSkeleton;
  report.analysis = analysis;
  onProgress?.('리포트 생성 완료', 100);

  return report;
}

// 외부 노출
window.ShadowgramEngine = {
  generateReport,
  analyzeTeam,
  TYPE_MASTER,
  SYNERGY,
};
