/**
 * 온유스쿨 통합 Google Apps Script
 * ─────────────────────────────────────────────────────────────
 * 모든 폼(index.html + check.html + result.html + pastor.html)이 이 단일 URL로 POST
 *
 * 설치 방법:
 *  1. Google Apps Script (script.google.com) 에서 새 프로젝트 생성
 *  2. 이 코드 전체 붙여넣기
 *  3. SPREADSHEET_ID, ADMIN_EMAIL, PASTOR_PAGE_URL 값 설정
 *  4. 배포 → 웹 앱으로 배포 → 액세스: 모든 사용자
 *  5. 배포 URL을 모든 HTML 파일의 APPS_SCRIPT_URL 에 붙여넣기
 * ─────────────────────────────────────────────────────────────
 */

// ── 설정값 ──────────────────────────────────────────────────
const SPREADSHEET_ID  = 'YOUR_GOOGLE_SHEET_ID_HERE';          // 구글시트 ID
const ADMIN_EMAIL     = 'joculsion@gmail.com';                 // 관리자 알림 이메일
const DETAIL_CODE     = 'ONYU2026';                           // 상세리포트 코드 (고정)
const SEMINAR_DATE    = '2025년 4월 12일 (주일) 저녁 9시';
const SEMINAR_MEET    = '세미나 참가 링크는 날짜 전날까지 이메일로 보내드립니다.';
const PASTOR_PAGE_URL = 'https://onyuschool.com/pastor.html'; // 목회자 전용 페이지 URL

// ── 진입점 ──────────────────────────────────────────────────
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const type = data.type || 'unknown';

    let result;
    switch (type) {
      case 'pastor_quick':    result = handlePastorQuick(data);   break; // 원스탑 신속 신청 (이름+이메일만)
      case 'check_submit':    result = handleCheckSubmit(data);   break;
      case 'pastor_apply':    result = handlePastorApply(data);   break; // 상세 신청 (기존 호환)
      case 'seminar':         result = handleSeminar(data);       break;
      case 'subscribe':       result = handleSubscribe(data);     break;
      default:                result = { ok: false, msg: '알 수 없는 type: ' + type };
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

// CORS 대응 (OPTIONS preflight)
function doGet(e) {
  // 토큰 검증용 GET 요청도 처리
  const token = e.parameter && e.parameter.token;
  if (token) {
    const info = lookupToken(token);
    return ContentService
      .createTextOutput(JSON.stringify(info))
      .setMimeType(ContentService.MimeType.JSON);
  }
  return ContentService.createTextOutput('OK');
}

// ── 0. 원스탑 목회자 신속 신청 ────────────────────────────────
// index.html 간소화 폼: 이름 + 이메일만 받고, 전용 링크 발송
function handlePastorQuick(data) {
  if (!data.email) return { ok: false, msg: '이메일이 필요합니다.' };

  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getOrCreateSheet(ss, '목회자_토큰');

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['날짜','이름','이메일','토큰','사용여부','MBTI','유형','완료날짜']);
  }

  // 중복 이메일 체크 — 이미 토큰 있으면 재발송
  const existing = sheet.getDataRange().getValues();
  let existingToken = null;
  for (let i = 1; i < existing.length; i++) {
    if (existing[i][2] === data.email) {
      existingToken = existing[i][3];
      break;
    }
  }

  const token = existingToken || generateToken();

  if (!existingToken) {
    sheet.appendRow([
      formatDate(new Date().toISOString()),
      data.name  || '',
      data.email,
      token,
      'N',  // 사용여부
      '',   // MBTI (검사 완료 후 채워짐)
      '',   // 유형
      '',   // 완료날짜
    ]);
  }

  // 목회자 전용 링크 발송
  sendPastorTokenEmail(data.name || '', data.email, token);

  // 구독자 시트에도 기록
  recordSubscriber(ss, data.email, data.name, '', '목회자원스탑');

  // 관리자 알림
  notifyAdmin(
    '[온유스쿨] 목회자 원스탑 신청 — ' + (data.name || '이름없음'),
    '이름: ' + data.name + '\n이메일: ' + data.email +
    '\n토큰: ' + token +
    '\n날짜: ' + formatDate(new Date().toISOString())
  );

  return { ok: true, msg: '전용 링크 발송 완료', token };
}

// ── 토큰 조회 (GET ?token=xxx) ────────────────────────────────
function lookupToken(token) {
  try {
    const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName('목회자_토큰');
    if (!sheet) return { ok: false, msg: '시트 없음' };

    const rows = sheet.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][3] === token) {
        return {
          ok:    true,
          name:  rows[i][1],
          email: rows[i][2],
          token: token,
          used:  rows[i][4],
          mbti:  rows[i][5],
          sgType: rows[i][6],
        };
      }
    }
    return { ok: false, msg: '유효하지 않은 토큰입니다.' };
  } catch(e) {
    return { ok: false, msg: e.message };
  }
}

// ── 토큰 완료 처리 (check_submit 시 토큰 업데이트) ──────────────
function markTokenUsed(email, mbti, sgType) {
  try {
    const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName('목회자_토큰');
    if (!sheet) return;

    const rows  = sheet.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][2] === email) {
        sheet.getRange(i + 1, 5).setValue('Y');                  // 사용여부
        sheet.getRange(i + 1, 6).setValue(mbti);                 // MBTI
        sheet.getRange(i + 1, 7).setValue(sgType);               // 유형
        sheet.getRange(i + 1, 8).setValue(formatDate(new Date().toISOString())); // 완료날짜
        break;
      }
    }
  } catch(e) {
    Logger.log('토큰 업데이트 실패: ' + e.message);
  }
}

// ── 1. 검사 완료 제출 (check.html / pastor.html) ───────────────
function handleCheckSubmit(data) {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getOrCreateSheet(ss, '검사_제출');

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['날짜','이름','이메일','교회','역할','MBTI','쉐도우그램유형','소식구독','코드','토큰경로']);
  }

  sheet.appendRow([
    formatDate(data.date),
    data.name    || '',
    data.email   || '',
    data.church  || '',
    data.role    || '',
    data.mbti    || '',
    data.sgType  || '',
    data.subscribe ? 'Y' : 'N',
    DETAIL_CODE,
    data.token   ? 'TOKEN' : 'DIRECT',  // 진입 경로
  ]);

  // 토큰 경로로 온 경우: 토큰 완료 처리 (이메일 재발송 불필요)
  if (data.token) {
    markTokenUsed(data.email, data.mbti, data.sgType);
    // 토큰 경로에서는 result.html로 리다이렉트 안내 이메일 불필요
    // (pastor.html 내에서 바로 상세리포트 표시)
  } else {
    // 일반 경로: 코드 이메일 발송
    sendCodeEmail(data);
  }

  // 소식 구독 시
  if (data.subscribe && data.email) {
    recordSubscriber(ss, data.email, data.name, data.sgType, '검사완료');
  }

  // 관리자 알림
  notifyAdmin(
    '[온유스쿨] 새 검사 완료 — ' + (data.name || '이름없음'),
    '이름: ' + data.name + '\n이메일: ' + data.email +
    '\n유형: ' + data.sgType + ' (' + data.mbti + ')' +
    '\n역할: ' + data.role +
    '\n경로: ' + (data.token ? '목회자 토큰' : '직접') +
    '\n날짜: ' + formatDate(data.date)
  );

  return { ok: true, msg: data.token ? '검사 완료 (토큰 처리됨)' : '코드 이메일 발송 완료' };
}

// ── 2. 목회자 상세 신청 (기존 호환) ────────────────────────────
function handlePastorApply(data) {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getOrCreateSheet(ss, '목회자_신청');

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['날짜','이름','이메일','연락처','교회','MBTI','메모']);
  }

  sheet.appendRow([
    formatDate(data.date),
    data.name   || '',
    data.email  || '',
    data.phone  || '',
    data.church || '',
    data.mbti   || '',
    data.memo   || '',
  ]);

  sendPastorApplyEmail(data);

  notifyAdmin(
    '[온유스쿨] 목회자 체험판 신청 — ' + (data.name || '이름없음'),
    '이름: ' + data.name + '\n이메일: ' + data.email +
    '\n교회: ' + data.church +
    '\n연락처: ' + data.phone +
    '\n날짜: ' + formatDate(data.date)
  );

  return { ok: true, msg: '목회자 신청 접수 완료' };
}

// ── 3. 세미나 신청 (result.html / pastor.html) ──────────────────
function handleSeminar(data) {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getOrCreateSheet(ss, '세미나_신청');

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['날짜','이름','이메일','교회','소통유형','영상수신']);
  }

  sheet.appendRow([
    formatDate(data.date),
    data.name   || '',
    data.email  || '',
    data.church || '',
    data.sgType || '',
    data.video ? 'Y' : 'N',
  ]);

  sendSeminarEmail(data);

  notifyAdmin(
    '[온유스쿨] 세미나 신청 — ' + (data.name || '이름없음'),
    '이름: ' + data.name + '\n이메일: ' + data.email +
    '\n유형: ' + data.sgType +
    '\n날짜: ' + formatDate(data.date)
  );

  return { ok: true, msg: '세미나 신청 완료' };
}

// ── 4. 소식 구독 ─────────────────────────────────────────────
function handleSubscribe(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  recordSubscriber(ss, data.email, data.name || '', data.sgType || '', '소식구독');
  sendSubscribeEmail(data);
  return { ok: true, msg: '구독 등록 완료' };
}

// ── 이메일 발송 함수들 ───────────────────────────────────────

// 목회자 원스탑 전용 링크 이메일
function sendPastorTokenEmail(name, email, token) {
  const link    = PASTOR_PAGE_URL + '?token=' + token;
  const subject = '[온유스쿨] 목회자 전용 소통스타일 검사 링크가 준비되었습니다';
  const body    = `안녕하세요, ${name}님.

온유스쿨 목회자 전용 페이지가 준비되었습니다.
아래 링크 하나로 모든 것이 자동으로 연결됩니다.

━━━━━━━━━━━━━━━━━━━━━━━
▶ 나의 목회자 전용 링크:
${link}
━━━━━━━━━━━━━━━━━━━━━━━

이 링크에서 하실 수 있는 것:
✔ 소통스타일 검사 (28문항, 약 5분)
✔ 이름·이메일 재입력 없이 상세리포트 즉시 열람
✔ 목회자 전용 섹션 확인 (성도 가이드, 동역자 이해)
✔ 목회자 세미나 신청 (${SEMINAR_DATE})

※ 이 링크는 ${name}님 전용입니다. 개인 기기에서 열어보세요.

─────────────────────────────
온유스쿨 · onyuschool.com
인생나무코칭연구소 · 조민철
문의: ${ADMIN_EMAIL}
─────────────────────────────
이 메일은 온유스쿨 목회자 전용 링크 신청 후 발송됩니다.`;

  MailApp.sendEmail({ to: email, subject, body });
}

function sendCodeEmail(data) {
  if (!data.email) return;
  const isPastor = data.role === 'pastor';
  const subject  = '[온유스쿨] 상세 리포트 열람 코드 안내 — ' + (data.sgType || '');
  const body = `안녕하세요, ${data.name || ''}님.

온유스쿨 소통스타일 검사를 완료해주셔서 감사합니다.
아래 코드를 입력하시면 상세 리포트를 열람하실 수 있습니다.

━━━━━━━━━━━━━━━━━━━━━━━
상세 리포트 열람 코드:  ${DETAIL_CODE}
━━━━━━━━━━━━━━━━━━━━━━━

▶ 리포트 열람 페이지: https://onyuschool.com/check.html

나의 소통스타일: ${data.sgType || ''} (${data.mbti || ''})

${isPastor ? `
─────────────────────────────
목회자 체험판 안내
─────────────────────────────
코드 입력 후 상세리포트에서 목회자 전용 섹션을 확인해보세요.
· 성도 소통스타일별 목회 가이드
· 나의 사역 스타일 분석
· 목회자 성장 과제 및 동역자 이해

또한 아래 일정의 목회자 세미나에 참여하실 수 있습니다.
· 1차 세미나: ${SEMINAR_DATE}
· 방식: 구글미트 (온라인) · 약 40분
· ${SEMINAR_MEET}
` : ''}
─────────────────────────────
온유스쿨 · onyuschool.com
인생나무코칭연구소 · 조민철
문의: ${ADMIN_EMAIL}
─────────────────────────────
이 메일은 온유스쿨 소통스타일 검사를 완료하신 분께 발송됩니다.`;

  MailApp.sendEmail({ to: data.email, subject, body });
}

function sendPastorApplyEmail(data) {
  if (!data.email) return;
  const subject = '[온유스쿨] 목회자 체험판 신청 접수 확인';
  const body = `안녕하세요, ${data.name || ''}님.

온유스쿨 목회자 체험판 신청이 접수되었습니다.
빠른 시일 내에 개별적으로 리포트를 보내드리겠습니다.

직접 소통스타일 검사도 해보세요:
▶ https://onyuschool.com/check.html
(검사 완료 후 즉시 상세리포트 열람 코드를 받으실 수 있습니다)

─────────────────────────────
4월 12일 (주일) 저녁 9시 — 1차 목회자 세미나 예정
구글미트 온라인 · 무료 참여 · 약 40분
리포트 수령 후 상세페이지에서 신청 가능합니다
─────────────────────────────
온유스쿨 · onyuschool.com
인생나무코칭연구소 · 조민철
문의: ${ADMIN_EMAIL}`;

  MailApp.sendEmail({ to: data.email, subject, body });
}

function sendSeminarEmail(data) {
  if (!data.email) return;
  const subject = '[온유스쿨] 세미나 신청 확인 — ' + SEMINAR_DATE;
  const body = `안녕하세요, ${data.name || ''}님.

온유스쿨 목회자 세미나 신청이 완료되었습니다.

─────────────────────────────
1차 세미나: ${SEMINAR_DATE}
방식: 구글미트 온라인 · 무료 · 약 40분
구글미트 링크: 세미나 전날까지 이메일로 보내드립니다
─────────────────────────────
${data.video ? '영상 링크도 신청해주셨습니다. 세미나 후 영상을 보내드리겠습니다.\n' : ''}
온유스쿨 · onyuschool.com
인생나무코칭연구소 · 조민철
문의: ${ADMIN_EMAIL}`;

  MailApp.sendEmail({ to: data.email, subject, body });
}

function sendSubscribeEmail(data) {
  if (!data.email) return;
  const subject = '[온유스쿨] 소식 구독 등록 완료';
  const body = `안녕하세요.

온유스쿨 새 소식 구독이 등록되었습니다.
새 리포트·세미나 일정·부부/가정 프로그램 소식이 생기면 알려드리겠습니다.

아직 소통스타일 검사를 하지 않으셨다면 지금 바로 해보세요:
▶ https://onyuschool.com/check.html

─────────────────────────────
온유스쿨 · onyuschool.com
인생나무코칭연구소 · 조민철
문의: ${ADMIN_EMAIL}`;

  MailApp.sendEmail({ to: data.email, subject, body });
}

// ── 헬퍼 함수 ───────────────────────────────────────────────

// 고유 토큰 생성 (pastor_ + 8자리 영숫자)
function generateToken() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let token   = 'pastor_';
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
