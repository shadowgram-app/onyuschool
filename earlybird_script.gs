/**
 * 온유스쿨 얼리버드 신청폼 → 구글 시트 연동
 * Google Apps Script Web App
 *
 * [설치 방법]
 * 1. https://script.google.com 접속 → 새 프로젝트 만들기
 * 2. 이 코드 전체를 붙여넣기
 * 3. SHEET_ID 에 구글 시트 ID 입력 (아래 주석 참고)
 * 4. 상단 메뉴 → 배포 → 새 배포 → 유형: 웹 앱
 *    - 다음 사용자로 실행: 나(내 계정)
 *    - 액세스 권한: 모든 사용자
 * 5. 배포 URL 복사 → pastor/index.html 의 SCRIPT_URL 에 붙여넣기
 */

// ★ 구글 시트 ID를 여기에 입력하세요
// 시트 URL: https://docs.google.com/spreadsheets/d/【여기가 ID】/edit
const SHEET_ID = 'YOUR_GOOGLE_SHEET_ID';
const SHEET_NAME = '얼리버드신청'; // 시트 탭 이름 (없으면 자동 생성)

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    const ss = SpreadsheetApp.openById(SHEET_ID);
    let sheet = ss.getSheetByName(SHEET_NAME);

    // 시트가 없으면 새로 만들고 헤더 추가
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
      sheet.appendRow(['신청일시', '이름', '교회명', '연락처', '관심클래스', '소감']);
      sheet.getRange(1, 1, 1, 6).setFontWeight('bold');
      sheet.setFrozenRows(1);
    }

    // 데이터 추가
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const timestamp = Utilities.formatDate(kst, 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss');

    sheet.appendRow([
      timestamp,
      data.name || '',
      data.church || '',
      data.contact || '',
      data.classes || '',
      data.comment || ''
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({ result: 'success' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ result: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// 테스트용 (브라우저에서 직접 접근 시)
function doGet(e) {
  return ContentService
    .createTextOutput('온유스쿨 얼리버드 신청 수신 서버 ✓')
    .setMimeType(ContentService.MimeType.TEXT);
}
