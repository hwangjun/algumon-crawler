/**
 * 🚀 알구몬 크롤러 Supabase 모듈 v2
 * - deal_id 기반 중복 체크 (URL → deal_id 업그레이드)
 * - 메모리 캐시로 성능 향상
 * - upsert 방식으로 DB 요청 최소화
 * - 기존 hotdeal-nextjs와 100% 호환
 */

const { createClient } = require('@supabase/supabase-js');
const { extractDealId, isValidDealId } = require('./deal-id');
const { 
  loadExistingDealIds, 
  isDuplicate, 
  addDealIds,
  getCacheStats,
  getCacheEfficiency 
} = require('./deal-cache');

let supabase = null;

/**
 * 🔗 Supabase 초기화 + 캐시 로딩
 */
async function initSupabase() {
  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    // 쓰기 권한을 위해 service_role key 우선 사용, fallback은 anon key
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 
                       process.env.SUPABASE_ANON_KEY || 
                       process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase 환경변수 필요: SUPABASE_URL, SUPABASE_ANON_KEY');
    }

    supabase = createClient(supabaseUrl, supabaseKey);
    
    // 연결 테스트
    const { data, error } = await supabase
      .from('deals')
      .select('id')
      .limit(1);
    
    if (error && error.code !== 'PGRST116') { // 빈 테이블은 괜찮음
      throw error;
    }

    console.log('✅ Supabase 연결 테스트 성공');

    // 메모리 캐시 로딩 (중요!)
    console.log('🔄 캐시 로딩 시도 중...');
    const cacheLoaded = await loadExistingDealIds(supabase, 2000); // 최근 2000개
    if (!cacheLoaded) {
      console.warn('⚠️ 캐시 로딩 실패 (deal_id 컬럼 없음?), URL 기반 중복 체크로 fallback');
    }

    return supabase;

  } catch (error) {
    console.error('❌ Supabase 초기화 실패:', error);
    throw error;
  }
}

/**
 * 💾 알구몬 딜 배치 저장 (upsert 방식)
 */
async function saveAlgumonDeals(dealsData) {
  if (!Array.isArray(dealsData) || dealsData.length === 0) {
    return { success: true, saved: 0, skipped: 0, errors: [] };
  }

  if (!supabase) {
    throw new Error('Supabase 초기화 필요');
  }

  const startTime = Date.now();
  let saved = 0;
  let skipped = 0;
  let errors = [];

  try {
    // 1단계: 메모리 캐시로 빠른 필터링
    const newDeals = [];
    
    for (const dealData of dealsData) {
      const dealId = extractDealId(dealData.url);
      
      if (!dealId || !isValidDealId(dealId)) {
        console.warn(`⚠️ deal_id 추출 실패: ${dealData.url}`);
        continue;
      }

      // 메모리 캐시 중복 체크 (O(1))
      if (isDuplicate(dealId)) {
        skipped++;
        continue;
      }

      // 포맷팅
      const formattedDeal = formatDealForSupabase(dealData, dealId);
      newDeals.push(formattedDeal);
    }

    console.log(`📊 1차 필터링: ${newDeals.length}개 신규, ${skipped}개 중복 (캐시)`);

    if (newDeals.length === 0) {
      return { success: true, saved: 0, skipped, errors: [], cacheHits: skipped };
    }

    // 2단계: DB upsert (unique 제약으로 최종 중복 방지)
    let data, error;
    
    try {
      // deal_id 기반 upsert 시도
      const result = await supabase
        .from('deals')
        .upsert(newDeals, {
          onConflict: 'deal_id',
          ignoreDuplicates: true  // 중복이면 무시 (업데이트 안함)
        })
        .select('deal_id');
      
      data = result.data;
      error = result.error;
      
    } catch (dealIdError) {
      // deal_id 컬럼이 없으면 일반 insert (URL 기반 중복 체크)
      console.log('📍 deal_id upsert 실패, 일반 insert로 fallback');
      
      // URL 기반 중복 체크 후 개별 insert
      let insertedCount = 0;
      const insertedDeals = [];
      
      for (const deal of newDeals) {
        try {
          // URL 기반 중복 확인
          const { data: existing } = await supabase
            .from('deals')
            .select('id')
            .eq('url', deal.url)
            .limit(1);
          
          if (!existing || existing.length === 0) {
            // 중복 아니면 insert
            const { data: inserted, error: insertError } = await supabase
              .from('deals')
              .insert([deal])
              .select('id')
              .single();
            
            if (!insertError && inserted) {
              insertedDeals.push({ deal_id: deal.deal_id });
              insertedCount++;
            }
          }
        } catch (e) {
          console.warn('개별 insert 실패:', e.message);
        }
      }
      
      data = insertedDeals;
      error = null;
    }

    if (error) {
      console.error('❌ 배치 저장 실패:', error);
      return { success: false, error, saved: 0, skipped, errors: [error] };
    }

    // 3단계: 성공한 deal_id들 캐시에 추가
    const savedDealIds = data?.map(row => row.deal_id).filter(Boolean) || [];
    addDealIds(savedDealIds);
    saved = savedDealIds.length;

    // 4단계: 가격 히스토리 저장
    let priceHistorySaved = 0;
    if (data && data.length > 0) {
      console.log(`💰 가격 히스토리 저장 시작... (${data.length}개)`);
      
      const priceHistories = data.map(deal => ({
        deal_id: deal.deal_id,
        price: deal.price,
        original_price: deal.original_price,
        discount_rate: deal.discount_rate || 0,
        crawled_at: new Date().toISOString()
      })).filter(h => h.price !== null && h.price !== undefined);

      if (priceHistories.length > 0) {
        const historyResult = await savePriceHistoryBatch(priceHistories);
        if (historyResult.success) {
          priceHistorySaved = historyResult.saved;
          console.log(`💰 가격 히스토리 저장 완료: ${priceHistorySaved}개`);
        } else {
          console.warn(`⚠️ 가격 히스토리 저장 실패:`, historyResult.error);
        }
      }
    }

    const duration = Date.now() - startTime;
    
    console.log(`✅ 배치 저장 완료: ${saved}개 저장, ${skipped}개 중복, ${priceHistorySaved}개 가격히스토리 (${duration}ms)`);
    
    return { 
      success: true, 
      saved, 
      skipped, 
      errors: [],
      cacheHits: skipped,
      priceHistorySaved,
      duration: `${duration}ms`,
      dealIds: savedDealIds
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ saveAlgumonDeals 오류 (${duration}ms):`, error);
    
    return { 
      success: false, 
      error: error.message, 
      saved: 0, 
      skipped, 
      errors: [error],
      duration: `${duration}ms`
    };
  }
}

/**
 * 🏗️ 딜 데이터를 Supabase 형태로 포맷
 */
function formatDealForSupabase(dealData, dealId) {
  return {
    id: `algumon-${dealId}`, // 기존 호환성 유지
    deal_id: dealId,         // 새로운 중복 체크 키
    title: dealData.title,
    price: dealData.price,
    original_price: dealData.original_price || dealData.price,
    discount_rate: dealData.discount_rate || 0,
    has_price: dealData.has_price,
    price_text: dealData.price_text,
    mall_name: '알구몬',
    mall_logo: '🛒',
    category: dealData.category || 'general',
    image_url: dealData.image_url || '',
    tags: dealData.tags || [],
    url: dealData.url,
    description: `[카테고리 ${dealData.algumon_category}] ${dealData.description || dealData.site_name || ''}`.trim(),
    pub_date: dealData.pub_date || new Date().toISOString(),
    source: 'Crawler-알구몬-v2',
    delivery_info: dealData.delivery_info || '원문 확인',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    crawled_at: new Date().toISOString()
  };
}

/**
 * 📊 알구몬 딜 통계
 */
async function getAlgumonStats() {
  try {
    if (!supabase) throw new Error('Supabase 초기화 필요');

    // 오늘 수집한 알구몬 딜 수
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { count: todayCount, error: todayError } = await supabase
      .from('deals')
      .select('*', { count: 'exact', head: true })
      .eq('mall_name', '알구몬')
      .gte('created_at', today.toISOString());

    if (todayError) throw todayError;

    // 총 알구몬 딜 수
    const { count: totalCount, error: totalError } = await supabase
      .from('deals')
      .select('*', { count: 'exact', head: true })
      .eq('mall_name', '알구몬');

    if (totalError) throw totalError;

    // deal_id 가진 딜 수
    const { count: withDealIdCount, error: dealIdError } = await supabase
      .from('deals')
      .select('*', { count: 'exact', head: true })
      .eq('mall_name', '알구몬')
      .not('deal_id', 'is', null);

    if (dealIdError) throw dealIdError;

    // 캐시 통계
    const cacheStats = getCacheStats();
    const cacheEfficiency = getCacheEfficiency();

    return {
      success: true,
      todayCount: todayCount || 0,
      totalCount: totalCount || 0,
      withDealIdCount: withDealIdCount || 0,
      dealIdCompletionRate: totalCount > 0 ? 
        Math.round((withDealIdCount / totalCount) * 100) : 0,
      cache: cacheStats,
      efficiency: cacheEfficiency,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error('❌ getAlgumonStats 오류:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 🔍 deal_id로 특정 딜 조회
 */
async function getDealById(dealId) {
  try {
    if (!supabase) throw new Error('Supabase 초기화 필요');

    const { data, error } = await supabase
      .from('deals')
      .select('*')
      .eq('deal_id', dealId)
      .eq('mall_name', '알구몬')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return { success: true, data: null, found: false };
      }
      throw error;
    }

    return { success: true, data, found: true };

  } catch (error) {
    console.error(`❌ getDealById(${dealId}) 오류:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * 🧹 오래된 알구몬 딜 정리 (deal_id 없는 것들 우선)
 */
async function cleanupOldAlgumonDeals(days = 7) {
  try {
    if (!supabase) throw new Error('Supabase 초기화 필요');

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    // 1. deal_id 없는 오래된 딜들 삭제
    const { data: withoutDealId, error: error1 } = await supabase
      .from('deals')
      .delete()
      .eq('mall_name', '알구몬')
      .is('deal_id', null)
      .lt('created_at', cutoffDate.toISOString())
      .select('id');

    // 2. 매우 오래된 딜들 삭제
    const veryOldDate = new Date();
    veryOldDate.setDate(veryOldDate.getDate() - (days * 2));

    const { data: veryOld, error: error2 } = await supabase
      .from('deals')
      .delete()
      .eq('mall_name', '알구몬')
      .lt('created_at', veryOldDate.toISOString())
      .select('id');

    const deletedCount = (withoutDealId?.length || 0) + (veryOld?.length || 0);

    if (deletedCount > 0) {
      console.log(`🧹 ${deletedCount}개 오래된 알구몬 딜 정리 완료`);
    }

    return { success: true, deletedCount };

  } catch (error) {
    console.error('❌ cleanupOldAlgumonDeals 오류:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 💰 가격 히스토리 저장
 */
async function savePriceHistory(dealId, currentPrice, originalPrice, discountRate) {
  try {
    if (!supabase) throw new Error('Supabase 초기화 필요');
    
    // 가격 정보가 없으면 저장하지 않음
    if (currentPrice === null || currentPrice === undefined) {
      return { success: true, message: 'No price to save' };
    }

    const historyData = {
      deal_id: dealId,
      price: currentPrice,
      original_price: originalPrice,
      discount_rate: discountRate || 0,
      crawled_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('price_history')
      .insert([historyData])
      .select();

    if (error) throw error;

    console.log(`💰 가격 히스토리 저장 성공: ${dealId} → ${currentPrice}원`);
    return { success: true, data: data[0] };

  } catch (error) {
    console.error(`❌ 가격 히스토리 저장 실패 (${dealId}):`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * 📈 특정 딜의 가격 히스토리 조회
 */
async function getPriceHistoryByDealId(dealId, limit = 30) {
  try {
    if (!supabase) throw new Error('Supabase 초기화 필요');

    const { data, error } = await supabase
      .from('price_history')
      .select('price, original_price, discount_rate, crawled_at, created_at')
      .eq('deal_id', dealId)
      .order('crawled_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    console.log(`📈 가격 히스토리 조회: ${dealId} → ${data?.length || 0}개`);
    return { success: true, data: data || [], count: data?.length || 0 };

  } catch (error) {
    console.error(`❌ 가격 히스토리 조회 실패 (${dealId}):`, error.message);
    return { success: false, error: error.message, data: [] };
  }
}

/**
 * 📊 배치 가격 히스토리 저장 (성능 최적화)
 */
async function savePriceHistoryBatch(priceHistoryData) {
  try {
    if (!Array.isArray(priceHistoryData) || priceHistoryData.length === 0) {
      return { success: true, saved: 0 };
    }

    if (!supabase) throw new Error('Supabase 초기화 필요');

    const validHistories = priceHistoryData.filter(history => 
      history.deal_id && 
      history.price !== null && 
      history.price !== undefined
    );

    if (validHistories.length === 0) {
      return { success: true, saved: 0 };
    }

    const { data, error } = await supabase
      .from('price_history')
      .insert(validHistories)
      .select('id, deal_id, price');

    if (error) throw error;

    console.log(`💰 배치 가격 히스토리 저장: ${data?.length || 0}개`);
    return { success: true, saved: data?.length || 0, data };

  } catch (error) {
    console.error('❌ 배치 가격 히스토리 저장 실패:', error.message);
    return { success: false, error: error.message, saved: 0 };
  }
}

module.exports = {
  initSupabase,
  saveAlgumonDeals,      // 새로운 배치 저장 함수
  savePriceHistory,      // 가격 히스토리 저장
  savePriceHistoryBatch, // 배치 가격 히스토리 저장
  getAlgumonStats,
  getDealById,
  cleanupOldAlgumonDeals,
  formatDealForSupabase,
  getPriceHistoryByDealId // 가격 히스토리 조회
};