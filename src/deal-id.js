/**
 * 🆔 알구몬 deal_id 추출 및 관리
 * - URL에서 고유 deal_id 추출
 * - 메모리 캐시로 중복 체크 성능 향상
 */

/**
 * 🔍 알구몬 URL에서 deal_id 추출
 * @param {string} url - 알구몬 딜 URL
 * @returns {string|null} deal_id 또는 null
 * 
 * 예시:
 * 'https://www.algumon.com/l/d/939539' → '939539'
 * 'https://www.algumon.com/l/d/939539?v=abc&t=123' → '939539'
 */
function extractDealId(url) {
  if (!url || typeof url !== 'string') {
    return null;
  }

  // 알구몬 딜 URL 패턴: /l/d/{숫자}
  const dealIdMatch = url.match(/\/l\/d\/(\d+)/);
  
  if (dealIdMatch && dealIdMatch[1]) {
    return dealIdMatch[1];
  }

  // 추가 패턴들 (혹시 모를 URL 변형 대응)
  const altPatterns = [
    /deal_id[=:](\d+)/,           // deal_id=123456
    /\/deal\/(\d+)/,              // /deal/123456  
    /id[=:](\d+)/                 // id=123456
  ];

  for (const pattern of altPatterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

/**
 * 📊 deal_id 통계 정보
 */
function getDealIdStats(dealId) {
  if (!dealId) return null;

  return {
    id: dealId,
    length: dealId.length,
    isNumeric: /^\d+$/.test(dealId),
    estimatedAge: estimateDealAge(dealId)
  };
}

/**
 * 📅 deal_id로 대략적인 생성 시기 추정
 * (숫자가 클수록 최신)
 */
function estimateDealAge(dealId) {
  const id = parseInt(dealId);
  
  if (isNaN(id)) return 'unknown';
  
  // 대략적인 기준 (실제 알구몬 데이터 분석 필요)
  if (id > 939000) return 'very_recent';  // 최근 며칠
  if (id > 900000) return 'recent';       // 최근 몇 주
  if (id > 800000) return 'old';          // 몇 달 전
  
  return 'very_old';                      // 오래된 딜
}

/**
 * ✅ deal_id 유효성 검사
 */
function isValidDealId(dealId) {
  if (!dealId || typeof dealId !== 'string') return false;
  
  // 숫자만 허용, 3-10자리 정도
  return /^\d{3,10}$/.test(dealId);
}

/**
 * 🧪 테스트 함수
 */
function testDealIdExtraction() {
  const testCases = [
    'https://www.algumon.com/l/d/939539',
    'https://www.algumon.com/l/d/939539?v=abc123&t=456',
    '/l/d/123456',
    'invalid-url',
    null,
    undefined
  ];

  console.log('🧪 deal_id 추출 테스트:');
  testCases.forEach(url => {
    const dealId = extractDealId(url);
    const isValid = isValidDealId(dealId);
    console.log(`URL: ${url} → deal_id: ${dealId} (${isValid ? '✅' : '❌'})`);
  });
}

module.exports = {
  extractDealId,
  getDealIdStats,
  estimateDealAge,
  isValidDealId,
  testDealIdExtraction
};