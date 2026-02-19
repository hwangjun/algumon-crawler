/**
 * 🛒 알구몬 크롤링 Background Worker v3
 * - Express 서버 없는 순수 백그라운드 워커
 * - deal_id 기반 중복 체크
 * - 메모리 캐시로 성능 향상
 * - 5분마다 자동 크롤링
 * - Render.com Background Worker 최적화
 */

require('dotenv').config();
const cron = require('node-cron');

const { crawlAllCategories, CATEGORIES } = require('./crawler-v2');
const { initSupabase, saveAlgumonDeals, cleanupOldAlgumonDeals } = require('./supabase-v2');
const { getCacheStats, getCacheEfficiency } = require('./deal-cache');

// 워커 시작 시간
const startTime = Date.now();

// 크롤링 통계
const stats = {
  totalRuns: 0,
  successRuns: 0,
  failedRuns: 0,
  totalDeals: 0,
  lastRun: null,
  lastSuccess: null,
  uptime: () => Math.floor((Date.now() - startTime) / 1000)
};

/**
 * 📊 워커 상태 로깅
 */
function logWorkerStatus() {
  const uptime = stats.uptime();
  const hours = Math.floor(uptime / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  
  console.log('');
  console.log('📊 =================================');
  console.log('🛒 알구몬 크롤링 워커 v3 상태');
  console.log('📊 =================================');
  console.log(`⏰ 가동 시간: ${hours}시간 ${minutes}분`);
  console.log(`🔄 총 실행: ${stats.totalRuns}회`);
  console.log(`✅ 성공: ${stats.successRuns}회`);
  console.log(`❌ 실패: ${stats.failedRuns}회`);
  console.log(`📈 성공률: ${stats.totalRuns > 0 ? Math.round(stats.successRuns / stats.totalRuns * 100) : 0}%`);
  console.log(`📦 총 수집 딜: ${stats.totalDeals.toLocaleString()}개`);
  console.log(`🕒 마지막 실행: ${stats.lastRun || '없음'}`);
  console.log(`🎯 마지막 성공: ${stats.lastSuccess || '없음'}`);
  
  // 캐시 통계
  const cacheStats = getCacheStats();
  const cacheEfficiency = getCacheEfficiency();
  
  console.log('');
  console.log('🧠 메모리 캐시 상태:');
  console.log(`📊 캐시 크기: ${cacheStats.currentSize.toLocaleString()}개`);
  console.log(`🚫 중복 차단: ${cacheStats.duplicatesBlocked.toLocaleString()}개`);
  console.log(`💾 메모리 사용: ${cacheStats.memoryUsageMB.toFixed(1)}MB`);
  console.log(`⚡ 적중률: ${cacheEfficiency.hitRate}%`);
  console.log(`💽 절약된 DB 쿼리: ${cacheEfficiency.savedDbQueries.toLocaleString()}개`);
  console.log('📊 =================================');
  console.log('');
}

/**
 * 🕐 크롤링 실행
 */
async function runCrawling() {
  const runId = Date.now();
  stats.totalRuns++;
  stats.lastRun = new Date().toLocaleString('ko-KR');
  
  console.log(`🚀 크롤링 시작 #${stats.totalRuns} (ID: ${runId})`);
  
  try {
    // 전체 카테고리 크롤링
    const startTime = Date.now();
    const results = await crawlAllCategories();
    const crawlTime = Date.now() - startTime;
    
    if (!results || results.length === 0) {
      throw new Error('크롤링 결과가 없습니다');
    }
    
    // 결과 통계
    const totalDeals = results.reduce((sum, r) => sum + (r.deals?.length || 0), 0);
    const successCategories = results.filter(r => r.success).length;
    
    console.log(`📊 크롤링 완료: ${totalDeals}개 딜, ${successCategories}/${results.length} 카테고리 성공 (${crawlTime}ms)`);
    
    if (totalDeals === 0) {
      throw new Error('수집된 딜이 0개입니다');
    }
    
    // Supabase 저장
    console.log('💾 Supabase 저장 시작...');
    const saveStartTime = Date.now();
    
    const allDeals = results.flatMap(r => r.deals || []);
    const saveResult = await saveAlgumonDeals(allDeals);
    
    const saveTime = Date.now() - saveStartTime;
    
    console.log(`✅ 저장 완료: ${saveResult?.saved || 0}개 저장, ${saveResult?.duplicates || 0}개 중복 (${saveTime}ms)`);
    
    // 성공 통계 업데이트
    stats.successRuns++;
    stats.totalDeals += totalDeals;
    stats.lastSuccess = new Date().toLocaleString('ko-KR');
    
    const totalTime = Date.now() - runId;
    console.log(`🎉 크롤링 #${stats.totalRuns} 성공! (총 ${totalTime}ms)`);
    
    // 20회마다 상태 로깅
    if (stats.totalRuns % 20 === 0) {
      logWorkerStatus();
    }
    
  } catch (error) {
    stats.failedRuns++;
    console.error(`❌ 크롤링 #${stats.totalRuns} 실패:`, error.message);
    
    // 연속 실패가 많으면 상세 로그
    if (stats.failedRuns > stats.successRuns && stats.totalRuns > 10) {
      console.error('🚨 연속 실패가 많습니다. 상세 에러:', error);
      logWorkerStatus();
    }
  }
}

/**
 * 🧹 오래된 딜 정리 (매일 자정)
 */
async function runCleanup() {
  console.log('🧹 오래된 딜 정리 시작...');
  
  try {
    const result = await cleanupOldAlgumonDeals(7); // 7일 이상된 딜 삭제
    console.log(`✅ 정리 완료: ${result?.deleted || 0}개 딜 삭제`);
  } catch (error) {
    console.error('❌ 정리 실패:', error.message);
  }
}

/**
 * 🚀 워커 초기화 및 시작
 */
async function startWorker() {
  console.log('🛒 알구몬 크롤링 Background Worker v3 시작...');
  console.log(`🕒 시작 시간: ${new Date().toLocaleString('ko-KR')}`);
  console.log('📍 모드: Background Worker (Express 서버 없음)');
  
  try {
    // Supabase 초기화
    await initSupabase();
    console.log('✅ Supabase 연결 및 캐시 로딩 성공');
    
    // 크론 작업 등록
    console.log('⏰ 크론 작업 등록 중...');
    
    // 매 5분마다 크롤링 (*/5 * * * *)
    cron.schedule('*/5 * * * *', async () => {
      await runCrawling();
    }, {
      scheduled: true,
      timezone: "Asia/Seoul"
    });
    
    // 매일 자정 정리 (0 0 * * *)
    cron.schedule('0 0 * * *', async () => {
      await runCleanup();
    }, {
      scheduled: true,
      timezone: "Asia/Seoul"
    });
    
    console.log('✅ 크론 작업 등록 완료');
    console.log('📅 스케줄:');
    console.log('   - 크롤링: 매 5분마다');
    console.log('   - 정리: 매일 자정');
    
    // 초기 상태 로깅
    logWorkerStatus();
    
    // 시작 후 30초 뒤 첫 크롤링 실행
    console.log('⏳ 30초 후 첫 크롤링 시작...');
    setTimeout(async () => {
      await runCrawling();
    }, 30000);
    
    // 매 1시간마다 상태 로깅
    setInterval(() => {
      logWorkerStatus();
    }, 3600000); // 1시간
    
    console.log('🎯 Background Worker 가동 중...');
    console.log('💡 종료하려면 Ctrl+C를 누르세요');
    
  } catch (error) {
    console.error('❌ 워커 초기화 실패:', error);
    process.exit(1);
  }
}

/**
 * 💀 종료 신호 처리
 */
function setupGracefulShutdown() {
  const shutdown = (signal) => {
    console.log('');
    console.log(`🔄 ${signal} 신호 받음, 워커 종료 중...`);
    logWorkerStatus();
    console.log('👋 알구몬 크롤링 Background Worker 종료');
    process.exit(0);
  };
  
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

// 예외 처리
process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('🚨 Uncaught Exception:', error);
  process.exit(1);
});

// 워커 시작
setupGracefulShutdown();
startWorker();