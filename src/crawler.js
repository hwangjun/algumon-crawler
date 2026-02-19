/**
 * 🕷️ 알구몬 크롤러 - axios + cheerio
 * - 카테고리 1-6 모두 크롤링
 * - 실제 브라우저 헤더 시뮬레이션
 * - 가격 정보 추출
 * - Supabase 저장
 */

const axios = require('axios');
const cheerio = require('cheerio');
const { saveAlgumonDeal, cleanupOldAlgumonDeals } = require('./supabase');

// 카테고리 매핑
const CATEGORIES = {
  1: '기타',
  2: '디지털/가전', 
  3: '컴퓨터',
  4: '패션/뷰티',
  5: '식품/건강',
  6: '생활/취미'
};

// 공통 헤더 (실제 브라우저 시뮬레이션)
const COMMON_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
  'Accept-Encoding': 'gzip, deflate, br',
  'DNT': '1',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'Referer': 'https://www.algumon.com/',
  'Cache-Control': 'max-age=0'
};

/**
 * 🛒 모든 카테고리 크롤링
 */
async function crawlAllCategories() {
  const startTime = Date.now();
  console.log('🛒 알구몬 전체 카테고리 크롤링 시작...');
  
  const results = {
    categories: 0,
    totalItems: 0,
    newItems: 0,
    skippedItems: 0,
    errorItems: 0,
    categoryResults: {}
  };

  try {
    // 병렬로 모든 카테고리 크롤링
    const categoryPromises = Object.keys(CATEGORIES).map(async (categoryId) => {
      try {
        const categoryResult = await crawlCategory(categoryId);
        return { categoryId, ...categoryResult };
      } catch (error) {
        console.error(`❌ 카테고리 ${categoryId} 크롤링 실패:`, error.message);
        return { 
          categoryId, 
          success: false, 
          items: [], 
          error: error.message 
        };
      }
    });

    const categoryResults = await Promise.all(categoryPromises);

    // 결과 통합
    for (const result of categoryResults) {
      const { categoryId, ...categoryData } = result;
      results.categoryResults[categoryId] = categoryData;

      if (result.success) {
        results.categories++;
        results.totalItems += result.items.length;

        // Supabase에 저장
        for (const item of result.items) {
          try {
            const saveResult = await saveAlgumonDeal(item);
            
            if (saveResult.success) {
              if (saveResult.inserted) {
                results.newItems++;
              } else if (saveResult.skipped) {
                results.skippedItems++;
              }
            } else {
              results.errorItems++;
              console.error(`❌ 저장 실패: ${item.title} - ${saveResult.error?.message}`);
            }
          } catch (error) {
            results.errorItems++;
            console.error(`❌ 저장 예외: ${item.title} - ${error.message}`);
          }
        }
      }
    }

    // 주기적으로 오래된 데이터 정리 (하루에 한 번)
    if (shouldCleanupToday()) {
      console.log('🧹 오래된 알구몬 데이터 정리 중...');
      await cleanupOldAlgumonDeals();
    }

    const duration = Date.now() - startTime;
    
    console.log(`✅ 전체 크롤링 완료 (${duration}ms):`, {
      categories: results.categories,
      totalItems: results.totalItems,
      newItems: results.newItems,
      skipped: results.skippedItems,
      errors: results.errorItems
    });

    return {
      success: true,
      duration: `${duration}ms`,
      ...results,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ 전체 크롤링 실패 (${duration}ms):`, error);
    
    return {
      success: false,
      error: error.message,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * 🎯 단일 카테고리 크롤링
 */
async function crawlCategory(categoryId) {
  const startTime = Date.now();
  const categoryName = CATEGORIES[categoryId];
  
  console.log(`🎯 카테고리 크롤링 시작: ${categoryId} (${categoryName})`);

  try {
    const url = `https://www.algumon.com/category/${categoryId}`;
    
    // axios로 페이지 가져오기
    const response = await axios.get(url, {
      headers: COMMON_HEADERS,
      timeout: 30000,
      maxRedirects: 3
    });

    if (response.status !== 200) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // cheerio로 HTML 파싱
    const $ = cheerio.load(response.data);
    
    // 딜 아이템 추출
    const deals = [];
    
    // 알구몬의 딜 아이템 선택자 (분석 결과에 따라 수정 필요)
    $('.product.post-list .product-body, .main-list li, .deal-item').each((index, element) => {
      try {
        const deal = extractDealFromElement($, element, categoryId, index);
        if (deal) {
          deals.push(deal);
        }
      } catch (error) {
        console.error(`❌ 아이템 추출 실패 (카테고리 ${categoryId}, 인덱스 ${index}):`, error.message);
      }
    });

    // 대체 선택자 시도 (위가 실패한 경우)
    if (deals.length === 0) {
      $('li').each((index, element) => {
        const $el = $(element);
        const title = $el.find('a').attr('title') || $el.find('.title').text().trim();
        const link = $el.find('a').attr('href');
        
        if (title && link && title.length > 5) {
          try {
            const deal = extractDealFromElement($, element, categoryId, index);
            if (deal) {
              deals.push(deal);
            }
          } catch (error) {
            // 무시 (대체 추출에서는 에러 로그 생략)
          }
        }
      });
    }

    const duration = Date.now() - startTime;
    
    console.log(`✅ 카테고리 ${categoryId} (${categoryName}) 완료: ${deals.length}개 (${duration}ms)`);
    
    return {
      success: true,
      items: deals,
      categoryId,
      categoryName,
      duration: `${duration}ms`
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ 카테고리 ${categoryId} 실패 (${duration}ms):`, error.message);
    
    return {
      success: false,
      items: [],
      categoryId,
      categoryName,
      error: error.message,
      duration: `${duration}ms`
    };
  }
}

/**
 * 💎 HTML 요소에서 딜 정보 추출
 */
function extractDealFromElement($, element, categoryId, index) {
  const $el = $(element);
  
  // 제목 추출
  const title = $el.find('a').attr('title') || 
                $el.find('.title, .deal-title, .product-title').text().trim() ||
                $el.find('a').text().trim();

  if (!title || title.length < 3) {
    return null;
  }

  // 링크 추출
  let link = $el.find('a').attr('href');
  if (link && !link.startsWith('http')) {
    link = `https://www.algumon.com${link}`;
  }

  if (!link) {
    return null;
  }

  // 사이트명 추출
  const siteName = $el.find('.site-name, [data-site]').text().trim() ||
                   $el.find('[data-site]').attr('data-site') ||
                   '알구몬';

  // 가격 추출 시도
  const priceInfo = extractPrice(title, $el);

  // 이미지 URL 추출
  const imageUrl = $el.find('img').attr('src') || '';

  // 설명 추출
  const description = $el.find('.description, .deal-desc').text().trim() || '';

  return {
    id: `algumon-${categoryId}-${Date.now()}-${index}`,
    title,
    price: priceInfo.price,
    original_price: priceInfo.price,
    discount_rate: 0,
    has_price: priceInfo.hasPrice,
    price_text: priceInfo.priceText,
    category: 'general',
    image_url: imageUrl,
    tags: [],
    url: link,
    description: description.substring(0, 200),
    pub_date: new Date().toISOString(),
    delivery_info: '원문 확인',
    
    // 알구몬 전용 필드
    algumon_category: categoryId,
    site_name: siteName,
    deal_score: 0
  };
}

/**
 * 💰 가격 정보 추출
 */
function extractPrice(title, $element = null) {
  // 제목에서 가격 패턴 추출
  const pricePatterns = [
    /(\d{1,3}(?:,\d{3})*)\s*원/,           // 12,000원
    /\((\d{1,3}(?:,\d{3})*)\s*원\)/,      // (12,000원)
    /(\d{1,3}(?:,\d{3})*)\s*원/g,         // 여러 가격 중 첫 번째
    /가격[:\s]*(\d{1,3}(?:,\d{3})*)/,     // 가격: 12000
    /(\d{1,3}(?:,\d{3})*)/                // 숫자만 (마지막 시도)
  ];

  for (const pattern of pricePatterns) {
    const match = title.match(pattern);
    if (match) {
      const priceStr = match[1].replace(/,/g, '');
      const price = parseInt(priceStr);
      
      // 합리적인 가격 범위 확인
      if (price >= 100 && price <= 10000000) {
        return {
          price,
          hasPrice: true,
          priceText: `${price.toLocaleString()}원`
        };
      }
    }
  }

  // HTML 요소에서 가격 추출 시도
  if ($element) {
    const priceElement = $element.find('.price, .deal-price, .product-price');
    if (priceElement.length > 0) {
      const priceText = priceElement.text().trim();
      const match = priceText.match(/(\d{1,3}(?:,\d{3})*)/);
      if (match) {
        const price = parseInt(match[1].replace(/,/g, ''));
        if (price >= 100 && price <= 10000000) {
          return {
            price,
            hasPrice: true,
            priceText: `${price.toLocaleString()}원`
          };
        }
      }
    }
  }

  return {
    price: null,
    hasPrice: false,
    priceText: '가격 정보 없음'
  };
}

/**
 * 🧹 정리 작업 필요 여부 확인
 */
function shouldCleanupToday() {
  const now = new Date();
  const today = now.toDateString();
  
  // 간단한 메모리 기반 체크 (프로세스 재시작시 초기화됨)
  if (global.lastCleanupDate !== today) {
    global.lastCleanupDate = today;
    return true;
  }
  
  return false;
}

/**
 * 🧪 단일 카테고리 테스트
 */
async function testCategory(categoryId) {
  console.log(`🧪 카테고리 ${categoryId} 테스트 시작...`);
  
  try {
    const result = await crawlCategory(categoryId);
    console.log('테스트 결과:', result);
    return result;
  } catch (error) {
    console.error('테스트 실패:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  crawlAllCategories,
  crawlCategory,
  testCategory,
  CATEGORIES
};