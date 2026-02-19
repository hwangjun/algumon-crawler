/**
 * 🧪 알구몬 크롤러 테스트
 * - 개별 카테고리 테스트
 * - 전체 크롤링 테스트
 * - 로컬 환경에서 실행
 */

require('dotenv').config();
const { testCategory, crawlAllCategories, CATEGORIES } = require('./crawler');
const { initSupabase } = require('./supabase');

/**
 * 🏥 시스템 헬스체크
 */
async function systemHealthCheck() {
  console.log('🏥 시스템 헬스체크 시작...');
  
  const checks = {
    nodeVersion: true,
    dependencies: true,
    supabaseConnection: false,
    networkAccess: false
  };
  
  try {
    // Node.js 버전 확인
    const nodeVersion = process.version;
    console.log(`✅ Node.js 버전: ${nodeVersion}`);
    
    // 의존성 확인
    try {
      require('axios');
      require('cheerio');
      require('@supabase/supabase-js');
      console.log('✅ 필수 의존성 로드 성공');
    } catch (error) {
      console.error('❌ 의존성 로드 실패:', error.message);
      checks.dependencies = false;
    }
    
    // Supabase 연결 테스트
    if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
      try {
        await initSupabase();
        console.log('✅ Supabase 연결 성공');
        checks.supabaseConnection = true;
      } catch (error) {
        console.error('❌ Supabase 연결 실패:', error.message);
      }
    } else {
      console.log('⚠️ Supabase 환경변수 없음');
    }
    
    // 네트워크 접근 테스트
    try {
      const axios = require('axios');
      await axios.get('https://www.algumon.com', { timeout: 5000 });
      console.log('✅ 알구몬 사이트 접근 가능');
      checks.networkAccess = true;
    } catch (error) {
      console.error('❌ 네트워크 접근 실패:', error.message);
    }
    
    const passedChecks = Object.values(checks).filter(Boolean).length;
    const totalChecks = Object.keys(checks).length;
    
    console.log(`\n🎯 헬스체크 결과: ${passedChecks}/${totalChecks} 통과`);
    
    if (checks.dependencies && checks.networkAccess) {
      console.log('✅ 기본 기능 동작 가능');
      return true;
    } else {
      console.log('❌ 필수 기능 실패');
      return false;
    }
    
  } catch (error) {
    console.error('❌ 헬스체크 오류:', error);
    return false;
  }
}

async function runTests() {
  console.log('🧪 알구몬 크롤러 테스트 시작...\n');
  
  try {
    // Supabase 초기화 (선택사항)
    if (process.env.SUPABASE_URL) {
      console.log('🗄️ Supabase 연결 테스트...');
      await initSupabase();
      console.log('✅ Supabase 연결 성공\n');
    } else {
      console.log('⚠️ Supabase 환경변수 없음 - 저장 기능 건너뛰기\n');
    }

    // 1. 개별 카테고리 테스트
    console.log('📋 개별 카테고리 테스트:\n');
    
    for (const [categoryId, categoryName] of Object.entries(CATEGORIES)) {
      console.log(`🎯 카테고리 ${categoryId} (${categoryName}) 테스트 중...`);
      
      const result = await testCategory(categoryId);
      
      console.log(`결과: ${result.success ? '✅' : '❌'} ${result.items?.length || 0}개 아이템`);
      
      if (result.success && result.items && result.items.length > 0) {
        // 첫 번째 아이템 샘플 출력
        const sample = result.items[0];
        console.log(`샘플: ${sample.title}`);
        console.log(`가격: ${sample.price_text}`);
        console.log(`링크: ${sample.url}`);
        console.log(`사이트: ${sample.site_name}`);
      }
      
      if (result.error) {
        console.log(`에러: ${result.error}`);
      }
      
      console.log('');
    }
    
    // 2. 전체 크롤링 테스트 (저장 없이)
    console.log('🚀 전체 크롤링 테스트 (저장 제외):\n');
    
    // 임시로 저장 기능 비활성화
    const originalSupabaseUrl = process.env.SUPABASE_URL;
    delete process.env.SUPABASE_URL;
    
    const allResults = await crawlAllCategories();
    
    // 환경변수 복원
    if (originalSupabaseUrl) {
      process.env.SUPABASE_URL = originalSupabaseUrl;
    }
    
    console.log('전체 결과:', {
      성공: allResults.success ? '✅' : '❌',
      카테고리수: allResults.categories,
      총아이템: allResults.totalItems,
      소요시간: allResults.duration
    });
    
    if (allResults.categoryResults) {
      console.log('\n📊 카테고리별 상세 결과:');
      for (const [categoryId, result] of Object.entries(allResults.categoryResults)) {
        const categoryName = CATEGORIES[categoryId];
        console.log(`- ${categoryId} (${categoryName}): ${result.success ? '✅' : '❌'} ${result.items?.length || 0}개`);
        if (result.error) {
          console.log(`  에러: ${result.error}`);
        }
      }
    }
    
    console.log('\n🎉 테스트 완료!');
    
  } catch (error) {
    console.error('❌ 테스트 실패:', error);
    process.exit(1);
  }
}

// 명령줄 인자 처리
const args = process.argv.slice(2);

if (args.length > 0) {
  const command = args[0];
  
  if (command === 'health') {
    // 헬스체크
    systemHealthCheck()
      .then(result => {
        process.exit(result ? 0 : 1);
      })
      .catch(error => {
        console.error('헬스체크 실패:', error);
        process.exit(1);
      });
      
  } else if (command === 'category' && args[1]) {
    // 특정 카테고리 테스트
    const categoryId = args[1];
    console.log(`🎯 카테고리 ${categoryId} 단독 테스트`);
    
    testCategory(categoryId)
      .then(result => {
        console.log('\n결과:', result);
        
        if (result.items && result.items.length > 0) {
          console.log('\n📝 샘플 아이템들:');
          result.items.slice(0, 3).forEach((item, index) => {
            console.log(`${index + 1}. ${item.title}`);
            console.log(`   가격: ${item.price_text}`);
            console.log(`   링크: ${item.url}`);
            console.log('');
          });
        }
        
        process.exit(result.success ? 0 : 1);
      })
      .catch(error => {
        console.error('에러:', error);
        process.exit(1);
      });
      
  } else if (command === 'full') {
    // 전체 크롤링 테스트 (저장 포함)
    console.log('🚀 전체 크롤링 테스트 (저장 포함)');
    
    crawlAllCategories()
      .then(result => {
        console.log('\n결과:', result);
        process.exit(result.success ? 0 : 1);
      })
      .catch(error => {
        console.error('에러:', error);
        process.exit(1);
      });
      
  } else {
    console.log('사용법:');
    console.log('  npm test                    # 전체 테스트');
    console.log('  npm test health             # 시스템 헬스체크');
    console.log('  npm test category 1         # 카테고리 1 테스트');
    console.log('  npm test full               # 전체 크롤링 (저장 포함)');
    process.exit(1);
  }
} else {
  // 전체 테스트 실행
  runTests();
}

// 예외 처리
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});