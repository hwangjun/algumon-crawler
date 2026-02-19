/**
 * 🛒 알구몬 크롤링 서버
 * - Render.com 무료 호스팅
 * - axios + cheerio 크롤링
 * - 1분마다 자동 실행
 * - Supabase 저장
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cron = require('node-cron');

const { crawlAllCategories } = require('./crawler');
const { initSupabase } = require('./supabase');

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
  lastSuccess: null,
  lastError: null
};

// 미들웨어
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());

// 정적 파일 (헬스체크용)
app.use('/health', express.static('public'));

/**
 * 🏠 홈페이지 - 서버 정보
 */
app.get('/', (req, res) => {
  res.json({
    service: '🛒 알구몬 크롤링 서버',
    version: '1.0.0',
    platform: 'Render.com',
    status: isServerReady ? 'running' : 'starting',
    uptime: Math.floor(process.uptime()),
    lastCrawl: lastCrawlTime,
    stats: crawlStats,
    categories: [
      { id: 1, name: '기타' },
      { id: 2, name: '디지털/가전' },
      { id: 3, name: '컴퓨터' },
      { id: 4, name: '패션/뷰티' },
      { id: 5, name: '식품/건강' },
      { id: 6, name: '생활/취미' }
    ],
    timestamp: new Date().toISOString()
  });
});

/**
 * 📊 상태 체크
 */
app.get('/status', (req, res) => {
  res.json({
    success: true,
    server: {
      status: isServerReady ? 'running' : 'starting',
      uptime: `${Math.floor(process.uptime())}s`,
      memory: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
      platform: 'Render.com',
      lastCrawl: lastCrawlTime
    },
    crawling: {
      ...crawlStats,
      successRate: crawlStats.totalRuns > 0 ? 
        Math.round((crawlStats.successRuns / crawlStats.totalRuns) * 100) : 0
    },
    timestamp: new Date().toISOString()
  });
});

/**
 * 🔧 수동 크롤링 실행
 */
app.post('/crawl', async (req, res) => {
  const startTime = Date.now();
  
  try {
    console.log('🔧 수동 크롤링 요청 받음');
    
    const results = await crawlAllCategories();
    const duration = Date.now() - startTime;
    
    res.json({
      success: true,
      message: '수동 크롤링 완료',
      results,
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
 * ⏰ 크론 상태
 */
app.get('/cron', (req, res) => {
  res.json({
    success: true,
    cron: {
      schedule: '*/1 * * * * (매분)',
      isRunning: true,
      platform: 'Render.com',
      totalRuns: crawlStats.totalRuns,
      lastRun: crawlStats.lastSuccess || crawlStats.lastError?.time
    },
    stats: crawlStats,
    timestamp: new Date().toISOString()
  });
});

/**
 * 🔍 실제 크롤링 수행
 */
async function performCrawling() {
  const startTime = Date.now();
  
  try {
    console.log('🛒 알구몬 크롤링 시작:', new Date().toISOString());
    
    crawlStats.totalRuns++;
    
    // 모든 카테고리 크롤링
    const results = await crawlAllCategories();
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // 성공 통계 업데이트
    crawlStats.successRuns++;
    crawlStats.lastSuccess = new Date().toISOString();
    crawlStats.totalItems += results.totalItems || 0;
    lastCrawlTime = new Date().toISOString();
    
    console.log(`✅ 크롤링 완료 (${duration}ms):`, {
      categories: results.categories || 0,
      totalItems: results.totalItems || 0,
      newItems: results.newItems || 0,
      duration: `${duration}ms`
    });
    
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
    
    console.error(`❌ 크롤링 실패 (${duration}ms):`, error);
  }
}

/**
 * 🚀 서버 시작
 */
async function startServer() {
  try {
    console.log('🛒 알구몬 크롤링 서버 시작...');
    
    // Supabase 초기화
    await initSupabase();
    console.log('✅ Supabase 연결 성공');
    
    // 서버 시작
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🌐 서버가 포트 ${PORT}에서 실행 중 (Render.com)`);
      isServerReady = true;
      
      // 시작 시 한 번 크롤링 실행
      setTimeout(performCrawling, 5000); // 5초 후 실행
    });
    
    // 1분마다 크롤링 실행 (Render.com에서 안정적)
    cron.schedule('*/1 * * * *', () => {
      console.log('⏰ 1분 스케줄 크롤링 시작...');
      performCrawling();
    });
    
    console.log('⏰ 크론 작업 등록 완료: 1분마다 실행');
    
  } catch (error) {
    console.error('❌ 서버 시작 실패:', error);
    process.exit(1);
  }
}

// Render.com 헬스체크 (30초마다 자동 호출)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// 404 처리
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: '🛒 알구몬 크롤링 서버입니다',
    availableEndpoints: [
      'GET /',
      'GET /status', 
      'POST /crawl',
      'GET /cron',
      'GET /health'
    ]
  });
});

// 에러 핸들러
app.use((error, req, res, next) => {
  console.error('서버 에러:', error);
  res.status(500).json({
    error: 'Internal Server Error',
    message: error.message
  });
});

// 프로세스 종료 처리
process.on('SIGTERM', () => {
  console.log('🔄 서버 종료 신호 받음');
  process.exit(0);
});

// 서버 시작
if (require.main === module) {
  startServer();
}

module.exports = app;