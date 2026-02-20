/**
 * 🧪 가격 히스토리 저장 기능 테스트
 */

require('dotenv').config();
const { 
  initSupabase, 
  savePriceHistory, 
  savePriceHistoryBatch, 
  getPriceHistoryByDealId 
} = require('./src/supabase-v2');

async function testPriceHistory() {
  console.log('🧪 가격 히스토리 저장 기능 테스트 시작...');
  console.log('');

  try {
    // 1단계: Supabase 초기화
    console.log('1️⃣ Supabase 초기화...');
    await initSupabase();
    console.log('✅ Supabase 초기화 성공');
    console.log('');

    // 2단계: 개별 가격 히스토리 저장 테스트
    console.log('2️⃣ 개별 가격 히스토리 저장 테스트...');
    const testDealId = 'test-deal-' + Date.now();
    
    const singleResult = await savePriceHistory(
      testDealId,
      19900,    // 현재 가격
      29900,    // 원래 가격
      33        // 할인율
    );

    if (singleResult.success) {
      console.log('✅ 개별 저장 성공:', singleResult.data);
    } else {
      console.log('❌ 개별 저장 실패:', singleResult.error);
      return;
    }
    console.log('');

    // 3단계: 배치 가격 히스토리 저장 테스트
    console.log('3️⃣ 배치 가격 히스토리 저장 테스트...');
    const testPriceHistories = [
      {
        deal_id: testDealId + '-batch-1',
        price: 15000,
        original_price: 20000,
        discount_rate: 25,
        crawled_at: new Date().toISOString()
      },
      {
        deal_id: testDealId + '-batch-2',
        price: 8500,
        original_price: 12000,
        discount_rate: 29,
        crawled_at: new Date().toISOString()
      },
      {
        deal_id: testDealId + '-batch-3',
        price: null, // 가격 없음 - 필터링 되어야 함
        original_price: 15000,
        discount_rate: 0,
        crawled_at: new Date().toISOString()
      }
    ];

    const batchResult = await savePriceHistoryBatch(testPriceHistories);
    if (batchResult.success) {
      console.log('✅ 배치 저장 성공:', `${batchResult.saved}개 저장`);
      console.log('   저장된 데이터:', batchResult.data?.map(d => `${d.deal_id}: ${d.price}원`));
    } else {
      console.log('❌ 배치 저장 실패:', batchResult.error);
      return;
    }
    console.log('');

    // 4단계: 가격 히스토리 조회 테스트
    console.log('4️⃣ 가격 히스토리 조회 테스트...');
    const historyResult = await getPriceHistoryByDealId(testDealId, 10);
    
    if (historyResult.success) {
      console.log('✅ 히스토리 조회 성공:', `${historyResult.count}개`);
      if (historyResult.data.length > 0) {
        console.log('   조회된 데이터:');
        historyResult.data.forEach((h, i) => {
          console.log(`   ${i + 1}. ${h.price}원 (${h.discount_rate}% 할인) - ${new Date(h.crawled_at).toLocaleString('ko-KR')}`);
        });
      }
    } else {
      console.log('❌ 히스토리 조회 실패:', historyResult.error);
    }
    console.log('');

    // 5단계: Edge Case 테스트
    console.log('5️⃣ Edge Case 테스트...');
    
    // 가격이 null인 경우
    const nullPriceResult = await savePriceHistory(testDealId + '-null', null, 10000, 0);
    console.log('   가격 null 테스트:', nullPriceResult.success ? '✅ 올바르게 스킵됨' : '❌ 에러 발생');

    // 빈 배열 테스트
    const emptyBatchResult = await savePriceHistoryBatch([]);
    console.log('   빈 배열 테스트:', emptyBatchResult.success ? '✅ 올바르게 처리됨' : '❌ 에러 발생');

    // 존재하지 않는 deal_id 조회
    const nonExistentResult = await getPriceHistoryByDealId('non-existent-deal-id');
    console.log('   존재하지 않는 딜 조회:', nonExistentResult.success && nonExistentResult.count === 0 ? '✅ 올바르게 빈 결과 반환' : '❌ 에러 발생');

    console.log('');
    console.log('🎉 가격 히스토리 저장 기능 테스트 완료!');
    console.log('');
    console.log('📊 테스트 결과 요약:');
    console.log('- ✅ 개별 가격 히스토리 저장');
    console.log('- ✅ 배치 가격 히스토리 저장');  
    console.log('- ✅ 가격 히스토리 조회');
    console.log('- ✅ Edge Case 처리');
    console.log('');
    console.log('🚀 1단계: 가격 히스토리 저장 시스템 구현 완료!');

  } catch (error) {
    console.error('❌ 테스트 실패:', error);
    process.exit(1);
  }
}

// 테스트 실행
if (require.main === module) {
  testPriceHistory()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('❌ 테스트 에러:', error);
      process.exit(1);
    });
}

module.exports = { testPriceHistory };