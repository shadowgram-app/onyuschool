/**
 * 온유스쿨 통합 Google Apps Script
 * ─────────────────────────────────────────────────────────────
 * 설치 방법:
 *  1. script.google.com → 새 프로젝트
 *  2. 이 코드 전체 붙여넣기
 *  3. SPREADSHEET_ID 값 설정 (구글시트 ID)
 *  4. 배포 → 웹 앱으로 배포 → 액세스: 모든 사용자 → 배포
 *  5. 배포 URL을 parenting-dashboard.html의 APPS_SCRIPT_URL 에 입력
 * ─────────────────────────────────────────────────────────────
 */

// ── 설정값 (여기만 수정하세요) ───────────────────────────────
const SPREADSHEET_ID  = 'YOUR_GOOGLE_SHEET_ID_HERE';  // ← 구글시트 ID 입력
const ADMIN_EMAIL     = 'joculsion@gmail.com';
const DETAIL_CODE     = 'ONYU2026';
const PASTOR_PAGE_URL = 'https://onyuschool.com/pastor/';

// ── 진입점 ──────────────────────────────────────────────────
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const type = data.type || 'unknown';

    let result;
    switch (type) {
      case 'pastor_quick':     result = handlePastorQuick(data);      break;
      case 'check_submit':     result = handleCheckSubmit(data);      break;
      case 'pastor_apply':     result = handlePastorApply(data);      break;
      case 'seminar':          result = handleSeminar(data);          break;
      case 'subscribe':        result = handleSubscribe(data);        break;
      case 'send_otp':         result = handleSendOtp(data);          break; // ← OTP 이메일 발송
      case 'supabase_webhook': result = handleSupabaseWebhook(data);  break;
      default:                 result = { ok: false, msg: '알 수 없는 type: ' + type };
    }

    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// CORS 대응 GET
function doGet(e) {
  const token = e.parameter && e.parameter.token;
  if (token) {
    return ContentService
      .createTextOutput(JSON.stringify(lookupToken(token)))
      .setMimeType(ContentService.MimeType.JSON);
  }
  return ContentService.createTextOutput('OK');
}

// ══════════════════════════════════════════════════════════════
// OTP 이메일 발송 (대시보드 이메일 인증용)
// ══════════════════════════════════════════════════════════════
function handleSendOtp(data) {
  const email = data.email;
  const otp   = data.otp;

  if (!email || !otp) return { ok: false, msg: 'email, otp 필요' };

  const subject = '[온유스쿨] 인증코드: ' + otp;
  const body = `안녕하세요.

온유스쿨 대시보드 접속 인증코드입니다.

━━━━━━━━━━━━━━━━━━━━━━━
인증코드:  ${otp}
━━━━━━━━━━━━━━━━━━━━━━━

위 6자리 코드를 화면에 입력해 주세요.
코드는 3분간 유효합니다.

본인이 요청하지 않은 경우 이 메일을 무시해 주세요.

─────────────────────────────
온유스쿨 · onyuschool.com · ${ADMIN_EMAIL}`;

  try {
    MailApp.sendEmail({ to: email, subject, body });
    return { ok: true, msg: 'OTP 발송 완료' };
  } catch(e) {
    return { ok: false, msg: '발송 실패: ' + e.message };
  }
}

// ══════════════════════════════════════════════════════════════
// 목회자 원스탑 신청
// ══════════════════════════════════════════════════════════════
function handlePastorQuick(data) {
  if (!data.email) return { ok: false, msg: '이메일이 필요합니다.' };

  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getOrCreateSheet(ss, '목회자_토큰');

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['날짜','이름','이메일','토큰','사용여부','MBTI','유형','완료날짜']);
  }

  const existing = sheet.getDataRange().getValues();
  let existingToken = null;
  for (let i = 1; i < existing.length; i++) {
    if (existing[i][2] === data.email) { existingToken = existing[i][3]; break; }
  }

  const token = existingToken || generateToken();

  if (!existingToken) {
    sheet.appendRow([
      formatDate(new Date().toISOString()),
      data.name || '', data.email, token,
      'N', '', '', '',
    ]);
  }

  sendPastorTokenEmail(data.name || '', data.email, token);
  recordSubscriber(ss, data.email, data.name, '', '목회자원스탑');
  notifyAdmin(
    '[온유스쿨] 목회자 원스탑 신청 — ' + (data.name || '이름없음'),
    '이름: ' + data.name + '\n이메일: ' + data.email + '\n토큰: ' + token
  );

  return { ok: true, msg: '전용 링크 발송 완료', token };
}

// ── 토큰 조회 ──
function lookupToken(token) {
  try {
    const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName('목회자_토큰');
    if (!sheet) return { ok: false, msg: '시트 없음' };

    const rows = sheet.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][3] === token) {
        return { ok: true, name: rows[i][1], email: rows[i][2],
                 token, used: rows[i][4], mbti: rows[i][5], sgType: rows[i][6] };
      }
    }
    return { ok: false, msg: '유효하지 않은 토큰입니다.' };
  } catch(e) { return { ok: false, msg: e.message }; }
}

function markTokenUsed(email, mbti, sgType) {
  try {
    const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName('목회자_토큰');
    if (!sheet) return;
    const rows = sheet.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][2] === email) {
        sheet.getRange(i+1,5).setValue('Y');
        sheet.getRange(i+1,6).setValue(mbti);
        sheet.getRange(i+1,7).setValue(sgType);
        sheet.getRange(i+1,8).setValue(formatDate(new Date().toISOString()));
        break;
      }
    }
  } catch(e) { Logger.log('토큰 업데이트 실패: ' + e.message); }
}

// ══════════════════════════════════════════════════════════════
// 검사 완료 제출
// ══════════════════════════════════════════════════════════════
function handleCheckSubmit(data) {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getOrCreateSheet(ss, '검사_제출');

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['날짜','이름','이메일','교회','역할','MBTI','쉐도우그램유형','소식구독','코드','토큰경로']);
  }

  sheet.appendRow([
    formatDate(data.date),
    data.name || '', data.email || '', data.church || '', data.role || '',
    data.mbti || '', data.sgType || '',
    data.subscribe ? 'Y' : 'N',
    DETAIL_CODE,
    data.token ? 'TOKEN' : 'DIRECT',
  ]);

  if (data.token) {
    markTokenUsed(data.email, data.mbti, data.sgType);
  } else {
    sendCodeEmail(data);
  }

  if (data.subscribe && data.email) {
    recordSubscriber(ss, data.email, data.name, data.sgType, '검사완료');
  }

  notifyAdmin(
    '[온유스쿨] 새 검사 완료 — ' + (data.name || '이름없음'),
    '이름: ' + data.name + '\n유형: ' + data.sgType + '\n이메일: ' + data.email
  );

  return { ok: true, msg: data.token ? '검사 완료 (토큰 처리됨)' : '코드 이메일 발송 완료' };
}

// ══════════════════════════════════════════════════════════════
// 목회자 상세 신청
// ══════════════════════════════════════════════════════════════
function handlePastorApply(data) {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getOrCreateSheet(ss, '목회자_신청');

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['날짜','이름','이메일','연락처','교회','MBTI','메모']);
  }

  sheet.appendRow([
    formatDate(data.date),
    data.name || '', data.email || '', data.phone || '',
    data.church || '', data.mbti || '', data.memo || '',
  ]);

  sendPastorApplyEmail(data);
  notifyAdmin(
    '[온유스쿨] 목회자 체험판 신청 — ' + (data.name || '이름없음'),
    '이름: ' + data.name + '\n이메일: ' + data.email + '\n교회: ' + data.church
  );

  return { ok: true, msg: '목회자 신청 접수 완료' };
}

// ══════════════════════════════════════════════════════════════
// 세미나 신청
// ══════════════════════════════════════════════════════════════
function handleSeminar(data) {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getOrCreateSheet(ss, '세미나_신청');

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['날짜','이름','이메일','교회','소통유형','영상수신']);
  }

  sheet.appendRow([
    formatDate(data.date),
    data.name || '', data.email || '', data.church || '',
    data.sgType || '', data.video ? 'Y' : 'N',
  ]);

  sendSeminarEmail(data);
  notifyAdmin(
    '[온유스쿨] 세미나 신청 — ' + (data.name || '이름없음'),
    '이름: ' + data.name + '\n이메일: ' + data.email + '\n유형: ' + data.sgType
  );

  return { ok: true, msg: '세미나 신청 완료' };
}

// ══════════════════════════════════════════════════════════════
// 소식 구독
// ══════════════════════════════════════════════════════════════
function handleSubscribe(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  recordSubscriber(ss, data.email, data.name || '', data.sgType || '', '소식구독');
  sendSubscribeEmail(data);
  return { ok: true, msg: '구독 등록 완료' };
}

// ══════════════════════════════════════════════════════════════
// Supabase Webhook — 팀빌딩 / 자녀양육 구글 시트 동기화
//
// Supabase 설정:
//   Dashboard → Database → Webhooks → Create webhook
//   [팀빌딩] Table: survey_results / Event: INSERT
//   Body: {"type":"supabase_webhook","source":"teambuilding","record":{{record}}}
//   [자녀양육] Table: family_members / Event: UPDATE
//   Body: {"type":"supabase_webhook","source":"parenting","record":{{record}}}
//   URL: 이 Apps Script 웹앱 URL
// ══════════════════════════════════════════════════════════════
function handleSupabaseWebhook(data) {
  const source = data.source || 'unknown';
  const record = data.record || {};

  if (source === 'teambuilding') return handleTeambuildingRecord(record);
  if (source === 'parenting')    return handleParentingRecord(record);
  return { ok: false, msg: '알 수 없는 source: ' + source };
}

function handleTeambuildingRecord(record) {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getOrCreateSheet(ss, '팀빌딩_검사결과');

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['완료일시','교회코드','이름','소속','그룹','쉐도우그램유형','주요기능점수']);
    sheet.getRange(1,1,1,7).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }

  const scores   = record.dim_scores || {};
  const topScore = Object.entries(scores)
    .sort((a,b) => b[1]-a[1]).slice(0,2)
    .map(([k,v]) => k+':'+v.toFixed(1)).join(', ');

  sheet.appendRow([
    formatDate(record.submitted_at || new Date().toISOString()),
    record.workshop_code || '', record.name || '', record.role || '',
    record.group_type === 'L' ? '리더십' : record.group_type === 'T' ? '교사팀' : record.group_type || '',
    record.sg_type || '', topScore,
  ]);

  return { ok: true, msg: '팀빌딩 기록 완료' };
}

function handleParentingRecord(record) {
  // completed_at 없으면 무시 (검사 미완료)
  if (!record.completed_at || !record.sg_type) return { ok: true, msg: '미완료 — 스킵' };

  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getOrCreateSheet(ss, '자녀양육_검사결과');

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['완료일시','세션코드','이름','역할','유형','출생연도','성별']);
    sheet.getRange(1,1,1,7).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }

  sheet.appendRow([
    formatDate(record.completed_at),
    record.session_code || '', record.name || '', record.role || '',
    record.sg_type || '', record.birth_year || '', record.gender || '',
  ]);

  checkFamilyComplete(ss, record.session_code, record.name);
  return { ok: true, msg: '자녀양육 기록 완료' };
}

function checkFamilyComplete(ss, sessionCode, latestName) {
  try {
    const sheet = ss.getSheetByName('자녀양육_검사결과');
    if (!sheet) return;
    const data = sheet.getDataRange().getValues();
    const rows = data.slice(1).filter(r => r[1] === sessionCode);

    if (rows.length >= 2) {
      const names = rows.map(r => r[2]+'('+r[4]+')').join(', ');
      notifyAdmin(
        '[온유스쿨 자녀양육] ' + latestName + '님 검사 완료 — 세션 ' + sessionCode,
        '세션: ' + sessionCode +
        '\n완료 인원: ' + rows.length + '명' +
        '\n구성원: ' + names +
        '\n\n리포트 확인:\nhttps://onyuschool.com/parenting-report.html?session=' + sessionCode +
        '\n\n대시보드:\nhttps://onyuschool.com/parenting-dashboard.html?session=' + sessionCode
      );
    }
  } catch(e) { Logger.log('가족 완료 체크 실패: ' + e.message); }
}

// ══════════════════════════════════════════════════════════════
// 이메일 발송 함수들
// ══════════════════════════════════════════════════════════════
function sendPastorTokenEmail(name, email, token) {
  const link    = PASTOR_PAGE_URL + '?token=' + token;
  const subject = '[온유스쿨] 목회자 전용 소통스타일 검사 링크';
  const body = `안녕하세요, ${name}님.

온유스쿨 목회자 전용 페이지가 준비되었습니다.

━━━━━━━━━━━━━━━━━━━━━━━
▶ 나의 목회자 전용 링크:
${link}
━━━━━━━━━━━━━━━━━━━━━━━

※ 이 링크는 ${name}님 전용입니다.

─────────────────────────────
온유스쿨 · onyuschool.com · ${ADMIN_EMAIL}`;

  MailApp.sendEmail({ to: email, subject, body });
}

function sendCodeEmail(data) {
  if (!data.email) return;
  const subject = '[온유스쿨] 상세 리포트 열람 코드 — ' + (data.sgType || '');
  const body = `안녕하세요, ${data.name || ''}님.

검사를 완료해주셔서 감사합니다.

━━━━━━━━━━━━━━━━━━━━━━━
상세 리포트 열람 코드:  ${DETAIL_CODE}
━━━━━━━━━━━━━━━━━━━━━━━

▶ 리포트 열람: https://onyuschool.com/check.html
나의 소통스타일: ${data.sgType || ''} (${data.mbti || ''})

─────────────────────────────
온유스쿨 · onyuschool.com · ${ADMIN_EMAIL}`;

  MailApp.sendEmail({ to: data.email, subject, body });
}

function sendPastorApplyEmail(data) {
  if (!data.email) return;
  const subject = '[온유스쿨] 목회자 체험판 신청 접수 확인';
  const body = `안녕하세요, ${data.name || ''}님.

온유스쿨 목회자 체험판 신청이 접수되었습니다.
빠른 시일 내에 리포트를 보내드리겠습니다.

▶ 지금 바로 검사: https://onyuschool.com/check.html

─────────────────────────────
온유스쿨 · onyuschool.com · ${ADMIN_EMAIL}`;

  MailApp.sendEmail({ to: data.email, subject, body });
}

function sendSeminarEmail(data) {
  if (!data.email) return;
  const subject = '[온유스쿨] 세미나 신청 확인';
  const body = `안녕하세요, ${data.name || ''}님.

온유스쿨 목회자 세미나 신청이 완료되었습니다.
구글미트 링크는 세미나 전날까지 이메일로 보내드립니다.

─────────────────────────────
온유스쿨 · onyuschool.com · ${ADMIN_EMAIL}`;

  MailApp.sendEmail({ to: data.email, subject, body });
}

function sendSubscribeEmail(data) {
  if (!data.email) return;
  const subject = '[온유스쿨] 소식 구독 등록 완료';
  const body = `안녕하세요.

온유스쿨 소식 구독이 등록되었습니다.

▶ 소통스타일 검사: https://onyuschool.com/check.html

─────────────────────────────
온유스쿨 · onyuschool.com · ${ADMIN_EMAIL}`;

  MailApp.sendEmail({ to: data.email, subject, body });
}

// ══════════════════════════════════════════════════════════════
// 헬퍼 함수
// ══════════════════════════════════════════════════════════════
function generateToken() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let token = 'pastor_';
  for (let i = 0; i < 8; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

function recordSubscriber(ss, email, name, sgType, source) {
  if (!email) return;
  const sheet = getOrCreateSheet(ss, '구독자');
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['날짜','이메일','이름','유형','출처']);
  }
  const existing = sheet.getDataRange().getValues();
  for (let i = 1; i < existing.length; i++) {
    if (existing[i][1] === email) return;
  }
  sheet.appendRow([new Date(), email, name || '', sgType || '', source || '']);
}

function getOrCreateSheet(ss, name) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  return sheet;
}

function notifyAdmin(subject, body) {
  try {
    MailApp.sendEmail({ to: ADMIN_EMAIL, subject, body });
  } catch(e) {
    Logger.log('관리자 알림 실패: ' + e.message);
  }
}

function formatDate(isoString) {
  try {
    const d = new Date(isoString);
    return Utilities.formatDate(d, 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss');
  } catch(e) {
    return isoString || '';
  }
}
