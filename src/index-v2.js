/**
 * 🛒 알구몬 크롤링 서버 v2
 * - deal_id 기반 중복 체크
 * - 메모리 캐시로 성능 향상
 * - 배치 저장으로 DB 효율성 개선
 * - Render.com 최적화
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cron = require('node-cron');

const { crawlAllCategories, CATEGORIES } = require('./crawler-v2');
const { initSupabase, saveAlgumonDeals, getAlgumonStats, cleanupOldAlgumonDeals } = require('./supabase-v2');
const { getCacheStats, getCacheEfficiency } = require('./deal-cache');

const app = express();
const PORT = process.env.PORT || 3000;

// 글로벌 상태
let isServerReady = false;
let lastCrawlTime = null;
let crawlStats = {
  totalRuns: 0,
  successRuns: 0,
  failedRuns: 0,
  totalItems: 0,
  savedItems: 0,
  skippedItems: 0,
  lastSuccess: null,
  lastError: null
};

// 미들웨어
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());

/**
 * 🏠 홈페이지 - 서버 정보
 */
app.get('/', (req, res) => {
  const cacheStats = getCacheStats();
  const cacheEfficiency = getCacheEfficiency();
  
  res.json({
    service: '🛒 알구몬 크롤링 서버 v2',
    version: '2.0.0',
    platform: 'Render.com',
    status: isServerReady ? 'running' : 'starting',
    uptime: Math.floor(process.uptime()),
    features: [
      'deal_id 기반 중복 체크',
      '메모리 캐시 최적화',
      '배치 upsert 저장',
      '카테고리 간 중복 제거'
    ],
    lastCrawl: lastCrawlTime,
    stats: crawlStats,
    cache: {
      size: cacheStats.currentSize,
      hitRate: cacheEfficiency.hitRate,
      savedQueries: cacheEfficiency.savedDbQueries
    },
    categories: Object.entries(CATEGORIES).map(([id, info]) => ({
      id,
      name: info.name
    })),
    timestamp: new Date().toISOString()
  });
});

/**
 * 📊 상태 체크
 */
app.get('/status', (req, res) => {
  const cacheStats = getCacheStats();
  const cacheEfficiency = getCacheEfficiency();
  
  res.json({
    success: true,
    server: {
      status: isServerReady ? 'running' : 'starting',
      uptime: `${Math.floor(process.uptime())}s`,
      memory: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
      version: '2.0.0',
      lastCrawl: lastCrawlTime
    },
    crawling: {
      ...crawlStats,
      successRate: crawlStats.totalRuns > 0 ? 
        Math.round((crawlStats.successRuns / crawlStats.totalRuns) * 100) : 0,
      avgSaved: crawlStats.successRuns > 0 ? 
        Math.round(crawlStats.savedItems / crawlStats.successRuns) : 0
    },
    cache: {
      ...cacheStats,
      efficiency: cacheEfficiency
    },
    timestamp: new Date().toISOString()
  });
});

/**
 * 📊 상세 통계
 */
app.get('/stats', async (req, res) => {
  try {
    const supabaseStats = await getAlgumonStats();
    const cacheStats = getCacheStats();
    const cacheEfficiency = getCacheEfficiency();
    
    res.json({
      success: true,
      supabase: supabaseStats,
      cache: {
        ...cacheStats,
        efficiency: cacheEfficiency
      },
      crawling: crawlStats,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * 🔧 수동 크롤링 실행
 */
app.post('/crawl', async (req, res) => {
  const startTime = Date.now();
  
  try {
    console.log('🔧 수동 크롤링 요청 받음');
    
    const crawlResult = await performCrawling();
    const duration = Date.now() - startTime;
    
    res.json({
      success: crawlResult.success,
      message: crawlResult.success ? '수동 크롤링 완료' : '수동 크롤링 실패',
      result: crawlResult,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('❌ 수동 크롤링 실패:', error);
    
    res.status(500).json({
      success: false,
      error: error.message,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * 🧹 정리 작업 수동 실행
 */
app.post('/cleanup', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const result = await cleanupOldAlgumonDeals(days);
    
    res.json({
      success: result.success,
      message: `${days}일 이상 오래된 딜 정리`,
      deletedCount: result.deletedCount || 0,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * 🔍 실제 크롤링 수행
 */
async function performCrawling() {
  const startTime = Date.now();
  
  try {
    console.log('🛒 알구몬 크롤링 v2 시작:', new Date().toISOString());
    
    crawlStats.totalRuns++;
    
    // 1단계: 모든 카테고리 크롤링
    const crawlResult = await crawlAllCategories();
    
    if (!crawlResult.success || crawlResult.deals.length === 0) {
      throw new Error(`크롤링 실패 또는 데이터 없음: ${crawlResult.error || 'No deals found'}`);
    }

    // 2단계: 배치 저장
    console.log(`📦 ${crawlResult.deals.length}개 딜 배치 저장 중...`);
    const saveResult = await saveAlgumonDeals(crawlResult.deals);
    
    if (!saveResult.success) {
      throw new Error(`저장 실패: ${saveResult.error}`);
    }

    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // 성공 통계 업데이트
    crawlStats.successRuns++;
    crawlStats.lastSuccess = new Date().toISOString();
    crawlStats.totalItems += crawlResult.uniqueItems;
    crawlStats.savedItems += saveResult.saved;
    crawlStats.skippedItems += saveResult.skipped;
    lastCrawlTime = new Date().toISOString();
    
    const result = {
      success: true,
      categories: crawlResult.successCount,
      totalDeals: crawlResult.uniqueItems,
      savedDeals: saveResult.saved,
      skippedDeals: saveResult.skipped,
      cacheHits: saveResult.cacheHits,
      duplicatesRemoved: crawlResult.duplicatesRemoved,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    };

    console.log(`✅ 크롤링 v2 완료 (${duration}ms):`, {
      categories: result.categories,
      total: result.totalDeals,
      saved: result.savedDeals,
      skipped: result.skippedDeals,
      cacheHits: result.cacheHits
    });
    
    return result;
    
  } catch (error) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // 실패 통계 업데이트
    crawlStats.failedRuns++;
    crawlStats.lastError = {
      message: error.message,
      time: new Date().toISOString(),
      duration: `${duration}ms`
    };
    
    console.error(`❌ 크롤링 v2 실패 (${duration}ms):`, error);
    
    return {
      success: false,
      error: error.message,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * 🚀 서버 시작
 */
async function startServer() {
  try {
    console.log('🛒 알구몬 크롤링 서버 v2 시작...');
    
    // Supabase 초기화 + 캐시 로딩
    await initSupabase();
    console.log('✅ Supabase 연결 및 캐시 로딩 성공');
    
    // 서버 시작
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🌐 서버 v2가 포트 ${PORT}에서 실행 중 (Render.com)`);
      isServerReady = true;
      
      // 시작 시 한 번 크롤링 실행
      setTimeout(() => {
        console.log('🚀 초기 크롤링 시작...');
        performCrawling();
      }, 10000); // 10초 후 실행
    });
    
    // 5분마다 크롤링 실행
    cron.schedule('*/5 * * * *', () => {
      console.log('⏰ 5분 스케줄 크롤링 시작...');
      performCrawling();
    });
    
    // 매일 자정 정리 작업
    cron.schedule('0 0 * * *', () => {
      console.log('🧹 일일 정리 작업 시작...');
      cleanupOldAlgumonDeals(7);
    });
    
    console.log('⏰ 크론 작업 등록 완료: 5분마다 크롤링, 매일 자정 정리');
    
  } catch (error) {
    console.error('❌ 서버 시작 실패:', error);
    process.exit(1);
  }
}

// Render.com 헬스체크
app.get('/health', (req, res) => {
  const cacheStats = getCacheStats();
  
  res.status(200).json({
    status: 'healthy',
    version: '2.0.0',
    uptime: process.uptime(),
    cache: cacheStats.currentSize,
    timestamp: new Date().toISOString()
  });
});

// 404 처리
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: '🛒 알구몬 크롤링 서버 v2입니다',
    version: '2.0.0',
    availableEndpoints: [
      'GET /',
      'GET /status', 
      'GET /stats',
      'POST /crawl',
      'POST /cleanup',
      'GET /health'
    ]
  });
});

// 에러 핸들러
app.use((error, req, res, next) => {
  console.error('서버 에러:', error);
  res.status(500).json({
    error: 'Internal Server Error',
    message: error.message,
    version: '2.0.0'
  });
});

// 프로세스 종료 처리
process.on('SIGTERM', () => {
  console.log('🔄 서버 종료 신호 받음 (v2)');
  process.exit(0);
});

// 서버 시작
if (require.main === module) {
  startServer();
}

module.exports = app;