/**
 * 🛒 알구몬 크롤러 v2
 * - deal_id 기반 중복 체크
 * - 메모리 캐시로 성능 향상 
 * - 배치 저장으로 DB 효율성 개선
 * - 카테고리 간 중복 제거
 */

const axios = require('axios');
const cheerio = require('cheerio');
const { extractDealId, isValidDealId } = require('./deal-id');

// 알구몬 카테고리 설정
const CATEGORIES = {
  '1': { name: '기타', url: 'https://www.algumon.com/category/1' },
  '2': { name: '디지털/가전', url: 'https://www.algumon.com/category/2' },
  '3': { name: '컴퓨터', url: 'https://www.algumon.com/category/3' },
  '4': { name: '패션/뷰티', url: 'https://www.algumon.com/category/4' },
  '5': { name: '식품/건강', url: 'https://www.algumon.com/category/5' },
  '6': { name: '생활/취미', url: 'https://www.algumon.com/category/6' }
};

/**
 * 🎯 단일 카테고리 크롤링
 */
async function crawlCategory(categoryId) {
  const startTime = Date.now();
  const category = CATEGORIES[categoryId];
  
  if (!category) {
    throw new Error(`알 수 없는 카테고리: ${categoryId}`);
  }

  console.log(`🎯 카테고리 ${categoryId} (${category.name}) 크롤링 중...`);

  try {
    // HTTP 요청
    const { data: html } = await axios.get(category.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 30000
    });

    const $ = cheerio.load(html);
    const deals = [];

    // HTML에서 딜 요소들 추출
    $('li').each((index, element) => {
      const deal = extractDealFromElement($, element, categoryId, index);
      if (deal) {
        deals.push(deal);
      }
    });

    const duration = Date.now() - startTime;
    
    console.log(`✅ 카테고리 ${categoryId} (${category.name}) 완료: ${deals.length}개 (${duration}ms)`);
    
    return {
      success: true,
      categoryId,
      categoryName: category.name,
      deals,
      duration: `${duration}ms`
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ 카테고리 ${categoryId} 실패 (${duration}ms):`, error.message);
    
    return {
      success: false,
      categoryId,
      categoryName: category.name,
      deals: [],
      error: error.message,
      duration: `${duration}ms`
    };
  }
}

/**
 * 🛒 전체 카테고리 크롤링 (순차 처리)
 */
async function crawlAllCategories() {
  const startTime = Date.now();
  console.log('🛒 알구몬 전체 카테고리 크롤링 시작...');

  const results = [];
  const allDeals = [];

  // 순차 처리 (서버 부하 분산)
  for (const categoryId of Object.keys(CATEGORIES)) {
    try {
      const result = await crawlCategory(categoryId);
      results.push(result);
      
      if (result.success && result.deals.length > 0) {
        allDeals.push(...result.deals);
      }

      // 카테고리 간 1초 대기 (서버 친화적)
      if (categoryId !== '6') { // 마지막이 아니면
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

    } catch (error) {
      console.error(`❌ 카테고리 ${categoryId} 처리 중 오류:`, error);
      results.push({
        success: false,
        categoryId,
        categoryName: CATEGORIES[categoryId]?.name || 'Unknown',
        deals: [],
        error: error.message
      });
    }
  }

  // 카테고리 간 중복 제거 (deal_id 기준)
  const uniqueDeals = removeDuplicatesByDealId(allDeals);
  
  const totalDuration = Date.now() - startTime;
  const successCount = results.filter(r => r.success).length;
  
  console.log(`🏁 전체 크롤링 완료: ${successCount}/6 카테고리 성공, ${uniqueDeals.length}개 고유 딜 (${totalDuration}ms)`);

  return {
    success: successCount > 0,
    categories: results.length,
    successCount,
    failureCount: results.length - successCount,
    totalItems: allDeals.length,
    uniqueItems: uniqueDeals.length,
    duplicatesRemoved: allDeals.length - uniqueDeals.length,
    deals: uniqueDeals,
    results,
    duration: `${totalDuration}ms`
  };
}

/**
 * 💎 HTML 요소에서 딜 정보 추출
 */
function extractDealFromElement($, element, categoryId, index) {
  const $el = $(element);
  
  // 링크 찾기
  const anchor = $el.find('a[href*="/l/d/"]').first();
  if (!anchor.length) return null;

  const href = anchor.attr('href');
  if (!href) return null;

  // deal_id 추출 (핵심!)
  const dealId = extractDealId(href);
  if (!dealId || !isValidDealId(dealId)) return null;

  // 제목 추출
  const title = anchor.attr('title') || 
                anchor.text().trim() ||
                $el.find('.title, .deal-title').text().trim();

  if (!title || title.length < 3) return null;

  // 링크 정규화
  let dealUrl = href;
  if (href.startsWith('/')) {
    dealUrl = `https://www.algumon.com${href}`;
  }

  // 사이트명 추출
  const siteName = $el.find('.site-name, [data-site]').text().trim() ||
                   $el.find('[data-site]').attr('data-site') ||
                   title; // fallback

  // 가격 추출
  const priceInfo = extractPrice(title, $el);

  // 이미지 URL 추출
  const imageUrl = $el.find('img').attr('src') || '';

  // 설명 추출
  const description = $el.find('.description, .deal-desc').text().trim() || '';

  return {
    deal_id: dealId,                    // 핵심 고유 키
    id: `algumon-${dealId}`,           // 기존 호환성
    title,
    price: priceInfo.price,
    original_price: priceInfo.price,
    discount_rate: 0,
    has_price: priceInfo.hasPrice,
    price_text: priceInfo.priceText,
    category: 'general',
    image_url: imageUrl,
    tags: [],
    url: dealUrl,
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
 * 💰 가격 정보 추출 (기존 로직 유지)
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
 * 🔄 deal_id 기준으로 중복 제거
 */
function removeDuplicatesByDealId(deals) {
  const dealMap = new Map();
  
  deals.forEach(deal => {
    const dealId = deal.deal_id;
    if (dealId && !dealMap.has(dealId)) {
      dealMap.set(dealId, deal);
    }
  });
  
  return Array.from(dealMap.values());
}

/**
 * 🧪 테스트 함수들
 */
async function testCategory(categoryId) {
  console.log(`🧪 카테고리 ${categoryId} 테스트 시작...`);
  const result = await crawlCategory(categoryId);
  
  if (result.success) {
    console.log(`📝 샘플 아이템들:`);
    result.deals.slice(0, 3).forEach((deal, i) => {
      console.log(`${i+1}. deal_id: ${deal.deal_id}`);
      console.log(`   제목: ${deal.title}`);
      console.log(`   가격: ${deal.price ? deal.price.toLocaleString() + '원' : '가격정보없음'}`);
      console.log(`   링크: ${deal.url}`);
      console.log('');
    });
  }
  
  return result;
}

async function testDealIdExtraction() {
  console.log('🧪 deal_id 추출 테스트...');
  const result = await crawlCategory('1');
  
  if (result.success && result.deals.length > 0) {
    console.log('📊 deal_id 추출 결과:');
    result.deals.slice(0, 5).forEach((deal, i) => {
      console.log(`${i+1}. URL: ${deal.url.substring(0, 50)}...`);
      console.log(`   deal_id: ${deal.deal_id} (${isValidDealId(deal.deal_id) ? '✅' : '❌'})`);
    });
  }
}

module.exports = {
  crawlCategory,
  crawlAllCategories,
  removeDuplicatesByDealId,
  testCategory,
  testDealIdExtraction,
  CATEGORIES
};