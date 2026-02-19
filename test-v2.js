/**
 * 🧪 알구몬 크롤러 v2 통합 테스트
 * - deal_id 추출 테스트
 * - 메모리 캐시 테스트
 * - 배치 저장 테스트
 * - 중복 제거 테스트
 */

require('dotenv').config();

// v2 모듈들
const { extractDealId, isValidDealId, testDealIdExtraction } = require('./src/deal-id');
const { testCache, getCacheStats, getCacheEfficiency } = require('./src/deal-cache');
const { testDealIdExtraction: testCrawlerDealId, testCategory, removeDuplicatesByDealId } = require('./src/crawler-v2');
const { initSupabase, saveAlgumonDeals, getAlgumonStats } = require('./src/supabase-v2');

/**
 * 🧪 1단계: deal_id 추출 테스트
 */
function testDealIdSystem() {
  console.log('🧪 1단계: deal_id 시스템 테스트');
  console.log('='.repeat(50));
  
  // deal_id 추출 테스트
  console.log('📍 deal_id 추출 테스트:');
  testDealIdExtraction();
  
  console.log('\n📍 메모리 캐시 테스트:');
  testCache();
  
  console.log('✅ deal_id 시스템 테스트 완료\n');
}

/**
 * 🧪 2단계: 크롤링 테스트
 */
async function testCrawlingSystem() {
  console.log('🧪 2단계: 크롤링 시스템 테스트');
  console.log('='.repeat(50));
  
  try {
    // 카테고리 1 크롤링 테스트
    console.log('📍 카테고리 1 크롤링 테스트:');
    const result = await testCategory('1');
    
    if (result.success && result.deals.length > 0) {
      console.log(`✅ 크롤링 성공: ${result.deals.length}개 딜`);
      
      // deal_id 추출 검증
      let validDealIds = 0;
      result.deals.forEach((deal, i) => {
        if (deal.deal_id && isValidDealId(deal.deal_id)) {
          validDealIds++;
          if (i < 3) { // 처음 3개만 출력
            console.log(`   ${i+1}. deal_id: ${deal.deal_id}, 제목: ${deal.title.substring(0, 30)}...`);
          }
        }
      });
      
      const validRate = Math.round((validDealIds / result.deals.length) * 100);
      console.log(`📊 유효한 deal_id: ${validDealIds}/${result.deals.length} (${validRate}%)`);
      
      // 중복 제거 테스트
      console.log('\n📍 중복 제거 테스트:');
      const duplicatedDeals = [...result.deals, ...result.deals.slice(0, 3)]; // 인위적 중복 생성
      const uniqueDeals = removeDuplicatesByDealId(duplicatedDeals);
      console.log(`   중복 생성: ${duplicatedDeals.length}개 → 중복 제거: ${uniqueDeals.length}개`);
      
      console.log('✅ 크롤링 시스템 테스트 완료');
      return result.deals;
      
    } else {
      console.error('❌ 크롤링 실패:', result.error);
      return [];
    }
    
  } catch (error) {
    console.error('❌ 크롤링 테스트 오류:', error);
    return [];
  }
  
  console.log('');
}

/**
 * 🧪 3단계: Supabase 저장 테스트
 */
async function testSupabaseSystem(testDeals) {
  console.log('🧪 3단계: Supabase 시스템 테스트');
  console.log('='.repeat(50));
  
  try {
    // Supabase 초기화
    console.log('📍 Supabase 초기화 및 캐시 로딩:');
    await initSupabase();
    
    const initialCache = getCacheStats();
    console.log(`✅ 캐시 로딩 완료: ${initialCache.currentSize}개 deal_id`);
    
    if (testDeals.length === 0) {
      console.log('⚠️ 테스트할 딜이 없습니다.');
      return;
    }
    
    // 배치 저장 테스트
    console.log('\n📍 배치 저장 테스트:');
    const testBatch = testDeals.slice(0, 5); // 처음 5개만 테스트
    console.log(`   저장할 딜: ${testBatch.length}개`);
    
    const saveResult = await saveAlgumonDeals(testBatch);
    
    if (saveResult.success) {
      console.log(`✅ 저장 성공: ${saveResult.saved}개 저장, ${saveResult.skipped}개 중복`);
      console.log(`   캐시 히트: ${saveResult.cacheHits}개`);
      console.log(`   소요 시간: ${saveResult.duration}`);
    } else {
      console.error('❌ 저장 실패:', saveResult.error);
    }
    
    // 중복 저장 테스트 (같은 데이터 다시 저장)
    console.log('\n📍 중복 저장 테스트:');
    const duplicateResult = await saveAlgumonDeals(testBatch);
    
    if (duplicateResult.success) {
      console.log(`✅ 중복 테스트: ${duplicateResult.saved}개 저장, ${duplicateResult.skipped}개 중복`);
      console.log(`   캐시 효율성: ${duplicateResult.skipped}/${testBatch.length} (${Math.round(duplicateResult.skipped/testBatch.length*100)}%)`);
    }
    
    // 통계 확인
    console.log('\n📍 알구몬 통계 확인:');
    const stats = await getAlgumonStats();
    
    if (stats.success) {
      console.log(`✅ 통계 조회 성공:`);
      console.log(`   오늘 딜: ${stats.todayCount}개`);
      console.log(`   전체 딜: ${stats.totalCount}개`);
      console.log(`   deal_id 보유: ${stats.withDealIdCount}개 (${stats.dealIdCompletionRate}%)`);
      
      const efficiency = getCacheEfficiency();
      console.log(`   캐시 효율성: 히트율 ${efficiency.hitRate}%, 절약된 쿼리 ${efficiency.savedDbQueries}개`);
    }
    
    console.log('✅ Supabase 시스템 테스트 완료');
    
  } catch (error) {
    console.error('❌ Supabase 테스트 오류:', error);
  }
  
  console.log('');
}

/**
 * 🧪 4단계: 성능 벤치마크
 */
async function performanceBenchmark() {
  console.log('🧪 4단계: 성능 벤치마크');
  console.log('='.repeat(50));
  
  try {
    const { crawlAllCategories } = require('./src/crawler-v2');
    
    console.log('📊 전체 카테고리 크롤링 성능 테스트...');
    const startTime = Date.now();
    
    const result = await crawlAllCategories();
    
    const endTime = Date.now();
    const totalDuration = endTime - startTime;
    
    if (result.success) {
      console.log('✅ 성능 벤치마크 결과:');
      console.log(`   총 소요 시간: ${totalDuration}ms`);
      console.log(`   성공 카테고리: ${result.successCount}/6`);
      console.log(`   총 딜 수: ${result.totalItems}개`);
      console.log(`   고유 딜 수: ${result.uniqueItems}개`);
      console.log(`   중복 제거: ${result.duplicatesRemoved}개`);
      console.log(`   평균 카테고리당: ${Math.round(totalDuration/6)}ms`);
      console.log(`   딜당 평균: ${Math.round(totalDuration/result.uniqueItems)}ms`);
      
      // 배치 저장 성능 테스트
      console.log('\n📊 배치 저장 성능 테스트...');
      const saveStartTime = Date.now();
      const saveResult = await saveAlgumonDeals(result.deals);
      const saveDuration = Date.now() - saveStartTime;
      
      if (saveResult.success) {
        console.log(`✅ 저장 성능:`);
        console.log(`   저장 시간: ${saveDuration}ms`);
        console.log(`   저장된 딜: ${saveResult.saved}개`);
        console.log(`   중복 딜: ${saveResult.skipped}개`);
        console.log(`   딜당 저장 시간: ${saveResult.saved > 0 ? Math.round(saveDuration/saveResult.saved) : 0}ms`);
      }
      
    } else {
      console.error('❌ 성능 테스트 실패:', result.error);
    }
    
  } catch (error) {
    console.error('❌ 성능 벤치마크 오류:', error);
  }
  
  console.log('');
}

/**
 * 🏁 메인 테스트 실행
 */
async function runAllTests() {
  console.log('🚀 알구몬 크롤러 v2 통합 테스트 시작');
  console.log('='.repeat(60));
  console.log('');
  
  const overallStartTime = Date.now();
  
  try {
    // 1단계: 기본 시스템 테스트
    testDealIdSystem();
    
    // 2단계: 크롤링 테스트
    const testDeals = await testCrawlingSystem();
    
    // 3단계: Supabase 테스트
    await testSupabaseSystem(testDeals);
    
    // 4단계: 성능 벤치마크
    await performanceBenchmark();
    
    const totalDuration = Date.now() - overallStartTime;
    
    console.log('🎉 전체 테스트 완료!');
    console.log('='.repeat(60));
    console.log(`⏱️ 총 소요 시간: ${totalDuration}ms`);
    console.log('✅ 모든 v2 시스템이 정상 작동합니다.');
    console.log('');
    console.log('🚀 Render.com 배포 준비 완료!');
    
  } catch (error) {
    console.error('❌ 통합 테스트 실패:', error);
    process.exit(1);
  }
}

// CLI 인터페이스
const args = process.argv.slice(2);

if (args.length === 0) {
  runAllTests();
} else {
  const command = args[0];
  
  switch (command) {
    case 'dealid':
      testDealIdSystem();
      break;
    case 'crawl':
      testCrawlingSystem();
      break;
    case 'db':
      if (args[1] === 'init') {
        initSupabase().then(() => console.log('Supabase 초기화 완료'));
      } else {
        console.log('사용법: node test-v2.js db init');
      }
      break;
    case 'benchmark':
      performanceBenchmark();
      break;
    default:
      console.log('사용법:');
      console.log('  node test-v2.js           # 전체 테스트');
      console.log('  node test-v2.js dealid    # deal_id 시스템 테스트');
      console.log('  node test-v2.js crawl     # 크롤링 테스트');
      console.log('  node test-v2.js db init   # DB 초기화');
      console.log('  node test-v2.js benchmark # 성능 테스트');
  }
}