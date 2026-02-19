/**
 * 🧠 알구몬 딜 메모리 캐시
 * - deal_id 기반 중복 체크
 * - DB 쿼리 최소화로 성능 향상
 * - 서버 재시작 시 기존 데이터 로딩
 */

/**
 * 메모리 캐시 - Set으로 O(1) 조회 성능
 */
const seenDealIds = new Set();

/**
 * 캐시 통계
 */
let cacheStats = {
  totalLoaded: 0,
  duplicatesBlocked: 0,
  newDealsAdded: 0,
  loadedAt: null,
  lastUpdate: null
};

/**
 * 🔄 기존 deal_id들을 DB에서 로딩
 */
async function loadExistingDealIds(supabase, limit = 1000) {
  const startTime = Date.now();
  
  try {
    console.log('🔄 기존 deal_id 캐시 로딩 시작...');
    
    // deal_id 컬럼이 있는지 먼저 확인
    let data, error;
    
    try {
      // deal_id 컬럼으로 시도
      const result = await supabase
        .from('deals')
        .select('deal_id')
        .not('deal_id', 'is', null)  // deal_id가 있는 것만
        .order('created_at', { ascending: false })
        .limit(limit);
      
      data = result.data;
      error = result.error;
      
    } catch (dealIdError) {
      // deal_id 컬럼이 없으면 URL에서 추출
      console.log('📍 deal_id 컬럼 없음, URL에서 추출합니다...');
      
      const urlResult = await supabase
        .from('deals')
        .select('url')
        .eq('mall_name', '알구몬')
        .not('url', 'is', null)
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (urlResult.error) {
        error = urlResult.error;
      } else {
        // URL에서 deal_id 추출
        const { extractDealId } = require('./deal-id');
        data = urlResult.data
          ?.map(row => ({ deal_id: extractDealId(row.url) }))
          .filter(row => row.deal_id);
      }
    }

    if (error) {
      console.error('❌ 기존 ID 로딩 실패:', error);
      return false;
    }

    // Set에 추가
    seenDealIds.clear();
    let loadedCount = 0;
    
    if (data && data.length > 0) {
      data.forEach(row => {
        if (row.deal_id) {
          seenDealIds.add(row.deal_id);
          loadedCount++;
        }
      });
    }

    const duration = Date.now() - startTime;
    
    // 통계 업데이트
    cacheStats.totalLoaded = loadedCount;
    cacheStats.loadedAt = new Date().toISOString();
    cacheStats.lastUpdate = new Date().toISOString();

    console.log(`✅ ${loadedCount}개 deal_id 캐시 로딩 완료 (${duration}ms)`);
    return true;

  } catch (error) {
    console.error('❌ 캐시 로딩 중 오류:', error);
    return false;
  }
}

/**
 * ⚡ deal_id 중복 체크 (메모리 캐시 O(1))
 */
function isDuplicate(dealId) {
  if (!dealId) return false;
  
  const duplicate = seenDealIds.has(dealId);
  
  if (duplicate) {
    cacheStats.duplicatesBlocked++;
    cacheStats.lastUpdate = new Date().toISOString();
  }
  
  return duplicate;
}

/**
 * ➕ 새로운 deal_id 캐시에 추가
 */
function addDealId(dealId) {
  if (!dealId || seenDealIds.has(dealId)) {
    return false;
  }
  
  seenDealIds.add(dealId);
  cacheStats.newDealsAdded++;
  cacheStats.lastUpdate = new Date().toISOString();
  
  return true;
}

/**
 * ➕ 여러 deal_id 배치 추가
 */
function addDealIds(dealIds) {
  if (!Array.isArray(dealIds)) return 0;
  
  let addedCount = 0;
  
  dealIds.forEach(dealId => {
    if (addDealId(dealId)) {
      addedCount++;
    }
  });
  
  return addedCount;
}

/**
 * 📊 캐시 상태 조회
 */
function getCacheStats() {
  return {
    ...cacheStats,
    currentSize: seenDealIds.size,
    memoryUsageMB: Math.round((seenDealIds.size * 50) / 1024 / 1024 * 100) / 100, // 대략 추정
    uptime: cacheStats.loadedAt ? 
      Math.round((Date.now() - new Date(cacheStats.loadedAt).getTime()) / 1000) : 0
  };
}

/**
 * 🧹 캐시 정리 (메모리 절약)
 */
function clearCache() {
  const oldSize = seenDealIds.size;
  seenDealIds.clear();
  
  cacheStats = {
    totalLoaded: 0,
    duplicatesBlocked: 0,
    newDealsAdded: 0,
    loadedAt: null,
    lastUpdate: new Date().toISOString()
  };
  
  console.log(`🧹 캐시 정리 완료: ${oldSize}개 → 0개`);
}

/**
 * 🔍 캐시에서 deal_id 검색
 */
function searchDealIds(pattern) {
  const regex = new RegExp(pattern, 'i');
  return Array.from(seenDealIds).filter(id => regex.test(id));
}

/**
 * 📈 캐시 효율성 리포트
 */
function getCacheEfficiency() {
  const stats = getCacheStats();
  const totalRequests = stats.duplicatesBlocked + stats.newDealsAdded;
  
  return {
    hitRate: totalRequests > 0 ? 
      Math.round((stats.duplicatesBlocked / totalRequests) * 100) : 0,
    missRate: totalRequests > 0 ? 
      Math.round((stats.newDealsAdded / totalRequests) * 100) : 0,
    totalRequests,
    savedDbQueries: stats.duplicatesBlocked
  };
}

/**
 * 🧪 캐시 테스트
 */
function testCache() {
  console.log('🧪 캐시 테스트 시작...');
  
  // 테스트 데이터
  const testIds = ['939539', '939540', '939541'];
  
  // 추가 테스트
  console.log('1️⃣ 추가 테스트:');
  testIds.forEach(id => {
    const added = addDealId(id);
    console.log(`  ${id} 추가: ${added ? '✅' : '❌'}`);
  });
  
  // 중복 테스트
  console.log('2️⃣ 중복 체크 테스트:');
  testIds.forEach(id => {
    const duplicate = isDuplicate(id);
    console.log(`  ${id} 중복: ${duplicate ? '✅' : '❌'}`);
  });
  
  // 통계
  console.log('3️⃣ 캐시 통계:', getCacheStats());
  console.log('4️⃣ 효율성:', getCacheEfficiency());
}

module.exports = {
  loadExistingDealIds,
  isDuplicate,
  addDealId,
  addDealIds,
  getCacheStats,
  getCacheEfficiency,
  clearCache,
  searchDealIds,
  testCache
};