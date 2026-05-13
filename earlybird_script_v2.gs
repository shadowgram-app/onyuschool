/**
 * 온유스쿨 얼리버드 + 퍼스트클래스 결과 통합 스크립트
 * ─────────────────────────────────────────────────────
 * 기존 earlybird_script.gs 를 이것으로 전체 교체하세요.
 * 시트 ID는 동일하게 사용합니다.
 */

const SHEET_ID = '1yMUEgpEr83tKHAEJiXDf2M-AblAVNLi6dcThuZhfAmw';

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    // sheet 필드로 탭 구분
    const targetSheet = data.sheet || '얼리버드신청';

    const ss = SpreadsheetApp.openById(SHEET_ID);
    let sheet = ss.getSheetByName(targetSheet);

    if (targetSheet === '퍼스트클래스결과') {
      // ── 퍼스트클래스 결과 설문 ──
      if (!sheet) {
        sheet = ss.insertSheet('퍼스트클래스결과');
        sheet.appendRow(['신청일시', '이름', '교회명', '직분', '연락처', '유형', '소감', '기대효과', '마케팅동의']);
        sheet.getRange(1, 1, 1, 9).setFontWeight('bold');
        sheet.setFrozenRows(1);
      }
      const timestamp = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss');
      sheet.appendRow([
        timestamp,
        data.name     || '',
        data.church   || '',
        data.position || '',
        data.contact  || '',
        data.type     || '',
        data.comment  || '',
        data.expects  || '',
        data.agree    || '',
      ]);

    } else if (targetSheet === '부부클래스결과') {
      // ── 부부클래스 결과 설문 ──
      if (!sheet) {
        sheet = ss.insertSheet('부부클래스결과');
        sheet.appendRow(['신청일시', '이름', '교회명', '직분', '연락처', '남편유형', '아내유형', '소감']);
        sheet.getRange(1, 1, 1, 8).setFontWeight('bold');
        sheet.setFrozenRows(1);
      }
      const timestamp = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss');
      sheet.appendRow([
        timestamp,
        data.name     || '',
        data.church   || '',
        data.position || '',
        data.contact  || '',
        data.typeA    || '',
        data.typeB    || '',
        data.comment  || '',
      ]);

    } else {
      // ── 얼리버드 신청 (기존) ──
      if (!sheet) {
        sheet = ss.insertSheet('얼리버드신청');
        sheet.appendRow(['신청일시', '이름', '교회명', '연락처', '관심클래스', '소감']);
        sheet.getRange(1, 1, 1, 6).setFontWeight('bold');
        sheet.setFrozenRows(1);
      }
      const timestamp = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss');
      sheet.appendRow([
        timestamp,
        data.name    || '',
        data.church  || '',
        data.contact || '',
        data.classes || '',
        data.comment || '',
      ]);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ result: 'success' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ result: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput('온유스쿨 ✓').setMimeType(ContentService.MimeType.TEXT);
}
